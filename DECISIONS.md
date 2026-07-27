# Decisions log

Everything below was verified against the real binaries on 2026-07-26/27, not
recalled. Where a claim came from docs rather than a local run, it says so.

Versions: oxlint 1.75.0, oxfmt 0.60.0, oxlint-tsgolint 7.0.2001, pnpm 11.17.0,
turbo 2.10.7, TypeScript 7.0.2 (`latest` dist-tag), Node >= 22.

---

## 1. Research findings

### oxlint `extends` — path-based, not package-based

`.oxlintrc.json` has 12 top-level keys: `$schema`, `categories`, `env`,
`extends`, `globals`, `ignorePatterns`, `jsPlugins`, `options`, `overrides`,
`plugins`, `rules`, `settings`.

`extends` is `string[]`, resolved **relative to the config file's own
directory**. There is no node resolution. Verified:

```jsonc
{ "extends": ["fake-cfg/base.json"] }
// x invalid config file /…/scratchpad/extest/fake-cfg/base.json: NotFound
```

It joined the specifier onto the config dir. `"./node_modules/fake-cfg/base.json"`
works, including through a pnpm-style symlink, and a nested `extends` inside the
extended file resolves relative to _that_ file (so intra-package composition
works).

**`extends` drops `ignorePatterns`.** Verified on 1.75.0, both paths: a consumer
whose whole config is `defineConfig({ extends: [expo] })` gets none of the
preset's ignore patterns, and neither does `.oxlintrc.json` with
`"extends": ["./node_modules/magic-oxlint-config/expo.json"]`. With no
`.gitignore` present that run reported ~500k diagnostics out of `node_modules`;
with one, seeded files under `generated/`, `ios/` and `android/` were still
linted. Only patterns at the top level of the config oxlint loaded are applied,
so consumers must re-declare them: `ignorePatterns: expo.ignorePatterns` (JS) or
a literal copy (JSON). Same run, hoisted: one diagnostic. Documented in both
READMEs; `.gitignore` is what was masking this in real repos, and it does not
cover the `ios/` and `android/` that bare RN repos commit.

`oxlint.config.ts` / `.mts` is the supported sharing path: `extends` there takes
**imported objects**, not strings. Verified end-to-end with a real npm package.
Requires the npm `oxlint` package (not the standalone binary) and Node >= 22.18.

**Decision:** ship both. `src/*.ts` builds to ESM entry points for the `.mts`
path (recommended), and `scripts/emit-json.mjs` generates `base.json` and
friends from the same source for JSON consumers. A test asserts the two never
drift.

### oxlint `jsPlugins` — works, and works better than expected

`ExternalPluginEntry` is a string, or `{ name, specifier }` where `specifier` is
a path **or a package name** (real node resolution, unlike `extends`). Rule
namespace = plugin name. Fifteen namespaces are reserved for the native Rust
plugins and need an alias if you want the JS version: `react`, `unicorn`,
`typescript`, `oxc`, `import`, `jsdoc`, `jest`, `vitest`, `jsx-a11y`, `nextjs`,
`react-perf`, `promise`, `node`, `vue`, `eslint`.

Compatibility tested locally against real packages:

| Plugin                                 | Result                                               |
| -------------------------------------- | ---------------------------------------------------- |
| `eslint-plugin-safe-jsx@1.3.0`         | **Works fully** — reporting, scope analysis, autofix |
| `eslint-plugin-react-native`           | Works (`no-inline-styles` fires)                     |
| `eslint-plugin-testing-library`        | Works (`prefer-screen-queries` fires)                |
| `eslint-plugin-react-compiler`         | Works, but unnecessary — see below                   |
| `@shopify/strict-component-boundaries` | Fails: `unable to load resolver "node"`              |

**safe-jsx needs no changes.** This was the main open risk. It's CJS,
`module.exports = plugin`, and its rule uses `sourceCode.getScope()` plus
`variable.references` / `scope.variables` — full scope analysis. All of it works
under oxlint, including `--fix` rewriting `bad && <span/>` to
`Boolean(bad) && <span/>`.

jsPlugins are marked alpha and explicitly outside semver, which is one reason
the README tells consumers to pin oxlint exactly.

