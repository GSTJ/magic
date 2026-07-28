/**
 * The boundary, without a renderer.
 *
 * `react-test-renderer` is gone in React 19 and pulling in `react-dom` plus a
 * DOM shim to assert on one `createElement` call would be a lot of machinery
 * for very little. A class component is just an object: constructing it and
 * driving its lifecycle methods by hand tests the same logic, and it is the
 * logic — which client gets called, with what context, and which fallback is
 * chosen — that this package owns. React owns the rest.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ObservabilityBoundary,
  reportBoundaryError,
} from "../dist/boundary.js";
import { createNoopClient } from "../dist/index.js";

const recordingClient = () => {
  const captured = [];
  return {
    captured,
    client: {
      enabled: true,
      disabledReason: null,
      capture: () => {},
      captureError: (error, context) => captured.push([error, context]),
      identify: () => {},
      reset: () => {},
      register: () => {},
      flush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    },
  };
};

/** A boundary instance with working `setState`, outside React. */
const mount = (props) => {
  const boundary = new ObservabilityBoundary(props);
  boundary.state = { error: null, componentStack: null };
  boundary.setState = (partial) => {
    boundary.state = { ...boundary.state, ...partial };
  };
  return boundary;
};

describe("reportBoundaryError", () => {
  it("tags the source and carries the component stack", () => {
    const { captured, client } = recordingClient();
    reportBoundaryError(
      client,
      new Error("render failed"),
      { componentStack: "\n    at Checkout" },
      { screen: "checkout" },
    );

    const [[error, context]] = captured;
    assert.equal(error.message, "render failed");
    assert.deepEqual(context, {
      screen: "checkout",
      source: "error-boundary",
      componentStack: "\n    at Checkout",
    });
  });

  it("sends componentStack: null when React did not give one", () => {
    const { captured, client } = recordingClient();
    reportBoundaryError(client, new Error("x"), undefined, undefined);
    const [[, context]] = captured;
    assert.equal(context.componentStack, null);
  });

  it("reports nothing through a no-op client, and does not throw", () => {
    assert.doesNotThrow(() =>
      reportBoundaryError(
        createNoopClient("missing-key"),
        new Error("x"),
        { componentStack: "" },
        {},
      ),
    );
  });
});

describe("ObservabilityBoundary", () => {
  it("normalises a thrown string into state", () => {
    const next = ObservabilityBoundary.getDerivedStateFromError("nope");
    assert.ok(next.error instanceof Error);
    assert.equal(next.error.name, "NonError");
  });

  it("renders children while there is no error", () => {
    const boundary = mount({
      client: createNoopClient("missing-key"),
      children: "kids",
    });
    assert.equal(boundary.render(), "kids");
  });

  it("reports through componentDidCatch and then calls onError", () => {
    const { captured, client } = recordingClient();
    const seen = [];
    const boundary = mount({
      client,
      context: { screen: "home" },
      onError: (error) => seen.push(error.message),
    });

    boundary.componentDidCatch(new Error("render failed"), {
      componentStack: "\n    at Home",
    });

    assert.equal(captured.length, 1);
    const [[, context]] = captured;
    assert.equal(context.screen, "home");
    assert.deepEqual(seen, ["render failed"]);
    assert.equal(boundary.state.componentStack, "\n    at Home");
  });

  it("renders a fallback component with error, stack and reset", () => {
    const boundary = mount({
      client: createNoopClient("missing-key"),
      fallback: () => null,
    });
    boundary.state = {
      error: new Error("render failed"),
      componentStack: "\n    at Home",
    };

    const element = boundary.render();
    assert.equal(element.props.error.message, "render failed");
    assert.equal(element.props.componentStack, "\n    at Home");
    assert.equal(typeof element.props.reset, "function");
  });

  it("renders a fallback node as-is", () => {
    const boundary = mount({
      client: createNoopClient("missing-key"),
      fallback: "sorry",
    });
    boundary.state = { error: new Error("x"), componentStack: null };
    assert.equal(boundary.render(), "sorry");
  });

  it("renders nothing when no fallback was given", () => {
    const boundary = mount({ client: createNoopClient("missing-key") });
    boundary.state = { error: new Error("x"), componentStack: null };
    assert.equal(boundary.render(), null);
  });

  it("clears the error when resetKeys change, and not otherwise", () => {
    const boundary = mount({
      client: createNoopClient("missing-key"),
      resetKeys: ["/checkout"],
    });
    boundary.state = { error: new Error("x"), componentStack: null };

    boundary.componentDidUpdate({ resetKeys: ["/checkout"] });
    assert.notEqual(boundary.state.error, null);

    boundary.componentDidUpdate({ resetKeys: ["/cart"] });
    assert.equal(boundary.state.error, null);
  });

  it("reset() clears the error by hand", () => {
    const boundary = mount({ client: createNoopClient("missing-key") });
    boundary.state = { error: new Error("x"), componentStack: "s" };
    boundary.reset();
    assert.deepEqual(boundary.state, { error: null, componentStack: null });
  });
});
