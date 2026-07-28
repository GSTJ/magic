#!/usr/bin/env node

import { materializePagesMarker, materializeTheme } from "./init.ts";

const usage = `Usage: magic-docs-init [--out <path>] [--public-dir <path>] [--force]

Materialize the versioned theme and GitHub Pages marker in a consumer repository.

Options:
  --out <path>  Output path (default: magic-docs.css)
  --public-dir  Static public directory (default: public)
  --no-pages-marker  Do not create <public-dir>/.nojekyll
  --force       Replace a different existing file
  -h, --help    Show this help
`;

const args = process.argv.slice(2);
let out: string | undefined;
let publicDirectory = "public";
let pagesMarker = true;
let force = false;

for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];

  if (argument === "-h" || argument === "--help") {
    process.stdout.write(usage);
    process.exit(0);
  } else if (argument === "--force") {
    force = true;
  } else if (argument === "--no-pages-marker") {
    pagesMarker = false;
  } else if (argument === "--public-dir") {
    const value = args[index + 1];
    if (value === undefined || value.startsWith("-")) {
      process.stderr.write("magic-docs-init: --public-dir requires a path\n");
      process.exit(2);
    }
    publicDirectory = value;
    index += 1;
  } else if (argument === "--out") {
    out = args[index + 1];
    if (out === undefined || out.startsWith("-")) {
      process.stderr.write("magic-docs-init: --out requires a path\n");
      process.exit(2);
    }
    index += 1;
  } else {
    process.stderr.write(`magic-docs-init: unknown argument ${argument}\n`);
    process.stderr.write(usage);
    process.exit(2);
  }
}

try {
  const result = materializeTheme({ cwd: process.cwd(), out, force });
  process.stdout.write(`magic-docs-init: ${result.status} ${result.path}\n`);
  if (pagesMarker) {
    const marker = materializePagesMarker(process.cwd(), publicDirectory);
    process.stdout.write(`magic-docs-init: ${marker.status} ${marker.path}\n`);
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
