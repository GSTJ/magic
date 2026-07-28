import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildErrorProperties,
  describeValue,
  flattenContext,
  mergeContext,
  normalizeError,
} from "../dist/index.js";

describe("normalizeError", () => {
  it("passes an Error through untouched", () => {
    const error = new TypeError("boom");
    assert.equal(normalizeError(error), error);
  });

  it("wraps a thrown string as a NonError so the throw site is findable", () => {
    const error = normalizeError("nope");
    assert.equal(error.name, "NonError");
    assert.equal(error.message, "Non-error thrown: nope");
  });

  it("rebuilds an error-shaped object, keeping its name and stack", () => {
    const error = normalizeError({
      message: "serialised across a worker",
      name: "RpcError",
      stack: "RpcError: serialised across a worker\n    at worker.js:1:1",
    });
    assert.equal(error.name, "RpcError");
    assert.equal(error.message, "serialised across a worker");
    assert.match(error.stack, /worker\.js/u);
  });

  it("does not mistake a non-string message for an error shape", () => {
    const error = normalizeError({ message: 42 });
    assert.equal(error.name, "NonError");
    assert.match(error.message, /"message":42/u);
  });

  it("handles null, undefined and cycles without throwing", () => {
    assert.equal(normalizeError(null).message, "Non-error thrown: null");
    assert.equal(
      normalizeError(undefined).message,
      "Non-error thrown: undefined",
    );

    const cyclic = { a: 1 };
    cyclic.self = cyclic;
    assert.match(normalizeError(cyclic).message, /Circular/u);
  });
});

describe("flattenContext", () => {
  it("joins nested keys with a dot so PostHog can filter on them", () => {
    assert.deepEqual(
      flattenContext({ request: { id: "r1", user: { plan: "pro" } } }),
      { "request.id": "r1", "request.user.plan": "pro" },
    );
  });

  it("drops undefined rather than sending null", () => {
    assert.deepEqual(flattenContext({ a: undefined, b: null }), { b: null });
  });

  it("keeps booleans and finite numbers as-is, stringifies the rest", () => {
    assert.deepEqual(flattenContext({ ok: true, count: 3, nope: Number.NaN }), {
      ok: true,
      count: 3,
      nope: "NaN",
    });
  });

  it("expands an Error value into name/message/stack", () => {
    const flat = flattenContext({ cause: new RangeError("out of range") });
    assert.equal(flat["cause.name"], "RangeError");
    assert.equal(flat["cause.message"], "out of range");
    assert.match(flat["cause.stack"], /RangeError/u);
  });

  it("serialises a Date to ISO and an array to JSON", () => {
    const flat = flattenContext({
      at: new Date("2026-07-27T00:00:00.000Z"),
      ids: [1, 2],
    });
    assert.equal(flat["at"], "2026-07-27T00:00:00.000Z");
    assert.equal(flat["ids"], "[1,2]");
  });

  it("stops recursing at depth 3 and stringifies what is left", () => {
    const flat = flattenContext({ a: { b: { c: { d: { e: 1 } } } } });
    assert.equal(flat["a.b.c.d"], '{"e":1}');
  });

  it("truncates a string that would blow up the property", () => {
    const flat = flattenContext({ blob: "x".repeat(9000) });
    assert.ok(flat["blob"].endsWith("… [truncated]"));
    assert.ok(flat["blob"].length < 9000);
  });

  it("survives a cyclic object", () => {
    const cyclic = { name: "root" };
    cyclic.self = cyclic;
    assert.doesNotThrow(() => flattenContext({ cyclic }));
  });
});

describe("mergeContext", () => {
  it("lets later objects win and ignores explicit undefined", () => {
    assert.deepEqual(
      mergeContext({ a: 1, b: 2 }, undefined, { b: 3, c: undefined }),
      { a: 1, b: 3 },
    );
  });
});

describe("buildErrorProperties", () => {
  it("merges defaults under call-site context and strips distinctId", () => {
    assert.deepEqual(
      buildErrorProperties(
        { environment: "production", release: "abc123" },
        { distinctId: "user-1", screen: "checkout", release: "override" },
      ),
      { environment: "production", release: "override", screen: "checkout" },
    );
  });
});

describe("describeValue", () => {
  it("renders primitives and objects readably", () => {
    assert.equal(describeValue(null), "null");
    assert.equal(describeValue(7), "7");
    assert.equal(describeValue({ a: 1 }), '{"a":1}');
  });
});
