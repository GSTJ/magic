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
