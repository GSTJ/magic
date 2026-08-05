/**
 * Every README here follows the GSTJ standard, and this is the check that
 * keeps it true: `validateReadme` from `packages/readme` runs over every
 * package README plus the root one. The rules live in the package
 * so consumers get the exact validator this repo holds itself to.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { validateReadme } from "../packages/readme/lib/validate.mjs";

const repoRoot = join(import.meta.dirname, "..");

const show = (file) => relative(repoRoot, file);

/**
 * The npm package a README ships with, from the adjacent package.json. The
 * root manifest is private, so the root README comes back null and skips the
 * npm badge rule.
 */
const nameFor = (file) => {
  const sibling = join(dirname(file), "package.json");
  try {
    const manifest = JSON.parse(readFileSync(sibling, "utf8"));
    return manifest.private ? null : (manifest.name ?? null);
  } catch {
    return null;
  }
};

const files = [
  join(repoRoot, "README.md"),
  ...readdirSync(join(repoRoot, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(repoRoot, "packages", entry.name, "README.md"))
    .filter((file) => existsSync(file)),
];

const failures = files.flatMap((file) => {
  const markdown = readFileSync(file, "utf8");
  return validateReadme(markdown, { name: nameFor(file) }).map(
    (problem) => `${show(file)}: ${problem}`,
  );
});

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.stderr.write(`\nvalidate-readmes: ${failures.length} problem(s).\n`);
  process.exit(1);
}

process.stdout.write(
  `validate-readmes: OK, ${files.length} READMEs follow the standard.\n`,
);
