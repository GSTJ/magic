<p align="center">
  <img alt="An error boundary catching a thrown error, beside the captureError event it ships to PostHog" src="https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-observability.png" />
</p>

<p align="center">Init once per platform. Catch errors in one boundary and ship them to PostHog in the same shape everywhere.</p>

<p align="center">
  <a aria-label="npm version" href="https://www.npmjs.com/package/magic-observability"><img alt="npm version" src="https://shieldcn.dev/npm/magic-observability.svg?variant=branded&size=xs&mode=light" /></a>
</p>

## How it works

1. Import the entry point for your platform. Each subpath reaches only its own SDK, so an Expo
   bundle can never pull in `posthog-js` and a browser chunk never touches `posthog-node`.
2. Call its `init*` once. It reads the platform's env vars, turns error tracking on, and returns a
   client with one surface: `capture`, `captureError`, `identify`, `flush`, `shutdown`.
3. Mount `ObservabilityBoundary` (the same component on web and React Native) and call
   `captureError` in catch blocks. Whatever was thrown is normalised to an `Error`, and context
   objects are flattened to dotted keys PostHog can filter on.
4. With no key resolved, `init*` returns a no-op client: every method exists, nothing is sent,
   nothing is logged.

```ts
import { initWebAnalytics } from "magic-observability/web";

const client = initWebAnalytics();
client.captureError(error, { screen: "checkout" });
```

Before this existed, pegada and chatmode had each hand-rolled their own PostHog wiring, with
different designs, and the other five repos had nothing. This is pegada's shape, generalised, with
chatmode's error normalisation folded in.

## Install

```sh
pnpm add magic-observability
```

Plus the one SDK your platform needs; the entry point table below says which.

## Entry points

Every platform gets its own subpath because `posthog-js` in a Hermes bundle is dead weight and
`posthog-node` in a browser chunk does not build at all. Importing `magic-observability/expo` can
never reach `posthog-js`, and `scripts/validate-observability.mjs` in this repo walks the built
module graph on every CI run to prove it.

| Import                         | For                                      | You install                    |
| ------------------------------ | ---------------------------------------- | ------------------------------ |
| `magic-observability`          | types and helpers, no SDK                | nothing                        |
| `magic-observability/web`      | browser: Next client bundle, Vite SPA    | `posthog-js`                   |
| `magic-observability/react`    | React bindings: provider, boundary, hook | `posthog-js`, `@posthog/react` |
| `magic-observability/next`     | Next server: `onRequestError`, RSC, API  | `posthog-node`                 |
| `magic-observability/node`     | workers, queue consumers, CLIs           | `posthog-node`                 |
| `magic-observability/expo`     | Expo and bare React Native               | `posthog-react-native`         |
| `magic-observability/boundary` | the error boundary on its own            | `react`                        |

All five SDKs are optional peers. You install the one you use.

## Environment variables

| Variable                   | Read by                          |
| -------------------------- | -------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`  | `/web` (and `/next` as fallback) |
| `NEXT_PUBLIC_POSTHOG_HOST` | `/web` (and `/next` as fallback) |
| `EXPO_PUBLIC_POSTHOG_KEY`  | `/expo`                          |
| `EXPO_PUBLIC_POSTHOG_HOST` | `/expo`                          |
| `POSTHOG_KEY`              | `/node`, `/next` (preferred)     |
| `POSTHOG_HOST`             | `/node`, `/next` (preferred)     |

Host defaults to `https://us.i.posthog.com`.

The server variables are read first on `/next`, so a server can point at a different project than
the browser; the `NEXT_PUBLIC_` ones are the fallback because one project for both is the normal
case.

Vite does not populate `process.env` in the browser, so a Vite SPA has to pass the key explicitly:

```ts
initWebAnalytics({ key: import.meta.env.VITE_POSTHOG_KEY });
```

