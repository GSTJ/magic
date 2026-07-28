import type { BaseObservabilityOptions } from "../core/types.ts";
import type { PostHogConfig } from "posthog-js";

import { DEFAULT_POSTHOG_HOST } from "../core/env.ts";

/**
 * Gabriel's defaults for `posthog-js`, and the reasoning behind each one.
 *
 * Kept in its own module, importing `posthog-js` for types only, so the
 * defaults can be unit-tested in plain Node without loading the SDK.
 */

/**
 * `posthog-js` gates behaviour changes behind a dated defaults bundle rather
 * than a major. This is the newest one as of 2026-07: history-API pageviews,
 * `head` script injection (no SSR hydration errors under Next), debounced
 * persistence writes, split storage, and the wider rageclick ignore list.
 */
export const WEB_DEFAULTS_DATE = "2026-05-30";

export type WebObservabilityOptions = BaseObservabilityOptions & {
  /**
   * Wrap `window.onerror` and `window.onunhandledrejection`. Defaults to
   * `true`, in code, on purpose — see the note in {@link buildWebOptions}.
   */
  captureExceptions?: boolean | undefined;
  /**
   * `false` disables session recording outright. Left unset (the default),
   * recording follows the project setting in PostHog, which is where replay is
   * turned on for a project in the first place.
   */
  sessionReplay?: boolean | undefined;
  /** `false` when the app captures its own pageviews. */
  capturePageview?: boolean | undefined;
  /** Escape hatch. Spread last, so it beats everything above. */
  posthogOptions?: Partial<PostHogConfig> | undefined;
};

export const buildWebOptions = (
  options: WebObservabilityOptions,
  host: string,
): Partial<PostHogConfig> => {
  const config: Partial<PostHogConfig> = {
    api_host: host || DEFAULT_POSTHOG_HOST,
    defaults: WEB_DEFAULTS_DATE,
    /**
     * PostHog's own docs make browser exception autocapture a *project*
     * setting, defaulting to whatever remote config says. Self-driving treats
     * error tracking as a signal source, so a product that ships without
     * someone remembering to flip a toggle in the UI produces no signals and
     * nobody finds out. Setting it here means the code is the source of truth
     * and a fresh project works on first deploy.
     */
    capture_exceptions: options.captureExceptions ?? true,
  };

  if (options.capturePageview === false) config.capture_pageview = false;
  if (options.sessionReplay === false) config.disable_session_recording = true;
  if (options.debug === true) config.debug = true;

  return { ...config, ...options.posthogOptions };
};

/**
 * Super properties registered right after init, so every event — including
 * `$exception` — can be filtered by environment and correlated to the build
 * whose source maps were uploaded.
 */
export const buildSuperProperties = (
  options: Pick<BaseObservabilityOptions, "environment" | "release">,
): Record<string, string> => {
  const properties: Record<string, string> = {};
  if (options.environment) properties["environment"] = options.environment;
  if (options.release) properties["release"] = options.release;
  return properties;
};
