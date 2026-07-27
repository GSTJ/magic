# Changelog

Versions are per package. This file records rounds, because the packages ship
together and most of what a consumer needs to know spans more than one of them.

## 2026-07-27 — CI: composite actions, and consumption by tag

No npm package changed. Everything here is in `.github/` and in how consumers
reference it. The repo tag for this round is `v1.3.0`, and `v1` moves onto it.

### Change your `uses:` lines

```diff
- uses: GSTJ/magic/.github/workflows/ci.yml@main
+ uses: GSTJ/magic/.github/workflows/ci.yml@v1
```

`@v1` is a moving major tag: fixes arrive on the next run, with no PR. Pin
`@v1.3.0` instead where a surprise is expensive; the Renovate preset groups those
bumps with the `magic-*` packages and automerges them.

### New: three composite actions

| Action                                     | Replaces                                                      |
| ------------------------------------------ | ------------------------------------------------------------- |
| `GSTJ/magic/.github/actions/setup@v1`      | the pnpm + setup-node + install block, 24 copies of it        |
| `GSTJ/magic/.github/actions/setup-ios-e2e@v1` | Xcode select, Maestro install, simulator boot, pods caching |
| `GSTJ/magic/.github/actions/approve-parked-ci@v1` | the two local copies of the parked-run approver         |

`setup` keeps the pnpm store cache on by default, so every hand-rolled
`pnpm store path` + `actions/cache` pair can go, and every `pnpm install` in a
workflow should regain its `--frozen-lockfile`.

### Fixed: `registry-url` on repos with no npm token

`ci.yml` used to set `registry-url` unconditionally, which writes an `.npmrc`
containing a literal `${NODE_AUTH_TOKEN}`. It is now written only when the
`NPM_TOKEN` secret is actually passed. Nothing to do in consumers; the repo that
worked around it locally can drop the workaround.

### New: `job-name` input

A called workflow reports as `<caller job> / <called job>`, which no ruleset
expecting a bare context name will ever match. `job-name` sets the second half,
so a caller job `verify` plus `job-name: verify` gives the stable
`verify / verify` to put in the ruleset — an alternative to the no-op shim job
two repos are carrying.

## 2026-07-27 — the 1.1.0 upgrade reports

The same eleven repos upgraded onto 1.1.0. All eleven ended green, so nothing
below was release-blocking; it is the set of things they proved with repros
afterwards. Two are real defects, one of which had been reported by three repos
independently.

| package               | 1.1.0 → | why                                       |
| --------------------- | ------- | ----------------------------------------- |
| `magic-oxlint-config` | 1.2.0   | `env`/`globals` survive `extends` now     |
| `magic-oxfmt-config`  | 1.2.0   | an opt-out for the `CHANGELOG.md` ignore  |
| `magic-tsconfig`      | 1.2.0   | `incremental` back in `nextjs.json`       |

### Read this before upgrading

**`extends` is no longer a documented way to consume `magic-oxlint-config`.**
Only two shapes are supported: the one-line re-export
(`export { default } from "magic-oxlint-config/base"`) and `extendConfig()`. If
your config is `defineConfig({ extends: [preset] })`, switch it — including if
you added the `ignorePatterns: base.ignorePatterns` line 1.1.0 told you to. The
line works; the recipe does not, because it has to be remembered in every repo
on every variant forever, and forgetting it is invisible until someone edits
`.gitignore`. Seven of eleven repos shipped 1.0.0 configs with zero ignore
patterns. `.oxlintrc.json` consumers have no alternative and keep the literal
copy — see the package README.

**`magic-tsconfig/nextjs.json` sets `incremental: true` again**, and Next repos
should keep `*.tsbuildinfo` in `.gitignore`. 1.1.0's advice to delete it was
wrong for Next apps, and for any turbo repo that declares the build info as a
task output.

### magic-oxlint-config 1.2.0

- **`env` and `globals` now survive oxlint's `extends`.** Every variant mirrors
  them into a `files: ["**"]` override, because `overrides` travel through
  `extends` and top-level fields do not. Before this, a config built on `extends`
  ran with `env: { builtin: true }` and no globals: `document = 1` did not fire
  `no-global-assign` (an `error` rule in every variant) and `__DEV__` was
  undefined in the React Native presets. It also fixes JSON consumers, who have
  no `extendConfig` to reach for. `ignorePatterns` still cannot be defended —
  oxlint has no per-override ignore — which is why `extends` stays undocumented.
