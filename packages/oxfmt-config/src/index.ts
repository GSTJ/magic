/**
 * Shared oxfmt configuration.
 *
 * oxfmt has no `extends` — the key is not in its schema and is silently ignored
 * if you write it, which is the worst possible failure mode. Composition
 * therefore happens in JavaScript: consumers write an `oxfmt.config.mts` that
 * imports one of these objects. oxfmt executes `.ts`/`.mts` config files, so a
 * real npm package import works. See the README for the two-line file.
 *
 * For consumers that must stay on plain JSON, `magic-oxfmt-init` writes an
 * equivalent `.oxfmtrc.json`.
 */

export type SortImportsCustomGroup = {
  groupName: string;
  elementNamePattern?: string[];
  selector?: string;
  modifiers?: string[];
};

export type MagicOxfmtConfig = {
  printWidth?: number;
  tabWidth?: number;
  useTabs?: boolean;
  semi?: boolean;
  singleQuote?: boolean;
  jsxSingleQuote?: boolean;
  quoteProps?: "as-needed" | "consistent" | "preserve";
  trailingComma?: "all" | "es5" | "none";
  arrowParens?: "always" | "avoid";
  bracketSpacing?: boolean;
  bracketSameLine?: boolean;
  singleAttributePerLine?: boolean;
  objectWrap?: "preserve" | "collapse";
  endOfLine?: "lf" | "crlf" | "cr";
  insertFinalNewline?: boolean;
  proseWrap?: "always" | "never" | "preserve";
  sortPackageJson?: boolean | { sortScripts?: boolean };
  sortImports?:
    | boolean
    | {
        groups?: (string | string[] | { newlinesBetween: boolean })[];
        customGroups?: SortImportsCustomGroup[];
        internalPattern?: string[];
        newlinesBetween?: boolean;
        order?: "asc" | "desc";
        ignoreCase?: boolean;
        sortSideEffects?: boolean;
        partitionByComment?: boolean;
        partitionByNewline?: boolean;
      };
  ignorePatterns?: string[];
  overrides?: {
    files: string[];
    excludeFiles?: string[];
    options: Omit<MagicOxfmtConfig, "overrides" | "ignorePatterns">;
  }[];
};

/**
 * House style. These are Prettier's defaults, which is what the incumbent
 * `@magic/prettier-config` used (it set no formatting overrides at all), so
 * every existing repo already looks like this.
 *
 * Two of them are worth calling out because oxfmt's defaults differ:
 *   - `printWidth: 80`. oxfmt defaults to 100. Leaving it unset would silently
 *     reflow every file in every repo on the first run.
 *   - `singleQuote: false`. Same as Prettier, and same as oxfmt, but stated
 *     explicitly because it is the one house-style question that comes up.
 */
const houseStyle = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  jsxSingleQuote: false,
  quoteProps: "as-needed",
  trailingComma: "all",
  arrowParens: "always",
  bracketSpacing: true,
  bracketSameLine: false,
  objectWrap: "preserve",
  endOfLine: "lf",
  insertFinalNewline: true,
} as const satisfies MagicOxfmtConfig;

/**
 * The general shape here is "a tool owns this file, and nobody reads its diff".
 *
 * `CHANGELOG.md` is the one that bit. Every changelog generator — release-please,
 * @release-it/conventional-changelog, changesets, standard-version — re-appends
 * entries in its own style, and the first `oxfmt .` rewrites the whole file
 * (`*` bullets to `-`, blank line under each heading stripped). From then on the
 * release PR fails the format check that the release PR itself created, forever,
 * with a diff nobody wants to read. Costs nothing in a repo that generates no
 * changelog.
 *
 * It does cost something in a repo that writes its changelog by hand and wants
 * it formatted: `oxfmt CHANGELOG.md` — a path that is now excluded — exits **2**
 * with "Expected at least one target file", so a release script that formats the
 * file explicitly starts failing on the upgrade. `withoutIgnorePatterns` below
 * is the supported way back.
 */
const sharedIgnorePatterns = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.turbo/**",
  "**/.next/**",
  "**/.expo/**",
  "**/generated/**",
  "**/CHANGELOG.md",
  "**/*.generated.*",
  "**/*.min.js",
  "**/*.min.css",
  "pnpm-lock.yaml",
];

/**
 * Import order, ported from the `@ianvs/prettier-plugin-sort-imports`
 * `importOrder` the prettier config used.
 *
 * oxfmt's sorter is a port of eslint-plugin-perfectionist, so groups match by
 * *glob*, not regex, and the group vocabulary is
 * `<modifier>-<modifier>-<selector>`. Two behaviours drive the shape below:
 *
 *   1. customGroups outrank every predefined group and are first-match-wins.
 *      A bare `react` group would therefore swallow
 *      `import type { ReactNode } from "react"` out of the type group, so the
 *      `-type` variants have to be listed first.
 *   2. The shipped schema's default `groups` and the published docs disagree,
 *      which means the default is not stable. Setting `groups` explicitly is
 *      the only way to get a defined order.
 */
