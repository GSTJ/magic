/**
 * Adversarial fixture runner. Executes oxlint/oxfmt against every fixture in
 * this directory and asserts actual vs expected. Exit 0 = everything behaves
 * as recorded.
 *
 * Usage: node fixtures/adversarial/run.mjs   (from anywhere)
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const here = import.meta.dirname;
const repoRoot = join(here, "..", "..");
const require_ = createRequire(import.meta.url);
const bin = (pkg, name) =>
  join(
    dirname(require_.resolve(`${pkg}/package.json`, { paths: [repoRoot] })),
    "bin",
    name,
  );
const oxlintBin = bin("oxlint", "oxlint");
const oxfmtBin = bin("oxfmt", "oxfmt");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  process.stdout.write(
    `  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`,
  );
};
const lint = (cwd, args) => {
  try {
    return JSON.parse(
      execFileSync(oxlintBin, ["--format", "json", ...args], {
        cwd,
        encoding: "utf8",
      }),
    );
  } catch (error) {
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
};
const codes = (report, file) =>
  report.diagnostics
    .filter((d) => !file || d.filename.endsWith(file))
    .map((d) => d.code);
const diag = (report, file, code) =>
  report.diagnostics.filter(
    (d) => d.filename.endsWith(file) && d.code === code,
  );
const line = (d) => d.labels?.[0]?.span?.line ?? 0;
/**
 * 1-based line of `needle` in a fixture file. Assertions about which *case* in a
 * fixture fired have to be anchored to the source, not to a literal line number
 * — oxfmt sorts the imports in these files and moves them around.
 */
const lineOf = (dir, file, needle) => {
  const lines = readFileSync(join(here, dir, "src", file), "utf8").split("\n");
  const index = lines.findIndex((text) => text.includes(needle));
  if (index === -1) throw new Error(`${file}: no line contains ${needle}`);
  return index + 1;
};

// ---------------------------------------------------------------- base ----
process.stdout.write("\n[base] default preset, no opt-ins\n");
{
  const r = lint(join(here, "base"), ["src"]);
  const env = diag(r, "env-access.ts", "eslint(no-restricted-properties)");
  check("process.env access fires twice", env.length === 2);
  check(
    "process.env ban carries the custom message",
    env.every((d) => (d.help ?? "").includes("validated env module")),
  );
  check(
    "env.ts is exempt from the process.env ban",
    codes(r, "env.ts").length === 0,
    `got: ${codes(r, "env.ts").join(", ") || "none"}`,
  );
  check(
    "nested ternary fires",
    codes(r, "nested-ternary.ts").includes("eslint(no-nested-ternary)"),
  );
  check(
    "unused import fires",
    codes(r, "unused-import.ts").includes("eslint(no-unused-vars)"),
  );
  check(
    "for..in fires guard-for-in (closest thing to the old ForInStatement ban)",
    codes(r, "for-in.ts").includes("eslint(guard-for-in)"),
  );
  check(
    "with statement fires no-with",
    codes(r, "with-stmt.js").includes("eslint(no-with)"),
  );
  const magic = r.diagnostics.filter((d) => d.code.startsWith("magic("));
  check(
    "vi.mock / api.useQuery do NOT fire under the default preset",
    magic.length === 0,
    magic.map((d) => d.code).join(", "),
  );

  // unicorn/filename-case, on in `base` since 2026-07-27.
  const cased = r.diagnostics.filter(
    (d) => d.code === "unicorn(filename-case)",
  );
  check(
    "filename-case fires on BadFileName.ts and nothing else",
    cased.length === 1 && cased[0].filename.endsWith("BadFileName.ts"),
    cased.map((d) => d.filename).join(", ") || "none",
  );
  check(
    "the diagnostic carries the rename target magic-kebab reads",
    (cased[0]?.help ?? "").includes("'bad-file-name.ts'"),
    cased[0]?.help ?? "no diagnostic",
  );
  check(
    "[postId].tsx is exempt (route parameter, not a word)",
    !cased.some((d) => d.filename.includes("[postId]")),
  );
  check(
    "__mocks__/AsyncStorage.ts is exempt (the package names the file)",
    !cased.some((d) => d.filename.includes("__mocks__")),
  );

  // ---- rule dispositions reversed after the 1.0.0 consumer reports ----
  check(
    "unicorn/no-array-reverse is off (its autofix needs ES2023; base pins ES2022)",
    !codes(r, "array-reverse.ts").includes("unicorn(no-array-reverse)"),
    codes(r, "array-reverse.ts").join(", ") || "none",
  );
  check(
    "unicorn/catch-error-name leaves a `{ cause }` binding alone",
    !codes(r, "error-cause.ts").includes("unicorn(catch-error-name)"),
    codes(r, "error-cause.ts").join(", ") || "none",
  );
  const typeShape = diag(
    r,
    "type-shape.ts",
    "typescript(consistent-type-definitions)",
  );
  check(
    "consistent-type-definitions prefers `type`: the interface is reported, the alias is not",
    typeShape.length === 1 &&
      line(typeShape[0]) ===
        lineOf("base", "type-shape.ts", "export interface WrongWayRound"),
    typeShape.map(line).join(", ") || "none",
  );
  const titles = diag(r, "titles.test.ts", "jest(valid-title)");
  check(
    "jest/valid-title fires on the 3 real offenders, not on identifier-shaped titles",
    titles.length === 3,
    titles.map(line).join(", ") || "none",
  );
  check(
    '`describe("itemsToChunks")` and `describe("shouldRetry")` pass (the \\b fix)',
    titles.every(
      (d) =>
        line(d) !== lineOf("base", "titles.test.ts", '"itemsToChunks"') &&
        line(d) !== lineOf("base", "titles.test.ts", '"shouldRetry"'),
    ),
    titles.map(line).join(", "),
  );

  // unicorn/prefer-export-from: off, because its suggestion fixer deletes every
  // statement between the first and last re-export. Assert both halves — the
  // rule is silent, AND running the destructive flag changes nothing.
  check(
    "unicorn/prefer-export-from does not fire on a derived-export barrel",
    !codes(r, "derived-reexport.ts").includes("unicorn(prefer-export-from)"),
    codes(r, "derived-reexport.ts").join(", ") || "none",
  );
  {
    const target = join(here, "base", "src", "derived-reexport.ts");
    const before = readFileSync(target, "utf8");
    try {
      execFileSync(
        oxlintBin,
        ["--fix-suggestions", "src/derived-reexport.ts"],
        {
          cwd: join(here, "base"),
        },
      );
    } catch {
      /* non-zero exit is fine — other diagnostics may remain */
    }
    const after = readFileSync(target, "utf8");
    if (after !== before) writeFileSync(target, before, "utf8");
    check(
      "`--fix-suggestions` no longer deletes the derived exports (M18)",
      after === before,
      after.includes("TIMEOUT_SECONDS")
        ? "file was rewritten"
        : "TIMEOUT_SECONDS was DELETED",
    );
  }
}

