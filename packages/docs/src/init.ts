import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type MaterializeThemeOptions = {
  cwd: string;
  out?: string;
  force?: boolean;
};

export type MaterializeThemeResult = {
  path: string;
  status: "created" | "unchanged" | "replaced";
};

export type MaterializePagesMarkerResult = {
  path: string;
  status: "created" | "unchanged";
};

const sourceTheme = fileURLToPath(new URL("../theme.css", import.meta.url));

/**
 * Copy the exact published theme into a consumer. This is deliberately
 * idempotent, and refuses to replace a locally customized copy without an
 * explicit `force`.
 */
export const materializeTheme = (
  options: MaterializeThemeOptions,
): MaterializeThemeResult => {
  const target = resolve(options.cwd, options.out ?? "magic-docs.css");

  if (existsSync(target)) {
    const current = readFileSync(target);
    const expected = readFileSync(sourceTheme);

    if (current.equals(expected)) {
      return { path: target, status: "unchanged" };
    }
    if (options.force !== true) {
      throw new Error(
        `magic-docs-init: ${target} already exists and differs; pass --force to replace it`,
      );
    }
  }

  mkdirSync(dirname(target), { recursive: true });
  const status = existsSync(target) ? "replaced" : "created";
  copyFileSync(sourceTheme, target);
  return { path: target, status };
};

/**
 * GitHub Pages runs Jekyll unless this hidden marker survives the artifact
 * upload. The workflow must pair it with `include-hidden-files: true`.
 */
export const materializePagesMarker = (
  cwd: string,
  publicDirectory = "public",
): MaterializePagesMarkerResult => {
  const target = resolve(cwd, publicDirectory, ".nojekyll");
  if (existsSync(target)) {
    return { path: target, status: "unchanged" };
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, "");
  return { path: target, status: "created" };
};
