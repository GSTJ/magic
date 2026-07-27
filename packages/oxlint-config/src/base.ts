import type { MagicOxlintConfig } from "./internal.ts";

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
  "typescript/no-misused-promises": "error",
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

  // Deliberately off. `no-unsafe-assignment`/`-call`/`-member-access` fire on
  // every untyped boundary (JSON.parse, most SDKs, RN native modules) and
  // produce more noise than signal; `no-unsafe-argument` and `no-unsafe-return`
  // above catch the cases that actually propagate.
  "typescript/no-unsafe-assignment": "off",
  "typescript/no-unsafe-call": "off",
  "typescript/no-unsafe-member-access": "off",
  "typescript/no-unsafe-type-assertion": "off",
  // Consistently misfires on generic helper signatures.
  "typescript/no-unnecessary-type-parameters": "off",
  // Needs every dependency's deprecation metadata to be accurate. It isn't.
  "typescript/no-deprecated": "off",
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
 * The general-purpose preset. Everything here applies to any TypeScript
 * codebase — no framework assumptions, no project conventions.
 *
 * Category strategy: turn on everything except `restriction` (which bans
 * language features wholesale and is far too blunt to enable globally), then
 * opt out of the individual rules that are wrong more often than they're right.
 * This is the strategy already proven in invest-radar and MM mobile.
 */
export const base: MagicOxlintConfig = {
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

    "promise/always-return": "off",
    "promise/avoid-new": "off",
    "promise/prefer-await-to-callbacks": "off",
    "promise/prefer-await-to-then": "off",

    // Defaults to kebab-case, and the repos genuinely disagree: magic-modal,
    // pegada and the portfolio are mostly PascalCase for components, only
    // invest-radar is kebab. Enabling it would rename hundreds of files during
    // a migration that is already changing everything else. A repo that wants
    // one convention should turn it on locally with its own `case` option.
    "unicorn/filename-case": "off",
    "unicorn/no-array-callback-reference": "off",
    "unicorn/no-array-sort": "off",
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

    "unicorn/no-accessor-recursion": "error",
    "unicorn/no-array-for-each": "error",
    "unicorn/no-array-reverse": "error",
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
    // Imports
    // ---------------------------------------------------------------------
    "import/no-cycle": "error",
    "import/no-duplicates": "error",
    "import/no-empty-named-blocks": "error",
    "import/no-self-import": "error",
    "import/no-named-as-default": "error",
    // Import *order* is not an oxlint rule at all — `oxfmt` owns it via
    // `sortImports`. See magic-oxfmt-config.
    "import/no-namespace": "off",

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
    "typescript/consistent-type-definitions": "error",
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
      plugins: ["typescript", "unicorn", "oxc", "import", "promise", "jest"],
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
        "typescript/strict-boolean-expressions": "off",
        "typescript/unbound-method": "off",

        "jest/no-disabled-tests": "error",
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "jest/no-commented-out-tests": "error",
        "jest/prefer-to-have-length": "error",
        "jest/valid-expect": "error",
        "jest/expect-expect": "off",
        "jest/no-hooks": "off",
        "jest/no-conditional-in-test": "off",
        "jest/prefer-expect-assertions": "off",
        "jest/prefer-lowercase-title": "off",
        "jest/max-expects": "off",
        "jest/require-hook": "off",
        "jest/require-top-level-describe": "off",
        "jest/no-large-snapshots": "off",
        "jest/valid-title": [
          "error",
          {
            mustNotMatch: [
              String.raw`(^should|^it|correctly|\.$)`,
              "Don't end with a full-stop, and don't start with 'should' or 'it'. Don't use 'correctly', it is presumed.",
            ],
          },
        ],
        // Clearing mocks belongs in the jest config (`clearMocks: true`), not
        // scattered through suites where it is easy to forget one.
        "no-restricted-properties": [
          "error",
          {
            object: "jest",
            property: "clearAllMocks",
            message:
              "Enable `clearMocks` in the jest config instead of calling jest.clearAllMocks() per suite.",
          },
        ],
      },
    },
  ],
};

export default base;