// --------------------------------------------------------------- optin ----
process.stdout.write(
  "\n[optin] base + magic/no-module-mocks + magic/prefer-suspense-query\n",
);
{
  const r = lint(join(here, "optin"), ["src"]);
  const mocks = diag(r, "mocks.test.ts", "magic(no-module-mocks)");
  check(
    "vi.mock + jest.mock + conditional vi.mock all fire",
    mocks.length === 3,
  );
  check(
    "conditional mock uses the hoisting message",
    mocks.some((d) => d.message.includes("inside a conditional")),
  );
  check(
    "vi.mock outside a test file does not fire",
    diag(r, "not-a-test.ts", "magic(no-module-mocks)").length === 0,
  );
  const suspense = diag(r, "trpc-usequery.ts", "magic(prefer-suspense-query)");
  check(
    "useQuery fires on api + trpc roots only (2 hits, not 4)",
    suspense.length === 2,
    `got ${suspense.length}`,
  );
}

// ------------------------------------------------------------- shopify ----
process.stdout.write(
  "\n[shopify] every @shopify rule's disposition, executed (DECISIONS.md §6)\n",
);
{
  const r = lint(join(here, "shopify"), ["src"]);

  // --- ported into magic-oxlint-plugin ---
  const early = diag(r, "early-return.ts", "magic(prefer-early-return)");
  check(
    "prefer-early-return fires on a wrapped body and a braceless expression",
    early.length === 2,
    `got ${early.length}`,
  );
  const guards = lineOf("shopify", "early-return.ts", "export const bail");
  check(
    "a braceless `return` / `throw` consequent is NOT reported (fidelity fix)",
    !early.some((d) => line(d) >= guards),
    early.map(line).join(", "),
  );

  const ancestor = diag(
    r,
    "ancestor-import.ts",
    "magic(no-ancestor-directory-import)",
  );
  check(
    "no-ancestor-directory-import fires on 3 imports + 2 re-exports",
    ancestor.length === 5,
    `got ${ancestor.length}`,
  );
  check(
    "`../elsewhere/index.ts` is NOT reported — it goes down, not up",
    !ancestor.some((d) => d.message.includes("elsewhere")),
  );

  const autocomplete = diag(
    r,
    "autocomplete.tsx",
    "magic(react-require-autocomplete)",
  );
  check(
    "react-require-autocomplete fires on <input type=email> and a listed component",
    autocomplete.length === 2 &&
      autocomplete.some((d) => d.message.includes("<TextField>")),
    `got ${autocomplete.length}`,
  );
  const silent = lineOf("shopify", "autocomplete.tsx", 'autoComplete="current');
  check(
    "an explicit autoComplete, a checkbox, a spread and a computed type are all silent",
    autocomplete.every((d) => line(d) < silent),
    autocomplete.map(line).join(", "),
  );

  const strictReturn = diag(
    r,
    "strict-return.ts",
    "magic(react-hooks-strict-return)",
  );
  check(
    "react-hooks-strict-return fires once, on the 4-tuple hook",
    strictReturn.length === 1 &&
      strictReturn[0].message.includes("`useCounter`"),
    `got ${strictReturn.length}`,
  );
  check(
    "an object return and a non-hook function are NOT reported",
    !strictReturn.some(
      (d) => d.message.includes("useNamed") || d.message.includes("buildTuple"),
    ),
  );

  // --- covered natively, wired from the plugin README's snippets ---
  const full = diag(r, "full-import.ts", "eslint(no-restricted-imports)");
  check(
    "restrict-full-import: `importNames: [default]` catches both spellings",
    full.length === 2,
    `got ${full.length}`,
  );
  const deepImport = lineOf("shopify", "full-import.ts", "lodash/debounce.js");
  check(
    "`import { debounce } from 'lodash/debounce.js'` is left alone",
    full.every((d) => line(d) !== deepImport),
    full.map(line).join(", "),
  );

  const namespaced = diag(r, "namespace.ts", "import(no-namespace)");
  check(
    "no-namespace-imports: only node:path is reported; react + @radix-ui pass",
    namespaced.length === 1 &&
      line(namespaced[0]) === lineOf("shopify", "namespace.ts", "node:path"),
    namespaced.map(line).join(", "),
  );

  const boundary = diag(
    r,
    "component-boundary.ts",
    "eslint(no-restricted-imports)",
  );
  check(
    "strict-component-boundaries: `patterns` reports the deep reach, not the entry point",
    boundary.length === 1 &&
      boundary[0].help?.includes("Import from its entry point"),
    `got ${boundary.length}`,
  );

  const literals = diag(r, "literals.tsx", "react(jsx-no-literals)");
  const hardcoded = lineOf("shopify", "literals.tsx", "Hardcoded copy");
  check(
    "jsx-no-hardcoded-content: only the untranslatable copy is reported",
    literals.length === 1,
    literals.map(line).join(", "),
  );
  check(
    "allowedStrings, elementOverrides.allowElement and ignoreProps all hold",
    literals.every((d) => line(d) === hardcoded),
    `expected line ${hardcoded}, got ${literals.map(line).join(", ")}`,
  );
}

