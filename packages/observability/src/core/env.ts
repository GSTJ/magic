import type {
  BaseObservabilityOptions,
  DisabledReason,
  ObservabilityClient,
} from "./types.ts";

import { createNoopClient } from "./noop.ts";

/**
 * Resolving "is there a key, and where does it point".
 *
 * The decision rules live here; the actual `process.env` reads live in a
 * per-entry-point `env.ts` beside each `index.ts`. Two reasons for that split.
 * `magic-oxlint-config` bans direct `process.env` access outside `**\/env.ts`,
 * so the reads have to be in a file with that name. And Next's DefinePlugin and
 * Metro's Babel transform only substitute `process.env.NEXT_PUBLIC_FOO` when it
 * is written out literally — a shared `process.env[name]` lookup would read as
 * `undefined` in a browser or Hermes bundle, silently, which is the worst way
 * for telemetry to be off.
 */

/** PostHog US cloud. Override with `host` (or the platform's `*_POSTHOG_HOST`). */
export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/** First value that is a non-blank string, or `undefined`. */
export const firstNonEmpty = (
  ...values: readonly (string | null | undefined)[]
): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
};

/** A resolved key plus host, or the reason there is no client to build. */
export type Resolution =
  | { readonly ok: true; readonly key: string; readonly host: string }
  | { readonly ok: false; readonly reason: DisabledReason };

export const resolveConfig = (
  options: Pick<BaseObservabilityOptions, "key" | "host" | "enabled">,
  envKey: string | undefined,
  envHost: string | undefined,
): Resolution => {
  if (options.enabled === false)
    return { ok: false, reason: "explicitly-disabled" };

  const key = firstNonEmpty(options.key, envKey);
  if (!key) return { ok: false, reason: "missing-key" };

  return {
    ok: true,
    key,
    host: firstNonEmpty(options.host, envHost) ?? DEFAULT_POSTHOG_HOST,
  };
};

/**
 * The no-op client, with the caller's `onDisabled` fired exactly once. Every
 * entry point funnels through here so "disabled" behaves identically on all
 * five platforms.
 */
export const disabledClient = (
  reason: DisabledReason,
  options: Pick<BaseObservabilityOptions, "onDisabled">,
): ObservabilityClient => {
  options.onDisabled?.(reason);
  return createNoopClient(reason);
};
