import type { ErrorContext, ObservabilityClient } from "../core/types.ts";
import type { WebObservabilityOptions } from "./options.ts";

import { posthog } from "posthog-js";

import { disabledClient, resolveConfig } from "../core/env.ts";
import { createClientFacade } from "../core/facade.ts";
import { createNoopClient } from "../core/noop.ts";
import { webEnvHost, webEnvKey } from "./env.ts";
import { buildSuperProperties, buildWebOptions } from "./options.ts";

/**
 * `magic-observability/web` — browser PostHog, for Next's client bundle and for
 * Vite SPAs alike. `posthog-js` is the only SDK this module reaches.
 */

export { WEB_DEFAULTS_DATE, buildWebOptions } from "./options.ts";
export type { WebObservabilityOptions } from "./options.ts";

let current: ObservabilityClient | null = null;
let initialized = false;

/**
 * Initialise browser telemetry, or hand back a no-op when there is no key.
 *
 * Idempotent: React 19 strict mode mounts effects twice and Next's
 * `instrumentation-client.ts` can be evaluated more than once during a soft
 * navigation in dev. The second call returns the first client rather than
 * re-initialising `posthog-js`, which would reset the session.
 */
export const initWebAnalytics = (
  options: WebObservabilityOptions = {},
): ObservabilityClient => {
  if (initialized && current) return current;
  initialized = true;

  const resolved = resolveConfig(options, webEnvKey(), webEnvHost());
  if (!resolved.ok) {
    current = disabledClient(resolved.reason, options);
    return current;
  }

  posthog.init(resolved.key, buildWebOptions(options, resolved.host));

  const superProperties = buildSuperProperties(options);
  if (Object.keys(superProperties).length > 0)
    posthog.register(superProperties);

  current = createClientFacade(
    {
      capture: (event, properties) => {
        posthog.capture(event, properties);
      },
      captureError: (error, properties) => {
        posthog.captureException(error, properties);
      },
      identify: (distinctId, properties) => {
        posthog.identify(distinctId, properties);
      },
      reset: () => {
        posthog.reset();
      },
      register: (properties) => {
        posthog.register(properties);
      },
      /**
       * `posthog-js` batches on its own and flushes on `pagehide`; there is no
       * public flush worth exposing, and pretending otherwise would have
       * consumers `await` something that never mattered.
       */
      flush: async () => {},
      shutdown: async () => {},
    },
    options,
  );

  return current;
};

/**
 * The client `initWebAnalytics` built, for modules that are not components and
 * cannot use a hook. Before init — or outside the browser — a no-op.
 */
export const getWebClient = (): ObservabilityClient =>
  current ?? createNoopClient("missing-key");

/** `posthog-js` itself, for feature flags, surveys, replay controls. */
export const getPostHog = (): typeof posthog => posthog;

/** Shorthand for `getWebClient().captureError(...)`. */
export const captureError = (error: unknown, context?: ErrorContext): void => {
  getWebClient().captureError(error, context);
};

/** Shorthand for `getWebClient().capture(...)`. */
export const capture = (
  event: string,
  properties?: Record<string, unknown>,
): void => {
  getWebClient().capture(event, properties);
};

/**
 * Tests only. Nothing in a product should need to forget the client, and doing
 * it in a browser leaves `posthog-js` initialised behind your back.
 */
export const resetWebClientForTests = (): void => {
  current = null;
  initialized = false;
};
