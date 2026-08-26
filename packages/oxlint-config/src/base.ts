import {
  type MagicOxlintConfig,
  type MagicOxlintOverride,
  type MagicOxlintPlugin,
  withEnvCarrier,
} from "./internal.ts";

/**
 * Rules that are only evaluated when oxlint runs with `--type-aware` (which
 * needs `oxlint-tsgolint` installed and TypeScript >= 7). Without the flag
 * oxlint ignores them silently — no error, no warning — so they can live in the
 * base preset unconditionally and simply switch on the day a repo is ready.
 */
const typeAwareRules: Record<string, unknown> = {
  "typescript/await-thenable": "error",
  "typescript/consistent-type-exports": "error",
  "typescript/no-duplicate-type-constituents": "error",
  "typescript/no-floating-promises": "error",
  // `checksVoidReturn.attributes: false` is carried over from the incumbent
  // ESLint config and is not optional: without it every `onClick={async () =>
  // …}` JSX handler is an error. The rules here are dormant until a repo passes
  // `--type-aware`, which is exactly why the option has to be right *now* —
  // flipping the flag is supposed to need no config change.
  "typescript/no-misused-promises": [
    "error",
    { checksVoidReturn: { attributes: false } },
  ],
  "typescript/no-redundant-type-constituents": "error",
  "typescript/no-unnecessary-boolean-literal-compare": "error",
  "typescript/no-unnecessary-condition": "error",
  "typescript/no-unnecessary-template-expression": "error",
  "typescript/no-unnecessary-type-arguments": "error",
  "typescript/no-unnecessary-type-assertion": "error",
  "typescript/no-unsafe-argument": "error",
  "typescript/no-unsafe-return": "error",
  "typescript/only-throw-error": "error",
  "typescript/prefer-nullish-coalescing": "error",
  "typescript/prefer-optional-chain": "error",
  "typescript/prefer-promise-reject-errors": "error",
  "typescript/promise-function-async": "off",
  "typescript/require-await": "error",
  "typescript/return-await": "error",
  "typescript/strict-boolean-expressions": "error",
  "typescript/switch-exhaustiveness-check": "error",
  "typescript/use-unknown-in-catch-callback-variable": "error",

  // Deliberately off. `no-unsafe-assignment` and `-member-access` fire on
  // every untyped boundary (JSON.parse, most SDKs, RN native modules) and
  // produce more noise than signal; `no-unsafe-argument` and `no-unsafe-return`
  // above catch the cases that actually propagate.
  "typescript/no-unsafe-assignment": "off",
  // NOTE: a downgrade from the incumbent, which only disabled the two above and
  // ran `no-unsafe-call` at error. Grouped with the family here because calling
  // into an `any`-typed SDK boundary is the same untyped-boundary case, and
  // keeping one third of the family produced noise without changing behaviour.
  // It *is* a loosening.
  "typescript/no-unsafe-call": "off",
  "typescript/no-unsafe-member-access": "off",
  "typescript/no-unsafe-type-assertion": "off",
  // Consistently misfires on generic helper signatures
  // (`const pick = <T, K extends keyof T>(…)`), which shared-utility packages
  // are full of. Both references (MM, invest-radar) run it at error; this one is
  // a deliberate deviation from them.
  "typescript/no-unnecessary-type-parameters": "off",
  // Needs every dependency's deprecation metadata to be accurate. It isn't.
  "typescript/no-deprecated": "off",
  // Downgrades from strictTypeChecked (incumbent had these at error):
  // `no-confusing-void-expression` fights the arrow-heavy house style
  // (`onPress={() => void mutate()}`, `=> setState(x)`), and the other two
  // fire almost exclusively on that same pattern. Dormant either way until a
  // repo passes `--type-aware`.
  "typescript/no-confusing-void-expression": "off",
  "typescript/no-meaningless-void-operator": "off",
  "typescript/no-base-to-string": "off",
  "typescript/consistent-return": "off",
  "typescript/prefer-for-of": "off",
  "typescript/prefer-readonly-parameter-types": "off",
  "typescript/strict-void-return": "off",
  "typescript/no-unnecessary-type-conversion": "off",
  "typescript/require-array-sort-compare": "off",
  "typescript/restrict-template-expressions": "off",
  "typescript/unbound-method": "off",
};