`import.meta.env.VITE_*` is only substituted where it is written literally, and a library cannot
write it on your behalf. Next and Expo are fine; their bundlers substitute
`process.env.NEXT_PUBLIC_*` / `process.env.EXPO_PUBLIC_*` inside `node_modules` too, which is why
this package reads them directly.

## No key

With no key resolved, every `init*` returns a no-op client: every method is there, every method
does nothing, and nothing is written to the console. A repo cloned without a `.env` boots and runs.
A dev who never set a token is not nagged on every render.

```ts
const client = initWebAnalytics();
client.enabled; // false
client.disabledReason; // "missing-key"
client.captureError(error); // fine. goes nowhere.
```

This package never writes to the console, in any code path. If you want to know, ask:

```ts
initNode({
  onDisabled: (reason) => logger.debug(`telemetry off: ${reason}`),
  onInternalError: (error) => logger.warn(`posthog threw: ${error.message}`),
});
```

`enabled: false` forces it off with a key present; `enabled: !__DEV__` is the usual shape.

## Next.js (App Router)

Three files. The client half and the server half never import each other.

**`instrumentation-client.ts`** runs before hydration:

```ts
import { initWebAnalytics } from "magic-observability/web";

initWebAnalytics({
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
});
```

**`app/providers.tsx`** holds the provider plus a top-level boundary:

```tsx
"use client";

import { getWebClient } from "magic-observability/web";
import {
  ObservabilityBoundary,
  ObservabilityProvider,
} from "magic-observability/react";

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <ObservabilityProvider>
    <ObservabilityBoundary
      client={getWebClient()}
      fallback={<SomethingWentWrong />}
    >
      {children}
    </ObservabilityBoundary>
  </ObservabilityProvider>
);
```

**`instrumentation.ts`** catches server errors, at the root of the project:

```ts
import { createRequestErrorHandler } from "magic-observability/next";

export const register = () => {};
export const onRequestError = createRequestErrorHandler();
```

Anywhere else on the server (route handlers, server actions, RSCs):

```ts
import { captureServerError, getServerClient } from "magic-observability/next";

try {
  await chargeCard(order);
} catch (error) {
  captureServerError(error, { orderId: order.id, distinctId: session.userId });
  throw error;
}

getServerClient().capture("order_failed", { distinctId: session.userId });
```

`app/error.tsx` and `app/global-error.tsx` are client components, so they use the browser client:

```tsx
"use client";

import { useEffect } from "react";
import { captureError } from "magic-observability/web";

export default function Error({ error }: { error: Error }) {
  useEffect(() => {
    captureError(error, { source: "app-error-boundary" });
  }, [error]);

  return <SomethingWentWrong />;
}
```

### Source maps

Uploading them is a build-time concern with a first-party plugin, outside this package:

```sh
pnpm add -D @posthog/nextjs-config
```

```ts
// next.config.ts
import { withPostHogConfig } from "@posthog/nextjs-config";

export default withPostHogConfig(nextConfig, {
  personalApiKey: process.env.POSTHOG_API_KEY!,
  projectId: process.env.POSTHOG_PROJECT_ID,
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  sourcemaps: { enabled: true, deleteAfterUpload: true },
});
```

`POSTHOG_API_KEY` is a personal API key with write access to error tracking, and it has to reach
the hosting provider's build environment; a value that only lives in a local `.env` never uploads
anything from CI.

## Expo and bare React Native

```sh
npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization
```

Bare RN swaps those for `@react-native-async-storage/async-storage react-native-device-info
react-native-localize`, plus `pod install`.

**`src/services/observability.ts`** constructs once and exports the handle:

```ts
import { initExpo } from "magic-observability/expo";
import * as Updates from "expo-updates";

export const observability = initExpo({
  environment: process.env.EXPO_PUBLIC_ENV ?? "development",
  release: Updates.manifest?.metadata?.updateGroup,
});
```

`release` matters more here than anywhere else: an OTA update ships new JavaScript under the same
binary, and without the update group id a stack trace cannot be matched to the source maps that
were uploaded for it.

