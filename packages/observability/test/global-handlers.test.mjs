/**
 * Driven against a fake `process`, because the real one cannot be asked to
 * pretend to crash.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { installGlobalHandlers } from "../dist/node/global-handlers.js";

const fakeProcess = () => {
  const listeners = new Map();
  const exits = [];
  const kills = [];

  const add = (event, handler) => {
    const existing = listeners.get(event) ?? [];
    listeners.set(event, [...existing, handler]);
  };

  return {
    exits,
    kills,
    listeners,
    emit: (event, ...args) => {
      for (const handler of listeners.get(event) ?? []) handler(...args);
    },
    ref: {
      pid: 4242,
      on: add,
      once: add,
      off: (event, handler) => {
        listeners.set(
          event,
          (listeners.get(event) ?? []).filter((entry) => entry !== handler),
        );
      },
      exit: (code) => exits.push(code),
      kill: (pid, signal) => kills.push([pid, signal]),
    },
  };
};

const recordingClient = () => {
  const captured = [];
  let shutdowns = 0;
  return {
    captured,
    shutdownCount: () => shutdowns,
    client: {
      enabled: true,
      disabledReason: null,
      capture: () => {},
      captureError: (error, context) => captured.push([error, context]),
      identify: () => {},
      reset: () => {},
      register: () => {},
      flush: () => Promise.resolve(),
      shutdown: () => {
        shutdowns += 1;
        return Promise.resolve();
      },
    },
  };
};

const tick = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe("installGlobalHandlers", () => {
  it("captures an uncaught exception, flushes, then restores the crash", async () => {
    const proc = fakeProcess();
    const { captured, client, shutdownCount } = recordingClient();
    installGlobalHandlers(client, { processRef: proc.ref });

    proc.emit("uncaughtException", new Error("boom"));
    await tick();

    assert.equal(captured[0][0].message, "boom");
    assert.equal(captured[0][1].source, "uncaughtException");
    assert.equal(captured[0][1].fatal, true);
    assert.equal(shutdownCount(), 1);
    assert.deepEqual(proc.exits, [1]);
  });

  it("can be told not to exit, for a supervisor that handles it", async () => {
    const proc = fakeProcess();
    const { client } = recordingClient();
    installGlobalHandlers(client, {
      processRef: proc.ref,
      exitOnUncaughtException: false,
    });

    proc.emit("uncaughtException", new Error("boom"));
    await tick();
    assert.deepEqual(proc.exits, []);
  });

  it("captures an unhandled rejection without killing the process", async () => {
    const proc = fakeProcess();
    const { captured, client } = recordingClient();
    installGlobalHandlers(client, { processRef: proc.ref });

    proc.emit("unhandledRejection", "a string rejection");
    await tick();

    assert.equal(captured[0][1].source, "unhandledRejection");
    assert.equal(captured[0][1].fatal, false);
    assert.deepEqual(proc.exits, []);
  });

  it("flushes on SIGTERM and re-raises so the exit code is honest", async () => {
    const proc = fakeProcess();
    const { client, shutdownCount } = recordingClient();
    installGlobalHandlers(client, { processRef: proc.ref });

    proc.emit("SIGTERM");
    await tick();

    assert.equal(shutdownCount(), 1);
    assert.deepEqual(proc.kills, [[4242, "SIGTERM"]]);
  });

  it("removes every listener it added", () => {
    const proc = fakeProcess();
    const { client } = recordingClient();
    const uninstall = installGlobalHandlers(client, { processRef: proc.ref });

    const total = () =>
      [...proc.listeners.values()].reduce(
        (count, handlers) => count + handlers.length,
        0,
      );

    assert.equal(total(), 4);
    uninstall();
    assert.equal(total(), 0);
  });

  it("installs only what it was asked for", () => {
    const proc = fakeProcess();
    const { client } = recordingClient();
    installGlobalHandlers(client, {
      processRef: proc.ref,
      captureUncaughtExceptions: false,
      captureUnhandledRejections: false,
      handleSignals: false,
    });

    assert.equal(proc.listeners.size, 0);
  });
});
