import type { BaseObservabilityOptions } from "../core/types.ts";
import type { PostHogOptions } from "posthog-node";

import { DEFAULT_POSTHOG_HOST } from "../core/env.ts";

/**
 * Defaults for `posthog-node`, split by how the process dies.
 *
 * A long-running worker can batch; a serverless function cannot, because the
 * runtime freezes the moment the handler returns and a queued batch is simply
 * lost. PostHog's docs say to set `flushAt: 1, flushInterval: 0` there, and
 * both pegada's API and chatmode's server config had arrived at that
 * independently.
 */

/**
 * `"worker"` — a daemon, a queue consumer, a CLI: batch, and flush on the way
 * out. `"serverless"` — a Lambda, a Vercel function, a Next route handler:
 * send immediately.
 */
export type NodeRuntimeKind = "worker" | "serverless";

export type NodeObservabilityOptions = BaseObservabilityOptions & {
  /** Defaults to `"worker"`. `magic-observability/next` defaults to `"serverless"`. */
  runtime?: NodeRuntimeKind | undefined;
  /**
   * Let `posthog-node` install its own `uncaughtException` and
   * `unhandledRejection` handlers. Defaults to `true` — error tracking is a
   * self-driving signal source, and a worker that only reports the errors
   * somebody remembered to wrap in a try/catch reports almost nothing.
   */
  autocaptureExceptions?: boolean | undefined;
  /** Overrides the runtime preset. */
  flushAt?: number | undefined;
  /** Overrides the runtime preset. */
  flushInterval?: number | undefined;
  /** Milliseconds. Defaults to 10000, the SDK's own default. */
  requestTimeout?: number | undefined;
  /** Escape hatch. Spread last. */
  posthogOptions?: Partial<PostHogOptions> | undefined;
};

const RUNTIME_PRESETS: Record<
  NodeRuntimeKind,
  { flushAt: number; flushInterval: number }
> = {
  worker: { flushAt: 20, flushInterval: 10_000 },
  serverless: { flushAt: 1, flushInterval: 0 },
};

export const buildNodeOptions = (
  options: NodeObservabilityOptions,
  host: string,
  defaultRuntime: NodeRuntimeKind = "worker",
): PostHogOptions => {
  const preset = RUNTIME_PRESETS[options.runtime ?? defaultRuntime];

  return {
    host: host || DEFAULT_POSTHOG_HOST,
    flushAt: options.flushAt ?? preset.flushAt,
    flushInterval: options.flushInterval ?? preset.flushInterval,
    requestTimeout: options.requestTimeout ?? 10_000,
    enableExceptionAutocapture: options.autocaptureExceptions ?? true,
    ...(options.debug === true ? { debug: true } : {}),
    ...options.posthogOptions,
  } satisfies PostHogOptions;
};
