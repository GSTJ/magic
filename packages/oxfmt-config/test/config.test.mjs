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
