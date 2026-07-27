import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { countFor, lint } from "./helpers.mjs";

describe("magic/prefer-early-return", () => {
  const rules = {
    "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
  };

  it("reports a function whose whole body is a lone if", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.ts": `export const handle = (ok: boolean) => {
  if (ok) {
    doA();
    doB();
  }
};
`,
      },
    });

    assert.equal(countFor(diagnostics, "prefer-early-return"), 1);
  });

  it("leaves a guard-clause function alone", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.ts": `export const handle = (ok: boolean) => {
  if (!ok) return;
  doA();
};
`,
      },
    });

    assert.equal(countFor(diagnostics, "prefer-early-return"), 0);
  });

  it("leaves an if/else alone — there is nothing to invert into", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.ts": `export const handle = (ok: boolean) => {
  if (ok) {
    doA();
  } else {
    doB();
  }
};
`,
      },
    });

    assert.equal(countFor(diagnostics, "prefer-early-return"), 0);
  });

  it("honours maximumStatements", () => {
    const files = {
      "a.ts": `export const handle = (ok: boolean) => {
  if (ok) {
    doA();
  }
};
`,
    };

    const strict = lint({
      files,
      rules: {
        "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
      },
    });
    const lenient = lint({
      files,
      rules: {
        "magic/prefer-early-return": ["error", { maximumStatements: 1 }],
      },
    });

    assert.equal(countFor(strict, "prefer-early-return"), 1);
    assert.equal(countFor(lenient, "prefer-early-return"), 0);
  });
});

describe("magic/no-barrel-file", () => {
  const rules = { "magic/no-barrel-file": "error" };

  it("reports a wildcard re-export in src/index.ts", () => {
    const diagnostics = lint({
      rules,
      files: { "src/index.ts": `export * from "./thing";\n` },
    });

    assert.equal(countFor(diagnostics, "no-barrel-file"), 1);
  });

  it("allows named re-exports", () => {
    const diagnostics = lint({
      rules,
      files: { "src/index.ts": `export { named } from "./thing";\n` },
    });

    assert.equal(countFor(diagnostics, "no-barrel-file"), 0);
  });

  it("ignores non-entry-point files by default", () => {
    const diagnostics = lint({
      rules,
      files: { "src/helpers.ts": `export * from "./thing";\n` },
    });

    assert.equal(countFor(diagnostics, "no-barrel-file"), 0);
  });

  it("honours the allow list", () => {
    const diagnostics = lint({
      files: { "src/index.ts": `export * from "./thing";\n` },
      rules: {
        "magic/no-barrel-file": ["error", { allow: ["src/index.ts"] }],
      },
    });

    assert.equal(countFor(diagnostics, "no-barrel-file"), 0);
  });
});

describe("magic/no-module-mocks", () => {
  const rules = { "magic/no-module-mocks": "error" };

  it("reports vi.mock and jest.mock in test files", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.test.ts": `vi.mock("./thing");\njest.mock("./other");\n`,
      },
    });

    assert.equal(countFor(diagnostics, "no-module-mocks"), 2);
  });

  it("ignores non-test files", () => {
    const diagnostics = lint({
      rules,
      files: { "a.ts": `vi.mock("./thing");\n` },
    });

    assert.equal(countFor(diagnostics, "no-module-mocks"), 0);
  });

  it("uses the conditional message when the mock is inside an if", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.test.ts": `if (flag) {\n  vi.mock("./thing");\n}\n`,
      },
    });

    assert.equal(countFor(diagnostics, "no-module-mocks"), 1);
    assert.match(diagnostics[0].message, /hoisted/);
  });

  it("honours a narrowed objects list", () => {
    const diagnostics = lint({
      files: { "a.test.ts": `vi.mock("./a");\njest.mock("./b");\n` },
      rules: { "magic/no-module-mocks": ["error", { objects: ["vi"] }] },
    });

    assert.equal(countFor(diagnostics, "no-module-mocks"), 1);
  });
});

describe("magic/prefer-suspense-query", () => {
  const rules = { "magic/prefer-suspense-query": "error" };

  it("reports useQuery on a configured root", () => {
    const diagnostics = lint({
      rules,
      files: { "a.ts": `export const x = () => api.things.list.useQuery();\n` },
    });

    assert.equal(countFor(diagnostics, "prefer-suspense-query"), 1);
  });

  it("ignores useQuery on an unrelated object", () => {
    const diagnostics = lint({
      rules,
      files: { "a.ts": `export const x = () => somethingElse.useQuery();\n` },
    });

    assert.equal(countFor(diagnostics, "prefer-suspense-query"), 0);
  });

  it("ignores useSuspenseQuery", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.ts": `export const x = () => api.things.list.useSuspenseQuery();\n`,
      },
    });

    assert.equal(countFor(diagnostics, "prefer-suspense-query"), 0);
  });

  it("honours configurable roots", () => {
    const diagnostics = lint({
      files: { "a.ts": `export const x = () => backend.things.useQuery();\n` },
      rules: {
        "magic/prefer-suspense-query": ["error", { roots: ["backend"] }],
      },
    });

    assert.equal(countFor(diagnostics, "prefer-suspense-query"), 1);
  });
});
