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
const lintWith = (configPath, source) => {
  const dir = mkdtempSync(join(tmpdir(), "magic-oxlint-config-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.tsx"), source);

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
