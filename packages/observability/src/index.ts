/**
 * `magic-observability` — the platform-free half.
 *
 * Importing this pulls in no PostHog SDK at all, which is what makes it safe in
 * a shared package that both a browser bundle and a worker will import. The
 * SDKs live behind `magic-observability/{web,react,next,node,expo}`.
 */
export { createClientFacade } from "./core/facade.ts";
export type { ObservabilityAdapter } from "./core/facade.ts";
export {
  buildErrorProperties,
  describeValue,
  flattenContext,
  mergeContext,
  normalizeError,
} from "./core/context.ts";
export {
  DEFAULT_POSTHOG_HOST,
  disabledClient,
  firstNonEmpty,
  resolveConfig,
} from "./core/env.ts";
export type { Resolution } from "./core/env.ts";
export { createNoopClient } from "./core/noop.ts";
export type {
  BaseObservabilityOptions,
  DisabledReason,
  ErrorContext,
  ObservabilityClient,
  Properties,
} from "./core/types.ts";