**`app/_layout.tsx`**:

```tsx
import type { BoundaryFallbackProps } from "magic-observability/expo";

import { PostHogProvider } from "posthog-react-native";
import {
  ObservabilityBoundary,
  getExpoPostHog,
} from "magic-observability/expo";
import { observability } from "@/services/observability";

export default function RootLayout() {
  const posthog = getExpoPostHog();

  const tree = (
    <ObservabilityBoundary client={observability} fallback={ErrorScreen}>
      <Stack />
    </ObservabilityBoundary>
  );

  // No key in this build: render the app without the provider.
  if (!posthog) return tree;

  return <PostHogProvider client={posthog}>{tree}</PostHogProvider>;
}

const ErrorScreen = ({ error, reset }: BoundaryFallbackProps) => (
  <View>
    <Text>Something went wrong.</Text>
    <Button title="Try again" onPress={reset} />
  </View>
);
```

The two-step (build the client, then hand it to the provider) is the only documented way to get
both configured error tracking and the provider's screen tracking. `<PostHogProvider apiKey
options>` cannot configure `errorTracking`; `new PostHog(...)` gives you no provider.

Same free-function pattern as `/node` for calls outside a component: `import { capture,
captureError } from "magic-observability/expo"`.

### Defaults

`initExpo` turns on uncaught exceptions, unhandled rejections and native crashes (the last one
also needs `@posthog/react-native-plugin` installed; it's a documented no-op without it). Console
capture is off by default, deduplicated against the boundary this package ships; turn it back on
with `initExpo({ errorTracking: { console: ["error", "warn"] } })` if your app has no boundary.

In dev, React propagates errors to the global handler even when a boundary caught them, so you
will see some things twice. That does not happen in production builds.

## Vite / React SPA

```tsx
import { initWebAnalytics } from "magic-observability/web";
import {
  ObservabilityBoundary,
  ObservabilityProvider,
} from "magic-observability/react";