**pnpm wrinkle:** jsPlugin specifiers resolve relative to the _consumer's_
config file, so a bare `"eslint-plugin-safe-jsx"` written inside a shared
package fails under pnpm's non-hoisted layout. The ESM entry points therefore
resolve to absolute paths via `createRequire(import.meta.url)` from inside
`magic-oxlint-config`, so the plugins are its dependencies and consumers install
nothing extra. The emitted JSON can't do that and uses bare specifiers, which is
documented.

### oxlint `--type-aware` — usable, but gated on TypeScript 7

Needs the optional peer `oxlint-tsgolint` (a Go binary on typescript-go).
Enabled by `--type-aware` or `options.typeAware`. Type-aware rules are ordinary
`typescript/*` rules; there is no separate category. Coverage is 59 of 61
typescript-eslint type-aware rules — missing `naming-convention` and
`prefer-destructuring`.

**The finding that shaped the design:** a type-aware rule configured while the
flag is _off_ is ignored silently. No error, no warning. Verified — a config
with `typescript/no-floating-promises: "error"` ran clean without the flag and
reported the violation with it.

**Decision:** type-aware rules go in `base` unconditionally, dormant. Turning a
repo on is one flag plus two devDependencies, with no config change. This
matters because half the migration set is still on TypeScript 5.x and can't
switch today, but shouldn't need a config edit later.

Constraints for whoever enables it: TypeScript >= 7, no `baseUrl` in tsconfig,
`pnpm -r build` before linting in a monorepo (it reads dependency `.d.ts`), and
don't leave `"include": ["**/*"]` in a root tsconfig.

### oxfmt — has import sorting, has no config sharing

Config file: `.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, or
`oxfmt.config.mts`. Nested lookup by default, nearest wins.

**No `extends`.** The key is not in the schema and is **silently ignored** if
written — no error, exit 0. Unknown keys generally fail open, so a typo'd option
does nothing quietly.

**Import sorting exists** as `sortImports`, off by default. It's a port of
`eslint-plugin-perfectionist`, so groups match by glob rather than regex, with a
`<modifier>-<selector>` group vocabulary and `customGroups` that outrank
predefined groups on a first-match-wins basis. The `@ianvs` `importOrder`
translates cleanly — see `packages/oxfmt-config/src/index.ts`.

The shipped schema's default `groups` and the published docs disagree about what
the default order is, and the binary follows the schema. So the default is not
something to rely on; we set `groups` explicitly.

**Decision:** `magic-oxfmt-config` is a real ESM package, consumed by a two-line
`oxfmt.config.mts`. Verified that oxfmt executes an `.mts` config importing an
npm package. (`oxfmt.config.ts` fails with "Cannot use import statement outside
a module" unless the package is `"type": "module"` — `.mts` always works, so
that's what the README uses.) A `magic-oxfmt-init` bin writes a snapshot
`.oxfmtrc.json` for anyone who can't run a TS config.

**`internalPattern` is prefixes, not globs.** Everything else in `sortImports`
is perfectionist-style glob matching (`customGroups[].elementNamePattern`
included), which makes `internalPattern` easy to get wrong. oxfmt's schema
documents it as "a prefix for identifying internal imports", default
`["~/", "@/", "#"]`, and matches with a plain starts-with. Globs there
(`"@/**"`) match nothing — silently, per the fail-open behaviour above — so
every aliased import falls through to `value-external` and sorts next to `zod`
instead of into its own internal group. Verified both ways against oxfmt
0.60.0. The config shipped with globs; corrected to prefixes on 2026-07-27, and
the adversarial fixture that recorded it as a KNOWN-BUG is now a plain
assertion. Restated explicitly in the config rather than left to the default, on
the same reasoning as `groups`: a default change would reshuffle imports across
every repo at once.

**One config file per directory, enforced.** oxfmt accepts exactly one of
`.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, `oxfmt.config.mts` in a
given directory. Two present is not a precedence question — every run dies with
`Failed to load configuration file. Both '<a>' and '<b>' found in <dir>` and
exits 1. Verified for all four pairings with `.oxfmtrc.json`. Running
`magic-oxfmt-init` in a repo that had already done the README's
`oxfmt.config.mts` step therefore used to hard-break formatting with no warning.
The bin now refuses when an auto-loaded config already exists in the target
directory. `--force` deliberately does **not** override that: `--force` means
"overwrite the file I named", and creating a second config is a different
failure. `--out` to a non-config filename or another directory still works,
since oxfmt never auto-loads those.