- No rule changed. The carrier override sets nothing but `env`/`globals`, and a
  before/after diff over three fixture trees reported identical diagnostics.

### magic-oxfmt-config 1.2.0

- `withoutIgnorePatterns(config, patterns)` is exported: the supported way for a
  repo that writes `CHANGELOG.md` by hand to format it again. It throws on a
  pattern the config does not actually ignore, rather than silently doing
  nothing. The `**/CHANGELOG.md` default stays — generated changelogs are the
  common case and formatting one turns every future release PR red.
- Worth knowing either way: **`oxfmt <ignored-path>` exits 2**, not 0
  (`Expected at least one target file`). A release script shaped like
  `node tools/changelog.mjs && oxfmt CHANGELOG.md`, run from `npm version`, now
  dies after rewriting the changelog and before `git add`-ing it. Drop the
  explicit call or opt out.

### magic-tsconfig 1.2.0

- `incremental: true` is back in `nextjs.json`. `next build` runs
  `writeConfigurationDefaults`, which writes any of its suggested compiler
  options that are absent from the **resolved** config straight into the
  consumer's `tsconfig.json` — reformatting the whole file in its own JSON style
  while it is there. `incremental` was the only suggested option this package
  left unset after 1.1.0, so every `next build` dirtied the working tree and the
  next `oxfmt --check` failed on a file nobody edited, with nothing connecting it
  back to a tsconfig bump. Three repos hit it.
- Safe there for the reason 1.1.0's removal was right everywhere else:
  `nextjs.json` is `noEmit`, so no stale build info can suppress an emit, and
  Next keeps its own build info in `.next/cache`. `base.json`,
  `internal-package.json` and `expo.json` are unchanged.
- `tsBuildInfoFile` cannot be shipped alongside it: relative paths in an extended
  config resolve against the file that declares them, so the entry would write
  inside `node_modules/magic-tsconfig`.
- If you kept a `tsBuildInfoFile` through the 1.1.0 bump, note it is
  `error TS5069` on TypeScript 5.x without `incremental` — a hard typecheck
  failure. (tsgo 7.0.2 accepts it.)

### Docs

- **`oxlint --print-config` is not a way to audit an `extends`-shaped config**,
  and both this file and the README used to send people there. It renders that
  shape post-expansion and pre-merge: `categories: {}`, `env: { builtin: true }`,
  `globals: {}`, no `jsPlugins`, and every rule stripped of its options — none of
  which is what runs. Seven repos ran the check; three started re-declaring rule
  options by hand. `fixtures/adversarial/extends` now executes the whole matrix
  on every `pnpm run check`.
- README Gotchas gained `typescript/consistent-type-definitions`' three autofix
  failures on `interface … extends` (the `{} &` intersection that never
  converges, `declare module` augmentations that stop merging, and exported types
  a published package's consumers can no longer merge into), plus the missing
  semicolon that makes `--fix` output fail `oxfmt --check` on its own.
- The pnpm 11 section gained the upgrade case: swapping
  `minimumReleaseAgeExclude` to the new versions in one edit fails, because pnpm
  verifies the committed lockfile before it resolves anything. Both versions have
  to be listed for the one install that rewrites the lockfile. Also there: pnpm
  10.34.5's warning that it ignores the `pnpm` field in `package.json` (it does
  not, yet), that a quarantined install silently downgrades rather than failing,
  and that `pnpm dedupe --check` is not read-only.

### Not changed, and why

- **`typescript/consistent-type-definitions` stays at `["error", "type"]`.** The
  fixer's failures above are upstream and real, but the rule's direction is the
  safe one — `type` → `interface` breaks index-signature assignability at every
  use site, which is what 1.1.0 fixed. There is no config lever that exempts
  `declare module` bodies, so those get a per-site disable.
- **`**/_generated/**` was not added to the shared ignore lists.** Convex's
  `convex/_generated/` is not matched by `**/generated/**` or `**/*.generated.*`,
  but adding an ignore to a shared preset silently stops linting a directory in
  twelve repos, and the one repo that hit it judged the pattern project-specific.
  Keep it local.

---

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
CI cache keys. (**Corrected in 1.2.0 above:** `nextjs.json` keeps `incremental`,
and Next repos keep `*.tsbuildinfo` in `.gitignore`. The "drop it" advice was
also wrong for turbo repos that declare the build info as a task output.)

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
  (**Superseded by 1.2.0 above:** that recipe is gone, and `extends` also drops
  `env` and `globals`, which 1.2.0 fixes. `extends` is not a documented
  consumption path any more.)
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
