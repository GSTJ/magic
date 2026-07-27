/**
 * magic-tsconfig had no test until a consumer's `rimraf dist && tsc` started
 * silently emitting nothing on the second run: `base.json` set
 * `"incremental": true` with no `tsBuildInfoFile`, so tsc wrote
 * `<config>.tsbuildinfo` *next to the config* — outside `outDir` — and after the
 * clean still believed the deleted output was current. Exit 0, no output, and
 * the failure only surfaced at `require("./build")`.
 *
 * The JSON assertions below are cheap; the build-clean-build test is the one
 * that actually reproduces it.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

const require_ = createRequire(import.meta.url);
const packageRoot = join(import.meta.dirname, "..");
const tsc = join(
  dirname(require_.resolve("typescript/package.json")),
  "bin",
  "tsc",
);

const VARIANTS = [
  "base.json",
  "internal-package.json",
  "nextjs.json",
  "expo.json",
];

const read = (name) =>
  JSON.parse(readFileSync(join(packageRoot, name), "utf8"));

test("no variant turns on `incremental` without saying where the cache goes", () => {
  const offenders = VARIANTS.filter((name) => {
    const { compilerOptions = {} } = read(name);
    return (
      compilerOptions.incremental === true &&
      typeof compilerOptions.tsBuildInfoFile !== "string"
    );
  });

  assert.deepEqual(
    offenders,
    [],
    `${offenders.join(", ")} set incremental without tsBuildInfoFile. tsc then ` +
      `writes <config>.tsbuildinfo next to the config, which no ` +
      `\`rimraf <outDir>\` invalidates, and the next build emits nothing.`,
  );
});

test("internal-package.json still emits declarations only", () => {
  // Not a bug — it is what the name means. Asserted so that if it ever changes,
  // the README section that tells libraries to use tsconfig.build.json instead
  // gets revisited on purpose rather than by accident.
  const { compilerOptions } = read("internal-package.json");
  assert.equal(compilerOptions.emitDeclarationOnly, true);
  assert.equal(compilerOptions.noEmit, false);
});

test("a library build survives `rimraf out && tsc` twice", () => {
  const dir = mkdtempSync(join(tmpdir(), "magic-tsconfig-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "index.ts"), "export const answer = 42;\n");
    writeFileSync(
      join(dir, "tsconfig.build.json"),
      `${JSON.stringify(
        {
          extends: join(packageRoot, "base.json"),
          include: ["src"],
          compilerOptions: { outDir: "./build", rootDir: "src", noEmit: false },
        },
        null,
        2,
      )}\n`,
    );

    const build = () =>
      execFileSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
        cwd: dir,
        encoding: "utf8",
      });

    build();
    assert.ok(
      existsSync(join(dir, "build", "index.js")),
      "first build emitted",
    );

    rmSync(join(dir, "build"), { recursive: true, force: true });
    build();
    assert.ok(
      existsSync(join(dir, "build", "index.js")),
      "second build emitted nothing after the output dir was removed — " +
        "a stale tsbuildinfo outside outDir is the usual cause",
    );

    const strays = readdirSync(dir).filter((name) =>
      name.endsWith(".tsbuildinfo"),
    );
    assert.deepEqual(
      strays,
      [],
      `base.json left ${strays.join(", ")} next to the tsconfig`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
