/**
 * The facade is where "whatever the SDK does" stops mattering. These tests use
 * a fake adapter, because the point is the shape of what reaches the SDK, not
 * the SDK.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createClientFacade } from "../dist/index.js";

const recordingAdapter = () => {
  const calls = {
    capture: [],
    captureError: [],
    identify: [],
    register: [],
    reset: 0,
    flush: 0,
    shutdown: 0,
  };
  return {
    calls,
    adapter: {
      capture: (event, properties) => calls.capture.push([event, properties]),
      captureError: (error, properties, distinctId) =>
        calls.captureError.push([error, properties, distinctId]),
      identify: (distinctId, properties) =>
        calls.identify.push([distinctId, properties]),
      register: (properties) => calls.register.push(properties),
      reset: () => {
        calls.reset += 1;
      },
      flush: () => {
        calls.flush += 1;
        return Promise.resolve();
      },
      shutdown: () => {
        calls.shutdown += 1;
        return Promise.resolve();
      },
    },
  };
};

describe("createClientFacade", () => {
  it("normalises a thrown non-Error before it reaches the SDK", () => {
    const { calls, adapter } = recordingAdapter();
    createClientFacade(adapter).captureError("kaboom");

    const [[error]] = calls.captureError;
    assert.ok(error instanceof Error);
    assert.equal(error.name, "NonError");
  });

  it("routes distinctId positionally and keeps it out of the properties", () => {
    const { calls, adapter } = recordingAdapter();
    createClientFacade(adapter).captureError(new Error("x"), {
      distinctId: "user-9",
      route: "/checkout",
    });

    const [[, properties, distinctId]] = calls.captureError;
    assert.equal(distinctId, "user-9");
    assert.deepEqual(properties, { route: "/checkout" });
  });

  it("merges defaultContext underneath the call-site context", () => {
    const { calls, adapter } = recordingAdapter();
    const client = createClientFacade(adapter, {
      defaultContext: { environment: "production", release: "v1" },
    });

    client.captureError(new Error("x"), { release: "v2" });
    const [[, errorProperties]] = calls.captureError;
    assert.deepEqual(errorProperties, {
      environment: "production",
      release: "v2",
    });
  });

  it("flattens nested context on capture too", () => {
    const { calls, adapter } = recordingAdapter();
    createClientFacade(adapter).capture("checkout_started", {
      cart: { items: 3 },
    });
    const [captured] = calls.capture;
    assert.deepEqual(captured, ["checkout_started", { "cart.items": 3 }]);
  });

  it("swallows an SDK throw and reports it through onInternalError", () => {
    const seen = [];
    const client = createClientFacade(
      {
        capture: () => {
          throw new Error("transport exploded");
        },
        captureError: () => {},
        identify: () => {},
        flush: () => Promise.resolve(),
        shutdown: () => Promise.resolve(),
      },
      { onInternalError: (error) => seen.push(error.message) },
    );

    assert.doesNotThrow(() => client.capture("thing"));
    assert.deepEqual(seen, ["transport exploded"]);
  });

  it("swallows an async SDK rejection the same way", async () => {
    const seen = [];
    const client = createClientFacade(
      {
        capture: () => {},
        captureError: () => {},
        identify: () => {},
        flush: () => Promise.reject(new Error("flush failed")),
        shutdown: () => Promise.resolve(),
      },
      { onInternalError: (error) => seen.push(error.message) },
    );

    await client.flush();
    assert.deepEqual(seen, ["flush failed"]);
  });

  it("no-ops reset and register when the adapter has neither", () => {
    const client = createClientFacade({
      capture: () => {},
      captureError: () => {},
      identify: () => {},
      flush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    });

    assert.doesNotThrow(() => client.reset());
    assert.doesNotThrow(() => client.register({ environment: "test" }));
  });

  it("reports itself as enabled", () => {
    const { adapter } = recordingAdapter();
    const client = createClientFacade(adapter);
    assert.equal(client.enabled, true);
    assert.equal(client.disabledReason, null);
  });
});
