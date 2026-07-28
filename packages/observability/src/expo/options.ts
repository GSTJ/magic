import type { BaseObservabilityOptions } from "../core/types.ts";
import type { PostHogOptions } from "posthog-react-native";

import { DEFAULT_POSTHOG_HOST } from "../core/env.ts";

/**
 * Defaults for `posthog-react-native`.
 *
 * The interesting one is `console`. PostHog's own docs warn that a
 * `PostHogErrorBoundary` plus `console: ["error"]` reports every render error
 * twice, because React logs caught errors to the console itself. This package
 * ships a boundary and the README tells you to mount it, so the default here is
 * `console: []` — deduplicated by construction. Products that deliberately have
 * no boundary can pass `errorTracking: { console: ["error", "warn"] }` back.
 *
 * `posthog-react-native` is imported for types only, so this module can be
 * unit-tested in Node without pulling in `react-native`.
 */

/** Levels `posthog-react-native` will turn into `$exception` events. */
export type ConsoleLogLevel = "debug" | "info" | "log" | "warn" | "error";

export type ExpoErrorTrackingOptions = {
  /** `ErrorUtils.setGlobalHandler`. Defaults to `true`. */
  uncaughtExceptions?: boolean | undefined;
  /** Global `onunhandledrejection`. Defaults to `true`. */
  unhandledRejections?: boolean | undefined;
  /**
   * Console levels captured as exceptions. Defaults to `[]` — see the note at
   * the top of this file.
   */
  console?: readonly ConsoleLogLevel[] | undefined;
  /**
   * Native iOS/Android crashes. Defaults to `true`. Needs
   * `@posthog/react-native-plugin` installed and native symbols uploaded; with
   * the plugin missing it is a documented no-op, so leaving it on costs
   * nothing and means the day the plugin lands, it works.
   */
  nativeCrashes?: boolean | undefined;
};

export type ExpoObservabilityOptions = BaseObservabilityOptions & {
  errorTracking?: ExpoErrorTrackingOptions | undefined;
  /**
   * Mobile session replay. Defaults to `false` — it is off in the SDK by
   * default, it is expensive, and it needs turning on per project in PostHog
   * anyway. Self-driving lists replay as a signal source, so turn it on
   * deliberately when you want that.
   */
  sessionReplay?: boolean | undefined;
  /** Escape hatch. Spread last. */
  posthogOptions?: Partial<PostHogOptions> | undefined;
};

export const buildExpoOptions = (
  options: ExpoObservabilityOptions,
  host: string,
): PostHogOptions => {
  const errorTracking = options.errorTracking ?? {};

  return {
    host: host || DEFAULT_POSTHOG_HOST,
    enableSessionReplay: options.sessionReplay ?? false,
    errorTracking: {
      autocapture: {
        uncaughtExceptions: errorTracking.uncaughtExceptions ?? true,
        unhandledRejections: errorTracking.unhandledRejections ?? true,
        console: [...(errorTracking.console ?? [])],
        nativeCrashes: errorTracking.nativeCrashes ?? true,
      },
    },
    ...(options.debug === true ? { enableDebug: true } : {}),
    ...options.posthogOptions,
  } as PostHogOptions;
};

/**
 * Super properties for the mobile client. `release` is where an OTA update id
 * belongs — pegada registers `Updates.manifest.metadata.updateGroup` here, and
 * without it a JS-only update's stack traces cannot be matched to the source
 * maps that were uploaded for it.
 */
export const buildExpoSuperProperties = (
  options: Pick<BaseObservabilityOptions, "environment" | "release">,
): Record<string, string> => {
  const properties: Record<string, string> = {};
  if (options.environment) properties["environment"] = options.environment;
  if (options.release) properties["release"] = options.release;
  return properties;
};
