/**
 * The vocabulary every entry point shares.
 *
 * Nothing in this file imports a PostHog SDK. That is the whole point: product
 * code types against `ObservabilityClient`, and swapping `posthog-js` for
 * `posthog-node` between a component and a route handler changes the import
 * path and nothing else.
 */

/** Event properties. PostHog flattens these server-side; so do we, on the way in. */
export type Properties = Record<string, unknown>;

/**
 * Extra detail attached to a captured error.
 *
 * `distinctId` is lifted out because the server SDKs take it as a positional
 * argument rather than a property. Everything else is merged into the
 * `$exception` event after {@link flattenContext} runs over it.
 */
export type ErrorContext = {
  /**
   * Who the exception belongs to. Server-side only — the browser and mobile
   * SDKs already know the current person, and passing this there does nothing.
   */
  distinctId?: string;
  [key: string]: unknown;
};

/** Why a client is doing nothing. `null` when it is doing something. */
export type DisabledReason = "missing-key" | "explicitly-disabled";

/**
 * The surface product code is allowed to touch.
 *
 * Deliberately small. Feature flags, surveys, replay controls and the rest of
 * the PostHog API are reached through the raw SDK handle each entry point
 * exposes (`getPostHog()` and friends) — wrapping them here would mean tracking
 * four SDKs' worth of drift for no gain.
 */
export type ObservabilityClient = {
  /** `false` when there is no key, or when the caller passed `enabled: false`. */
  readonly enabled: boolean;
  /** `null` when {@link ObservabilityClient.enabled} is `true`. */
  readonly disabledReason: DisabledReason | null;
  capture: (event: string, properties?: Properties) => void;
  captureError: (error: unknown, context?: ErrorContext) => void;
  identify: (distinctId: string, properties?: Properties) => void;
  reset: () => void;
  /** Super properties: merged into every subsequent event from this client. */
  register: (properties: Properties) => void;
  flush: () => Promise<void>;
  shutdown: () => Promise<void>;
};

/** Options every `init*` accepts. */
export type BaseObservabilityOptions = {
  /**
   * Project token. When absent — and no platform env var supplies one — the
   * returned client is a no-op and nothing is logged. See the README's
   * "No key, no noise" section.
   */
  key?: string | null | undefined;
  /** Defaults to `https://us.i.posthog.com`. */
  host?: string | undefined;
  /**
   * Force the client off with a key present, e.g. `enabled: !__DEV__`.
   * Defaults to `true`.
   */
  enabled?: boolean | undefined;
  /** Registered as a super property, so every event carries it. */
  environment?: string | undefined;
  /**
   * Registered as a super property. An OTA update id, a git sha, a build
   * number — whatever the source maps were uploaded under.
   */
  release?: string | undefined;
  /** Merged into every captured error, under the caller's own context. */
  defaultContext?: Properties | undefined;
  /** Turns on the SDK's own debug logging. Off by default. */
  debug?: boolean | undefined;
  /**
   * Called once, at init, when the client comes back disabled.
   *
   * This package never writes to the console. If you want to know in dev that
   * telemetry is off, say so here.
   */
  onDisabled?: ((reason: DisabledReason) => void) | undefined;
  /**
   * Called when the SDK itself throws inside a capture call. Telemetry failing
   * must never take the app with it, so those throws are swallowed; this is the
   * only way to see them.
   */
  onInternalError?: ((error: Error) => void) | undefined;
};
