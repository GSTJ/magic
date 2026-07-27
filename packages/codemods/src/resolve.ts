import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, posix, resolve as resolvePath } from "node:path";

import { ts } from "ts-morph";

import { LINTABLE_EXTENSIONS } from "./kebab.ts";

/** Extensions a bare specifier may be standing in for, in resolution order. */
const CANDIDATE_EXTENSIONS = [
  ...LINTABLE_EXTENSIONS,
  ".d.ts",
  ".json",
  ".native.ts",
  ".native.tsx",
  ".ios.ts",
  ".ios.tsx",
  ".android.ts",
  ".android.tsx",
  ".web.ts",
  ".web.tsx",
];

export interface AliasResolver {
  /** Absolute paths the specifier could denote, most likely first. */
  candidates: (fromFile: string, specifier: string) => string[];
  readonly tsconfigPath: string | undefined;
}

const isFile = (path: string): boolean =>
  existsSync(path) && statSync(path).isFile();

const asFile = (candidate: string): string | undefined =>
  [
    ...["", ...CANDIDATE_EXTENSIONS].map((extension) => candidate + extension),
    ...CANDIDATE_EXTENSIONS.map((extension) =>
      posix.join(candidate, `index${extension}`),
    ),
  ].find((path) => isFile(path));

/**
 * `.js` in a specifier usually means `.ts` on disk under NodeNext, and
 * `rewriteRelativeImportExtensions`. Try the source extension too.
 */
const SOURCE_EXTENSION_SWAPS: Record<string, string[]> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};

const withSourceExtensionSwapped = (candidate: string): string[] =>
  Object.entries(SOURCE_EXTENSION_SWAPS)
    .filter(([from]) => candidate.endsWith(from))
    .flatMap(([from, targets]) =>
      targets.map((target) => candidate.slice(0, -from.length) + target),
    );

const readPaths = (
  tsconfigPath: string,
): { baseUrl: string; paths: Record<string, string[]> } | undefined => {
  const read = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (read.error ?? !read.config) return undefined;

  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    dirname(tsconfigPath),
    undefined,
    tsconfigPath,
  );
  const { options } = parsed;
  if (!options.paths) return undefined;

  // `paths` is resolved relative to `baseUrl` when set, otherwise relative to
  // the config that declared it. tsgo forbids `baseUrl` outright (see
  // DECISIONS.md), so the second branch is the common one now.
  const baseUrl =
    options.baseUrl ?? options.pathsBasePath ?? dirname(tsconfigPath);
  return { baseUrl: String(baseUrl), paths: options.paths };
};

/** One `compilerOptions.paths` entry, applied to one specifier. */
const expandPathsEntry = (
  base: string,
  pattern: string,
  targets: string[],
  specifier: string,
): string[] => {
  const starIndex = pattern.indexOf("*");
  if (starIndex === -1) {
    return pattern === specifier
      ? targets.map((target) => resolvePath(base, target))
      : [];
  }

  const prefix = pattern.slice(0, starIndex);
  const suffix = pattern.slice(starIndex + 1);
  const fits =
    specifier.startsWith(prefix) &&
    specifier.endsWith(suffix) &&
    specifier.length >= prefix.length + suffix.length;
  if (!fits) return [];

  const middle = specifier.slice(
    prefix.length,
    specifier.length - suffix.length,
  );
  return targets.map((target) =>
    resolvePath(base, target.replace("*", middle)),
  );
};

export const createResolver = (
  root: string,
  tsconfigPath: string | undefined,
): AliasResolver => {
  const explicit = tsconfigPath ? resolvePath(root, tsconfigPath) : undefined;
  const detected =
    explicit ??
    ["tsconfig.json", "tsconfig.base.json", "jsconfig.json"]
      .map((name) => resolvePath(root, name))
      .find((path) => existsSync(path));

  const aliases = detected ? readPaths(detected) : undefined;

  const expandAlias = (specifier: string): string[] =>
    aliases === undefined
      ? []
      : Object.entries(aliases.paths).flatMap(([pattern, targets]) =>
          expandPathsEntry(aliases.baseUrl, pattern, targets, specifier),
        );

  const candidates = (fromFile: string, specifier: string): string[] => {
    const bases: string[] = [];
    if (specifier.startsWith(".")) {
      bases.push(resolvePath(dirname(fromFile), specifier));
    } else if (isAbsolute(specifier)) {
      bases.push(specifier);
    } else {
      bases.push(...expandAlias(specifier));
    }

    // Written as a loop rather than a `flatMap` because the two shapes the
    // preset accepts are mutually exclusive here: `oxc/no-map-spread` rejects
    // `flatMap((b) => [b, ...swaps(b)])` and `unicorn/prefer-spread` rejects the
    // `.concat()` you would reach for instead.
    const attempts: string[] = [];
    for (const base of bases)
      attempts.push(base, ...withSourceExtensionSwapped(base));

    const resolved = attempts
      .map((attempt) => asFile(attempt))
      .filter((file): file is string => file !== undefined);

    return [...new Set(resolved)];
  };

  return { candidates, tsconfigPath: detected };
};
