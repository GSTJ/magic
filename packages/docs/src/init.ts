import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
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

const errorCode = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;

const replaceAtomically = (target: string, contents: Buffer): void => {
  const directory = dirname(target);
  mkdirSync(directory, { recursive: true });
  const temporaryDirectory = mkdtempSync(join(directory, ".magic-docs-"));
  const temporary = join(temporaryDirectory, "theme.css");
  try {
    writeFileSync(temporary, contents, { flag: "wx" });
    renameSync(temporary, target);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
};

/**
 * Copy the exact published theme into a consumer. This is deliberately
 * idempotent, and refuses to replace a locally customized copy without an
 * explicit `force`.
 */
export const materializeTheme = (
  options: MaterializeThemeOptions,
): MaterializeThemeResult => {
  const target = resolve(options.cwd, options.out ?? "magic-docs.css");
  const expected = readFileSync(sourceTheme);
  let current: Buffer | undefined;

  try {
    current = readFileSync(target);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }

  if (current !== undefined) {
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
  if (current === undefined) {
    try {
      writeFileSync(target, expected, { flag: "wx" });
    } catch (error) {
      if (errorCode(error) === "EEXIST") {
        throw new Error(
          `magic-docs-init: ${target} appeared while it was being created; rerun the command`,
          { cause: error },
        );
      }
      throw error;
    }
    return { path: target, status: "created" };
  }

  replaceAtomically(target, expected);
  return { path: target, status: "replaced" };
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
  mkdirSync(dirname(target), { recursive: true });
  try {
    writeFileSync(target, "", { flag: "wx" });
    return { path: target, status: "created" };
  } catch (error) {
    if (errorCode(error) === "EEXIST") {
      return { path: target, status: "unchanged" };
    }
    throw error;
  }
};
