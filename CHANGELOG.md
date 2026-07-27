# Changelog

Versions are per package. This file records rounds, because the packages ship
together and most of what a consumer needs to know spans more than one of them.

## 2026-07-27 — the 1.0.0 migration reports

Eleven repos migrated onto the 1.0.0 packages and filed 26 findings. This round
is all 26. Nothing here is a new feature; it is what 1.0.0 got wrong.

| package               | 1.0.0 → | why                                 |
| --------------------- | ------- | ----------------------------------- |
| `magic-oxlint-config` | 1.1.0   | new exports, one rule changes sides |
| `magic-oxfmt-config`  | 1.1.0   | two new ignore patterns             |
| `magic-tsconfig`      | 1.1.0   | `incremental` dropped               |
| `magic-codemods`      | 1.1.0   | new detections, two new fatals      |
| `magic-oxlint-plugin` | 1.0.1   | exported types only                 |

### Read this before upgrading

**`magic-oxlint-config` now enforces `type` over `interface`.**
`typescript/consistent-type-definitions` was already `"error"` but carried
oxlint's default option, which enforces the opposite direction. Every
`interface` in a consuming repo is now a lint error. The conversion is
mechanical and `--fix` handles it; this repo converted itself as the dogfood.

**`magic-tsconfig` no longer sets `incremental`.** Builds lose their
`.tsbuildinfo` cache and get slower. That is the point: with `incremental` on, a
`rm -rf dist && tsc` emitted nothing at all, because the build info still
claimed the output was current. Drop `.tsbuildinfo` from `.gitignore` and from
CI cache keys.

**`magic-oxfmt-config` stops formatting `CHANGELOG.md` and `*.generated.*`.**
Every changelog generator re-appends entries in its own style, so the first
`oxfmt .` rewrote the file and from then on the release PR failed the format
check it had itself created.

**`magic-kebab` fails where it used to shrug.** An unmatched `--rename` key and
a `--tsconfig` path that does not exist are both fatal now, and newly-detected
module strings mean `--strict` can exit 1 on a repo that passed before.

### magic-oxlint-config 1.1.0

- The exported type is assignable to oxlint's `OxlintConfig` again. `plugins`
  was `string[]` and `rules` was `Record<string, unknown>` — both wider than
  oxlint's own types, so the config file the README tells you to write failed
  `tsc` with TS2322. `plugins` is now the same 15-member union oxlint uses and
  `rules` mirrors its rule-entry shape.
- Step 2 of the README is now `export { default } from "magic-oxlint-config/base"`.
  `defineConfig({ extends: [base] })` silently drops the preset's
  `ignorePatterns` — verified on oxlint 1.75.0, and with no `.gitignore` in the
  way that config reported ~500k diagnostics out of `node_modules`. The
  re-export loads the preset as _the_ config, so every field applies. The
  `extends` form stays documented with the required
  `ignorePatterns: base.ignorePatterns` line for repos already on 1.0.0.
- `testFilePlugins` is exported. A rule from a plugin that is not enabled for an
  override entry's own plugin set is ignored there, silently — which is why a
  consumer override could not switch off `jest/valid-title`. Spread
  `testFilePlugins` into the override's `plugins` and it works.
- `MagicOxlintOverride`, `MagicOxlintPlugin`, `MagicOxlintRuleEntry` and
  `MagicOxlintSeverity` are exported.
- `typescript/consistent-type-definitions` is `["error", "type"]`.
- `unicorn/no-array-reverse` off. Its autofix emits `toReversed()`, which is
  ES2023; the presets pin ES2022 and Hermes cannot be assumed to have it. Same
  reasoning that already had `unicorn/no-array-sort` off.
- `unicorn/prefer-export-from` off. The suggestion fixer deletes every statement
  between the first and last re-export. It is suggestion-only, so plain `--fix`
  never triggers it, but the README tells every migrating repo to run fixers and
  two reached for `--fix-suggestions`.
- `unicorn/catch-error-name` ignores `cause`. It was renaming the binding in
  `.catch((cause) => { throw new E("msg", { cause }) })`, and with it the
  shorthand property key, turning the Error's `cause` option into an unknown
  `error` option.
- `jest/valid-title`'s `mustNotMatch` gained word boundaries. `^should|^it`
  unanchored reported `describe("itemsToChunks")` and `describe("shouldRetry")`.
- The `next` preset turns off `unicorn/prefer-string-raw`,
  `react/function-component-definition` and `import/no-anonymous-default-export`
  for App Router files, and its glob covers `**/proxy.{js,ts}`.
  `prefer-string-raw` is the dangerous one: it rewrites a `middleware.ts`
  matcher to `String.raw` and `next build` then fails with "Invalid segment
  configuration export detected", naming no file, while lint, typecheck and
  tests all stay green.

### magic-oxfmt-config 1.1.0

- `**/CHANGELOG.md` and `**/*.generated.*` added to the shared ignore patterns.

### magic-tsconfig 1.1.0

- `incremental` removed from `base.json`, and the redundant repeat of it removed
  from `nextjs.json`.

### magic-codemods 1.1.0

- tsconfig discovery walks the workspace: the run root, then every package
  matched by `pnpm-workspace.yaml`, then a generic sweep. It used to look only
  at the run root — which in a monorepo usually has no tsconfig — print one line
  saying so, and then rewrite relative imports while leaving every `@/…` alias
  pointing at a file it had just renamed.
- `--tsconfig` is repeatable, and a path that does not resolve is fatal.
- An alias-shaped specifier that cannot be resolved and whose last segment names
  a rename target goes to `NEEDS REVIEW` instead of being quietly skipped.
- A bare string literal that resolves to a file being renamed goes to
  `NEEDS REVIEW` and is never edited. This is the Expo config-plugin case
  (`plugins: ["./plugins/withStoreKitConfiguration"]` in `app.config.ts`) and
  the require-wrapper case. Both broke real repos silently — the config-plugin
  one only on Linux and EAS, since APFS is case-insensitive.
- An unmatched `--rename` key is fatal and suggests the full basename when the
  extension is what was missing. It used to be ignored, and the file was renamed
  to the codemod's own target instead — discarding the human's decision on
  exactly the files someone had looked at carefully.

### magic-oxlint-plugin 1.0.1

- Exported types are `type` aliases rather than `interface`, following the
  config change above. No rule behaviour changed.

### Repo config

- The shared Renovate preset sets `minimumReleaseAge: "3 days"`. pnpm 11 enforces
  a 24h quarantine on `--frozen-lockfile`; with `automerge: true` on
  devDependencies, any repo on pnpm 11 got an un-installable lockfile for up to
  a day every time Renovate merged a same-day release.

### Docs

README.md, DECISIONS.md and `packages/codemods/README.md` corrected wherever
1.0.0's claims are now wrong, including the `extends` recipe, the override
mechanism, and the pnpm 11 notes (`onlyBuiltDependencies` → `allowBuilds`,
`minimumReleaseAgeExclude`). DECISIONS.md §7 indexes all 26 findings.

### Known gaps

- oxfmt 0.60.0 cannot parse a CSS custom property whose name contains a dot
  (`--blur-1.5`, a Tailwind v4 theme variable). It fails the whole run, not just
  that file. Upstream; the workaround is `"**/*.css"` in `ignorePatterns`.
- `unicorn/explicit-length-check` rewrites `data.size ? …` to `data.size > 0 ? …`
  on any property named `size`, assuming Set/Map. `tsc` catches it afterwards,
  but only by luck.
