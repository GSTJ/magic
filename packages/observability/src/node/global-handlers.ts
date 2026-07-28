/**
 * Process-level wiring for workers and CLIs.
 *
 * Deliberately separate from the client, and deliberately opt-in, because
 * adding a listener for `uncaughtException` or `unhandledRejection` *changes
 * what Node does*: the default behaviour — print and exit non-zero — is
 * suppressed the moment a listener exists. A reporting helper that silently
 * turns a crash into a zombie process is worse than no reporting, so the exit
 * is put back explicitly and the flush is bounded.
 *
 * Most services will not need this at all: `posthog-node`'s
 * `enableExceptionAutocapture` (on by default in `initNode`) already captures
 * both. Reach for this when autocapture is off, or when the process also needs
 * to flush on SIGTERM.
 */
import type { ObservabilityClient } from "../core/types.ts";

export type GlobalHandlerOptions = {
  /** Defaults to `true`. */
  captureUncaughtExceptions?: boolean | undefined;
  /** Defaults to `true`. */
  captureUnhandledRejections?: boolean | undefined;
  /**
   * Flush, then `process.exit(1)`, restoring Node's default crash behaviour.
   * Defaults to `true`. Turning it off means the process survives an
   * uncaught exception, which is a real choice but must be a deliberate one.
   */
  exitOnUncaughtException?: boolean | undefined;
  /** Flush and shut down on SIGINT/SIGTERM. Defaults to `true`. */
  handleSignals?: boolean | undefined;
  /** How long a shutdown flush may take before the process leaves anyway. */
  flushTimeoutMs?: number | undefined;
  /** Injected in tests. */
  processRef?: NodeJS.Process | undefined;
};

/** Never let a hung transport hold the process open past its budget. */
const withTimeout = async (
  work: Promise<void>,
  timeoutMs: number,
): Promise<void> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
    timer.unref?.();
  });
  try {
    await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Wires the handlers and returns the function that removes them again. The
 * return value is not optional politeness — tests and hot-reloading servers
 * both need it, and leaking listeners across reloads trips Node's
 * MaxListenersExceededWarning.
 */
export const installGlobalHandlers = (
  client: ObservabilityClient,
  options: GlobalHandlerOptions = {},
): (() => void) => {
  const {
    captureUncaughtExceptions = true,
    captureUnhandledRejections = true,
    exitOnUncaughtException = true,
    handleSignals = true,
    flushTimeoutMs = 2000,
    processRef = process,
  } = options;

  const teardown: (() => void)[] = [];

  const drainThenExit = async (): Promise<void> => {
    await withTimeout(client.shutdown(), flushTimeoutMs);
    if (!exitOnUncaughtException) return;
    processRef.exit(1);
  };

  const onUncaughtException = (error: Error): void => {
    client.captureError(error, { source: "uncaughtException", fatal: true });
    void drainThenExit();
  };

  const onUnhandledRejection = (reason: unknown): void => {
    client.captureError(reason, { source: "unhandledRejection", fatal: false });
  };

  /**
   * Re-raising the signal after the flush is what makes this transparent: the
   * `once` listener has already been removed by the time we get here, so the
   * second delivery hits Node's default handler and the process dies with the
   * exit code the caller's supervisor expects.
   */
  const drainThenReraise = async (signal: NodeJS.Signals): Promise<void> => {
    await withTimeout(client.shutdown(), flushTimeoutMs);
    processRef.kill(processRef.pid, signal);
  };

  const onSignal = (signal: NodeJS.Signals) => (): void => {
    void drainThenReraise(signal);
  };

  if (captureUncaughtExceptions) {
    processRef.on("uncaughtException", onUncaughtException);
    teardown.push(() => {
      processRef.off("uncaughtException", onUncaughtException);
    });
  }

  if (captureUnhandledRejections) {
    processRef.on("unhandledRejection", onUnhandledRejection);
    teardown.push(() => {
      processRef.off("unhandledRejection", onUnhandledRejection);
    });
  }

  if (handleSignals) {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      const handler = onSignal(signal);
      processRef.once(signal, handler);
      teardown.push(() => {
        processRef.off(signal, handler);
      });
    }
  }

  return () => {
    for (const remove of teardown) remove();
  };
};
