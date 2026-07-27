import type { Rename } from "./plan.ts";
import type { ManualReview } from "./rewrite.ts";

import { readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

import { isLintable, stemOf } from "./kebab.ts";

/**
 * Files that can hold a module path but that no AST pass will ever understand:
 * runner configs where the specifier is a *regex* (`moduleNameMapper`), bundler
 * aliases, JSON manifests, and prose.
 *
 * The mandate here is report, never edit. A `moduleNameMapper` key is a regex
 * whose escaping is the author's; a `package.json` `exports` path is a published
 * contract. Guessing at either is how a codemod turns a lint fix into an
 * outage — so this only ever tells a human where to look.
 */
const SCANNED_EXTENSIONS = [
  ".json",
  ".jsonc",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
  ".html",
  ".css",
  ".scss",
  ".sh",
];

/** Source files whose *string values* are module-ish but whose AST shape is not. */
const CONFIG_BASENAME =
  /^(jest|vitest|vite|metro|next|babel|webpack|rollup|tsup|jsconfig|tsconfig)[.\w-]*\.(js|cjs|mjs|ts|mts|cts|json)$/u;

const MAX_HITS_PER_RENAME = 20;

const shouldScan = (relativePath: string): boolean => {
  const name = basename(relativePath);
  if (CONFIG_BASENAME.test(name)) return true;
  if (isLintable(name)) return false;
  return SCANNED_EXTENSIONS.some((extension) => name.endsWith(extension));
};

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

export const findStaleReferences = (
  root: string,
  renames: Rename[],
  allTrackedFiles: string[],
): ManualReview[] => {
  if (renames.length === 0) return [];

  const probes = renames.map((rename) => {
    const oldBase = basename(rename.from);
    const oldStem = stemOf(oldBase);
    return {
      rename,
      // Either the whole basename anywhere, or the stem in a path-shaped
      // position — `"@/components/Button"`, `<rootDir>/src/Button`. The
      // trailing guard keeps `Button` from matching `ButtonGroup`.
      pattern: new RegExp(
        `(${escapeRegExp(oldBase)}|[/'"\`]${escapeRegExp(oldStem)}(?![\\w-]))`,
        "u",
      ),
      oldBase,
    };
  });

  const readScannable = (relativePath: string): string => {
    try {
      const absolute = join(root, relativePath);
      if (statSync(absolute).size > 2 * 1024 * 1024) return "";
      return readFileSync(absolute, "utf8");
    } catch {
      return "";
    }
  };

  // One entry per matching line, however many renamed modules it happens to
  // name: `Button.tsx` and its `__mocks__/Button.ts` share a stem, so a
  // per-probe loop would report the same line of prose twice.
  const hitsPerLine = allTrackedFiles
    .filter((path) => shouldScan(path))
    .flatMap((relativePath) =>
      readScannable(relativePath)
        .split("\n")
        .map((line, index) => ({
          relativePath,
          line: index + 1,
          text: line.trim(),
          probes: probes.filter((probe) => probe.pattern.test(line)),
        }))
        .filter((entry) => entry.probes.length > 0),
    );

  // Cap per renamed file so one over-eager match in a lockfile-sized document
  // cannot bury the rest of the report.
  const counts = new Map<string, number>();
  const underCap = hitsPerLine.filter((entry) => {
    const key = entry.probes[0]?.oldBase ?? "";
    const seen = counts.get(key) ?? 0;
    counts.set(key, seen + 1);
    return seen < MAX_HITS_PER_RENAME;
  });

  return underCap.map((entry) => {
    const names = [...new Set(entry.probes.map((probe) => probe.oldBase))];
    const targets = [
      ...new Set(entry.probes.map((probe) => basename(probe.rename.to))),
    ];

    return {
      file: entry.relativePath,
      line: entry.line,
      detail: `Mentions ${names.map((name) => `\`${name}\``).join(", ")}, becoming ${targets.map((target) => `\`${target}\``).join(", ")}. Not rewritten — this file's strings are not import specifiers.`,
      text:
        entry.text.length > 140 ? `${entry.text.slice(0, 137)}…` : entry.text,
    };
  });
};
