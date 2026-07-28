/**
 * The single most important behaviour in this package: a product cloned without
 * a `.env` boots, works, and says nothing.
 *
 * Every one of these entry points is loaded with no `*_POSTHOG_KEY` set. If any
 * of them ever throws, or writes to the console, a wave of repos will start
 * failing in dev at once.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createNoopClient,
  disabledClient,
  resolveConfig,
} from "../dist/index.js";
import { getServerClient } from "../dist/next/index.js";
import { getNodeClient, initNode } from "../dist/node/index.js";
import { getWebClient, initWebAnalytics } from "../dist/web/index.js";

/** Runs `run()` with every console method recording instead of printing. */
const withSilencedConsole = async (run) => {
  const methods = ["log", "info", "warn", "error", "debug", "trace"];
  const original = {};
  const written = [];
  for (const method of methods) {
    original[method] = console[method];
    console[method] = (...args) => written.push([method, ...args]);
  }
  try {
    await run();
  } finally {
    for (const method of methods) console[method] = original[method];
  }
  return written;
};

/** Everything on the client surface, called once, with nothing configured. */
const exerciseEverything = async (client) => {
  client.capture("thing_happened", { a: 1 });
  client.captureError(new Error("boom"), { screen: "home" });
  client.captureError("a thrown string");
  client.identify("user-1", { plan: "pro" });
  client.register({ environment: "test" });
  client.reset();
  await client.flush();
  await client.shutdown();
};

describe("no key present", () => {
  it("gives every entry point a disabled client and never throws", async () => {
    const clients = [
      ["web", initWebAnalytics()],
      ["web singleton", getWebClient()],
      ["node", initNode()],
      ["node singleton", getNodeClient()],
      ["next server", getServerClient()],
    ];

    for (const [name, client] of clients) {
      assert.equal(client.enabled, false, `${name} should be disabled`);
      assert.equal(client.disabledReason, "missing-key", name);
    }

    await Promise.all(clients.map(([, client]) => exerciseEverything(client)));
  });

  it("writes nothing to the console", async () => {
    const written = await withSilencedConsole(async () => {
      await exerciseEverything(initNode());
      await exerciseEverything(initWebAnalytics());
      await exerciseEverything(getServerClient());
    });

    assert.deepEqual(
      written,
      [],
      `expected silence, got:\n${written.map((entry) => entry.join(" ")).join("\n")}`,
    );
  });

  it("tells you why, but only if you asked, via onDisabled", () => {
    const reasons = [];
    const client = disabledClient("explicitly-disabled", {
      onDisabled: (reason) => reasons.push(reason),
    });

    assert.deepEqual(reasons, ["explicitly-disabled"]);
    assert.equal(client.enabled, false);
    assert.equal(client.disabledReason, "explicitly-disabled");

    // And with no callback, nothing happens at all.
    assert.doesNotThrow(() => disabledClient("missing-key", {}));
  });

  it("createNoopClient reports the reason it was given", () => {
    assert.equal(createNoopClient("missing-key").disabledReason, "missing-key");
  });
});

describe("resolveConfig", () => {
  it("prefers an explicit key over the environment", () => {
    assert.deepEqual(
      resolveConfig({ key: "phc_explicit" }, "phc_env", undefined),
      {
        ok: true,
        key: "phc_explicit",
        host: "https://us.i.posthog.com",
      },
    );
  });

  it("falls back to the environment, and trims it", () => {
    assert.deepEqual(
      resolveConfig({}, "  phc_env  ", "https://eu.i.posthog.com"),
      { ok: true, key: "phc_env", host: "https://eu.i.posthog.com" },
    );
  });

  it("treats a blank string as no key at all", () => {
    assert.deepEqual(resolveConfig({ key: "   " }, "", undefined), {
      ok: false,
      reason: "missing-key",
    });
  });

  it("honours enabled: false even with a key", () => {
    assert.deepEqual(
      resolveConfig({ key: "phc_x", enabled: false }, undefined, undefined),
      { ok: false, reason: "explicitly-disabled" },
    );
  });
});