const client = initWebAnalytics({
  key: import.meta.env.VITE_POSTHOG_KEY,
  host: import.meta.env.VITE_POSTHOG_HOST,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ObservabilityProvider client={client}>
      <ObservabilityBoundary client={client} fallback={<SomethingWentWrong />}>
        <App />
      </ObservabilityBoundary>
    </ObservabilityProvider>
  </StrictMode>,
);
```

Source maps go through `@posthog/cli` rather than the Next plugin.

## Node workers and CLIs

```ts
import { captureError, initNode, shutdownNode } from "magic-observability/node";

initNode({
  environment: process.env.NODE_ENV,
  release: process.env.GIT_SHA,
  globalHandlers: true,
});

try {
  await drainQueue();
} catch (error) {
  captureError(error, { queue: "emails" });
} finally {
  await shutdownNode();
}
```

`initNode` batches by default (`flushAt: 20`, `flushInterval: 10s`) and turns on `posthog-node`'s
own exception autocapture. Call `shutdownNode()` on the way out; a process that exits without it
drops whatever was still queued.

`globalHandlers: true` additionally wires `uncaughtException`, `unhandledRejection` and
SIGINT/SIGTERM. It is opt-in because installing those listeners changes what Node does: the
default "print and exit non-zero" is suppressed the moment a listener exists. This helper puts the
exit back and bounds the flush, but it should still be something you asked for.

Serverless (a Lambda, a Vercel function, anything frozen the instant the handler returns) wants
every event sent immediately:

```ts
initNode({ runtime: "serverless" }); // flushAt: 1, flushInterval: 0
```

## Client surface

Every entry point returns the same thing.

```ts
type ObservabilityClient = {
  readonly enabled: boolean;
  readonly disabledReason: "missing-key" | "explicitly-disabled" | null;
  capture(event: string, properties?: Properties): void;
  captureError(error: unknown, context?: ErrorContext): void;
  identify(distinctId: string, properties?: Properties): void;
  reset(): void;
  register(properties: Properties): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
};
```

Feature flags, surveys and replay controls are not wrapped; reach the raw SDK through
`getPostHog()`, `getPostHogNode()`, `getPostHogServer()` or `getExpoPostHog()`. Wrapping them
would mean tracking four SDKs' worth of drift for no gain.

### captureError

```ts
captureError(error, {
  distinctId: "user-42", // server only; routed positionally instead of as a property
  orderId: order.id,
  request: { path: "/checkout", method: "POST" }, // becomes request.path, request.method
});
```

Whatever was thrown becomes an `Error`. `throw "nope"` and `throw { code: 500 }` are legal and
produce an exception event with no stack and no message. An error-shaped object (a string
`message`, usually a `name` and `stack`) is rebuilt; that is what a serialised error crossing a
worker or an RPC boundary looks like, and its stack is the useful one. Anything else becomes a
`NonError`, which is searchable in PostHog and tells you the throw site is wrong.

Nested context is flattened to dotted keys, three levels deep, with `undefined` dropped instead of
sent as `null`. PostHog's property filters work on scalars; a nested object is a property nobody
can filter on.

A throw from inside the SDK is swallowed and offered to `onInternalError`. The caller is usually a
`catch` block, and losing the original error to a reporting bug is the worst available outcome.

### ObservabilityBoundary

The same component on web and React Native.

```tsx
<ObservabilityBoundary
  client={client}
  fallback={ErrorScreen} // component, or a plain node, or omit for nothing
  context={{ screen: "checkout" }}
  resetKeys={[pathname]} // clears the error when the route changes
  onError={(error, info) => toast(error.message)}
>
  {children}
</ObservabilityBoundary>
```

The fallback component gets `{ error, componentStack, reset }`. With a disabled client it still
renders the fallback and reports nothing.

It is a plain React class component built with `createElement`, so it needs neither a JSX runtime
nor `react-native`'s types, which is what lets one implementation serve both platforms.

## Manual PostHog setup

This package sets everything it can set from code. These are the parts that live in PostHog's UI
or in a repo's secrets, and no amount of TypeScript will do them for you.

1. Create the project and copy its `phc_...` token. One project per product.
2. Put the token in the environments that build: Vercel for the Next apps, EAS for the Expo apps,
   GitHub Actions secrets for anything CI needs. Nothing in this repo can do that.
3. Session replay is off until you turn it on per project (`/settings/project-replay`). This
   package leaves the browser setting alone and defaults mobile replay to off; both are then yours
   to enable.
4. Exception autocapture for native crashes is gated on the project-level "Enable exception
   autocapture" setting (`/settings/project-error-tracking#exception-autocapture`) even though the
   JavaScript side is configured in code here.
5. A personal API key with write access to error tracking, for source map upload in CI
   (`POSTHOG_API_KEY`, plus `POSTHOG_PROJECT_ID`).

### Self-driving

PostHog's self-driving loop (scouts watching your data, reports landing in an inbox, an agent
opening pull requests) is open beta, and it is a product loop with nothing to import. What it
needs from the application, this package already does:

- Events flowing. Pageviews and screen views are on by default here.
- Error tracking, its first in-app signal source. On by default on all three platforms, in code.
- Session replay, its second. Off by default here; see the replay point above.

The rest is manual and one-time, per organisation:

```sh
npx @posthog/wizard self-driving
```

Run it in the repo. It wants a GitHub repository the agents can work in, and AI data processing
enabled at the organisation level (`/docs/posthog-ai/allow-access`); it checks and tells you how.
Pricing is $15 per pull request with the first three each month free; reports are always free, and
a $150 org billing limit is set automatically.

Each scout report also fires a real `$scout_report_emitted` event into your own project, carrying
`skill_name`, `title`, `priority`, `actionability`, `report_kind` and `report_url`. It is
queryable in SQL, insights and alerts like any other event.
