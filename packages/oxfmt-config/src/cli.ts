#!/usr/bin/env node
/**
 * `magic-oxfmt-init [variant]` — write a `.oxfmtrc.json` equivalent to one of
 * the shared variants.
 *
 * The preferred consumption path is an `oxfmt.config.mts` that imports this
 * package, because it stays in sync when the package is bumped. This exists for
 * repos that can't run a TS config (older Node, or a toolchain that shells out
 * to the standalone oxfmt binary), and for anyone who just wants to see the
 * resolved config as JSON.
 */

import type { MagicOxfmtConfig } from "./index.ts";

import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { base, expo, next, react, reactNative } from "./index.ts";

const VARIANTS: Record<string, MagicOxfmtConfig> = {
  base,
  react,
  "react-native": reactNative,
  next,
  expo,
};

const SCHEMA = "./node_modules/oxfmt/configuration_schema.json";

const usage = () =>
  `Usage: magic-oxfmt-init [variant] [--force] [--out <path>]\n\n` +
  `  variant   one of: ${Object.keys(VARIANTS).join(", ")}  (default: base)\n` +
  `  --force   overwrite an existing file\n` +
  `  --out     destination path (default: ./.oxfmtrc.json)\n`;

const main = async (argv: string[]): Promise<number> => {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(usage());
    return 0;
  }

  const force = argv.includes("--force");
  const outIndex = argv.indexOf("--out");
  const outPath = resolve(
    outIndex === -1 ? ".oxfmtrc.json" : (argv[outIndex + 1] ?? ".oxfmtrc.json"),
  );

  const variantName =
    argv.find((arg, index) => !arg.startsWith("-") && index !== outIndex + 1) ??
    "base";
  const variant = VARIANTS[variantName];

  if (!variant) {
    process.stderr.write(
      `magic-oxfmt-init: unknown variant "${variantName}".\n\n${usage()}`,
    );
    return 1;
  }

  if (existsSync(outPath) && !force) {
    process.stderr.write(
      `magic-oxfmt-init: ${outPath} already exists. Pass --force to overwrite.\n`,
    );
    return 1;
  }

  const contents = { $schema: SCHEMA, ...variant };
  await writeFile(outPath, `${JSON.stringify(contents, null, 2)}\n`, "utf8");
  process.stdout.write(
    `magic-oxfmt-init: wrote ${variantName} config to ${outPath}\n` +
      `Note: this is a snapshot. Bumping magic-oxfmt-config will NOT update it — rerun this command.\n`,
  );
  return 0;
};

process.exitCode = await main(process.argv.slice(2));