/**
 * Basenames exempt from `unicorn/filename-case`.
 *
 * `ignore` entries are **regexes matched unanchored against the basename
 * only** — verified against oxlint 1.75.0: `^Pascal` suppresses
 * `src/PascalThing.ts`, `^src/Pascal` does not. An unparseable regex is a fatal
 * config error, as is an unknown option key (the rule accepts exactly `case`,
 * `cases`, `ignore`, `multipleFileExtensions`).
 *
 * Anything listed here must also be in `magic-kebab`'s skip list, or a repo ends
 * up with a violation the codemod refuses to fix.
 */
export const filenameCaseIgnore: string[] = [
  // File-based routers — Next.js app/pages router, expo-router, TanStack
  // Router — put a *route parameter name* between brackets: `[postId].tsx`,
  // `[[...slug]].tsx`. That name is addressable behaviour (it becomes
  // `params.postId`), not a word in a filename, so kebab-casing it changes the
  // route contract and breaks every reader of the param. Costs nothing in a
  // repo that has no bracketed filenames.
  String.raw`\[`,
];

/**
 * A manual mock's filename is not ours to choose: jest and vitest resolve
 * `__mocks__/<x>` by matching `<x>` against the *module being mocked*, so
 * `__mocks__/AsyncStorage.ts` has to stay `AsyncStorage.ts` for exactly as long
 * as the package is called that. Deliberately narrower than the test-file
 * override — `button.test.tsx` is ours and does get kebab-cased.
 *
 * Exported (and appended last by every variant) because a later, broader
 * `overrides[]` entry can switch a category rule back on for the files it
 * matches, and `unicorn/filename-case` is a `style` rule, so an earlier `off`
 * for `__mocks__` does not survive one. Being last is the only thing that makes
 * it stick, and `test/variants.test.mjs` asserts it holds in all five variants.
 */
export const mocksFilenameCase: MagicOxlintOverride = {
  files: ["**/__mocks__/**"],
  rules: { "unicorn/filename-case": "off" },
};

/**
 * The plugin list the test-file override declares.
 *
 * Exported because a consumer who wants to reconfigure any `jest/*` rule the
 * preset sets **must repeat this list verbatim** in their own override, and
 * nobody derives that from first principles. `jest` is enabled only inside an
 * override, and a rule belonging to a plugin that is not enabled for an override
 * entry's own plugin set is silently ignored there — so a consumer entry with
 * `rules: { "jest/valid-title": "off" }` and no `plugins` key does nothing, and
 * so does a top-level `rules` entry. Verified against oxlint 1.75.0; the
 * before/after is in the root README's Gotchas and
 * `fixtures/adversarial/override` executes both directions.
 *
 *   import { testFilePlugins } from "magic-oxlint-config";
 *
 *   overrides: [
 *     {
 *       files: ["**\/*.test.ts"],
 *       plugins: testFilePlugins,
 *       rules: { "jest/valid-title": "off" },
 *     },
 *   ]
 */
export const testFilePlugins: MagicOxlintPlugin[] = [
  "typescript",
  "unicorn",
  "oxc",
  "import",
  "promise",
  "jest",
];

/**
 * The general-purpose preset. Everything here applies to any TypeScript
 * codebase — no framework assumptions, no project conventions.
 *
 * Category strategy: turn on everything except `restriction` (which bans
 * language features wholesale and is far too blunt to enable globally), then
 * opt out of the individual rules that are wrong more often than they're right.
 * This is the strategy already proven in invest-radar and MM mobile.
 */
