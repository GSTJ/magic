#!/usr/bin/env node
import { relative } from "node:path";
import { parseArgs } from "node:util";

import {
  CodemodError,
  type DetectMode,
  type KebabResult,
  runKebabCodemod,
  summarise,
} from "./index.ts";

const USAGE = `magic-kebab — rename files to kebab-case and rewrite every import that pointed at them

  magic-kebab [options] [paths...]

Prints a plan and changes nothing unless you pass --write.

Options
  --write               Apply the plan: rewrite specifiers, then git mv the files.
  --dry-run             Explicit form of the default. Mutually exclusive with --write.
  --detect <mode>       oxlint (default) | builtin
                        oxlint  runs the repo's own linter and reads its diagnostics,
                                so the repo's ignore list and overrides are honoured.
                        builtin applies this package's copy of the rule to tracked
                                files. Use before the repo has adopted the preset.
  --root <dir>          Where to start looking for the repo. Default: cwd.
  --tsconfig <path>     tsconfig whose \`paths\` drive alias rewriting.
                        Default: tsconfig.json / tsconfig.base.json / jsconfig.json.
  --rename <old=new>    Override one target basename, e.g. --rename S3.ts=s3.ts.
                        Repeatable. Also forces a rename the skip list would refuse.
  --allow-dirty         Skip the clean-tree check. You will regret this.
  --strict              Exit 1 if anything needs manual review.
  --json                Emit the whole result as JSON instead of prose.
  --help, -h            This.

Run --dry-run first, read the plan, then --write. The two are the same code path;
--write is the only thing that touches disk.`;

const parsed = parseArgs({
  allowPositionals: true,
  options: {
    write: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    detect: { type: "string", default: "oxlint" },
    root: { type: "string" },
    tsconfig: { type: "string" },
    rename: { type: "string", multiple: true, default: [] },
    "allow-dirty": { type: "boolean", default: false },
    strict: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

// The explicit annotation is load-bearing: TypeScript only treats a call as
// never-returning (and narrows afterwards) when the *variable* is annotated.
const fail: (message: string) => never = (message: string): never => {
  process.stderr.write(`magic-kebab: ${message}\n`);
  process.exit(1);
};

if (parsed.values.help) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

if (parsed.values.write && parsed.values["dry-run"]) {
  fail("--write and --dry-run contradict each other.");
}

const isDetectMode = (value: string): value is DetectMode =>
  value === "oxlint" || value === "builtin";

const { detect } = parsed.values;
if (!isDetectMode(detect)) {
  fail(`--detect must be "oxlint" or "builtin", got "${detect}".`);
}

const overrides = new Map<string, string>();
for (const entry of parsed.values.rename ?? []) {
  const at = entry.indexOf("=");
  if (at <= 0) fail(`--rename expects old=new, got "${entry}".`);
  overrides.set(entry.slice(0, at), entry.slice(at + 1));
}

const section = (heading: string, lines: string[]): string[] =>
  lines.length === 0 ? [] : [heading, ...lines.map((line) => `  ${line}`), ""];

const footer = (result: KebabResult): string[] => {
  const { plan } = result;
  if (plan.renames.length === 0 && plan.conflicts.length === 0) {
    return ["Nothing to rename.", ""];
  }
  return result.applied
    ? []
    : ["Nothing was changed. Re-run with --write to apply.", ""];
};

const report = (result: KebabResult): void => {
  const { plan } = result;
  const verb = result.applied ? "Applied" : "Plan";
  const tsconfig = result.tsconfigPath
    ? relative(result.root, result.tsconfigPath)
    : "(none found — path aliases will not be rewritten)";

  const out = [
    `${verb} — ${summarise(result)}`,
    `  repo:      ${result.root}`,
    `  detection: ${plan.detectedBy}`,
    `  tsconfig:  ${tsconfig}`,
    "",
    ...section(
      `RENAMES (${plan.renames.length})`,
      plan.renames.map(
        (rename) =>
          `${rename.from} -> ${rename.to}${rename.reason === "violation" ? "" : `  [${rename.reason}]`}`,
      ),
    ),
    ...section(
      `SPECIFIER REWRITES (${result.edits.length})`,
      result.edits.map(
        (edit) =>
          `${edit.file}:${edit.line}  ${edit.kind}  "${edit.from}" -> "${edit.to}"`,
      ),
    ),
    ...section(
      `SKIPPED (${plan.skipped.length}) — reported by the linter, not renamed`,
      plan.skipped.flatMap((skip) => [
        `${skip.path}  [${skip.rule}]`,
        `    ${skip.explanation}`,
      ]),
    ),
    ...section(
      `NEEDS REVIEW (${result.manual.length}) — found, deliberately not touched`,
      result.manual.flatMap((item) => [
        `${item.file}${item.line === undefined ? "" : `:${item.line}`}`,
        `    ${item.detail}`,
        `    ${item.text}`,
      ]),
    ),
    ...section(
      `CONFLICTS (${plan.conflicts.length}) — nothing was renamed for these`,
      plan.conflicts.flatMap((conflict) => [
        `${conflict.from} -> ${conflict.to}`,
        `    ${conflict.detail}`,
      ]),
    ),
    ...footer(result),
  ];

  process.stdout.write(out.join("\n"));
};

try {
  const result = runKebabCodemod({
    cwd: parsed.values.root ?? process.cwd(),
    paths: parsed.positionals,
    write: parsed.values.write,
    allowDirty: parsed.values["allow-dirty"],
    detect,
    tsconfig: parsed.values.tsconfig,
    overrides,
  });

  if (parsed.values.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    report(result);
  }

  const blocked = result.plan.conflicts.length > 0;
  const review = parsed.values.strict && result.manual.length > 0;
  process.exit(blocked || review ? 1 : 0);
} catch (error) {
  if (error instanceof CodemodError) fail(error.message);
  throw error;
}
