#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { validateReadme } from "../lib/validate.mjs";

const root = join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const usage = () => {
  console.log(`magic-readme ${pkg.version}

The GSTJ README standard: write a skeleton, check files against it.

Usage:
  magic-readme init [dir]        write the README skeleton into dir (default .)
  magic-readme check <files...>  validate READMEs, exit 1 listing failures
`);
};

/** @param {string | undefined} dir */
const init = (dir) => {
  const target = resolve(dir ?? ".");
  const dest = join(target, "README.md");
  if (existsSync(dest)) {
    console.error(`${dest} already exists; move it aside first.`);
    process.exit(1);
  }
  mkdirSync(target, { recursive: true });
  copyFileSync(join(root, "templates", "README.md"), dest);
  console.log(`wrote ${dest}. Fill every <placeholder>, then run:`);
  console.log(`  magic-readme check ${dest}`);
};

/**
 * The package name a README belongs to, for problem messages: the adjacent
 * package.json's name when there is one, the directory's name otherwise.
 *
 * @param {string} file
 */
const nameFor = (file) => {
  const sibling = join(dirname(file), "package.json");
  try {
    return JSON.parse(readFileSync(sibling, "utf8")).name;
  } catch {
    return basename(dirname(file));
  }
};

/** @param {string[]} files */
const check = (files) => {
  if (files.length === 0) {
    console.error("check needs at least one file.");
    process.exit(1);
  }

  let total = 0;
  for (const file of files) {
    const markdown = readFileSync(resolve(file), "utf8");
    const problems = validateReadme(markdown, { name: nameFor(resolve(file)) });
    total += problems.length;
    if (problems.length > 0) {
      console.error(file);
      for (const problem of problems) console.error(`  - ${problem}`);
    }
  }

  if (total > 0) {
    console.error(`\nmagic-readme: ${total} problem(s).`);
    process.exit(1);
  }
  console.log(`magic-readme: OK, ${files.length} file(s) follow the standard.`);
};

const [cmd, ...rest] = process.argv.slice(2);

if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
  usage();
  process.exit(0);
}
if (cmd === "init") {
  init(rest[0]);
  process.exit(0);
}
if (cmd === "check") {
  check(rest);
  process.exit(0);
}
console.error(`unknown command: ${cmd}`);
usage();
process.exit(1);
