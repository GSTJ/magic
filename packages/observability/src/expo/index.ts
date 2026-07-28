import type {
  BoundaryFallbackProps,
  ObservabilityBoundaryProps,
} from "../boundary.ts";
import type {
  ErrorContext,
  ObservabilityClient,
  Properties,
} from "../core/types.ts";
import type {
  ConsoleLogLevel,
  ExpoErrorTrackingOptions,
  ExpoObservabilityOptions,
} from "./options.ts";

import { PostHog } from "posthog-react-native";

import { ObservabilityBoundary, reportBoundaryError } from "../boundary.ts";
import { disabledClient, resolveConfig } from "../core/env.ts";
import { createClientFacade } from "../core/facade.ts";
import { createNoopClient } from "../core/noop.ts";
import { expoEnvHost, expoEnvKey } from "./env.ts";
import { buildExpoOptions, buildExpoSuperProperties } from "./options.ts";

/**
 * `magic-observability/expo` — Expo and bare React Native.
 * `posthog-react-native` and `react` are the only things this module reaches.
 *
 * The SDK has two init styles and they do not compose: `<PostHogProvider apiKey
 * options>` gives you screen tracking and autocapture but no way to configure
 * `errorTracking`, while `new PostHog(...)` configures everything and gives you
 * no provider. The documented way to get both is to construct the client and
 * hand it over — `<PostHogProvider client={posthog}>` — which is what
 * {@link initExpo} plus {@link getExpoPostHog} exist to make routine.
 */

export { ObservabilityBoundary, reportBoundaryError };
export type { BoundaryFallbackProps, ObservabilityBoundaryProps };
export { buildExpoOptions };
export type {
  ConsoleLogLevel,
  ExpoErrorTrackingOptions,
  ExpoObservabilityOptions,
};

/**
 * The RN SDK types its property bags as JSON, which `Record<string, unknown>`
 * cannot prove it satisfies. Everything reaching an adapter has already been
 * through `flattenContext`, which only ever emits strings, finite numbers,
 * booleans and null — so the assertion is describing a real invariant rather
 * than papering over one.
 */
type EventProperties = NonNullable<Parameters<PostHog["register"]>[0]>;

const asEventProperties = (properties: Properties): EventProperties =>
  properties as EventProperties;

type ExpoState = {
  client: ObservabilityClient;
  posthog: PostHog | null;
};

let state: ExpoState | null = null;

/**
 * Build the mobile client, or a no-op when there is no key. Idempotent: fast
 * refresh re-evaluates modules, and a second `new PostHog(...)` would start a
 * second queue against the same storage.
 */
export const initExpo = (
  options: ExpoObservabilityOptions = {},
): ObservabilityClient => {
  if (state) return state.client;

  const resolved = resolveConfig(options, expoEnvKey(), expoEnvHost());
  if (!resolved.ok) {
    state = { client: disabledClient(resolved.reason, options), posthog: null };
    return state.client;
  }

  const posthog = new PostHog(
    resolved.key,
    buildExpoOptions(options, resolved.host),
  );

  const superProperties = buildExpoSuperProperties(options);
  if (Object.keys(superProperties).length > 0) {
    void posthog.register(superProperties);
  }

  const client = createClientFacade(
    {
      capture: (event, properties) => {
        posthog.capture(event, asEventProperties(properties));
      },
      captureError: (error, properties) => {
        posthog.captureException(error, asEventProperties(properties));
      },
      identify: (distinctId, properties) => {
        posthog.identify(distinctId, asEventProperties(properties));
      },
      reset: () => {
        posthog.reset();
      },
      register: (properties) => {
        void posthog.register(asEventProperties(properties));
      },
      flush: async () => {
        await posthog.flush();
      },
      /**
       * The React Native SDK has no public `shutdown` — a phone app does not
       * exit, it gets backgrounded, and the SDK persists its queue for the next
       * launch. Flushing is the strongest thing available.
       */
      shutdown: async () => {
        await posthog.flush();
      },
    },
    options,
  );

  state = { client, posthog };
  return client;
};

/** The client `initExpo` built, for services and stores that are not components. */
export const getExpoClient = (): ObservabilityClient =>
  state?.client ?? createNoopClient("missing-key");

/**
 * The raw SDK instance, for `<PostHogProvider client={...}>` and for feature
 * flags. `null` when telemetry is off — pass it straight to the provider
 * anyway; the README snippet shows the guard.
 */
export const getExpoPostHog = (): PostHog | null => state?.posthog ?? null;

/** Shorthand for `getExpoClient().captureError(...)`. */
export const captureError = (error: unknown, context?: ErrorContext): void => {
  getExpoClient().captureError(error, context);
};

/** Shorthand for `getExpoClient().capture(...)`. */
export const capture = (
  event: string,
  properties?: Record<string, unknown>,
): void => {
  getExpoClient().capture(event, properties);
};

/** Tests only. */
export const resetExpoClientForTests = (): void => {
  state = null;
};