// --------------------------------------------------------------- react ----
process.stdout.write("\n[react] safe-jsx trip + --fix\n");
{
  const reactDir = join(here, "react");
  const r = lint(reactDir, ["src/leaked-jsx.tsx"]);
  check(
    "leaked && JSX fires safe-jsx(jsx-explicit-boolean)",
    codes(r, "leaked-jsx.tsx").includes("safe-jsx(jsx-explicit-boolean)"),
  );

  const workDir = join(reactDir, "work");
  mkdirSync(workDir, { recursive: true });
  const fixCopy = join(workDir, "leaked-jsx.tsx");
  copyFileSync(join(reactDir, "src", "leaked-jsx.tsx"), fixCopy);
  try {
    execFileSync(oxlintBin, ["--fix", "work/leaked-jsx.tsx"], {
      cwd: reactDir,
    });
  } catch {
    /* non-zero exit is fine — diagnostics may remain */
  }
  const afterOne = readFileSync(fixCopy, "utf8");
  check(
    "--fix rewrites to Boolean(items.length) &&",
    afterOne.includes("Boolean(items.length) &&"),
  );
  const rFixed = lint(reactDir, ["work/leaked-jsx.tsx"]);
  check(
    "safe-jsx no longer fires after --fix",
    !codes(rFixed, "leaked-jsx.tsx").includes("safe-jsx(jsx-explicit-boolean)"),
  );
  // Pass 1 leaves unicorn/explicit-length-check on Boolean(items.length); a
  // second --fix pass converges to `items.length > 0` and zero diagnostics.
  try {
    execFileSync(oxlintBin, ["--fix", "work/leaked-jsx.tsx"], {
      cwd: reactDir,
    });
  } catch {
    /* see above */
  }
  const rConverged = lint(reactDir, ["work/leaked-jsx.tsx"]);
  check(
    "second --fix pass converges to zero diagnostics",
    rConverged.diagnostics.length === 0 &&
      readFileSync(fixCopy, "utf8").includes("items.length > 0 &&"),
  );
  rmSync(workDir, { recursive: true, force: true });
}

