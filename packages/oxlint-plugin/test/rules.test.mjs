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

  // Under `createOnce` the closure runs once for the whole run, so options read
  // outside `before()` get frozen at whatever the first file saw. Two files in
  // one run with different options is the only shape that catches that.
  it("re-reads options per file when an override changes them", () => {
    const body = `export const handle = (ok: boolean) => {
  if (ok) {
    doA();
  }
};
`;

    const diagnostics = lint({
      rules: {
        "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
      },
      overrides: [
        {
          files: ["lenient/**"],
          rules: {
            "magic/prefer-early-return": ["error", { maximumStatements: 1 }],
          },
        },
      ],
      files: { "strict/a.ts": body, "lenient/b.ts": body },
    });

    assert.equal(countFor(diagnostics, "prefer-early-return"), 1);
    assert.match(diagnostics[0].file, /strict/);
  });

  // The upstream rule counts a braceless consequent only when it is an
  // `ExpressionStatement`. That carve-out matters: `if (done) return;` as a
  // whole function body already *is* the early return the rule asks for, and
  // reporting it would be advice to invert a guard clause into itself.
  it("reports a braceless expression consequent at maximumStatements 0", () => {
    const diagnostics = lint({
      rules: {
        "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
      },
      files: {
        "a.ts": `export const handle = (ok: boolean) => {
  if (ok) doA();
};
`,
      },
    });

    assert.equal(countFor(diagnostics, "prefer-early-return"), 1);
  });

  it("leaves a braceless return/throw/continue body alone", () => {
    const diagnostics = lint({
      rules: {
        "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
      },
      files: {
        "a.ts": `export const handle = (ok: boolean) => {
  if (ok) return;
};
export const guard = (bad: boolean) => {
  if (bad) throw new Error("nope");
};
`,
      },
    });

    assert.equal(countFor(diagnostics, "prefer-early-return"), 0);
  });

  it("does not report a braceless consequent once the budget is non-zero", () => {
    const diagnostics = lint({
      rules: {
        "magic/prefer-early-return": ["error", { maximumStatements: 1 }],
      },
      files: {
        "a.ts": `export const handle = (ok: boolean) => {
  if (ok) doA();
};
`,
      },
    });

    assert.equal(countFor(diagnostics, "prefer-early-return"), 0);
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

  it("ignores type-only wildcard re-exports — they are erased at runtime", () => {
    const diagnostics = lint({
      rules,
      files: {
        "src/index.ts": `export type * from "./types";\nexport * from "./thing";\n`,
      },
    });

    assert.equal(countFor(diagnostics, "no-barrel-file"), 1);
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

  it("reports the whole default method family, not just mock", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.test.ts": `vi.doMock("./a");\nvi.mocked(thing);\nvi.hoisted(() => ({}));\njest.requireMock("./b");\n`,
      },
    });

    assert.equal(countFor(diagnostics, "no-module-mocks"), 4);
  });

  it("reports optional-chained calls (vi?.mock)", () => {
    const diagnostics = lint({
      rules,
      files: { "a.test.ts": `vi?.mock("./thing");\n` },
    });

    assert.equal(countFor(diagnostics, "no-module-mocks"), 1);
  });

  it("applies to __tests__/ files with no .test infix (Jest's default layout)", () => {
    const diagnostics = lint({
      rules,
      files: { "__tests__/thing.ts": `vi.mock("./thing");\n` },
    });

    assert.equal(countFor(diagnostics, "no-module-mocks"), 1);
  });

  it("leaves vi.spyOn and vi.fn alone — instance mocking is the alternative", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.test.ts": `vi.spyOn(api, "fetchUser");\nconst cb = vi.fn();\n`,
      },
    });

    assert.equal(countFor(diagnostics, "no-module-mocks"), 0);
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

  it("reports optional-chained call sites (api?.things.useQuery())", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.ts": `export const x = () => api?.things.useQuery();\nexport const y = () => api.things.useQuery?.();\n`,
      },
    });

    assert.equal(countFor(diagnostics, "prefer-suspense-query"), 2);
  });

  it("ignores useMutation — only the configured hooks are steered", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.ts": `export const x = () => api.things.create.useMutation();\n`,
      },
    });

    assert.equal(countFor(diagnostics, "prefer-suspense-query"), 0);
  });
});

