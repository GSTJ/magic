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

  it("mirrors env and globals into an override, in every variant", () => {
    // oxlint's `extends` drops top-level `env` and `globals`. `overrides`
    // survive it, so each variant repeats the two fields in a `files: ["**"]`
    // entry — and repeats them exactly once, however deep the variant chain is.
    // `fixtures/adversarial/extends` proves the behaviour end to end; this
    // asserts the shape that produces it, including for JSON consumers, who
    // have no alternative to `extends`.
    for (const variant of VARIANTS) {
      const json = JSON.parse(
        readFileSync(join(packageRoot, `${variant}.json`), "utf8"),
      );
      const carriers = json.overrides.filter(
        (entry) => entry.files.length === 1 && entry.files[0] === "**",
      );

      assert.equal(
        carriers.length,
        1,
        `${variant}.json should carry exactly one env/globals override`,
      );
      assert.equal(
        json.overrides.indexOf(carriers[0]),
        0,
        `${variant}.json should carry it first, so nothing it sets outranks a later entry`,
      );
      assert.deepEqual(carriers[0].env, json.env, `${variant}.json env`);
      assert.deepEqual(
        carriers[0].globals ?? json.globals,
        json.globals,
        `${variant}.json globals`,
      );
      assert.ok(
        !carriers[0].rules && !carriers[0].plugins,
        `${variant}.json's carrier must set nothing but env/globals`,
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

/**
 * Turning `unicorn/filename-case` on (DECISIONS.md §6) means every framework
 * that derives behaviour from a filename is now one bad exemption away from a
 * broken app. These assert against a real tree rather than against the comments
 * in the source, because the rule's actual semantics are surprising: it checks
 * only the segment before the *first* dot, it trims leading and trailing
 * underscores, and it rejects nothing but uppercase, spaces and interior
 * underscores — `+not-found.tsx` and `$ref.ts` pass on their own merits, while
 * `[userId].tsx` needs the bracket exemption.
 */
describe("unicorn/filename-case exemptions", () => {
  /** Lint one named file with a variant and say whether filename-case fired. */
  const reportsFilenameCase = (variant, fileName) => {
    const result = lintWith(
      join(packageRoot, `${variant}.json`),
      "export default 1;\n",
      fileName,
    );
    return result.diagnostics.some((d) => d.code === "unicorn(filename-case)");
  };

  const NEVER_REPORTED = [
    // Next.js App Router reserved files — all already kebab-valid.
    "page.tsx",
    "layout.tsx",
    "loading.tsx",
    "error.tsx",
    "not-found.tsx",
    "global-error.tsx",
    "template.tsx",
    "default.tsx",
    "route.ts",
    "sitemap.ts",
    "robots.ts",
    "manifest.ts",
    "opengraph-image.tsx",
    "apple-icon.tsx",
    "middleware.ts",
    "instrumentation.ts",
    // Pages Router — pass only because leading underscores are trimmed.
    "_app.tsx",
    "_document.tsx",
    // expo-router.
    "_layout.tsx",
    "+not-found.tsx",
    "+html.tsx",
    // Dynamic segments across every file-based router. These are the ones that
    // need the `ignore` entry: the parameter name is camelCase by convention.
    "[postId].tsx",
    "[userId].ts",
    "[...slug].tsx",
    "[[...filters]].tsx",
    // Ordinary code that happens to be fine.
    "use-theme.ts",
    "index.ts",
    "button.test.tsx",
    "theme.ios.ts",
  ];

  for (const variant of VARIANTS) {
    it(`${variant} leaves framework-reserved filenames alone`, () => {
      const reported = NEVER_REPORTED.filter((name) =>
        reportsFilenameCase(variant, name),
      );
      assert.deepEqual(
        reported,
        [],
        `${variant} would demand a rename of files whose names are a framework contract`,
      );
    });

    it(`${variant} still reports ordinary PascalCase and camelCase files`, () => {
      assert.equal(reportsFilenameCase(variant, "AlertBanner.tsx"), true);
      assert.equal(reportsFilenameCase(variant, "formatDate.ts"), true);
      assert.equal(reportsFilenameCase(variant, "Button.stories.tsx"), true);
    });
  }

  it("exempts App.tsx in the React Native family and nowhere else", () => {
    // Bare RN's `index.js` imports `./App`, and classic Expo points `main` at
    // `node_modules/expo/AppEntry.js` whose `import App from "../../App"` is
    // unreachable from any codemod. On APFS the rename looks fine locally and
    // breaks on the first Linux build.
    for (const variant of ["react-native", "expo"]) {
      assert.equal(
        reportsFilenameCase(variant, "App.tsx"),
        false,
        `${variant} should exempt App.tsx`,
      );
    }
    for (const variant of ["base", "react", "next"]) {
      assert.equal(
        reportsFilenameCase(variant, "App.tsx"),
        true,
        `${variant} has no React Native entry point to protect`,
      );
    }
  });

  it("keeps the __mocks__ exemption last, in every variant", () => {
    // An `overrides[]` entry that omits `plugins` re-activates category rules
    // for the files it matches, and `unicorn/filename-case` is a `style` rule.
    // So the exemption only holds if nothing broader follows it — hence the
    // duplicated `mocksFilenameCase` at the end of each variant. Assert the
    // outcome, not the arrangement.
    for (const variant of VARIANTS) {
      const { overrides } = JSON.parse(
        readFileSync(join(packageRoot, `${variant}.json`), "utf8"),
      );
      const last = overrides.at(-1);
      assert.deepEqual(
        last.files,
        ["**/__mocks__/**"],
        `${variant}.json does not end with the __mocks__ override`,
      );
      assert.equal(last.rules["unicorn/filename-case"], "off");
    }
  });
});
