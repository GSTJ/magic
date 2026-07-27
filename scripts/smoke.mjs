/**
 * Run the shared config against `fixtures/smoke` and assert on exactly which
 * rules fire.
 *
 * The fixture is deliberately broken. A config regression that quietly stops
 * catching leaked JSX, or process.env access, or an unused import, would
 * otherwise be invisible — nothing else in this repo exercises the rules
 * end-to-end.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require_ = createRequire(import.meta.url);

const repoRoot = join(import.meta.dirname, "..");
const fixtureDir = join(repoRoot, "fixtures", "smoke");
const oxlintBin = join(
  dirname(require_.resolve("oxlint/package.json", { paths: [repoRoot] })),
  "bin",
  "oxlint",
);

/** Rule ids the fixture must trip, and why each one is in here. */
const EXPECTED = [
  [
    "safe-jsx(jsx-explicit-boolean)",
    "`items.length && <span/>` renders a bare 0",
  ],
  ["eslint(no-restricted-properties)", "direct process.env access"],
  ["eslint(no-console)", "leftover console.log"],
  ["eslint(no-nested-ternary)", "nested ternary"],
  ["eslint(no-unused-vars)", "unused import"],
  ["magic(prefer-early-return)", "whole body wrapped in a lone if"],
  ["magic(no-barrel-file)", "catch-all `export * from`"],
];

const run = () => {
  try {
    return execFileSync(oxlintBin, ["--format", "json", "src"], {
      cwd: fixtureDir,
      encoding: "utf8",
    });
  } catch (error) {
    // Non-zero exit is the expected outcome; the payload is still on stdout.
    if (error.stdout) return error.stdout;
    throw error;
  }
};

const { diagnostics = [] } = JSON.parse(run());
const seen = new Set(diagnostics.map((diagnostic) => diagnostic.code));

process.stdout.write(
  `smoke: oxlint reported ${diagnostics.length} diagnostics\n\n`,
);
for (const diagnostic of diagnostics) {
  const line = diagnostic.labels?.[0]?.span?.line ?? "?";
  process.stdout.write(`  ${diagnostic.filename}:${line} ${diagnostic.code}\n`);
}
process.stdout.write("\n");

const missing = EXPECTED.filter(([code]) => !seen.has(code));

for (const [code, why] of EXPECTED) {
  process.stdout.write(
    `  ${seen.has(code) ? "PASS" : "FAIL"}  ${code} — ${why}\n`,
  );
}

if (missing.length > 0) {
  const list = missing.map(([code]) => `  - ${code}`).join("\n");
  process.stderr.write(
    `\nsmoke: FAILED — ${missing.length} expected rule(s) did not fire:\n${list}\n` +
      `The shared config stopped catching something it used to catch.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `\nsmoke: PASS — all ${EXPECTED.length} expected rules fired.\n`,
);
