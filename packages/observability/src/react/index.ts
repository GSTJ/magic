import type {
  BoundaryFallbackProps,
  ObservabilityBoundaryProps,
} from "../boundary.ts";
import type { ObservabilityClient } from "../core/types.ts";
import type { WebObservabilityOptions } from "../web/options.ts";

import type { ReactNode } from "react";

import { createElement } from "react";

import { PostHogProvider, usePostHog } from "@posthog/react";
import { posthog } from "posthog-js";

import { ObservabilityBoundary, reportBoundaryError } from "../boundary.ts";
import { getWebClient, initWebAnalytics } from "../web/index.ts";

/**
 * `magic-observability/react` — the React bindings for the browser SDK.
 *
 * Reaches `posthog-js`, `@posthog/react` and `react`, and nothing else. The
 * boundary is imported from `../boundary.ts` directly rather than through the
 * expo entry point, which is what keeps `posthog-react-native` out of a web
 * bundle; `scripts/validate-observability.mjs` fails the build if that ever
 * stops being true.
 */

export { ObservabilityBoundary, reportBoundaryError };
export type { BoundaryFallbackProps, ObservabilityBoundaryProps };
export { getWebClient, initWebAnalytics };
export type { WebObservabilityOptions };
/** PostHog's own hook, re-exported so products need one dependency, not two. */
export { usePostHog };

export type ObservabilityProviderProps = {
  children?: ReactNode;
  /**
   * The client from `initWebAnalytics`. Omitted, the module-level one is used —
   * which is what you want when init happened in `instrumentation-client.ts`.
   */
  client?: ObservabilityClient;
};

/**
 * Mounts `@posthog/react`'s provider around the app when telemetry is on, and
 * gets out of the way when it is not.
 *
 * The disabled branch matters: without a key, `posthog-js` was never
 * `init`-ed, and a provider handing an uninitialised client to `usePostHog`
 * gives every consumer a client whose `capture` silently queues forever. Not
 * rendering it means `usePostHog()` returns the default instance, which no-ops
 * exactly as intended.
 */
export const ObservabilityProvider = ({
  children,
  client,
}: ObservabilityProviderProps): ReactNode => {
  const resolved = client ?? getWebClient();
  if (!resolved.enabled) return children;
  return createElement(PostHogProvider, { client: posthog }, children);
};