const baseConfig: MagicOxlintConfig = {
  plugins: ["typescript", "unicorn", "oxc", "import", "promise"],

  categories: {
    correctness: "error",
    suspicious: "error",
    pedantic: "error",
    style: "error",
    perf: "error",
    restriction: "off",
    nursery: "off",
  },

  env: {
    browser: true,
    node: true,
    es2024: true,
  },

  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/.next/**",
    "**/.expo/**",
    "**/generated/**",
    // Playwright's HTML report and artifact dirs are generated JS.
    "**/playwright-report/**",
    "**/test-results/**",
    "**/*.d.ts",
    "**/*.min.js",
    "pnpm-lock.yaml",
  ],

  rules: {
    // ---------------------------------------------------------------------
    // Category opt-outs: rules the blanket `style`/`pedantic` switch turns on
    // that we do not want.
    // ---------------------------------------------------------------------
    "arrow-body-style": "off",
    "capitalized-comments": "off",
    curly: "off",
    "id-length": "off",
    "init-declarations": "off",
    "max-lines-per-function": "off",
    "max-params": "off",
    "max-statements": "off",
    "no-inline-comments": "off",
    "no-magic-numbers": "off",
    "no-plusplus": "off",
    "no-shadow": "off",
    "no-ternary": "off",
    "no-underscore-dangle": "off",
    "no-void": "off",
    // oxlint 1.78 implemented this rule, and the blanket `style` category
    // immediately started asking consumers to combine adjacent declarations.
    // One declaration per statement is the established style across the
    // ecosystem and produces smaller diffs when bindings change independently.
    "one-var": "off",
    "prefer-named-capture-group": "off",
    "require-unicode-regexp": "off",
    "sort-imports": "off",
    "sort-keys": "off",
    "func-names": "off",

    "import/exports-last": "off",
    "import/first": "off",
    "import/group-exports": "off",
    "import/max-dependencies": "off",
    "import/no-default-export": "off",
    "import/no-named-as-default-member": "off",
    "import/no-named-export": "off",
    "import/no-nodejs-modules": "off",
    "import/no-unassigned-import": "off",
    "import/prefer-default-export": "off",
    // Contradicts `typescript/consistent-type-imports`, which we want to own
    // type-import style. Keeping both on produces a fight the fixer can't win.
    "import/consistent-type-specifier-style": "off",

    // Contradicts `unicorn/prefer-spread` on `flatMap((x) => [x, ...f(x)])`:
    // this rejects the spread, prefer-spread rejects the `.concat()` escape
    // hatch, and the only lint-clean form is a hand-rolled loop. prefer-spread
    // is general and autofixable, so the perf micro-rule yields.
    "oxc/no-map-spread": "off",

    "promise/always-return": "off",
    "promise/avoid-new": "off",
    "promise/prefer-await-to-callbacks": "off",
    "promise/prefer-await-to-then": "off",

    // On, kebab-case everywhere, per the g2i and invest-radar convention.
    // `case` is stated explicitly even though `kebabCase` is the current
    // default, on the same reasoning as oxfmt's `groups`: a default change
    // upstream must not silently re-case every repo at once.
    //
    // The mass rename this implies is not hand work. `magic-codemods`'
    // `magic-kebab` does the renames and the import rewrites together, so every
    // repo runs the same script instead of inventing one.
    "unicorn/filename-case": [
      "error",
      { case: "kebabCase", ignore: filenameCaseIgnore },
    ],
    "unicorn/no-array-callback-reference": "off",
    // `no-array-sort` and `no-array-reverse` are the same rule against the same
    // ES2023 method family, and this preset ships next to a tsconfig that pins
    // `lib: ["ES2022"]`. Leaving `no-array-reverse` on meant `oxlint --fix`
    // rewrote `[...arr].reverse()` to `arr.toReversed()` and `tsc` then rejected
    // it — the shipped preset autofixing code into a state the shipped tsconfig
    // cannot compile. Hermes has the same gap at runtime. Raising `lib` to
    // ES2023 is the wrong lever: it changes the compile target of every repo to
    // accommodate one autofix, and does nothing for Hermes.
    "unicorn/no-array-sort": "off",
    "unicorn/no-array-reverse": "off",
    // Its `--fix-suggestions` fixer deletes code. Verified on oxlint 1.75.0
    // against a module that re-exports imported names in two `export { … }`
    // statements with an unrelated `export const` between them: the fixer
    // replaces the whole span with one `export … from`, and everything between
    // the first and last re-export is silently gone. No diagnostic, no type
    // error at the fix site. `{ checkUsedVariables: false }` narrows it but does
    // not close it: a barrel whose re-exported names are used nowhere else still
    // collapses. `fixtures/adversarial/base/src/derived-reexport.ts` is the
    // shape to re-test with.
    "unicorn/prefer-export-from": "off",
    "unicorn/no-immediate-mutation": "off",
    "unicorn/no-null": "off",
    "unicorn/no-object-as-default-parameter": "off",
    "unicorn/no-useless-undefined": "off",
    "unicorn/number-literal-case": "off",
    "unicorn/numeric-separators-style": "off",
    "unicorn/prefer-global-this": "off",
    "unicorn/prefer-logical-operator-over-ternary": "off",
    "unicorn/prefer-math-trunc": "off",
    "unicorn/prefer-response-static-json": "off",
    "unicorn/prefer-ternary": "off",
    "unicorn/prefer-top-level-await": "off",
    "unicorn/switch-case-braces": "off",

    // ---------------------------------------------------------------------
    // Correctness and safety
    // ---------------------------------------------------------------------
    "no-eval": "error",
    "no-extend-native": "error",
    "no-implied-eval": "error",
    "no-iterator": "error",
    "no-labels": "error",
    "no-lone-blocks": "error",
    "no-multi-str": "error",
    "no-new-func": "error",
    "no-new-wrappers": "error",
    "no-proto": "error",
    "no-return-assign": "error",
    "no-script-url": "error",
    "no-self-compare": "error",
    "no-sequences": "error",
    "no-throw-literal": "error",
    "no-unmodified-loop-condition": "error",
    "no-useless-call": "error",
    "no-useless-concat": "error",
    "no-useless-return": "error",
    "prefer-promise-reject-errors": "error",
    "preserve-caught-error": "error",
    radix: "error",
    yoda: "error",
    "new-cap": "error",
    "no-var": "error",
    "prefer-const": "error",

    // `console` is a debugging leftover in shipped code. Test files, scripts
    // and CLI entry points opt back in via their own overrides.
    "no-console": "error",

    // ---------------------------------------------------------------------
    // Readability
    // ---------------------------------------------------------------------
    complexity: ["error", { max: 20 }],
    "max-depth": ["error", 3],
    "max-lines": ["error", 1000],
    "no-array-constructor": "error",
    "no-bitwise": "error",
    "no-continue": "error",
    "no-else-return": ["error", { allowElseIf: false }],
    "no-lonely-if": "error",
    "no-negated-condition": "error",
    "no-nested-ternary": "error",
    "no-unneeded-ternary": "error",
    "operator-assignment": "error",
    "prefer-exponentiation-operator": "error",
    "prefer-object-spread": "error",

    // The incumbent `prefer-arrow-functions/prefer-arrow-functions` has no
    // oxlint equivalent. `func-style: expression` enforces the same outcome —
    // no hoisted `function` declarations — without a JS plugin. Named exports
    // are left alone so `export default function Page()` (Next.js) and
    // `export function GET()` (route handlers) still work.
    "func-style": [
      "error",
      "expression",
      { overrides: { namedExports: "ignore" } },
    ],

    // ---------------------------------------------------------------------
    // Modern syntax
    // ---------------------------------------------------------------------
    "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
    "no-useless-rename": "error",
    "prefer-arrow-callback": "error",
    "prefer-destructuring": "error",
    "prefer-numeric-literals": "error",
    "prefer-rest-params": "error",
    "prefer-spread": "error",
    "prefer-template": "error",
    "symbol-description": "error",

    // `cause` is the standard `new Error(msg, { cause })` chaining idiom, and
    // the autofixer rewrites the shorthand property *key* along with the
    // binding — so `.catch((cause) => { throw new E(m, { cause }) })` silently
    // became `{ error }`, an option `Error` does not know, and the error chain
    // was lost with nothing to report it. The rename itself is fine; rewriting a
    // shorthand key is a semantic change wearing a rename's clothes.
    "unicorn/catch-error-name": ["error", { ignore: ["^cause$"] }],
    "unicorn/no-accessor-recursion": "error",
    "unicorn/no-array-for-each": "error",
    "unicorn/no-instanceof-builtins": "error",
    "unicorn/no-lonely-if": "error",
    "unicorn/no-negated-condition": "error",
    "unicorn/no-nested-ternary": "error",
    "unicorn/no-typeof-undefined": "error",
    "unicorn/no-useless-spread": "error",
    "unicorn/no-useless-switch-case": "error",
    "unicorn/prefer-array-find": "error",
    "unicorn/prefer-array-flat": "error",
    "unicorn/prefer-array-flat-map": "error",
    "unicorn/prefer-array-some": "error",
    "unicorn/prefer-includes": "error",
    "unicorn/prefer-modern-math-apis": "error",
    "unicorn/prefer-native-coercion-functions": "error",
    "unicorn/prefer-number-properties": "error",
    "unicorn/prefer-optional-catch-binding": "error",
    "unicorn/prefer-regexp-test": "error",
    "unicorn/prefer-set-has": "error",
    "unicorn/prefer-spread": "error",
    "unicorn/prefer-string-replace-all": "error",
    "unicorn/prefer-string-slice": "error",
    "unicorn/prefer-string-starts-ends-with": "error",
    "unicorn/prefer-string-trim-start-end": "error",
    "unicorn/require-post-message-target-origin": "error",
    "unicorn/throw-new-error": "error",

    // ---------------------------------------------------------------------
    // Imports. Import *order* is not an oxlint rule at all — `oxfmt` owns it
    // via `sortImports`. See magic-oxfmt-config.
    // ---------------------------------------------------------------------
    "import/no-cycle": "error",
    "import/no-duplicates": "error",
    "import/no-empty-named-blocks": "error",
    "import/no-self-import": "error",
    "import/no-named-as-default": "error",
    // The `@shopify/no-namespace-imports` replacement. `import * as x` defeats
    // tree-shaking and hides what a module actually uses. The `react` preset
    // re-declares this with the ecosystem allow list the old config carried
    // (`react`, `@radix-ui/*`); tests turn it off, because namespace imports are
    // how you spy on a module.
    "import/no-namespace": "error",

    // ---------------------------------------------------------------------
    // Promises
    // ---------------------------------------------------------------------
    "promise/catch-or-return": "error",
    "promise/no-nesting": "error",
    "promise/no-return-wrap": "error",
    "promise/param-names": "error",

    // ---------------------------------------------------------------------
    // TypeScript (syntax-only — the type-aware set is merged in below)
    // ---------------------------------------------------------------------
    // `"type"`, not the rule's default `"interface"`. The interface→type
    // direction is safe; type→interface is not. An interface has no implicit
    // index signature, so autofixing `type LngProps = { lng: Locale }` into an
    // interface stops it satisfying `Record<string, unknown>` and Next's
    // `Params` constraint — and the errors land at every *use* site, not at the
    // converted declaration. A repo-wide `--fix` did 98 of those conversions.
    "typescript/consistent-type-definitions": ["error", "type"],
    "typescript/consistent-type-imports": "error",
    "typescript/method-signature-style": "error",
    "typescript/no-confusing-non-null-assertion": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-extraneous-class": "error",
    "typescript/no-import-type-side-effects": "error",
    "typescript/no-inferrable-types": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/no-unsafe-enum-comparison": "error",
    "typescript/prefer-as-const": "error",
    "typescript/no-useless-empty-export": "error",
    "typescript/no-require-imports": "off",
    // oxlint has no separate `typescript/no-unused-vars`; the core rule is
    // TypeScript-aware. It also already reports unused *imports*, which is what
    // `unused-imports/no-unused-imports` was doing in the ESLint config.
    "no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],

    // ---------------------------------------------------------------------
    // `no-restricted-syntax` does not exist in oxlint. Both things the ESLint
    // config used it for are expressible with real rules instead.
    // ---------------------------------------------------------------------
    "no-restricted-properties": [
      "error",
      {
        object: "process",
        property: "env",
        message:
          "Direct process.env usage is not allowed. Import from a dedicated, validated env module instead.",
      },
    ],

    ...typeAwareRules,
  },

  overrides: [
    {
      // The env module is the one place allowed to read process.env.
      files: [
        "**/env.ts",
        "**/env.js",
        "**/env.mjs",
        "**/env.*.ts",
        "**/src/env/**",
      ],
      rules: { "no-restricted-properties": "off" },
    },
    {
      // Config files, scripts and CLI entry points legitimately log and
      // legitimately use default exports.
      files: [
        "**/*.config.{js,cjs,mjs,ts,cts,mts}",
        "**/scripts/**",
        "**/bin/**",
      ],
      rules: {
        "no-console": "off",
        "import/no-default-export": "off",
        // `export default { … }` is the whole point of a config file.
        "import/no-anonymous-default-export": "off",
        "typescript/no-require-imports": "off",
        "func-style": "off",
        "no-restricted-properties": "off",
      },
    },
    {
      files: [
        "**/*.test.{js,jsx,ts,tsx}",
        "**/*.spec.{js,jsx,ts,tsx}",
        "**/__tests__/**",
        "**/__mocks__/**",
      ],
      // NOTE: `overrides[].plugins` *replaces* the top-level list rather than
      // merging it, so the base plugins have to be repeated here or every
      // typescript/unicorn/import rule silently switches off inside tests.
      plugins: testFilePlugins,
      env: { jest: true },
      rules: {
        "no-console": "off",
        "max-lines": ["error", 3000],
        "max-nested-callbacks": "off",
        "no-negated-condition": "off",
        "prefer-destructuring": "off",
        "new-cap": "off",
        "no-script-url": "off",
        "func-style": "off",
        "no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        "typescript/no-explicit-any": "off",
        "typescript/no-non-null-assertion": "off",
        "typescript/consistent-type-imports": "off",
        "unicorn/consistent-function-scoping": "off",
        "unicorn/no-array-for-each": "off",
        "unicorn/no-await-expression-member": "off",
        "unicorn/empty-brace-spaces": "off",

        // Type-aware rules are noise in tests: mocks are deliberately loose.
        "typescript/await-thenable": "off",
        "typescript/no-floating-promises": "off",
        "typescript/no-misused-promises": "off",
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/require-await": "off",
        // The *core* rule too — `async` test callbacks with no `await` are
        // routine, and disabling only the typescript/ variant left the core
        // one (on via `pedantic`) firing on exactly the same code.
        "require-await": "off",
        "typescript/strict-boolean-expressions": "off",
        "typescript/unbound-method": "off",

        // Namespace imports are the normal way to spy on a module
        // (`import * as api from "./api"; jest.spyOn(api, "fetchUser")`).
        "import/no-namespace": "off",

        // `jest.configs["flat/recommended"]`, enumerated by hand. It has to be
        // enumerated: `categories` do *not* activate rules for a plugin that is
        // only declared inside an override, so in the `base` preset — where this
        // override is the only place `jest` is listed — anything not named here
        // is simply off. (In `react` and below the same rules happen to come on
        // via the categories, because the react preset appends a second
        // test-file override with no `plugins` key. Relying on that would make
        // the jest rule set depend on which variant a repo picked, so every rule
        // we care about is spelled out instead.)
        "jest/no-alias-methods": "error",
        "jest/no-commented-out-tests": "error",
        "jest/no-conditional-expect": "error",
        "jest/no-deprecated-functions": "error",
        "jest/no-disabled-tests": "error",
        "jest/no-done-callback": "error",
        "jest/no-export": "error",
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "jest/no-interpolation-in-snapshots": "error",
        "jest/no-jasmine-globals": "error",
        "jest/no-mocks-import": "error",
        "jest/no-standalone-expect": "error",
        "jest/no-test-prefixes": "error",
        "jest/prefer-to-have-length": "error",
        "jest/valid-describe-callback": "error",
        "jest/valid-expect": "error",
        "jest/valid-expect-in-promise": "error",

        // Recommended-set rules we deliberately drop. `expect-expect` fires on
        // every suite whose assertion lives in a helper, which is most of them.
        "jest/expect-expect": "off",
        "jest/prefer-ending-with-an-expect": "off",
        // Pure spacing — oxfmt's territory. Same reasoning that dropped
        // `eslint-plugin-jest-formatting`.
        "jest/padding-around-after-all-blocks": "off",
        "jest/padding-around-test-blocks": "off",
        // Fine for repos that set `injectGlobals: false`; nothing in the
        // migration set does, and it rewrites the top of every test file.
        "jest/prefer-importing-jest-globals": "off",
        // Demands `toHaveBeenCalledWith` everywhere, including where "was it
        // called at all" is the whole assertion.
        "jest/prefer-called-with": "off",
        "jest/no-hooks": "off",
        "jest/no-conditional-in-test": "off",
        "jest/prefer-expect-assertions": "off",
        "jest/prefer-lowercase-title": "off",
        "jest/max-expects": "off",
        "jest/require-hook": "off",
        "jest/require-top-level-describe": "off",
        "jest/no-large-snapshots": "off",
        // The `\b`s are load-bearing. `^should` / `^it` match the first
        // *letters*, not the first word, so `describe("itemsToChunks")` and
        // `describe("shouldRetry")` were both reported — and describe blocks are
        // normally named after the function under test, so that is a large share
        // of them. With the word boundary, `it("should return null")` still
        // fails and the identifier-shaped titles pass.
        "jest/valid-title": [
          "error",
          {
            mustNotMatch: [
              String.raw`(^should\b|^it\b|correctly|\.$)`,
              "Don't end with a full-stop, and don't start with the word 'should' or 'it'. Don't use 'correctly', it is presumed.",
            ],
          },
        ],
        // Clearing mocks belongs in the runner config (`clearMocks: true`),
        // not scattered through suites where it is easy to forget one. Both
        // runners are listed because per-rule config *replaces* rather than
        // merges — which is also why the base-level `process.env` ban has to
        // be repeated here or this entry would silently switch it off in
        // tests.
        "no-restricted-properties": [
          "error",
          {
            object: "process",
            property: "env",
            message:
              "Direct process.env usage is not allowed. Import from a dedicated, validated env module instead.",
          },
          {
            object: "jest",
            property: "clearAllMocks",
            message:
              "Enable `clearMocks` in the jest config instead of calling jest.clearAllMocks() per suite.",
          },
          {
            object: "vi",
            property: "clearAllMocks",
            message:
              "Enable `clearMocks` in the vitest config instead of calling vi.clearAllMocks() per suite.",
          },
        ],
      },
    },
    mocksFilenameCase,
  ],
};

/**
 * `withEnvCarrier` mirrors `env` and `globals` into a `files: ["**"]` override
 * so a consumer who reaches for oxlint's `extends` still gets them — `extends`
 * drops both, silently. See the helper's docblock.
 */
export const base: MagicOxlintConfig = withEnvCarrier(baseConfig);

export default base;
