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

// -------------------------------------------------------------- report ----
const failed = results.filter((r) => !r.ok);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} expectations hold\n`,
);
if (failed.length > 0) {
  for (const f of failed) process.stdout.write(`  FAILED: ${f.name}\n`);
  process.exit(1);
}
