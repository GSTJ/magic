import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

const require_ = createRequire(import.meta.url);

const packageRoot = join(import.meta.dirname, "..");
const oxfmtBin = join(
  dirname(require_.resolve("oxfmt/package.json", { paths: [packageRoot] })),
  "bin",
  "oxfmt",
);

/** Format `source` with a variant and return the result. */
const format = async (variantName, fileName, source) => {
  const module = await import(join(packageRoot, "dist", "index.js"));
  const config = module[variantName];

  const dir = mkdtempSync(join(tmpdir(), "magic-oxfmt-config-"));
  try {
    writeFileSync(join(dir, ".oxfmtrc.json"), JSON.stringify(config));
    writeFileSync(join(dir, fileName), source);

    execFileSync(oxfmtBin, [fileName], { cwd: dir, encoding: "utf8" });
    return readFileSync(join(dir, fileName), "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("house style", () => {
  it("wraps at 80 columns, not oxfmt's default 100", async () => {
    // 90 columns: fits inside oxfmt's default 100, but not inside our 80. If
    // printWidth were left unset this would come back untouched.
    const source =
      "const x = someFunction(argumentOne, argumentTwo, argumentThree, argumentFour, five);\n";
    assert.ok(source.trim().length > 80 && source.trim().length < 100);

    const output = await format("base", "a.ts", source);

    assert.ok(
      output.includes("\n  argumentOne,"),
      `expected a break at printWidth 80, got:\n${output}`,
    );
  });

  it("uses double quotes and semicolons", async () => {
    const output = await format("base", "a.ts", "const x = 'hello'\n");

    assert.equal(output.trim(), 'const x = "hello";');
  });

  it("uses trailing commas everywhere", async () => {
    const output = await format(
      "base",
      "a.ts",
      "const x = { alphaKey: 1, betaKey: 2, gammaKey: 3, deltaKey: 4, epsilonKey: 5, zetaKey: 6 };\n",
    );

    assert.match(output, /,\n\}/);
  });
});

describe("import sorting", () => {
  it("puts types first, then react, then expo, then third party, then relative", async () => {
    const output = await format(
      "expo",
      "a.tsx",
      [
        `import { local } from "./local";`,
        `import axios from "axios";`,
        `import { Stack } from "expo-router";`,
        `import type { Foo } from "./types";`,
        `import { View } from "react-native";`,
        `import fs from "node:fs";`,
        "",
      ].join("\n"),
    );

    const order = output
      .split("\n")
      .filter((line) => line.startsWith("import"))
      .map((line) => line.split('"')[1]);

    assert.deepEqual(order, [
      "./types",
      "node:fs",
      "react-native",
      "expo-router",
      "axios",
      "./local",
    ]);
  });

  it("classifies ~/ @/ # aliases as internal, after third-party", async () => {
    // Regression: internalPattern takes literal PREFIXES, not perfectionist
    // globs. With globs ("@/**") nothing matches and every alias falls through
    // to value-external, landing next to "zod" instead of in its own group.
    const output = await format(
      "base",
      "a.ts",
      [
        `import { c } from "#charlie";`,
        `import { z } from "zod";`,
        `import { a } from "~/alpha";`,
        `import { b } from "@/bravo";`,
        "",
        "export const all = [z, a, b, c];",
        "",
      ].join("\n"),
    );

    const order = output
      .split("\n")
      .filter((line) => line.startsWith("import"))
      .map((line) => line.split('"')[1]);

    assert.deepEqual(order, ["zod", "#charlie", "@/bravo", "~/alpha"]);
    // ...and in a separate group, not merged into the external block.
    assert.match(output, /"zod";\n\n/);
  });

  it("does not move side-effect imports", async () => {
    const output = await format(
      "reactNative",
      "a.ts",
      [
        `import "react-native-gesture-handler";`,
        `import { z } from "zod";`,
        "",
      ].join("\n"),
    );

    assert.ok(
      output.indexOf("react-native-gesture-handler") < output.indexOf("zod"),
      `side-effect import moved:\n${output}`,
    );
  });
});