// -------------------------------------------------------- react-native ----
process.stdout.write(
  "\n[react-native] variant + README restricted-imports snippet\n",
);
{
  const r = lint(join(here, "react-native"), ["src"]);
  const restricted = diag(r, "restricted.tsx", "eslint(no-restricted-imports)");
  check("three restricted imports fire", restricted.length === 3);
  const helpFor = (name) =>
    restricted.find((d) => d.message.includes(`'${name}'`))?.help ?? "";
  check(
    "TouchableOpacity gets the PressableArea message",
    helpFor("TouchableOpacity").includes("PressableArea"),
  );
  check(
    "TouchableHighlight gets the PressableArea message",
    helpFor("TouchableHighlight").includes("PressableArea"),
  );
  check(
    "Image gets its OWN message (per-entry messages work)",
    helpFor("Image").includes("@/components/Image"),
  );
  check(
    "View is not flagged",
    !restricted.some((d) => d.message.includes("'View'")),
  );
  const inline = codes(r, "inline-style.tsx");
  check(
    "eslint-plugin-react-native jsPlugin loads and fires",
    inline.includes("react-native(no-inline-styles)") &&
      inline.includes("react-native(no-color-literals)"),
  );
}

// ---------------------------------------------------------------- next ----
process.stdout.write(
  "\n[next] App Router file conventions the preset promises to exempt\n",
);
{
  const r = lint(join(here, "next"), ["src"]);

  check(
    "middleware.ts keeps its plain-string matcher (unicorn/prefer-string-raw off)",
    !codes(r, "middleware.ts").includes("unicorn(prefer-string-raw)"),
    codes(r, "middleware.ts").join(", ") || "none",
  );
  check(
    "`export default async () => {}` passes in an App Router page",
    !codes(r, "page.tsx").includes("import(no-anonymous-default-export)"),
    codes(r, "page.tsx").join(", ") || "none",
  );
  check(
    "`export default function Layout()` passes in an App Router layout",
    !codes(r, "layout.tsx").includes("react(function-component-definition)"),
    codes(r, "layout.tsx").join(", ") || "none",
  );
  check(
    "the Pages Router keeps the same exemptions",
    codes(r, "legacy.tsx").length === 0,
    codes(r, "legacy.tsx").join(", ") || "none",
  );
  check(
    "the whole App Router fixture is clean — no page shape is left unlintable",
    r.diagnostics.length === 0,
    r.diagnostics.map((d) => `${d.filename}:${d.code}`).join(", "),
  );
}

// ------------------------------------------------------------ override ----
process.stdout.write(
  "\n[override] can a consumer turn off a rule the preset sets inside an override?\n",
);
{
  const r = lint(join(here, "override"), ["src"]);
  const withoutPlugins = diag(r, "no-plugins.test.ts", "jest(valid-title)");
  const withPlugins = diag(r, "with-plugins.test.ts", "jest(valid-title)");

  check(
    "an override entry that omits `plugins` cannot switch a jest rule off",
    withoutPlugins.length === 1,
    `got ${withoutPlugins.length} — if this is 0, oxlint changed and the README Gotchas bullet is stale`,
  );
  check(
    "repeating the plugin list via `testFilePlugins` makes the same `off` work",
    withPlugins.length === 0,
    withPlugins.map((d) => d.code).join(", "),
  );
}

// --------------------------------------------------------------- clean ----
process.stdout.write(
  "\n[clean] false-positive guard under every emitted JSON variant\n",
);
for (const variant of ["base", "react", "react-native", "next", "expo"]) {
  const r = lint(repoRoot, [
    "-c",
    `packages/oxlint-config/${variant}.json`,
    "--disable-nested-config",
    "fixtures/adversarial/clean/src/clean.tsx",
  ]);
  check(
    `clean.tsx is clean under ${variant}`,
    r.diagnostics.length === 0,
    r.diagnostics.map((d) => d.code).join(", "),
  );
}