describe("magic/no-ancestor-directory-import", () => {
  const rules = { "magic/no-ancestor-directory-import": "error" };

  it("reports the ancestor spellings that route through an index", () => {
    const diagnostics = lint({
      rules,
      files: {
        "src/feature/nested/a.ts": `import { a } from "..";
import { b } from "../";
import { c } from "../..";
import { d } from "../index";
import { e } from "../../index.ts";
export const use = [a, b, c, d, e];
`,
      },
    });

    assert.equal(countFor(diagnostics, "no-ancestor-directory-import"), 5);
  });

  it("reports the own-directory index too", () => {
    const diagnostics = lint({
      rules,
      files: {
        "src/a.ts": `import { a } from ".";
import { b } from "./index";
export const use = [a, b];
`,
      },
    });

    assert.equal(countFor(diagnostics, "no-ancestor-directory-import"), 2);
  });

  it("leaves sibling and descendant imports alone", () => {
    const diagnostics = lint({
      rules,
      files: {
        "src/feature/a.ts": `import { a } from "./thing";
import { b } from "../other/thing";
import { c } from "../other/index";
import { d } from "./nested/deep/thing";
export const use = [a, b, c, d];
`,
      },
    });

    assert.equal(countFor(diagnostics, "no-ancestor-directory-import"), 0);
  });

  it("leaves bare and aliased specifiers alone", () => {
    const diagnostics = lint({
      rules,
      files: {
        "src/a.ts": `import { a } from "react";
import { b } from "@scope/pkg";
import { c } from "node:path";
export const use = [a, b, c];
`,
      },
    });

    assert.equal(countFor(diagnostics, "no-ancestor-directory-import"), 0);
  });

  // `index.module.css` has basename `index.module`, not `index` — the naive
  // "starts with index" check would swallow every CSS-module import.
  it("does not treat index.module.css as an index file", () => {
    const diagnostics = lint({
      rules,
      files: {
        "src/feature/a.ts": `import styles from "../index.module.css";
export const use = styles;
`,
      },
    });

    assert.equal(countFor(diagnostics, "no-ancestor-directory-import"), 0);
  });

  it("covers re-export forms, which the original rule missed", () => {
    const diagnostics = lint({
      rules,
      files: {
        "src/feature/a.ts": `export * from "..";
export { thing } from ".";
export const own = 1;
`,
      },
    });

    assert.equal(countFor(diagnostics, "no-ancestor-directory-import"), 2);
  });
});

describe("magic/react-require-autocomplete", () => {
  const rules = { "magic/react-require-autocomplete": "error" };

  it("reports an autofillable input with no autoComplete", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.tsx": `export const A = () => <input type="text" />;
export const B = () => <input type="password" />;
export const C = () => <input />;
`,
      },
    });

    assert.equal(countFor(diagnostics, "react-require-autocomplete"), 3);
  });

  it("accepts either casing of the attribute", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.tsx": `export const A = () => <input type="text" autoComplete="name" />;
export const B = () => <input type="text" autocomplete="off" />;
`,
      },
    });

    assert.equal(countFor(diagnostics, "react-require-autocomplete"), 0);
  });

  it("ignores input types the browser cannot autofill", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.tsx": `export const A = () => <input type="checkbox" />;
export const B = () => <input type="submit" />;
export const C = () => <input type="file" />;
`,
      },
    });

    assert.equal(countFor(diagnostics, "react-require-autocomplete"), 0);
  });

  it("matches the type attribute case-insensitively, as HTML does", () => {
    const diagnostics = lint({
      rules,
      files: { "a.tsx": `export const A = () => <input type="TEXT" />;\n` },
    });

    assert.equal(countFor(diagnostics, "react-require-autocomplete"), 1);
  });

  // Both divergences from the upstream rule, and both exist to avoid reporting
  // on code where the answer is unknowable from syntax.
  it("skips spread attributes and computed types", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.tsx": `export const A = (props) => <input type="text" {...props} />;
export const B = ({ kind }) => <input type={kind} />;
`,
      },
    });

    assert.equal(countFor(diagnostics, "react-require-autocomplete"), 0);
  });

  it("honours inputComponents", () => {
    const diagnostics = lint({
      files: {
        "a.tsx": `export const A = () => <TextField type="email" />;
export const B = () => <Other type="email" />;
`,
      },
      rules: {
        "magic/react-require-autocomplete": [
          "error",
          { inputComponents: ["TextField"] },
        ],
      },
    });

    assert.equal(countFor(diagnostics, "react-require-autocomplete"), 1);
  });
});

describe("magic/react-hooks-strict-return", () => {
  const rules = { "magic/react-hooks-strict-return": "error" };

  it("reports a hook returning more than two tuple values", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.ts": `export const useThing = () => {
  return [1, 2, 3];
};
export function useOther() {
  return [1, 2, 3, 4];
}
`,
      },
    });

    assert.equal(countFor(diagnostics, "react-hooks-strict-return"), 2);
  });

  it("allows a two-value tuple and an object of any size", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.ts": `export const useThing = () => {
  return [1, 2];
};
export const useOther = () => {
  return { a: 1, b: 2, c: 3, d: 4 };
};
`,
      },
    });

    assert.equal(countFor(diagnostics, "react-hooks-strict-return"), 0);
  });

  it("ignores plain functions that are not hooks", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.ts": `export const buildTriple = () => {
  return [1, 2, 3];
};
export const user = () => {
  return [1, 2, 3];
};
`,
      },
    });

    assert.equal(countFor(diagnostics, "react-hooks-strict-return"), 0);
  });

  // The innermost function owns the return, so a big tuple built inside a
  // callback is the callback's business, not the hook's.
  it("attributes a return to the nearest enclosing function", () => {
    const diagnostics = lint({
      rules,
      files: {
        "a.ts": `export const useThing = () => {
  const rows = [1, 2].map(() => {
    return [1, 2, 3];
  });
  return rows;
};
`,
      },
    });

    assert.equal(countFor(diagnostics, "react-hooks-strict-return"), 0);
  });

  it("honours maximumReturnValues", () => {
    const files = {
      "a.ts": `export const useThing = () => {
  return [1, 2, 3];
};
`,
    };

    const strict = lint({
      files,
      rules: {
        "magic/react-hooks-strict-return": [
          "error",
          { maximumReturnValues: 2 },
        ],
      },
    });
    const lenient = lint({
      files,
      rules: {
        "magic/react-hooks-strict-return": [
          "error",
          { maximumReturnValues: 3 },
        ],
      },
    });

    assert.equal(countFor(strict, "react-hooks-strict-return"), 1);
    assert.equal(countFor(lenient, "react-hooks-strict-return"), 0);
  });
});
