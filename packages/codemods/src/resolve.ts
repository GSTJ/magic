import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, posix, resolve as resolvePath } from "node:path";

import { ts } from "ts-morph";

import { CodemodError } from "./git.ts";
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

export type AliasResolver = {
  /** Absolute paths the specifier could denote, most likely first. */
  candidates: (fromFile: string, specifier: string) => string[];
  /** Every tsconfig whose `paths` were loaded, in discovery order. */
  readonly tsconfigPaths: string[];
  /** True once at least one `paths` entry is in play. */
  readonly hasAliases: boolean;
};

/**
 * Prefixes that mean "this is a path alias, not a package".
 *
 * Same list oxfmt's `sortImports.internalPattern` defaults to, and the same list
 * the oxfmt config restates. A specifier starting with one of these that we
 * cannot resolve is a specifier we are probably about to break.
 */
export const ALIAS_PREFIXES = ["@/", "~/", "#"];

export const isAliasShaped = (specifier: string): boolean =>
  ALIAS_PREFIXES.some((prefix) => specifier.startsWith(prefix));

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

type PathsConfig = { baseUrl: string; paths: Record<string, string[]> };

const readPaths = (tsconfigPath: string): PathsConfig | undefined => {
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
    resolvePath(base, target.replaceAll("*", middle)),
  );
};

const ROOT_CONFIG_NAMES = [
  "tsconfig.json",
  "tsconfig.base.json",
  "jsconfig.json",
];

/**
 * The `packages:` globs out of a `pnpm-workspace.yaml`, if there is one.
 *
 * Hand-parsed rather than pulling in a YAML dependency: the block this needs is
 * a flat sequence of scalars, and getting it wrong costs a fallback to the
 * generic globs below rather than a wrong answer.
 */
const workspaceGlobs = (root: string): string[] => {
  const file = resolvePath(root, "pnpm-workspace.yaml");
  if (!existsSync(file)) return [];

  const lines = readFileSync(file, "utf8")
    .split("\n")
    .map((raw) => raw.replaceAll(/#.*$/gu, "").trimEnd());

  const start = lines.findIndex((line) => /^packages\s*:/u.test(line));
  if (start === -1) return [];

  const body = lines.slice(start + 1);
  // The block runs until the first line that is neither a list item nor blank.
  const end = body.findIndex(
    (line) => line.trim() !== "" && !/^\s+-\s*/u.test(line),
  );

  return (end === -1 ? body : body.slice(0, end))
    .map((line) => /^\s+-\s*(.+)$/u.exec(line)?.[1]?.trim() ?? "")
    .filter(Boolean)
    .map((entry) => entry.replaceAll(/^["']|["']$/gu, ""));
};

/**
 * Every tsconfig in the repo whose `paths` might matter, root first.
 *
 * Looking only at the run root was the bug: in a monorepo the root usually has
 * no tsconfig at all, magic-kebab printed one line saying so, and then rewrote
 * relative specifiers while leaving every `@/...` import in every workspace
 * package pointing at a file it had just renamed. `--write` would have left the
 * tree broken, and `--strict` said nothing.
 */
const discoverConfigs = (root: string): string[] => {
  const patterns = [
    ...ROOT_CONFIG_NAMES,
    ...workspaceGlobs(root).flatMap((glob) =>
      ROOT_CONFIG_NAMES.map((name) => `${glob}/${name}`),
    ),
    // Repos with no pnpm-workspace.yaml (npm/yarn workspaces, or a plain
    // multi-app repo) still have the same shape.
    ...ROOT_CONFIG_NAMES.flatMap((name) => [`*/${name}`, `*/*/${name}`]),
  ];

  const found = patterns.flatMap((pattern) => {
    try {
      return globSync(pattern, {
        cwd: root,
        exclude: (name) => name === "node_modules",
      });
    } catch {
      return [];
    }
  });

  return [...new Set(found.map((path) => resolvePath(root, path)))].filter(
    (path) => existsSync(path),
  );
};

export const createResolver = (
  root: string,
  tsconfigPaths: string[],
): AliasResolver => {
  const explicit = tsconfigPaths.map((path) => resolvePath(root, path));
  for (const path of explicit) {
    if (!existsSync(path)) {
      throw new CodemodError(`--tsconfig ${path} does not exist.`);
    }
  }

  const searched = explicit.length > 0 ? explicit : discoverConfigs(root);

  // Every discovered `paths` map is consulted, and a specifier that resolves
  // under more than one of them yields several candidates. That is correct here:
  // `candidates` already tolerates a specifier denoting several files (the
  // `.ios`/`.android` trio), and a candidate that is not a rename target is
  // simply ignored downstream.
  const loaded = searched
    .map((path) => ({ path, aliases: readPaths(path) }))
    .filter(
      (entry): entry is { path: string; aliases: PathsConfig } =>
        entry.aliases !== undefined,
    );

  const expandAlias = (specifier: string): string[] =>
    loaded.flatMap(({ aliases }) =>
      Object.entries(aliases.paths).flatMap(([pattern, targets]) =>
        expandPathsEntry(aliases.baseUrl, pattern, targets, specifier),
      ),
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

  return {
    candidates,
    tsconfigPaths: loaded.map((entry) => entry.path),
    hasAliases: loaded.length > 0,
  };
};
