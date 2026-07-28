import type { ErrorContext, ObservabilityClient } from "../core/types.ts";
import type { GlobalHandlerOptions } from "./global-handlers.ts";
import type { NodeObservabilityOptions, NodeRuntimeKind } from "./options.ts";

import { PostHog } from "posthog-node";

import { disabledClient, resolveConfig } from "../core/env.ts";
import { createClientFacade } from "../core/facade.ts";
import { createNoopClient } from "../core/noop.ts";
import { createNodeAdapter, serverDefaultContext } from "./adapter.ts";
import { nodeEnvHost, nodeEnvKey } from "./env.ts";
import { installGlobalHandlers } from "./global-handlers.ts";
import { buildNodeOptions } from "./options.ts";

/**
 * `magic-observability/node` — workers, queue consumers, CLIs, and any server
 * that is not a Next app. `posthog-node` is the only SDK this module reaches.
 */

export { installGlobalHandlers, buildNodeOptions };
export type { GlobalHandlerOptions, NodeObservabilityOptions, NodeRuntimeKind };

export type NodeInitOptions = NodeObservabilityOptions & {
  /**
   * Wire `uncaughtException`/`unhandledRejection`/SIGTERM through
   * {@link installGlobalHandlers} as well. `true` uses the defaults; an object
   * configures them. Off by default, because `autocaptureExceptions` already
   * covers the common case and taking over the process's crash behaviour
   * should be something you asked for.
   */
  globalHandlers?: boolean | GlobalHandlerOptions | undefined;
};

type NodeState = {
  client: ObservabilityClient;
  posthog: PostHog | null;
  uninstall: (() => void) | null;
};

let state: NodeState | null = null;

/**
 * Build the process-wide client. Idempotent — a second call returns the first
 * client rather than opening a second batching queue, which is what happens
 * when two modules both "make sure" telemetry is up.
 */
export const initNode = (
  options: NodeInitOptions = {},
  defaultRuntime: NodeRuntimeKind = "worker",
): ObservabilityClient => {
  if (state) return state.client;

  const resolved = resolveConfig(options, nodeEnvKey(), nodeEnvHost());
  if (!resolved.ok) {
    state = {
      client: disabledClient(resolved.reason, options),
      posthog: null,
      uninstall: null,
    };
    return state.client;
  }

  const posthog = new PostHog(
    resolved.key,
    buildNodeOptions(options, resolved.host, defaultRuntime),
  );

  const client = createClientFacade(createNodeAdapter(posthog), {
    ...options,
    defaultContext: serverDefaultContext(options),
  });

  const uninstall =
    options.globalHandlers === undefined || options.globalHandlers === false
      ? null
      : installGlobalHandlers(
          client,
          options.globalHandlers === true ? {} : options.globalHandlers,
        );

  state = { client, posthog, uninstall };
  return client;
};

/** The client `initNode` built, or a no-op if it never ran. */
export const getNodeClient = (): ObservabilityClient =>
  state?.client ?? createNoopClient("missing-key");

/** `posthog-node` itself, for feature flags and group analytics. */
export const getPostHogNode = (): PostHog | null => state?.posthog ?? null;

/** Shorthand for `getNodeClient().captureError(...)`. */
export const captureError = (error: unknown, context?: ErrorContext): void => {
  getNodeClient().captureError(error, context);
};

/** Shorthand for `getNodeClient().capture(...)`. */
export const capture = (
  event: string,
  properties?: Record<string, unknown>,
): void => {
  getNodeClient().capture(event, properties);
};

/**
 * Flush and close. Call it on the way out of a worker; `posthog-node` batches,
 * and a process that exits without this drops whatever was still queued.
 */
export const shutdownNode = async (): Promise<void> => {
  const active = state;
  state = null;
  active?.uninstall?.();
  await active?.client.shutdown();
};
