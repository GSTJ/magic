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
import { basename, dirname, join, resolve } from "node:path";

import { base, expo, next, react, reactNative } from "./index.ts";

const VARIANTS: Record<string, MagicOxfmtConfig> = {
  base,
  react,
  "react-native": reactNative,
  next,
  expo,
};

const SCHEMA = "./node_modules/oxfmt/configuration_schema.json";

/**
 * Every filename oxfmt recognises as a config in a given directory. It accepts
 * exactly one of them per directory — two present is a hard load error
 * (`Failed to load configuration file. Both 'x' and 'y' found in <dir>`,
 * exit 1) on *every* subsequent oxfmt run, not just a precedence question.
 * Verified against oxfmt 0.60.0 for all four pairings with `.oxfmtrc.json`.
 */
const OXFMT_CONFIG_FILES = [
  ".oxfmtrc.json",
  ".oxfmtrc.jsonc",
  "oxfmt.config.ts",
  "oxfmt.config.mts",
];

const usage = () =>
  `Usage: magic-oxfmt-init [variant] [--force] [--out <path>]\n\n` +
  `  variant   one of: ${Object.keys(VARIANTS).join(", ")}  (default: base)\n` +
  `  --force   overwrite an existing file at --out\n` +
  `  --out     destination path (default: ./.oxfmtrc.json)\n\n` +
  `oxfmt allows only one config file per directory. If the target directory\n` +
  `already has an oxfmt.config.mts (the recommended setup), this command\n` +
  `refuses rather than breaking it — delete that file first, or pass --out to\n` +
  `write the snapshot somewhere else.\n`;

/**
 * Refuse to create the two-configs-in-one-directory state. Deliberately not
 * bypassable with `--force`: `--force` means "overwrite the file I named", and
 * writing a second config alongside a first is a different, unrecoverable-
 * looking failure (oxfmt then refuses to run at all).
 */
const conflictingConfig = (outPath: string): string | undefined => {
  const dir = dirname(outPath);
  const self = basename(outPath);
  // Only auto-loaded names can collide. `--out notes/snapshot.json` is inert —
  // oxfmt never picks it up — so it may sit next to a real config.
  if (!OXFMT_CONFIG_FILES.includes(self)) return undefined;
  return OXFMT_CONFIG_FILES.filter((name) => name !== self).find((name) =>
    existsSync(join(dir, name)),
  );
};

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

  const conflict = conflictingConfig(outPath);
  if (conflict) {
    const advice = conflict.startsWith("oxfmt.config")
      ? `${conflict} is the recommended setup (it tracks magic-oxfmt-config across
version bumps; this snapshot would not). Keep it, or delete it first if you
really want JSON.
`
      : `Delete ${conflict} first, or pass --out to write elsewhere.\n`;
    process.stderr.write(
      `magic-oxfmt-init: refusing to write ${outPath}.
${dirname(outPath)} already contains ${conflict}, and oxfmt accepts only one
config file per directory — writing a second one makes every later oxfmt run
fail with "Failed to load configuration file. Both ... found in <dir>".

${advice}`,
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
      `Note: this is a snapshot. Bumping magic-oxfmt-config will NOT update it — rerun this command.\n` +
      // The file is JSON.stringify output, not oxfmt's own style, so the very
      // next `oxfmt --check` flags the config file itself unless it's
      // reformatted once.
      `Run \`oxfmt .\` once now — oxfmt formats this file differently than it was written.\n`,
  );
  return 0;
};

process.exitCode = await main(process.argv.slice(2));
