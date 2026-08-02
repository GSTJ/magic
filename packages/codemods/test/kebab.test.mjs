import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import {
  isKebabCase,
  kebabifyBasename,
  kebabifyStem,
  stemOf,
} from "../dist/index.js";
import { oxlintBin, run } from "./helpers.mjs";

/**
 * `--detect builtin` reimplements a rule that lives in a Rust binary. The only
 * defensible way to ship that is to keep proving the two agree, so this
 * generates a corpus, runs the real oxlint over it, and fails on a single
 * disagreement in either direction — a missed violation or a false one.
 *
 * If oxlint 1.76 changes the rule, this is what tells us, rather than a
 * migration agent discovering it against a live repo.
 */

const ALPHABET = [..."abzAZ09-_", "é", "É", "日", "$", "+", "[", " "];

const corpus = () => {
  // Deterministic, so a failure is reproducible from the seed alone.
  let seed = 20_260_727;
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };

  const handWritten = [
    "button.tsx",
    "Button.tsx",
    "myButton.tsx",
    "my-button.tsx",
    "index.ts",
    "MyComponent.test.tsx",
    "charlie.Test.ts",
    "papa.QUEBEC.ts",
    "camelCase.config.ts",
    "_layout.tsx",
    "_Private.ts",
    "__mocks__.ts",
    "alpha_.ts",
    "foo_bar.ts",
    "Foo__Bar.ts",
    "[id].tsx",
    "[...slug].tsx",
    "+page.ts",
    "$ref.ts",
    "a--b.ts",
    "-lead.ts",
    "HTTPServer.ts",
    "parseURLQuery.ts",
    "XMLHttpRequest.ts",
    "IOSThing.ts",
    "OAuth2Client.ts",
    "AppV2.ts",
    "Foo2Bar.ts",
    "S3.ts",
    "toJSON.ts",
    "myAPI.ts",
    "aB.ts",
    "ABC.ts",
    "A.ts",
    "e2e.ts",
    "i18n.ts",
    "with space.ts",
    "wíth-áccent.ts",
    "日本.ts",
    "Ünicode.ts",
    "Theme.ios.ts",
    "Theme.android.tsx",
  ];

  const generated = [];
  for (let index = 0; index < 700; index++) {
    const length = 1 + Math.floor(random() * 6);
    let name = "";
    for (let position = 0; position < length; position++) {
      name += ALPHABET[Math.floor(random() * ALPHABET.length)];
    }
    if (random() < 0.3) {
      name += `.${ALPHABET[Math.floor(random() * ALPHABET.length)]}x`;
    }
    generated.push(`${name}.ts`);
  }

  // The filesystem under this test is case-insensitive, so two names differing
  // only in case would silently become one file and one of them would go
  // untested. Dedupe on the folded name.
  const seen = new Set();
  return [...handWritten, ...generated].filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key) || name.includes("/")) return false;
    seen.add(key);
    return true;
  });
};

describe("the builtin kebab-case check matches oxlint", () => {
  let directory;
  let names;
  let oxlintReported;
  let oxlintSuggested;

  before(() => {
    directory = mkdtempSync(join(tmpdir(), "magic-kebab-corpus-"));
    mkdirSync(join(directory, "src"));
    names = corpus();
    for (const name of names) {
      writeFileSync(join(directory, "src", name), "export const x = 1;\n");
    }
    writeFileSync(
      join(directory, ".oxlintrc.json"),
      `${JSON.stringify({
        plugins: ["unicorn"],
        rules: { "unicorn/filename-case": ["error", { case: "kebabCase" }] },
      })}\n`,
    );

    const { stdout } = run(
      oxlintBin,
      ["-c", ".oxlintrc.json", "--format=json", "src"],
      { cwd: directory },
    );
    const diagnostics = JSON.parse(stdout).diagnostics ?? [];

    const filenameCase = diagnostics
      .filter((diagnostic) => diagnostic.code === "unicorn(filename-case)")
      .map((diagnostic) => ({
        name: diagnostic.filename.replace(/^src\//u, ""),
        target: /Rename the file to '(?<target>[^']+)'/u.exec(
          diagnostic.help ?? "",
        )?.groups?.target,
      }));

    oxlintReported = new Set(filenameCase.map((entry) => entry.name));
    oxlintSuggested = new Map(
      filenameCase
        .filter((entry) => entry.target !== undefined)
        .map((entry) => [entry.name, entry.target]),
    );
  });

  after(() => rmSync(directory, { recursive: true, force: true }));

  it("generates a corpus with violations on both sides of the line", () => {
    assert.ok(names.length > 500, `corpus too small: ${names.length}`);
    assert.ok(oxlintReported.size > 50, "corpus has almost no violations");
    assert.ok(
      oxlintReported.size < names.length - 50,
      "corpus is almost all violations",
    );
  });

  it("agrees with oxlint on every name in the corpus", () => {
    const disagreements = names
      .filter((name) => isKebabCase(name) === oxlintReported.has(name))
      .map(
        (name) =>
          `${JSON.stringify(name)}: builtin says ${isKebabCase(name) ? "ok" : "violation"}, oxlint says ${oxlintReported.has(name) ? "violation" : "ok"}`,
      );

    assert.deepEqual(
      disagreements,
      [],
      `${disagreements.length} of ${names.length} names disagree`,
    );
  });

  it("suggests the same rename target oxlint does", () => {
    const disagreements = [...oxlintSuggested.entries()]
      .filter(([name, target]) => kebabifyBasename(name) !== target)
      .map(
        ([name, target]) =>
          `${name}: builtin ${kebabifyBasename(name)}, oxlint ${target}`,
      );

    assert.deepEqual(disagreements, []);
  });

  it("only ever produces targets the rule accepts", () => {
    for (const name of names) {
      assert.ok(
        isKebabCase(kebabifyBasename(name)),
        `${name} -> ${kebabifyBasename(name)} would still be a violation`,
      );
    }
  });
});

describe("kebab helpers", () => {
  it("only examines the first dot-segment", () => {
    assert.equal(stemOf("Bravo.test.ts"), "Bravo");
    assert.equal(stemOf("charlie.Test.ts"), "charlie");
    assert.equal(isKebabCase("charlie.Test.ts"), true);
    assert.equal(isKebabCase("Bravo.test.ts"), false);
  });

  it("accepts the punctuation file-based routers rely on", () => {
    for (const name of [
      "[id].tsx",
      "[...slug].tsx",
      "+page.ts",
      "_layout.tsx",
      "$ref.ts",
    ]) {
      assert.equal(isKebabCase(name), true, name);
    }
  });

  it("rejects uppercase, interior underscores and spaces, and nothing else", () => {
    assert.equal(isKebabCase("Foo.ts"), false);
    assert.equal(isKebabCase("foo_bar.ts"), false);
    assert.equal(isKebabCase("with space.ts"), false);
    assert.equal(isKebabCase("_foo_.ts"), true);
    assert.equal(isKebabCase("a--b.ts"), true);
  });

  it("handles long underscore runs without regex backtracking", () => {
    const underscores = "_".repeat(100_000);
    assert.equal(isKebabCase(`${underscores}foo${underscores}.ts`), true);
    assert.equal(
      kebabifyStem(`${underscores}Foo${underscores}`),
      `${underscores}foo${underscores}`,
    );
  });

  it("preserves everything after the stem when renaming", () => {
    assert.equal(
      kebabifyBasename("MyComponent.test.tsx"),
      "my-component.test.tsx",
    );
    assert.equal(kebabifyBasename("Theme.ios.ts"), "theme.ios.ts");
    assert.equal(kebabifyStem("_Private"), "_private");
  });
});