### The consumer `oxfmt.config.mts` is a re-export, not an import + default

The README originally told every consumer to write
`import base from "magic-oxfmt-config"; export default base;`. That file fails
the lint preset shipped next to it —
`unicorn(prefer-export-from): Prefer re-exporting directly from the source module`
— so `pnpm run lint` exited 1 in every freshly migrated repo. This repo never hit
it because its own config spreads into a new object.

The README now says `export { default } from "magic-oxfmt-config";` (and
`export { next as default } from …` for the variants). Verified both ways: the
re-export form lints clean, and oxfmt executes it and applies the config —
a 94-character line reflows at `printWidth` 80 rather than staying on one line as
it does under oxfmt's own default of 100.

Fixed in the README rather than by switching `unicorn/prefer-export-from` off for
`*.config.mts` in the preset, because the rule is right and the two-liner was
just written the wrong way round.

### Renovate preset lives in `default.json`, not `renovate.json`

`github>GSTJ/magic` resolves to `default.json`. Serving a preset out of
`renovate.json` is deprecated ("If you're using a renovate.json file to share
your presets, rename it to default.json") and would break every consumer's bot
config on whichever release drops it. The preset therefore moved to
`default.json` byte-for-byte, and `renovate.json` is now this repo's own config,
extending the preset via `local>GSTJ/magic` like any other consumer.

### Versions

- pnpm `latest` = 11.17.0. Root pins `packageManager: pnpm@11.17.0`.
- TypeScript `latest` = **7.0.2** (not 6.x). The portfolio repo is already on it,
  and 7.0 is also the floor for type-aware linting, so 7.x is the target.
- turbo 2.10.7.
- oxlint 1.75.0 and oxfmt 0.60.0 pinned exactly, not caret-ranged.

---

## 2. Rule disposition

### Ported natively (no plugin needed)

| ESLint rule                                     | oxlint equivalent                                |
| ----------------------------------------------- | ------------------------------------------------ |
| `@typescript-eslint/*` type-aware family        | `typescript/*`, dormant until `--type-aware`     |
| `@typescript-eslint/no-unused-vars`             | `no-unused-vars` (TS-aware; also covers imports) |
| `unused-imports/no-unused-imports`              | `no-unused-vars`                                 |
| `prefer-arrow-functions/prefer-arrow-functions` | `func-style: ["error", "expression"]`            |
| `react-compiler/react-compiler`                 | `react/react-compiler` (native, nursery)         |
| `react-hooks/rules-of-hooks`, `exhaustive-deps` | `react/rules-of-hooks`, `react/exhaustive-deps`  |
| `@next/next/*`                                  | `nextjs/*` (native — no plugin dependency)       |
| `@shopify/no-namespace-imports`                 | `import/no-namespace` (see below)                |
| jest, jsx-a11y, react, import, promise, unicorn | native namespaces                                |

`import/no-namespace` was listed here from the start but shipped as `"off"` in
`base`, so the ported rule caught nothing — `import * as utils from "./x"` ran
clean. Now `"error"` in `base`; `react` and below re-declare it as
`["error", { ignore: ["react", "@radix-ui/*"] }]`, which is the old
`@shopify/no-namespace-imports` allow list (`ignore` globs match the module
specifier — verified: `react` and `@radix-ui/react-dialog` pass, `node:path` and
`./x` are reported). Off in the test override, since
`import * as api from "./api"` is how `jest.spyOn(api, …)` works.

**`jest.configs["flat/recommended"]` is enumerated by hand, not inherited from a
category.** The old base applied the whole recommended set. `categories` do not
activate rules for a plugin that is only declared inside an `overrides[]` entry,
which is the only place `base` declares `jest` — so for a while only the seven
rules named explicitly were live and `no-standalone-expect`,
`no-conditional-expect`, `valid-describe-callback`, `no-export`,
`no-done-callback`, `no-alias-methods` and the rest were silently off. Worse,
they _were_ on in `react` and below, because the react preset appends a second
test-file override with no `plugins` key and that flips the category behaviour
back on. Adding `plugins` to that override does not undo it, so the whole
recommended set is now spelled out in `base`, along with explicit `"off"` for the
category-only extras that differed between variants
(`prefer-called-with`, `prefer-ending-with-an-expect`,
`prefer-importing-jest-globals`, `padding-around-*`). All five variants now
report the identical jest rule set on the same fixture; `test/variants.test.mjs`
asserts it.

**`typescript/no-misused-promises` keeps `checksVoidReturn.attributes: false`.**
The incumbent config set it so `onClick={async () => …}` is allowed, and dropping
it would have been invisible until the first repo turned on `--type-aware` —
which defeats the point of shipping the type-aware rules dormant. Verified with
`oxlint --type-aware` + `oxlint-tsgolint` against a typed React fixture: with the
default options both the JSX handler and `const cb: () => void = async () => …`
are reported; with the preset only the second is. tsgolint accepts the
typescript-eslint option shape verbatim.

### Replaced with a different mechanism

**`no-restricted-syntax` does not exist in oxlint.** It was used for three
things, and all three map to real rules now:

- The `process.env` ban →
  `no-restricted-properties: [{ object: "process", property: "env", message }]`.
  Verified firing.
- The React Native Touchable/Image import bans → `no-restricted-imports`. The
  ESLint config used AST selectors _specifically_ because
  `no-restricted-imports` couldn't give per-`importName` messages for the same
  package. oxlint's version **can**: multiple `paths` entries with the same
  `name` each keep their own message. Verified with three overlapping entries
  against `react-native`. The workaround is no longer needed.

  Those bans are _not_ in the shared preset — they reference a per-repo
  `@/components/PressableArea`, so they're project config. The README shows the
  snippet for repos that want them.

- The statement bans (`ForInStatement`, `LabeledStatement`, `WithStatement`,
  applied to every file including `env.*`) → `guard-for-in`, `no-labels` and
  `no-with`, all at error. Labels and `with` keep exactly the old coverage
  (verified firing; `with` is additionally dead in strict-mode TS). `for..in`
  is a **deliberate relaxation**: the old config rejected it outright,
  `guard-for-in` accepts a loop wrapped in a `hasOwnProperty` check. A guarded
  `for..in` is the textbook-correct form, and `no-restricted-syntax` was the
  only way ESLint could ban it wholesale — accepting the guarded form is
  taking the real rule's judgement over the workaround's bluntness.

- `import/order` has no oxlint equivalent. **oxfmt owns import order** via
  `sortImports`, which also removes the ESLint/Prettier fight over it.

- `import/consistent-type-specifier-style: prefer-top-level` and
  `@typescript-eslint/consistent-type-imports` with
  `fixStyle: "inline-type-imports"` were **both** set in the incumbent config and
  directly contradict each other (`import type { Foo }` vs
  `import { type Foo }`). Resolved in favour of `typescript/consistent-type-imports`
  (top-level), with `import/consistent-type-specifier-style` off — matching the
  MM and invest-radar configs, and matching what oxfmt's `type` sort group
  expects.

### Ported as opt-in plugin rules (`magic-oxlint-plugin`, off by default)

| Rule                          | Origin                                                             |
| ----------------------------- | ------------------------------------------------------------------ |
| `magic/prefer-early-return`   | `@shopify/prefer-early-return`, `maximumStatements` option         |
| `magic/no-barrel-file`        | invest-radar's `scripts/no-barrel.sh`, now a real rule             |
| `magic/no-module-mocks`       | g2i `testing-policy/no-module-mocks`, generalised to jest + vitest |
| `magic/prefer-suspense-query` | g2i `prefer-suspense-query/no-use-query`, roots configurable       |

Per the governing directive, none of these is in any default preset. The last
two are stack-specific; the first two are policies a repo should choose.

**Rule API (revised).** These rules originally probed `require("oxlint").defineRule`
and used `createOnce` only if it turned up. It never turned up: oxlint 1.75.0's
main entry exports `defineConfig` and nothing else (`oxlint/plugins-dev` exports
only `RuleTester`), so the fast path was dead code and every rule ran ESLint's
per-file `create()` even under oxlint. `src/rule-api.ts` now emits `{ meta,
create, createOnce }` unconditionally, per `CreateOnceRule` in
`oxlint/dist/plugins-dev.d.ts`: "if `createOnce` method is present, `create` is
ignored". oxlint takes `createOnce`, ESLint takes `create`, nothing sniffs the
environment — a module-resolvability probe would only prove oxlint is installed,
not that it is the linter currently running. Consequence for rule authors:
`context.options` is per-file ("rule options for this rule on this file"), so it
must be read in `before()` alongside the filename. `prefer-early-return` was
reading it in the `createOnce` closure and is fixed; a two-file `overrides` test
now covers it.

### Dropped

| Rule                                                       | Why                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@shopify/jsx-no-hardcoded-content`                        | Only pays off with i18n; `react/jsx-no-literals` is near-native if wanted                                                                                                                            |
| `@shopify/strict-component-boundaries`                     | Fails under oxlint — `unable to load resolver "node"`                                                                                                                                                |
| `@shopify/react-require-autocomplete`                      | Web-form specific, narrow                                                                                                                                                                            |
| `@shopify/react-hooks-strict-return`                       | Opinionated beyond its payoff                                                                                                                                                                        |
| `@shopify/no-ancestor-directory-import`                    | Expressible with `no-restricted-imports` patterns                                                                                                                                                    |
| `@shopify/restrict-full-import`                            | Same                                                                                                                                                                                                 |
| `react/jsx-no-leaked-render`                               | `safe-jsx/jsx-explicit-boolean` covers the `&&` case, which is the leak that matters. **Removed from oxlint before 1.75** — it's in the MM config and no longer loads.                               |
| `testing-library/*`                                        | Works as a jsPlugin unmodified, but shipping the dependency to every consumer isn't worth it. Add per repo.                                                                                          |
| `jest-formatting/*`                                        | Pure formatting; oxfmt handles spacing. oxlint's own `jest/padding-around-*` are off for the same reason                                                                                             |
| `reanimated/js-function-in-worklet`                        | Needs typescript-eslint parser services; a silent no-op under oxlint. See below                                                                                                                      |
| `eslint-plugin-eslint-comments`                            | Superseded by `--report-unused-disable-directives`. That's a CLI flag, not a config key, so it can't ship inside the preset — it lives in the README's recommended `lint` script and this repo's own |
| `unicorn/no-array-push-push`, `no-octal-escape`            | Both in the MM config, both gone from oxlint 1.75                                                                                                                                                    |
| `react/no-deprecated`                                      | Gone from oxlint 1.75. No syntax-only equivalent; `typescript/no-deprecated` covers part of it under `--type-aware` but is deliberately off (dependency deprecation metadata is unreliable)          |
| `react/no-unused-state`, `react/prefer-stateless-function` | Gone from oxlint 1.75. Class-component era rules; nothing in the migration set uses class components                                                                                                 |
| `unicorn/filename-case`                                    | See below — the repos disagree                                                                                                                                                                       |

`reanimated/js-function-in-worklet` was `error` in the old react-native config
and is the one old rule with no replacement. `eslint-plugin-reanimated@2.0.1`
(latest) loads fine as a jsPlugin — oxlint resolves its rule names, and a bogus
`reanimated/does-not-exist` fails the config as expected — but the rule's
`create()` starts with
`if (!context.parserServices?.hasFullTypeInformation) return {}` and then goes
through `parserServices.program.getTypeChecker()` and `esTreeNodeToTSNodeMap` to
resolve call signatures. oxlint's JS plugin API exposes no parser services and
no TS program, so the rule installs and reports nothing. Verified: a worklet
calling a plain JS function produced zero diagnostics with the plugin wired in.

Shipping it anyway would be worse than leaving it out, because the config would
claim a guarantee it doesn't provide. Nothing replaces it: the safety net is the
Reanimated Babel plugin plus the runtime "tried to synchronously call a
non-worklet function on the UI thread" crash. A repo that wants the lint back
has to keep ESLint alive for that one rule; revisit if oxlint ever exposes type
information to JS plugins, or if `js-function-in-worklet` gets a syntax-only
implementation.

`unicorn/filename-case` deserves its own note because it is on by default once
`style` is at `error`, and it defaults to kebab-case. Counted `.tsx` filenames
across the migration set:

| repo                      | PascalCase | kebab-case |
| ------------------------- | ---------- | ---------- |
| react-native-magic-modal  | 9          | 0          |
| gabriel-taveira-portfolio | 19         | 1          |
| pegada                    | 24         | 11         |
| invest-radar              | 0          | 64         |

Three of four are PascalCase-dominant. Leaving the rule on would have renamed
hundreds of files during a migration that is already changing everything else,
and it's a convention the repos have not agreed on. Off in the preset; a repo
that wants one convention enables it locally with its own `case` option.

### Preset scope

Following the governing directives: the presets carry general guidelines only,
deduped across the invest-radar / MM / pegada / magic-eslint-config lineage.
Project-specific config (PressableArea import bans, nws service boundaries,
prisma `ctx.db` conventions) stays out and is layered locally. MM and g2i were
read as references and are not migration targets.

One exception, deliberately: `new-cap` in the `react-native` variant carries
`capIsNewExceptions` for the react-native-gesture-handler `Gesture.*` factory
API (copied from MM). RNGH is stack-general for the GSTJ RN repos — the
exception list is shaped by the library's API, not by any one repo's
conventions, so making every RN consumer rediscover it locally would just be
copy-paste debt.

### Deliberate deltas vs the incumbent configs

The category sweep (`style`/`pedantic` at error) plus explicit settings reverse
a handful of the old config's choices. All were reviewed; none is an accident.

**Tightenings** (stricter than the old base — these fail loudly on first
contact, which is the acceptable direction):

- `import/no-anonymous-default-export`, `import/no-mutable-exports` and
  `typescript/array-type` were explicitly `off` in the old base and now error
  via the categories. Kept: all three are good general rules, and the config
  files where anonymous default exports are idiomatic get an override exemption
  instead.
- Core `require-await` errors via `pedantic` (the old config only carried the
  TS variant, off). Kept, including as the coverage story for the
  non-type-aware majority — but it's now off in the test override, where async
  test callbacks without `await` are routine. Note for whoever flips
  `--type-aware`: `typescript/require-await` (error, dormant) then runs
  alongside the core rule on the same code. invest-radar resolved that by
  turning the core rule off; do that per-repo when it actually happens, because
  doing it in the preset today would lose the rule everywhere else.
- Rules the incumbents shipped at `warn` are uniformly `error` here — there is
  no warn tier in these presets, a rule is either worth failing CI or it's off.
  Affects `react/exhaustive-deps`, `react/no-children-prop`,
  `react-native/no-inline-styles`, `typescript/consistent-type-imports`.
- `max-depth` is `["error", 3]` — stricter than invest-radar (off) and MM
  (default 4 via pedantic). Three levels of nesting plus the
  `prefer-early-return` philosophy is the house style this repo family is
  converging on; expect first-run churn on migration repos.
- The `process.env` ban now also applies in test files, restoring the old
  `no-restricted-syntax` behaviour (the ban moved into
  `no-restricted-properties`, and the test override's `jest.clearAllMocks`
  entry was silently _replacing_ it — per-rule config replaces, it never
  merges). The same entry list bans `vi.clearAllMocks`, since invest-radar runs
  vitest and a jest-only ban would miss the closest migration target.

**Loosenings** (weaker than the old base — each one is a considered trade):

- `typescript/no-unsafe-call` is off, joining `no-unsafe-assignment` and
  `no-unsafe-member-access` (which the old config already disabled). The old
  config had it at error; it fires on the same untyped-boundary code as the
  other two, and keeping one third of the family produced noise without
  changing behaviour. `no-unsafe-argument` and `no-unsafe-return` stay at
  error — those are the two that catch `any` actually escaping.
- `typescript/no-base-to-string`, `typescript/no-confusing-void-expression`
  and `typescript/no-meaningless-void-operator` were error via strictTypeChecked
  and are off: `no-confusing-void-expression` fights the arrow-heavy house
  style (`=> setState(x)`), and the other two overwhelmingly fire on that same
  shape. Dormant either way until `--type-aware`.
- `typescript/no-unnecessary-type-parameters` is off although both references
  run it at error — it consistently misfires on generic helper signatures
  (`const pick = <T, K extends keyof T>(…)`), which shared-utility packages are
  full of.
- `unicorn/no-array-sort` is off, the one g2i safety bullet not carried:
  invest-radar and pegada also disable it, and on pre-`toSorted()` targets the
  autofix churn outweighs the mutation-safety win.
- `for..in` degraded from a wholesale ban to `guard-for-in` — see
  "Replaced with a different mechanism" above.

---

## 3. Guard rails built

Two scripts exist because of things that went wrong while building this.

**`scripts/validate-rules.mjs`** — checks every rule name in every emitted
variant against oxlint's own shipped JSON schema. An unknown rule name is a
_fatal_ config error in oxlint, not a warning, so one stale name breaks every
consumer at once. Six rules in the MM reference config are already gone in 1.75
(verified against the shipped `configuration_schema.json`):
`react/jsx-no-leaked-render`, `unicorn/no-array-push-push`, `no-octal-escape`,
`react/no-deprecated`, `react/no-unused-state` and
`react/prefer-stateless-function`. All six have dispositions in the "Dropped"
table above. Run this after any oxlint bump.

**`scripts/smoke.mjs`** — lints `fixtures/smoke`, a deliberately broken file, and
asserts on exactly which rules fire. Guards against a config change quietly
ceasing to catch leaked `&&` JSX, `process.env` access, nested ternaries, unused
imports, and the two enabled plugin rules.

**`.github/workflows/self-ci.yml`** — neither guard script was actually wired to
anything. `ci.yml` and `release.yml` are both `workflow_call`-only, so nothing in
this repo ran on push or PR, while the Renovate preset automerges devDependency
and `magic-*` bumps "once CI is green" — with no checks, that means on sight. The
self-CI workflow calls `ci.yml` (rather than duplicating its steps) with
`build-command`, `test-command`, and `extra-command:
pnpm run validate-rules && pnpm run smoke`, so breaking the reusable workflow for
consumers breaks this repo's own build first.

---

## 4. Known gaps and TODOs

- **`react/react-compiler` is a `nursery` rule.** It's the one nursery rule the
  `react` preset enables, to preserve the incumbent
  `react-compiler/react-compiler`. Nursery rules are explicitly unstable; if it
  misbehaves on a repo, turn it off locally rather than fighting it.

- **`.oxfmtrc.json` snapshots go stale.** `magic-oxfmt-init` writes a point-in-time
  copy. Repos on that path won't pick up config changes from a version bump.
  Prefer `oxfmt.config.mts`. A `--check` mode that diffs an existing snapshot
  against the current package would close this; not built. The bin refuses to
  write next to an existing `oxfmt.config.{ts,mts}` or `.oxfmtrc.jsonc` (see
  §1), so the two paths can't be mixed by accident — but nothing detects a repo
  that switched from snapshot to `.mts` and left a stale `.oxfmtrc.json`
  behind. That state fails loudly on the next oxfmt run, at least.

- **No type-aware CI run anywhere yet.** The rules are configured and verified
  firing locally, but no repo in the migration set is switched on. invest-radar
  is closest (already runs `--type-aware` with its own config).

- **`func-style: expression` will be noisy on first contact.** It's the
  `prefer-arrow-functions` replacement and named exports are exempt, but repos
  with many top-level `function` declarations will see a wall of errors. It's
  auto-fixable in most cases; run `oxlint --fix` first and read the diff.

- **Category strategy is aggressive.** `style` and `pedantic` at `error` turns on
  ~400 rules, tamed by ~40 opt-outs. Proven in invest-radar and MM, but repos
  with no lint today (seedgen, padrinhos) will see a large first run. Consider
  landing `base` with `categories.style: "warn"` for one PR there, then
  tightening.

- **jsPlugins are alpha and outside semver.** `safe-jsx` and the magic plugin
  both depend on that API surface. Pin oxlint; don't caret-range it.

- **Release automation for these packages isn't wired.** `release.yml` exists as
  a reusable workflow, but this repo has no `.release-it.js` and no publish
  trigger of its own. Publishing is manual for now.

- **`magic-tsconfig` has no test.** The JSON is simple enough that a broken
  `extends` would surface immediately in any consumer, but there's no check here.

- **TypeScript 7 (tsgo) does not auto-include `@types/node` under
  `magic-tsconfig/base.json`.** Found in the consumer simulation: a plain-ts
  consumer with `@types/node` installed still fails on `process` / `node:fs`
  (TS2591) until `"types": ["node"]` is set explicitly. The shared base can't
  carry that — it would break every consumer _without_ `@types/node` (TS2688) —
  so the README's plain-ts snippet sets it in the consumer tsconfig. This
  repo's own `tsconfig.build.json`s always did. Worth re-testing on tsgo bumps;
  classic tsc 5.x auto-included `@types/*` here.

- **`func-style: expression` noise, addendum:** `oxlint --fix` may need two
  passes to converge (safe-jsx's `Boolean(x)` rewrite is then rewritten again
  by `unicorn/explicit-length-check`). Run `--fix` until the diff is empty;
  the README's Gotchas section says the same.