const sortImports = {
  customGroups: [
    {
      groupName: "react-type",
      modifiers: ["type"],
      elementNamePattern: [
        "react",
        "react/**",
        "react-dom",
        "react-dom/**",
        "react-native",
        "react-native/**",
      ],
    },
    {
      groupName: "next-type",
      modifiers: ["type"],
      elementNamePattern: ["next", "next/**"],
    },
    {
      groupName: "expo-type",
      modifiers: ["type"],
      elementNamePattern: ["expo", "expo-*", "expo-*/**", "@expo/**"],
    },
    {
      groupName: "react",
      elementNamePattern: [
        "react",
        "react/**",
        "react-dom",
        "react-dom/**",
        "react-native",
        "react-native/**",
      ],
    },
    {
      groupName: "next",
      elementNamePattern: ["next", "next/**"],
    },
    {
      groupName: "expo",
      elementNamePattern: ["expo", "expo-*", "expo-*/**", "@expo/**"],
    },
  ],
  // Mirrors the prettier importOrder: <TYPES> first, then react/react-native,
  // next, expo, third party, workspace-internal, then relative.
  groups: [
    "type",
    "react-type",
    "next-type",
    "expo-type",
    "value-builtin",
    "react",
    "next",
    "expo",
    "value-external",
    ["value-internal", "subpath"],
    ["parent", "sibling", "index"],
    "style",
    "unknown",
  ],
  // NOT a glob. `internalPattern` is the one sortImports option that takes
  // literal *prefixes* — oxfmt's schema documents the default as
  // `["~/", "@/", "#"]` and matches with a plain starts-with. Writing
  // perfectionist-style globs here (`"@/**"`) matches nothing, silently, so
  // every aliased import falls through to `value-external` and sorts next to
  // `zod`. Restated explicitly rather than left to the default so a future
  // oxfmt default change can't reshuffle imports across every repo.
  // (`customGroups[].elementNamePattern` above *is* glob-matched. Only this
  // key is prefix-based.)
  internalPattern: ["~/", "@/", "#"],
  newlinesBetween: true,
  order: "asc",
  ignoreCase: true,
  // Side-effect imports (`import "react-native-gesture-handler"`,
  // `import "./global.css"`) must not move: their position *is* their meaning.
  sortSideEffects: false,
} as const satisfies MagicOxfmtConfig["sortImports"];

const quoteList = (values: Iterable<string>): string =>
  [...values].map((pattern) => `"${pattern}"`).join(", ");

/**
 * Opt back into formatting a file the shared config ignores.
 *
 *     import base, { withoutIgnorePatterns } from "magic-oxfmt-config";
 *
 *     // This repo writes CHANGELOG.md by hand, so it should be formatted.
 *     export default withoutIgnorePatterns(base, ["**\/CHANGELOG.md"]);
 *
 * Spreading and filtering by hand works too, and is what this replaces. The
 * difference is the throw: a pattern that is not in the config is a typo, and a
 * typo that silently keeps the ignore in place is the exact failure mode this
 * package keeps warning about — oxfmt accepts unknown keys without a word, so
 * nothing downstream would report it either.
 */
export const withoutIgnorePatterns = <T extends MagicOxfmtConfig>(
  config: T,
  patterns: string[],
): T => {
  const present = new Set(config.ignorePatterns);
  const missing = patterns.filter((pattern) => !present.has(pattern));

  if (missing.length > 0) {
    throw new Error(
      `magic-oxfmt-config: withoutIgnorePatterns() was asked to remove ${quoteList(missing)}, ` +
        `which this config does not ignore. It ignores: ${quoteList(present)}`,
    );
  }

  const removed = new Set(patterns);

  return {
    ...config,
    ignorePatterns: [...present].filter((pattern) => !removed.has(pattern)),
  };
};

export const base: MagicOxfmtConfig = {
  ...houseStyle,
  sortImports,
  // oxfmt sorts package.json keys by default. Kept on — it removes a whole
  // class of pointless diff — but scripts stay in authored order because their
  // grouping is meaningful.
  sortPackageJson: { sortScripts: false },
  ignorePatterns: [...sharedIgnorePatterns],
};

export const react: MagicOxfmtConfig = { ...base };

export const next: MagicOxfmtConfig = {
  ...base,
  ignorePatterns: [...sharedIgnorePatterns, "**/out/**", "**/next-env.d.ts"],
};

const reactNativeIgnorePatterns = [
  ...sharedIgnorePatterns,
  "**/ios/**",
  "**/android/**",
  "**/Pods/**",
  "**/DerivedData/**",
  "**/*.pbxproj",
];

export const reactNative: MagicOxfmtConfig = {
  ...base,
  ignorePatterns: [...reactNativeIgnorePatterns],
};

export const expo: MagicOxfmtConfig = {
  ...base,
  ignorePatterns: [
    ...reactNativeIgnorePatterns,
    "**/.expo/**",
    "**/expo-env.d.ts",
  ],
};

export default base;