// -------------------------------------------------------------- format ----
process.stdout.write(
  "\n[format] oxfmt house style + import sorting edge cases\n",
);
{
  const fmtDir = join(here, "format");
  const workDir = join(fmtDir, "work");
  mkdirSync(workDir, { recursive: true });
  for (const [input, output] of [
    ["import-sort.tsx.txt", "import-sort.tsx"],
    ["doc-comment.tsx.txt", "doc-comment.tsx"],
    ["house-style.ts.txt", "house-style.ts"],
  ]) {
    copyFileSync(join(fmtDir, "inputs", input), join(workDir, output));
  }
  execFileSync(oxfmtBin, ["work"], { cwd: fmtDir });

  const house = readFileSync(join(workDir, "house-style.ts"), "utf8");
  check(
    "single quotes become double quotes",
    house.includes('"single quotes here"'),
  );
  check(
    "long signature wraps at printWidth 80 (not oxfmt's default 100)",
    house.includes("(\n  alpha: string,"),
  );

  const docs = readFileSync(join(workDir, "doc-comment.tsx"), "utf8");
  check(
    "glued doc comment travels with its import when sorted (documented gotcha)",
    docs.indexOf("useState") < docs.indexOf("File-level doc comment") &&
      docs.indexOf("File-level doc comment") < docs.indexOf('from "zod"'),
  );

  const sorted = readFileSync(join(workDir, "import-sort.tsx"), "utf8");
  const importLines = sorted.split("\n").filter((l) => l.startsWith("import "));
  const pos = (needle) => importLines.findIndex((l) => l.includes(needle));
  check(
    "type group before react-type custom group",
    pos("ZodSchema") === 0 && pos("ReactNode") === 1,
  );
  check(
    "builtin before react before external",
    pos("node:fs/promises") < pos("useState") && pos("useState") < pos("{ z }"),
  );
  check(
    "side-effect imports keep their ordinal positions (sortSideEffects: false)",
    pos('"./polyfill"') === 2 && pos('"./globals.css"') === 8,
    `polyfill@${pos('"./polyfill"')} globals.css@${pos('"./globals.css"')}`,
  );
  // ianvs order: "@/lib/helper" is value-internal and must sort AFTER external
  // "zod", in its own group. This only holds because internalPattern is
  // written as PREFIXES ("@/"), not perfectionist globs ("@/**") — globs match
  // nothing and silently demote every alias to value-external.
  check(
    "@/ alias sorts as internal, after external",
    pos("@/lib/helper") > pos("{ z }"),
    `@/lib/helper@${pos("@/lib/helper")} zod@${pos("{ z }")}`,
  );

  // Regression guard for the prefix syntax itself: ~/ @/ # all classify as
  // internal and land after external.
  const probe = join(fmtDir, "prefix-fix", "internal-probe.ts");
  writeFileSync(
    probe,
    'import { z } from "zod";\nimport { a } from "~/alpha";\nimport { b } from "@/bravo";\nimport { c } from "#charlie";\n\nexport const all = [z, a, b, c];\n',
  );
  execFileSync(oxfmtBin, ["internal-probe.ts"], {
    cwd: join(fmtDir, "prefix-fix"),
  });
  const fixed = readFileSync(probe, "utf8");
  check(
    'prefix-syntax internalPattern (["~/", "@/", "#"]) groups aliases as internal',
    fixed.indexOf('"zod"') < fixed.indexOf('"#charlie"') &&
      fixed.indexOf('"#charlie"') < fixed.indexOf('"@/bravo"') &&
      fixed.indexOf('"@/bravo"') < fixed.indexOf('"~/alpha"'),
  );

  // Idempotency: a second oxfmt run must change nothing.
  execFileSync(oxfmtBin, ["--check", "work"], { cwd: fmtDir });
  check("formatting is idempotent (second run --check passes)", true);
}

// ----------------------------------------------------------- typecheck ----
process.stdout.write(
  "\n[typecheck] the README's own config files, compiled against oxlint's types\n",
);
{
  const tscBin = join(
    dirname(require_.resolve("typescript/package.json", { paths: [repoRoot] })),
    "bin",
    "tsc",
  );
  let output = "";
  let ok = true;
  try {
    execFileSync(process.execPath, [tscBin, "--noEmit", "-p", "typecheck"], {
      cwd: here,
      encoding: "utf8",
    });
  } catch (error) {
    ok = false;
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n")[0];
  }
  check(
    "every variant's README snippet is assignable to oxlint's OxlintConfig",
    ok,
    output,
  );
}

// -------------------------------------------------------------- report ----
const failed = results.filter((r) => !r.ok);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} expectations hold\n`,
);
if (failed.length > 0) {
  for (const f of failed) process.stdout.write(`  FAILED: ${f.name}\n`);
  process.exit(1);
}
