/**
 * A local reimplementation of `unicorn/filename-case`'s kebab-case check and of
 * the rename target oxlint suggests for a violation.
 *
 * This exists only as a fallback for `--detect builtin` (repos that have not
 * adopted the preset yet, or where running the full linter is too slow). The
 * default path asks oxlint itself — see `detect.ts` — because the only way to
 * be certain a codemod agrees with a linter is to let the linter answer.
 *
 * Everything below was derived from oxlint 1.75.0's observed behaviour and is
 * held to it by `test/kebab.test.mjs`, which generates a corpus, runs the real
 * binary over it, and fails on a single disagreement. If oxlint changes, that
 * test breaks before any repo does.
 */

/** Filenames oxlint will actually look at. `.d.ts` is excluded by the preset's `ignorePatterns`. */
export const LINTABLE_EXTENSIONS = [
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
];

export const isLintable = (basename: string): boolean =>
  !basename.endsWith(".d.ts") &&
  LINTABLE_EXTENSIONS.some((extension) => basename.endsWith(extension));

/**
 * The part of a basename the rule actually checks: everything before the
 * **first** dot.
 *
 * This is the single most surprising thing about the rule and the thing an
 * approximate reimplementation gets wrong. `charlie.Test.ts` passes, because
 * only `charlie` is examined; `Bravo.test.ts` fails, because `Bravo` is. So a
 * platform suffix, a `.stories`, a `.config` — none of it is ever inspected.
 * (`multipleFileExtensions: false` would inspect `Bravo.test` instead; the
 * preset leaves it at the default, and so does this.)
 */
export const stemOf = (basename: string): string =>
  basename.split(".")[0] ?? "";

/**
 * Leading and trailing underscore runs are stripped before the check, so
 * `_private.ts` and `__mocks__.ts` pass while `foo_bar.ts` does not.
 */
const trimUnderscores = (stem: string): string =>
  stem.replace(/^_+/u, "").replace(/_+$/u, "");

/**
 * True when oxlint would leave this basename alone.
 *
 * The rule is far more permissive than the name "kebab-case" suggests: it
 * rejects uppercase letters, spaces and interior underscores, and accepts
 * literally everything else. `+page.ts`, `[id].tsx`, `$ref.ts`, `a--b.ts`,
 * `-x.ts` and `日本.ts` all pass. There is no `^[a-z\d]+(-[a-z\d]+)*$` here,
 * which is what the upstream ESLint rule uses — assuming there is produces
 * false positives on every file-based router in the migration set.
 */
export const isKebabCase = (basename: string): boolean => {
  for (const char of trimUnderscores(stemOf(basename))) {
    if (char === "_" || char === " ") return false;
    if (char !== char.toLowerCase()) return false;
  }
  return true;
};

/**
 * Reproduce the target oxlint puts in its `help` text
 * (`Rename the file to 'pascal-thing.ts'`).
 *
 * Word boundaries, in the order they are applied:
 *   lower/digit → upper   `Foo2Bar`      → `foo2-bar`
 *   upper → upper+lower   `HTTPServer`   → `http-server`
 *   upper → digit         `AppV2`        → `app-v-2`
 *
 * That third one is why `S3.ts` becomes `s-3.ts` rather than `s3.ts`. It looks
 * wrong and it is what the linter asks for; `--rename S3.ts=s3.ts` is there for
 * when a human disagrees.
 */
export const kebabifyStem = (stem: string): string => {
  const leading = /^_*/u.exec(stem)?.[0] ?? "";
  const rest = stem.slice(leading.length);
  const trailing = /_*$/u.exec(rest)?.[0] ?? "";
  const core = rest.slice(0, rest.length - trailing.length);

  // Unicode property escapes, not `[a-z]`/`[A-Z]`. oxlint is Rust and asks
  // `char::is_uppercase`, so `É` is a word boundary and `ZÉaA` becomes
  // `z-éa-a`; an ASCII-only version silently produces `zéa-a` and every accented
  // filename in the migration set lands on a name the linter still rejects.
  // Caseless scripts (`日`, `\p{Lo}`) are neither, and correctly split nothing.
  const hyphenated = core
    .replaceAll(/([\p{Ll}\p{Nd}])(\p{Lu})/gu, "$1-$2")
    .replaceAll(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1-$2")
    .replaceAll(/(\p{Lu})(\p{Nd})/gu, "$1-$2")
    .replaceAll(/[_ ]/gu, "-")
    .toLowerCase();

  return `${leading}${hyphenated}${trailing}`;
};

/** `PascalThing.test.tsx` → `pascal-thing.test.tsx`. Only the stem moves. */
export const kebabifyBasename = (basename: string): string => {
  const stem = stemOf(basename);
  return kebabifyStem(stem) + basename.slice(stem.length);
};
