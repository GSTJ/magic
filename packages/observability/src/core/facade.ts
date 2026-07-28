import type {
  BaseObservabilityOptions,
  ErrorContext,
  ObservabilityClient,
  Properties,
} from "./types.ts";

import {
  buildErrorProperties,
  flattenContext,
  mergeContext,
  normalizeError,
} from "./context.ts";

/**
 * The one place that turns a PostHog SDK into an {@link ObservabilityClient}.
 *
 * Each platform entry point supplies an {@link ObservabilityAdapter} of five or
 * six one-line functions; everything above that line — normalising the throw,
 * merging and flattening context, and refusing to let a telemetry failure
 * become an app failure — happens here, once.
 */

/** The SDK-shaped half of a client. Written once per PostHog SDK. */
export type ObservabilityAdapter = {
  capture: (event: string, properties: Properties) => void;
  captureError: (
    error: Error,
    properties: Properties,
    distinctId: string | undefined,
  ) => void;
  identify: (distinctId: string, properties: Properties) => void;
  reset?: (() => void) | undefined;
  register?: ((properties: Properties) => void) | undefined;
  flush: () => Promise<void>;
  shutdown: () => Promise<void>;
};

type FacadeOptions = Pick<
  BaseObservabilityOptions,
  "defaultContext" | "onInternalError"
>;

export const createClientFacade = (
  adapter: ObservabilityAdapter,
  { defaultContext, onInternalError }: FacadeOptions = {},
): ObservabilityClient => {
  /**
   * A throw from inside the SDK — a bad property, a serialisation failure, a
   * transport that blew up synchronously — must not reach the caller. The
   * caller is usually a `catch` block or a React lifecycle method, and losing
   * the original error to a reporting bug is the worst possible outcome.
   */
  const guard = (run: () => void): void => {
    try {
      run();
    } catch (error) {
      onInternalError?.(normalizeError(error));
    }
  };

  const guardAsync = async (run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (error) {
      onInternalError?.(normalizeError(error));
    }
  };

  return {
    enabled: true,
    disabledReason: null,

    capture: (event, properties) => {
      guard(() => {
        adapter.capture(
          event,
          flattenContext(mergeContext(defaultContext, properties)),
        );
      });
    },

    captureError: (error: unknown, context?: ErrorContext) => {
      guard(() => {
        const distinctId =
          typeof context?.distinctId === "string"
            ? context.distinctId
            : undefined;
        adapter.captureError(
          normalizeError(error),
          buildErrorProperties(defaultContext, context),
          distinctId,
        );
      });
    },

    identify: (distinctId, properties) => {
      guard(() => {
        adapter.identify(distinctId, mergeContext(properties));
      });
    },

    reset: () => {
      guard(() => adapter.reset?.());
    },

    register: (properties) => {
      guard(() => adapter.register?.(mergeContext(properties)));
    },

    flush: () => guardAsync(() => adapter.flush()),
    shutdown: () => guardAsync(() => adapter.shutdown()),
  };
};
