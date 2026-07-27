import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

const require_ = createRequire(import.meta.url);

const packageRoot = join(import.meta.dirname, "..");
const oxlintBin = join(
  dirname(require_.resolve("oxlint/package.json", { paths: [packageRoot] })),
  "bin",
  "oxlint",
);

const VARIANTS = ["base", "react", "react-native", "next", "expo"];

/**
 * Run oxlint with a variant's shipped JSON. oxlint validates the whole config
 * before it lints, and an unknown rule or plugin name is a hard error — so a
 * clean run here means the config is structurally valid, not merely parseable.
 */
const lintWith = (configPath, source, fileName = "a.tsx") => {
  const dir = mkdtempSync(join(tmpdir(), "magic-oxlint-config-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", fileName), source);

    try {
      const stdout = execFileSync(
        oxlintBin,
        ["-c", configPath, "--format", "json", "src"],
        {
          cwd: dir,
          encoding: "utf8",
        },
      );
      return JSON.parse(stdout);
    } catch (error) {
      if (!error.stdout) throw error;
      return JSON.parse(error.stdout);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("shipped JSON variants", () => {
  for (const variant of VARIANTS) {
    it(`${variant}.json is accepted by oxlint`, () => {
      const result = lintWith(
        join(packageRoot, `${variant}.json`),
        "export const value = 1;\n",
      );

      // A config error surfaces as a non-JSON parse failure or an empty run;
      // reaching here with a diagnostics array means oxlint validated it.
      assert.ok(Array.isArray(result.diagnostics));
      assert.equal(result.diagnostics.length, 0);
    });
  }

  it("keeps the JSON mirrors in sync with the JS entry points", async () => {
    const loaded = await Promise.all(
      VARIANTS.map(async (variant) => ({
        variant,
        json: JSON.parse(
          readFileSync(join(packageRoot, `${variant}.json`), "utf8"),
        ),
        module: await import(join(packageRoot, "dist", `${variant}.js`)),
      })),
    );

    for (const { variant, json, module } of loaded) {
      // The JS form resolves jsPlugin specifiers to absolute paths, so compare
      // everything except that field.
      const { $schema, jsPlugins: _jsonPlugins, ...jsonRest } = json;
      const { jsPlugins: _jsPlugins, ...jsRest } = module.default;

      assert.ok($schema, `${variant}.json is missing $schema`);
      assert.deepEqual(
        jsonRest,
        jsRest,
        `${variant}.json has drifted from dist/${variant}.js — run pnpm build`,
      );
    }
  });
});

describe("variant composition", () => {
  it("react inherits base rules", async () => {
    const base = await import(join(packageRoot, "dist", "base.js"));
    const react = await import(join(packageRoot, "dist", "react.js"));

    assert.equal(
      react.default.rules["no-console"],
      base.default.rules["no-console"],
    );
    assert.ok(react.default.rules["react/jsx-key"]);
    assert.ok(react.default.plugins.includes("typescript"));
    assert.ok(react.default.plugins.includes("react"));
  });

  it("expo inherits the react-native ignore patterns", async () => {
    const expo = await import(join(packageRoot, "dist", "expo.js"));

    assert.ok(expo.default.ignorePatterns.includes("**/ios/**"));
    assert.ok(expo.default.ignorePatterns.includes("**/.expo/**"));
  });

  it("base bans direct process.env access", () => {
    const result = lintWith(
      join(packageRoot, "base.json"),
      "export const key = process.env.SECRET;\n",
    );

    assert.ok(
      result.diagnostics.some(
        (d) => d.code === "eslint(no-restricted-properties)",
      ),
      "expected no-restricted-properties to fire on process.env",
    );
  });

  it("base bans namespace imports, react allows the ecosystem ones", () => {
    const source = [
      'import * as React from "react";',
      'import * as Dialog from "@radix-ui/react-dialog";',
      'import * as utils from "./utils";',
      "",
      "export const value = [React, Dialog, utils];",
    ].join("\n");

    const codes = (variant) =>
      lintWith(join(packageRoot, `${variant}.json`), `${source}\n`)
        .diagnostics.filter((d) => d.code === "import(no-namespace)")
        .map((d) => d.labels[0].span.line);

    assert.deepEqual(
      codes("base"),
      [1, 2, 3],
      "base should report every namespace import",
    );
    assert.deepEqual(
      codes("react"),
      [3],
      "react should ignore `react` and `@radix-ui/*` only",
    );
  });

  it("applies the jest recommended set in test files, identically in every variant", () => {
    // Each line trips a `flat/recommended` rule that is *not* one of the rules
    // the preset used to name explicitly. They were all silently off in `base`.
    const source = [
      "expect(1).toBe(1);",
      "",
      "describe('suite', async () => {",
      "  it('conditional', () => {",
      "    try {",
      "      expect(1).toBe(2);",
      "    } catch {",
      "      expect(true).toBe(true);",
      "    }",
      "  });",
      "  it('callback', (done) => {",
      "    done();",
      "  });",
      "  it('alias', () => {",
      "    expect(jest.fn()).toBeCalled();",
      "  });",
      "});",
      "",
      "export const helper = 1;",
    ].join("\n");

    const expected = [
      "jest(no-alias-methods)",
      "jest(no-conditional-expect)",
      "jest(no-done-callback)",
      "jest(no-export)",
      "jest(no-standalone-expect)",
      "jest(valid-describe-callback)",
    ];

    for (const variant of VARIANTS) {
      const result = lintWith(
        join(packageRoot, `${variant}.json`),
        `${source}\n`,
        "a.test.tsx",
      );
      const jestCodes = [
        ...new Set(
          result.diagnostics
            .map((d) => d.code)
            .filter((code) => code.startsWith("jest(")),
        ),
      ].sort();

      assert.deepEqual(
        jestCodes,
        expected,
        `${variant}.json reported a different jest rule set`,
      );
    }
  });

  it("keeps the JSX-handler escape hatch on typescript/no-misused-promises", async () => {
    const base = await import(join(packageRoot, "dist", "base.js"));

    // Dormant until `--type-aware`, so nothing here can lint it. The option is
    // still load-bearing: without it every `onClick={async () => …}` errors the
    // day a repo passes the flag, which is exactly the config change the
    // dormant design promises not to need.
    assert.deepEqual(base.default.rules["typescript/no-misused-promises"], [
      "error",
      { checksVoidReturn: { attributes: false } },
    ]);
  });

  it("react catches leaked && JSX via the safe-jsx JS plugin", () => {
    const result = lintWith(
      join(packageRoot, "react.json"),
      "export const C = ({ n }: { n: number }) => <div>{n && <span />}</div>;\n",
    );

    assert.ok(
      result.diagnostics.some(
        (d) => d.code === "safe-jsx(jsx-explicit-boolean)",
      ),
      "expected safe-jsx to fire on `n && <span/>`",
    );
  });
});