describe("variants", () => {
  it("react-native ignores native build directories", async () => {
    const module = await import(join(packageRoot, "dist", "index.js"));

    assert.ok(module.reactNative.ignorePatterns.includes("**/ios/**"));
    assert.ok(module.reactNative.ignorePatterns.includes("**/android/**"));
    assert.ok(!module.base.ignorePatterns.includes("**/ios/**"));
  });

  it("every variant leaves a generated CHANGELOG.md alone", async () => {
    const module = await import(join(packageRoot, "dist", "index.js"));

    // release-please and friends re-append entries in their own style on every
    // release. Formatting the file once means the format check fails on every
    // release PR from then on — a permanent, self-inflicted red CI.
    const generated = [
      "# Changelog\n",
      "## [1.2.0](https://example.test/compare/v1.1.0...v1.2.0) (2026-07-27)\n",
      "\n",
      "### Features\n",
      "\n",
      "* **api:** add the thing ([abc1234](https://example.test/commit/abc1234))\n",
    ].join("");

    for (const name of ["base", "react", "reactNative", "next", "expo"]) {
      assert.ok(
        module[name].ignorePatterns.includes("**/CHANGELOG.md"),
        `${name} does not ignore CHANGELOG.md`,
      );
    }

    const dir = mkdtempSync(join(tmpdir(), "magic-oxfmt-changelog-"));
    try {
      writeFileSync(join(dir, ".oxfmtrc.json"), JSON.stringify(module.base));
      writeFileSync(join(dir, "CHANGELOG.md"), generated);

      execFileSync(oxfmtBin, ["."], { cwd: dir, encoding: "utf8" });

      assert.equal(
        readFileSync(join(dir, "CHANGELOG.md"), "utf8"),
        generated,
        "oxfmt rewrote CHANGELOG.md",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("every variant keeps the house style", async () => {
    const module = await import(join(packageRoot, "dist", "index.js"));

    for (const name of ["base", "react", "reactNative", "next", "expo"]) {
      assert.equal(module[name].printWidth, 80, `${name} printWidth`);
      assert.equal(module[name].singleQuote, false, `${name} singleQuote`);
      assert.equal(module[name].semi, true, `${name} semi`);
      assert.equal(module[name].trailingComma, "all", `${name} trailingComma`);
    }
  });
});

describe("magic-oxfmt-init", () => {
  const cliBin = join(packageRoot, "dist", "cli.js");

  /** Run the bin in a throwaway dir seeded with `files`. Never throws. */
  const run = (files, args = []) => {
    const dir = mkdtempSync(join(tmpdir(), "magic-oxfmt-init-"));
    try {
      for (const [name, body] of Object.entries(files)) {
        writeFileSync(join(dir, name), body);
      }
      try {
        const stdout = execFileSync(process.execPath, [cliBin, ...args], {
          cwd: dir,
          encoding: "utf8",
        });
        return { code: 0, stdout, stderr: "", dir };
      } catch (error) {
        return {
          code: error.status,
          stdout: error.stdout ?? "",
          stderr: error.stderr ?? "",
          dir,
        };
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("writes a snapshot in a clean directory", () => {
    const { code, stdout } = run({});

    assert.equal(code, 0);
    assert.match(stdout, /wrote base config/);
  });

  // oxfmt accepts exactly one config file per directory. Two present is a hard
  // load error on every later run, so the bin must not create that state.
  for (const other of [
    "oxfmt.config.mts",
    "oxfmt.config.ts",
    ".oxfmtrc.jsonc",
  ]) {
    it(`refuses to write .oxfmtrc.json next to ${other}`, () => {
      const { code, stderr } = run({ [other]: "export default {};\n" });

      assert.equal(code, 1);
      assert.match(stderr, /refusing to write/);
      assert.match(stderr, new RegExp(other.replaceAll(".", String.raw`\.`)));
    });

    it(`--force does not bypass the ${other} conflict`, () => {
      const { code, stderr } = run({ [other]: "export default {};\n" }, [
        "base",
        "--force",
      ]);

      assert.equal(code, 1);
      assert.match(stderr, /refusing to write/);
    });
  }

  it("--out lets the snapshot escape the conflict", () => {
    const { code, stdout } = run(
      { "oxfmt.config.mts": "export default {};\n" },
      ["base", "--out", "snapshot.json"],
    );

    assert.equal(code, 0);
    assert.match(stdout, /wrote base config/);
  });

  it("still guards a plain overwrite, and --force still allows it", () => {
    const blocked = run({ ".oxfmtrc.json": "{}\n" });
    assert.equal(blocked.code, 1);
    assert.match(blocked.stderr, /already exists\. Pass --force/);

    const forced = run({ ".oxfmtrc.json": "{}\n" }, ["base", "--force"]);
    assert.equal(forced.code, 0);
  });
});
