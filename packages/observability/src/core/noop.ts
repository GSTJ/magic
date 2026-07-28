/**
 * The client you get when there is no key.
 *
 * Every method is safe to call and none of them say anything. A product cloned
 * without a `.env` has to boot, and a dev who never set a token has to not be
 * nagged on every render — those two requirements are why this exists rather
 * than throwing, and why nothing here touches the console.
 */
import type { DisabledReason, ObservabilityClient } from "./types.ts";

const noop = (): void => {};
const resolved = async (): Promise<void> => {};

export const createNoopClient = (
  disabledReason: DisabledReason,
): ObservabilityClient => ({
  enabled: false,
  disabledReason,
  capture: noop,
  captureError: noop,
  identify: noop,
  reset: noop,
  register: noop,
  flush: resolved,
  shutdown: resolved,
});
