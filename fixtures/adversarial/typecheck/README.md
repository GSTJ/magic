# typecheck fixture

The root README's Step 2 snippet, verbatim, for every variant — compiled by
`tsc --noEmit` against the real `oxlint` types on every `pnpm run check`.

This exists because `MagicOxlintConfig` shipped at 1.0.0 with
`plugins?: string[]`, which is _wider_ than oxlint's
`LintPluginOptionsSchema[]` and therefore not assignable to it. Every consumer
that put `*.config.mts` in a tsconfig `include` got

    error TS2322: Type 'MagicOxlintConfig' is not assignable to type 'OxlintConfig'.

on the file the README told them to write. This repo missed it because
`typecheck` is `turbo run typecheck`, which is per-package, so the root
`oxlint.config.mts` is in no tsconfig's `include`.

`tsconfig.json` here puts `*.config.mts` in `include` on purpose. That is the
whole test.

Since magic-oxlint-config 1.2.0 these compile the two **supported** shapes — the
re-export and `extendConfig` — rather than the `extends` recipe they used to.
`extends` is not a documented consumption path any more (it drops the preset's
`ignorePatterns`), so type-checking it here would be certifying a shape the
README tells you not to write. What `extends` actually does at runtime is
covered by `fixtures/adversarial/extends` instead, which executes it.
