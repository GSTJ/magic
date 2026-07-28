import type { ErrorContext, ObservabilityClient } from "../core/types.ts";
import type { NodeObservabilityOptions } from "../node/options.ts";

import { PostHog } from "posthog-node";

import { disabledClient, resolveConfig } from "../core/env.ts";
import { createClientFacade } from "../core/facade.ts";
import { createNoopClient } from "../core/noop.ts";
import { createNodeAdapter, serverDefaultContext } from "../node/adapter.ts";
import { buildNodeOptions } from "../node/options.ts";
import { distinctIdFromCookieHeader } from "./cookie.ts";
import { isNodeRuntime, nextEnvHost, nextEnvKey } from "./env.ts";

/**
 * `magic-observability/next` — the **server** half of a Next app: the
 * `onRequestError` hook, the server client, and the cookie parsing that joins
 * a server exception to the person who hit the route.
 *
 * The client half is `magic-observability/web` and
 * `magic-observability/react`. They are separate entry points because they are
 * separate bundles: this module reaches `posthog-node`, and a browser chunk
 * that pulled it in would be both broken and enormous.
 */

export { distinctIdFromCookieHeader };
export type { NodeObservabilityOptions as NextServerOptions };

/** The parts of Next's `onRequestError` arguments this package looks at. */
export type NextErrorRequest = {
  path?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined> | undefined;
};

export type NextErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
};

/**
 * Next's `onRequestError` signature. Typed structurally rather than imported
 * from `next` so this package does not take a dependency on the framework.
 */
export type RequestErrorHandler = (
  error: unknown,
  request: NextErrorRequest,
  context?: NextErrorContext,
) => Promise<void>;

type NextState = {
  client: ObservabilityClient;
  posthog: PostHog | null;
};

let state: NextState | null = null;

/**
 * The server-side singleton, built lazily on first use.
 *
 * `"serverless"` timings by default — `flushAt: 1, flushInterval: 0` — because
 * a Vercel function is frozen the instant the response is returned and a
 * batched event never leaves. Pass `runtime: "worker"` on a long-lived Node
 * server to get batching back.
 */
export const getServerClient = (
  options: NodeObservabilityOptions = {},
): ObservabilityClient => {
  if (state) return state.client;

  const resolved = resolveConfig(options, nextEnvKey(), nextEnvHost());
  if (!resolved.ok) {
    state = { client: disabledClient(resolved.reason, options), posthog: null };
    return state.client;
  }

  const posthog = new PostHog(
    resolved.key,
    buildNodeOptions(options, resolved.host, "serverless"),
  );

  const client = createClientFacade(createNodeAdapter(posthog), {
    ...options,
    defaultContext: serverDefaultContext(options),
  });

  state = { client, posthog };
  return client;
};

/** `posthog-node` itself, for feature flags in server components. */
export const getPostHogServer = (): PostHog | null => state?.posthog ?? null;

/** Shorthand for `getServerClient().captureError(...)`. */
export const captureServerError = (
  error: unknown,
  context?: ErrorContext,
): void => {
  getServerClient().captureError(error, context);
};

/**
 * The `onRequestError` export for `instrumentation.ts`.
 *
 * Does three things PostHog's guide asks for and that are easy to get wrong by
 * hand: skips the edge runtime, pulls `distinct_id` off the `ph_phc_*_posthog`
 * cookie so the exception joins the right person, and attaches the route
 * metadata Next hands over.
 */
export const createRequestErrorHandler = (
  options: NodeObservabilityOptions = {},
): RequestErrorHandler => {
  return async (error, request, context) => {
    if (!isNodeRuntime()) return;

    const client = getServerClient(options);
    if (!client.enabled) return;

    const distinctId = distinctIdFromCookieHeader(request.headers?.["cookie"]);

    client.captureError(error, {
      ...(distinctId ? { distinctId } : {}),
      source: "next-request",
      request: {
        path: request.path,
        method: request.method,
      },
      ...(context ? { next: { ...context } } : {}),
    });

    await client.flush();
  };
};

/** Flush and close. `await` it from a `register()` teardown or a test. */
export const shutdownServerClient = async (): Promise<void> => {
  const active = state;
  state = null;
  await active?.client.shutdown();
};

/** A no-op client, for code that runs before `getServerClient` ever did. */
export const noopServerClient = (): ObservabilityClient =>
  createNoopClient("missing-key");
