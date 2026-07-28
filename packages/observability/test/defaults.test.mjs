/**
 * The defaults are the product. If someone quietly turns exception autocapture
 * off, or drops the serverless flush timings, the wave of repos that copied the
 * README keeps building and stops reporting — which is the failure mode nobody
 * notices for a month.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildExpoOptions } from "../dist/expo/options.js";
import { buildNodeOptions } from "../dist/node/options.js";
import { buildWebOptions, WEB_DEFAULTS_DATE } from "../dist/web/options.js";

describe("buildWebOptions", () => {
  it("turns exception autocapture on in code, not in project settings", () => {
    assert.equal(buildWebOptions({}, "").capture_exceptions, true);
  });

  it("pins the dated defaults bundle", () => {
    assert.equal(buildWebOptions({}, "").defaults, WEB_DEFAULTS_DATE);
    assert.equal(WEB_DEFAULTS_DATE, "2026-05-30");
  });

  it("falls back to US cloud when no host is resolved", () => {
    assert.equal(buildWebOptions({}, "").api_host, "https://us.i.posthog.com");
    assert.equal(
      buildWebOptions({}, "https://eu.i.posthog.com").api_host,
      "https://eu.i.posthog.com",
    );
  });

  it("leaves session recording to the project setting unless told otherwise", () => {
    assert.equal("disable_session_recording" in buildWebOptions({}, ""), false);
    assert.equal(
      buildWebOptions({ sessionReplay: false }, "").disable_session_recording,
      true,
    );
    assert.equal(
      "disable_session_recording" in
        buildWebOptions({ sessionReplay: true }, ""),
      false,
    );
  });

  it("lets posthogOptions win over every default", () => {
    const options = buildWebOptions(
      { posthogOptions: { capture_exceptions: false, autocapture: false } },
      "",
    );
    assert.equal(options.capture_exceptions, false);
    assert.equal(options.autocapture, false);
  });
});

describe("buildNodeOptions", () => {
  it("batches for a worker", () => {
    const options = buildNodeOptions({}, "", "worker");
    assert.equal(options.flushAt, 20);
    assert.equal(options.flushInterval, 10_000);
  });

  it("sends immediately for serverless, where a batch never leaves", () => {
    const options = buildNodeOptions({}, "", "serverless");
    assert.equal(options.flushAt, 1);
    assert.equal(options.flushInterval, 0);
  });

  it("lets an explicit runtime beat the entry point's default", () => {
    assert.equal(
      buildNodeOptions({ runtime: "serverless" }, "", "worker").flushAt,
      1,
    );
  });

  it("turns server exception autocapture on", () => {
    assert.equal(buildNodeOptions({}, "").enableExceptionAutocapture, true);
    assert.equal(
      buildNodeOptions({ autocaptureExceptions: false }, "")
        .enableExceptionAutocapture,
      false,
    );
  });

  it("sets a request timeout so a hung ingest cannot hold a handler open", () => {
    assert.equal(buildNodeOptions({}, "").requestTimeout, 10_000);
  });
});

describe("buildExpoOptions", () => {
  it("captures uncaught exceptions, rejections and native crashes", () => {
    const { autocapture } = buildExpoOptions({}, "").errorTracking;
    assert.equal(autocapture.uncaughtExceptions, true);
    assert.equal(autocapture.unhandledRejections, true);
    assert.equal(autocapture.nativeCrashes, true);
  });

  it("defaults console capture off, because we ship an error boundary", () => {
    // PostHog's docs: a boundary plus console capture reports render errors
    // twice, because React logs caught errors to the console itself.
    assert.deepEqual(
      buildExpoOptions({}, "").errorTracking.autocapture.console,
      [],
    );
  });

  it("lets a product without a boundary opt console capture back in", () => {
    const options = buildExpoOptions(
      { errorTracking: { console: ["error", "warn"] } },
      "",
    );
    assert.deepEqual(options.errorTracking.autocapture.console, [
      "error",
      "warn",
    ]);
  });

  it("leaves mobile session replay off", () => {
    assert.equal(buildExpoOptions({}, "").enableSessionReplay, false);
    assert.equal(
      buildExpoOptions({ sessionReplay: true }, "").enableSessionReplay,
      true,
    );
  });

  it("defaults to US cloud", () => {
    assert.equal(buildExpoOptions({}, "").host, "https://us.i.posthog.com");
  });
});
