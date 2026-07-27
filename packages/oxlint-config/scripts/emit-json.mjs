/**
 * Emit plain `.oxlintrc`-shaped JSON mirrors of every variant.
 *
 * The JS entry points resolve `jsPlugins` specifiers to absolute paths so they
 * survive pnpm's non-hoisted layout. That is exactly wrong for a file shipped
 * inside the tarball, so this script re-imports the modules with
 * MAGIC_OXLINT_BARE_SPECIFIERS=1 to get portable bare specifiers back.
 *
 * Run via `pnpm build`, never by hand — the JSON must not drift from the TS.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

process.env["MAGIC_OXLINT_BARE_SPECIFIERS"] = "1";

const packageRoot = join(import.meta.dirname, "..");

const SCHEMA =
  "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json";

const variants = [
  ["base.json", "../dist/base.js"],
  ["react.json", "../dist/react.js"],
  ["react-native.json", "../dist/react-native.js"],
  ["next.json", "../dist/next.js"],
  ["expo.json", "../dist/expo.js"],
];

const emit = async ([fileName, modulePath]) => {
  const module = await import(new URL(modulePath, import.meta.url).href);
  const withSchema = { $schema: SCHEMA, ...module.default };

  await writeFile(
    join(packageRoot, fileName),
    `${JSON.stringify(withSchema, null, 2)}\n`,
    "utf8",
  );

  return fileName;
};

const emitted = await Promise.all(variants.map(emit));

for (const fileName of emitted) process.stdout.write(`emitted ${fileName}\n`);
