import type { ObservabilityAdapter } from "../core/facade.ts";
import type { BaseObservabilityOptions, Properties } from "../core/types.ts";
import type { PostHog } from "posthog-node";

/**
 * The `posthog-node` half of a client, shared by `magic-observability/node` and
 * `magic-observability/next` — same SDK, same three quirks to absorb:
 *
 *   - `capture` needs a `distinctId` and there is no ambient one on a server.
 *     A property named `distinctId` wins; otherwise the event is attributed to
 *     `"server"`, which is at least a person you can filter out.
 *   - `captureException` takes the distinct id positionally, in the middle.
 *   - There is no `register`/`reset`; super properties are a browser concept.
 *
 * `posthog-node` is imported for types only, so this file compiles to something
 * with no runtime import and can be unit-tested against a fake.
 */

/** Attribution for an event that has no user attached. */
export const SERVER_DISTINCT_ID = "server";

export const createNodeAdapter = (posthog: PostHog): ObservabilityAdapter => ({
  capture: (event, properties) => {
    const { distinctId } = properties;
    posthog.capture({
      distinctId:
        typeof distinctId === "string" && distinctId !== ""
          ? distinctId
          : SERVER_DISTINCT_ID,
      event,
      properties,
    });
  },
  captureError: (error, properties, distinctId) => {
    posthog.captureException(error, distinctId, properties);
  },
  identify: (distinctId, properties) => {
    posthog.identify({ distinctId, properties });
  },
  flush: async () => {
    await posthog.flush();
  },
  shutdown: async () => {
    await posthog.shutdown();
  },
});

/**
 * `environment` and `release` folded into the default context, since the server
 * SDK has no super properties to register them as.
 */
export const serverDefaultContext = (
  options: Pick<
    BaseObservabilityOptions,
    "environment" | "release" | "defaultContext"
  >,
): Properties => ({
  ...(options.environment ? { environment: options.environment } : {}),
  ...(options.release ? { release: options.release } : {}),
  ...options.defaultContext,
});
