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

| Rule                                 | Origin                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `magic/prefer-early-return`          | `@shopify/prefer-early-return`, `maximumStatements` option                |
| `magic/no-ancestor-directory-import` | `@shopify/no-ancestor-directory-import`, reimplemented without a resolver |
| `magic/react-require-autocomplete`   | `@shopify/react-require-autocomplete`, `inputComponents` option           |
| `magic/react-hooks-strict-return`    | `@shopify/react-hooks-strict-return`, `maximumReturnValues` option        |
| `magic/no-barrel-file`               | invest-radar's `scripts/no-barrel.sh`, now a real rule                    |
| `magic/no-module-mocks`              | g2i `testing-policy/no-module-mocks`, generalised to jest + vitest        |
| `magic/prefer-suspense-query`        | g2i `prefer-suspense-query/no-use-query`, roots configurable              |

Per the governing directive, none of these is in any default preset. Some are
stack-specific; the rest are policies a repo should choose.

The bottom three rows date from the first pass. The top four are the outcome of
governing directive #6 and are dispositioned rule by rule in §6 — three of them
were listed as _dropped_ in the table below until 2026-07-27.

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
| `@shopify/jsx-no-hardcoded-content`                        | **Superseded by §6** — native `react/jsx-no-literals`, configured, off in the preset because it needs an i18n layer to be worth anything                                                             |
| `@shopify/strict-component-boundaries`                     | **Still dropped, see §6** — fails under oxlint (`unable to load resolver "node"`), and `no-restricted-imports` `patterns` covers it                                                                  |
| `@shopify/react-require-autocomplete`                      | **Superseded by §6** — ported as `magic/react-require-autocomplete`                                                                                                                                  |
| `@shopify/react-hooks-strict-return`                       | **Superseded by §6** — ported as `magic/react-hooks-strict-return`                                                                                                                                   |
| `@shopify/no-ancestor-directory-import`                    | **Superseded by §6** — ported as `magic/no-ancestor-directory-import`. "Expressible with `no-restricted-imports` patterns" was wrong; it needs an unbounded ladder of globs                          |
| `@shopify/restrict-full-import`                            | **Superseded by §6** — native `no-restricted-imports` with `importNames: ["default"]`, per-repo config                                                                                               |
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

---

## 5. `unicorn/filename-case` is on, and the rename is a codemod

Added 2026-07-27, implementing governing directive #5.

### Decision #6 is reversed

The table in §2 counted PascalCase against kebab-case across the migration set,
found three repos of four PascalCase-dominant, and switched the rule off.
Gabriel overruled that: kebab-case everywhere, per the g2i and invest-radar
convention, with the mass rename handled by a codemod shipped from this repo so
every migration agent runs the same script rather than inventing one.

The original reasoning was not wrong about the cost — it was wrong about who
pays it. "Hundreds of files during a migration that is already changing
everything else" is an argument for automating the rename, not for declining to
have a convention. The disposition table entry for `unicorn/filename-case` in §2
is superseded by this section.

`base` now carries:

```ts
"unicorn/filename-case": ["error", { case: "kebabCase", ignore: filenameCaseIgnore }]
```

`case` is stated explicitly although `kebabCase` is the current default, for the
same reason `groups` and `internalPattern` are stated explicitly in the oxfmt
config: a default change upstream must not silently re-case every repo at once.

Real numbers, `git ls-files` across the migration set on 2026-07-27:

| repo                      | lintable files | violations |
| ------------------------- | -------------- | ---------- |
| pegada                    | 638            | 98         |
| morphosis                 | 397            | 71         |
| gabriel-taveira-portfolio | 73             | 19         |
| react-native-magic-modal  | 87             | 13         |
| seedgen                   | 121            | 10         |
| e-card                    | 52             | 9          |
| invest-radar              | 1016           | 0          |
| padrinhos                 | 28             | 0          |
| would-you-rather          | 100            | 0          |

220 renames across the set. invest-radar being already at zero is the strongest
argument that the convention is livable — it is the largest repo in the list.

### What the rule actually does, verified

Every claim here comes from running oxlint 1.75.0 against generated trees, not
from the upstream ESLint rule's documentation, which describes something
stricter.

**Only the segment before the first dot is checked.** `charlie.Test.ts` passes;
`Bravo.test.ts` fails. A `.stories`, a `.config`, a `.ios` suffix is never
inspected. (`multipleFileExtensions: false` would inspect `Bravo.test` instead;
we leave the default.)

**Leading and trailing underscore runs are trimmed before the check.**
`_layout.tsx`, `__mocks__.ts` and `alpha_.ts` pass; `foo_bar.ts` does not.

**The only things rejected are uppercase letters, spaces, and interior
underscores.** Everything else passes, including every punctuation character
tested (`[ ] + $ ( ) @ ~ ! & % = , ; # ^ { } ' \` — · —`), repeated and leading
hyphens (`a--b.ts`, `-x.ts`), and caseless scripts (`日本.ts`). The upstream
ESLint rule uses `^[a-z\d]+(-[a-z\d]+)*$`; assuming that here produces false
positives on every file-based router in the set.

A 765-name differential run pinned the predicate to zero disagreements:

```
stem      = basename up to the first "."
trimmed   = stem with leading and trailing "_" runs removed
valid iff no character of `trimmed` is uppercase, a space, or "_"
```

**Uppercase is Unicode, not ASCII.** `ÉZ` is a word boundary to oxlint (it is
Rust, asking `char::is_uppercase`), so `ZÉaA.ts` wants `z-éa-a.ts`. An
ASCII-only `[A-Z]` implementation produces `zéa-a.ts` — a name the rule still
rejects. Caught by the differential test, not by reading.

**The diagnostic carries the target.** `help` is
`Rename the file to 'pascal-thing.ts'`, so nothing downstream has to reimplement
the word-splitting. Its corners: `S3.ts` → `s-3.ts`, `V2.ts` → `v-2.ts`,
`AppV2.ts` → `app-v-2.ts`, `OAuth2Client.ts` → `o-auth2-client.ts` (an uppercase
letter followed by a digit is a boundary).

**Options are strictly validated.** The rule accepts exactly `case`, `cases`,
`ignore`, `multipleFileExtensions`; an unknown key or an unknown case name is a
fatal config error, as is an unparseable regex in `ignore`. `ignore` entries are
regexes matched **unanchored against the basename only** — `^Pascal` suppresses
`src/PascalThing.ts`, `^src/Pascal` matches nothing. The schema types the rule as
`DummyRule` (no typed options), so none of this is discoverable from the schema;
it came from probing the binary.

### Exemptions, and where they live

The rule is now the thing that decides whether a filename is a bug, so every
framework that derives behaviour from a filename had to be checked against a
real tree. `packages/oxlint-config/test/variants.test.mjs` asserts all of it in
all five variants rather than trusting the analysis.

**Almost nothing needed an exemption.** Next.js App Router reserved names
(`page`, `layout`, `loading`, `error`, `not-found`, `global-error`, `template`,
`default`, `route`, `sitemap`, `robots`, `manifest`, `opengraph-image`,
`apple-icon`, `middleware`, `instrumentation`) are already kebab-valid. Pages
Router `_app.tsx` and `_document.tsx` pass because underscores are trimmed.
expo-router's `_layout.tsx`, `+not-found.tsx` and `+html.tsx` pass because `+` is
not a rejected character. Route groups `(marketing)`, parallel routes `@modal`
and intercepting routes `(.)photo` are _directories_, and the rule only looks at
basenames.

Three real exemptions:

- **`ignore: ["\\["]` in `base`.** Dynamic segments carry a _route parameter
  name_ between brackets, and `[postId].tsx` / `[userId].tsx` are camelCase by
  universal convention. Kebab-casing one changes `params.postId` to
  `params.post-id` — which is not even a valid identifier — so this is the one
  case where the rule is straightforwardly wrong. Costs nothing in a repo with
  no bracketed filenames, which is why it sits in `base` rather than in the
  `next` and `expo` variants separately.

- **`__mocks__/**` override, `off`.** jest and vitest resolve `__mocks__/<x>` by
  matching `<x>` against the module being mocked, so `__mocks__/AsyncStorage.ts`
  keeps that name for exactly as long as the package is called that. Narrower
  than the existing test-file override on purpose: `button.test.tsx` is ours and
  does get renamed.

- **`^App\.` in `react-native` (and therefore `expo`).** Bare RN's `index.js`
  template imports `./App`, and classic pre-expo-router Expo apps point `main` at
  `node_modules/expo/AppEntry.js`, whose `import App from "../../App"` is inside
  a dependency and unreachable from any codemod. Renaming to `app.tsx` therefore
  _works locally_ — APFS is case-insensitive — and fails only once the build runs
  on Linux (EAS, CI). That is the worst available failure shape, so `App` is
  exempt by config rather than left to a migration agent's judgement. Asserted to
  be exempt in `react-native` and `expo` and still reported in `base`, `react`
  and `next`, which have no RN entry point to protect.

  **The codemod's matching skip is conditional, and had to be.** The first
  version skipped every `App.*` unconditionally and the dry-runs immediately
  showed why that is wrong: e-card and morphosis are Vite web apps whose
  `src/App.tsx` is reached by an ordinary `./App` from `main.tsx`. Those repos
  use the `react` preset, which does _not_ exempt `App`, so the linter demands
  the rename and a codemod that refuses it produces exactly the orphaned-error
  state this whole design is meant to prevent. `magic-kebab` now walks up to the
  nearest `package.json` and only skips `App.*` when `react-native` or `expo` is
  a declared dependency there — matching, package by package, which preset that
  code would be linted with.

Remix / React Router file routes (`$postId.tsx`) would want `ignore: ["^\\$"]`.
Not in `base` — nothing in the migration set uses them, and `base` should not
accumulate exemptions for frameworks nobody runs. Add it locally.

**The `__mocks__` override has to be last, and is duplicated to stay that way.**
An `overrides[]` entry that omits `plugins` re-activates category rules for the
files it matches — the same behaviour documented in §2 for the jest rules — and
`unicorn/filename-case` is a `style` rule. So a later, broader override can
switch it back on for `__mocks__` from underneath. `mocksFilenameCase` is
exported from `base.ts` and appended as the final override of every variant;
`variants.test.mjs` asserts each emitted JSON ends with it.

### magic-codemods / magic-kebab

New package. `bin: magic-kebab`, ts-morph based. Full interface in
`packages/codemods/README.md`; the decisions worth recording here:

**Detection defers to oxlint.** The default `--detect oxlint` runs the target
repo's own linter and reads its `unicorn(filename-case)` diagnostics, taking the
rename target from the diagnostic's `help` text. A codemod that reimplements a
lint rule and then disagrees with it is worse than no codemod, and this makes
disagreement structurally impossible — the repo's `ignore` list, `overrides` and
`ignorePatterns` all apply because the linter is the one answering.
`--detect builtin` exists for repos that have not adopted the preset yet, and
`test/kebab.test.mjs` holds it to oxlint over a generated corpus.

**A plain lint run, not a scoped one.** `oxlint -A all -D unicorn/filename-case`
looks like the fast path and is wrong: verified on 1.75.0, `-D <rule>` re-enables
the rule with its **default options** and discards the config's `ignore` list, so
a scoped run reports every `[postId].tsx` in the repo. `overrides` survive it;
rule options do not.

**Rename via a temporary name, unconditionally.** On APFS `Button.tsx` and
`button.tsx` are the same path. `git mv` between them is refused, or with `-f`
becomes a no-op that still updates the index — producing a commit that claims a
rename the working tree never performed, and a file that materialises only when
someone checks out on Linux. Doing the two-step for every rename rather than only
for case-only ones keeps one code path, and it is invisible in history: git
records no rename in a commit, it infers renames from content similarity at diff
time, so two `git mv`s before one commit produce one rename in that commit.

**Rewrite first, move second.** Specifiers are rewritten to point at names that
do not exist yet, then the files are moved to make them true. The reverse order
resolves specifiers against a half-renamed tree where `./Button` is ambiguous
between the file that moved and the one that has not. Between the phases the tree
does not typecheck, which is fine — nothing observes it, and the clean-tree
precondition means one `git checkout .` undoes both.

**Refuses a dirty tree, untracked files included.** `git checkout .` has to be a
complete undo, and it only is when the tree started clean. A `git mv` onto an
untracked path clobbers it silently.

**Only basenames change, never directories.** This is the invariant that makes
specifier rewriting tractable: only the last segment of any specifier is ever
touched, and its extension — present, absent, or `.js` standing in for `.ts` —
is preserved as written.

**Report, never guess.** Computed specifiers (`import(`./${name}`)`),
`moduleNameMapper` regexes, bundler aliases, `package.json` `main`/`exports`, and
prose in `.md` are found and printed under `NEEDS REVIEW`, never edited. A
`moduleNameMapper` key is a regex whose escaping belongs to its author; a
`package.json` `exports` path is a published contract.

**A local module's `__mocks__` moves with it.** `__mocks__/Button.ts` next to a
`Button.tsx` being renamed is paired up and given the same stem, because jest
would otherwise silently stop applying it. A `__mocks__` entry with no
same-named sibling is a package mock and is skipped with a printed reason.

Dry-run numbers against the real migration set (`--detect builtin`, so the
repo's own config is not consulted): pegada 96 renames / 2 skipped, morphosis 70,
gabriel-taveira-portfolio 19, react-native-magic-modal 13, seedgen 10, e-card 8.
**Zero conflicts anywhere**, which is the number that mattered — a conflict is
the one outcome a migration agent cannot resolve without thinking.

Also run for real against a throwaway clone of e-card: 8 renames including the
case-only `App.tsx` → `app.tsx`, 8 specifier rewrites, on-disk casing correct, no
temp files left behind, `git status` showing `R` for every move, and
`git log --follow -- src/app.tsx` reaching back through five commits to `init`
with `R086 src/App.tsx src/app.tsx` in `--name-status`.

Verified end to end against a throwaway git repo carrying one instance of each
hazard — case-only rename, alias imports, barrel re-exports, dynamic `import()`,
a platform-variant trio, both kinds of mock, a route parameter, a
`moduleNameMapper`, a computed import. 45 assertions, including that
`git log --follow` still reaches back past the rename (`R100 old -> new` in
`--name-status`), that `tsc --noEmit` passes afterwards, that oxlint's
filename-case goes silent, and that `--dry-run` leaves the tree byte-identical.

### Dogfood outcome: zero renames

This repo was already entirely kebab-case — 89 tracked files, 0 violations under
both detectors, before and after turning the rule on. So the rule went on, the
full check chain stayed green, and the codemod's honest result here is
"Nothing to rename."

That is a weak dogfood and worth saying plainly rather than dressing up. The
fixture repo in `packages/codemods/test` is the real proving ground, and the
`--dry-run` numbers in the table above are the real evidence the thing works on
the repos it was built for.

One thing the repo's own lint did surface while writing the package:
`oxc/no-map-spread` and `unicorn/prefer-spread` are in direct conflict on
`flatMap((x) => [x, ...f(x)])` — the first rejects the spread, the second rejects
the `.concat()` you would reach for instead. Both are on via the categories.
The way out is a plain loop; noted in `resolve.ts` where it bites.

---

## 6. Every `@shopify/*` rule, dispositioned

Added 2026-07-27, implementing governing directive #6. The first pass dropped
six of the eight Shopify rules the incumbent config used, four of them with a
one-line reason. Gabriel overruled that: each rule gets a real disposition —
native equivalent, port, selective jsPlugin, or a documented drop.

### Verification basis

Everything below was run. `@shopify/eslint-plugin@50.0.0` was installed into a
scratch directory and loaded under oxlint 1.75.0 as
`jsPlugins: [{ name: "shopify", specifier: "@shopify/eslint-plugin" }]`.

| Shopify rule                   | Under oxlint 1.75.0                          |
| ------------------------------ | -------------------------------------------- |
| `prefer-early-return`          | Fires                                        |
| `no-namespace-imports`         | Fires                                        |
| `restrict-full-import`         | Fires                                        |
| `jsx-no-hardcoded-content`     | Fires                                        |
| `react-require-autocomplete`   | Fires                                        |
| `react-hooks-strict-return`    | Fires                                        |
| `no-ancestor-directory-import` | **Fails** — `unable to load resolver "node"` |
| `strict-component-boundaries`  | **Fails** — same                             |

New against what §1 recorded: `no-ancestor-directory-import` fails on the
resolver too. §1 only knew about `strict-component-boundaries`.

**Option (c) — load the plugin selectively — is rejected for every rule, on
weight rather than compatibility.** `@shopify/eslint-plugin@50` installs **262
transitive packages, 97 MB**: `eslint-plugin-import-x`, `eslint-plugin-jest`,
`eslint-plugin-jsx-a11y`, `typescript-eslint`, `prettier`,
`eslint-config-prettier`. That is a second copy of the ESLint ecosystem landing
in every consumer of a config whose entire reason to exist is that oxlint
replaced it. Six rules working is not worth reinstalling the thing we left.

### Disposition

| Shopify rule                   | Disposition | Where it lives                                              |
| ------------------------------ | ----------- | ----------------------------------------------------------- |
| `prefer-early-return`          | Ported      | `magic/prefer-early-return` (existed; fidelity-fixed)       |
| `no-ancestor-directory-import` | Ported      | `magic/no-ancestor-directory-import`                        |
| `react-require-autocomplete`   | Ported      | `magic/react-require-autocomplete`                          |
| `react-hooks-strict-return`    | Ported      | `magic/react-hooks-strict-return`                           |
| `no-namespace-imports`         | Native      | `import/no-namespace` — already on in `base` and `react`    |
| `restrict-full-import`         | Native      | `no-restricted-imports`, per-repo config                    |
| `jsx-no-hardcoded-content`     | Native      | `react/jsx-no-literals`, off in `react`, snippet documented |
| `strict-component-boundaries`  | Dropped     | `no-restricted-imports` `patterns`, per-repo config         |

### `prefer-early-return` — a real divergence, fixed

The port already in the repo treated _any_ braceless consequent as a single
statement, so at `maximumStatements: 0` it reported `() => { if (done) return; }`
and `() => { if (bad) throw e; }` — telling the author to invert a guard clause
into itself. Upstream's `isOffendingConsequent` counts a braceless consequent
only when it is an `ExpressionStatement` **and** `maxStatements === 0`. Matched
exactly now:

```ts
if (consequent.type === "BlockStatement") {
  if ((consequent.body ?? []).length <= maximumStatements) return;
} else if (
  consequent.type !== "ExpressionStatement" ||
  maximumStatements !== 0
) {
  return;
}
```

One divergence stays, documented in the source and the README: the default
`maximumStatements` is `0` here and `1` upstream. `0` is what the incumbent GSTJ
ESLint config passed, so a bare `"error"` means what those repos already meant.

### `no-namespace-imports` — native, and stricter than the original

`import/no-namespace` with `["error", { ignore: ["react", "@radix-ui/*"] }]`
passes `react` and `@radix-ui/react-dialog`, reports `react-native` and
`node:path`. Already wired: `base` bans it outright, `react` re-declares it with
the allow list the old config carried, the test override turns it off (namespace
imports are how you spy on a module).

Worth knowing, though it needs no action: Shopify's `allow` is
`new RegExp(allowed.join("|"))` — unanchored substring matching. `allow:
["react"]` therefore also permitted `react-native`, `react-dom`, `preact` and
`./my-react-thing`. oxlint's globs are exact-match-with-`*`, so the replacement
is tighter than what it replaces, not looser.

### `restrict-full-import` and `strict-component-boundaries` — project config

Which packages are off-limits, and where a component's boundary is, are project
decisions. Directive #3 keeps both out of the shared presets. Both snippets are
in the plugin README and both are executed by `fixtures/adversarial/shopify`, so
a README that stops working fails the build rather than the next migration.

Verified on 1.75.0: `{ name: "lodash", importNames: ["default"] }` reports both
`import lodash from "lodash"` and `import { default as lodash } from "lodash"`,
and leaves `import { debounce } from "lodash/debounce.js"` alone. The namespace
half is `import/no-namespace`'s job already. Upstream's `require()` branch has no
native equivalent and does not come up in ESM/TS.

`strict-component-boundaries` is the one true drop. It cannot load, and its core
heuristic — a PascalCase path segment means "another component" — is dead under
the kebab-case filename convention adopted in §5. `no-restricted-imports`
`patterns` with `group: ["**/components/*/**"]` reports
`../components/Card/internal/thing` and leaves `../components/Card` alone.

### `no-ancestor-directory-import` — the resolver bought nothing

The old disposition ("expressible with `no-restricted-imports` patterns") does
not survive contact: matching `.`, `..`, `../..`, `../index`, `../../index.ts`
and so on means enumerating an unbounded ladder of globs.

Reading upstream's `relative(filename, resolvedSource)` logic, the exact set it
reports is _specifiers composed only of `.`/`..` segments with an optional
trailing `index` basename_ — decidable from syntax, no resolver needed. Two
divergences, both documented: upstream stays silent when a specifier fails to
resolve (this reports; such an import does not typecheck anyway), and this
additionally covers the re-export forms (`export * from ".."`,
`export { x } from "."`) that upstream missed by hooking `ImportDeclaration`
alone. Dynamic `import("..")` is not covered. `index.module.css` has basename
`index.module`, not `index`, so CSS-module imports are not swallowed.

**Dogfood finding, and why it stays opt-in.** Turning this on for this repo
reports three real hits: `packages/codemods/src/cli.ts` and
`packages/oxfmt-config/src/cli.ts` importing `./index.ts`. Both are true
positives by the rule's definition and neither is a cycle — `runKebabCodemod`
and the oxfmt variants are _defined_ in `index.ts`, so there is no other file to
name. That is a fair illustration of why the rule is a policy and not a bug
detector, and it is the reason it is not a candidate for `base` despite being
general enough to live there.

### `react-require-autocomplete` — `jsx-a11y/autocomplete-valid` is not a substitute

Checked against 1.75.0: `jsx-a11y/autocomplete-valid` validates the _value_ of an
`autoComplete` attribute and says nothing when the attribute is missing, which is
the entire case. An autofillable `<input>` with no `autoComplete` gets whatever
the browser guesses, which is how a password manager fills an address into a
one-time-code box. `autoComplete="off"` is an accepted answer; the rule wants the
decision made.

Two divergences from upstream, both cutting false positives: an element with a
spread attribute is skipped (`autoComplete` may be in the spread), and a computed
`type={kind}` is skipped where upstream falls back to treating it as text.
Options: `inputComponents`, for components that render an `<input>` and forward
props.

### `react-hooks-strict-return` — one path dropped deliberately

A hook returning `[a, b, c, d]` makes every call site memorise a positional order
nothing checks. Two is the limit that keeps `const [value, setValue] = useThing()`
readable; object returns are never reported at any size, which matches upstream
and is the escape hatch.

Upstream additionally resolves an indirect return (`const pair = [a, b, c];
return pair;`) through scope analysis. That path is dropped: it needs the array
literal in scope and assigned to the returned identifier, which a `useX` hook
rarely looks like. A `SpreadElement` counts as one value rather than being
expanded. Both choices err toward silence. Options: `maximumReturnValues`
(default `2`; upstream hardcodes it).

### `jsx-no-hardcoded-content` — native, off, and two gotchas

`react/jsx-no-literals` covers it and is off in the `react` preset: it is an i18n
rule, and it only pays for itself once a repo has somewhere to move the strings
to. Nothing in the migration set does. The configured snippet is in the plugin
README.

Two things found while verifying it on 1.75.0, both of which cost time:
`elementOverrides` needs `allowElement: true` to exempt an element —
`{ "noStrings": false }` reads like it should work and silently does nothing. And
`restrictedAttributes` does **not** narrow checking to the attributes you list;
it reports every string attribute and merely uses a different message for the
listed ones, so `ignoreProps: true` is what keeps the rule on children.

### Where this is wired

Nowhere in the presets, except the two that were already there
(`import/no-namespace` in `base` and `react`) and the one explicit opt-out
(`react/jsx-no-literals` in `react`, now carrying its provenance in a comment).
The plugin's "nothing is on by default" invariant holds with seven rules exactly
as it did with four.

What is new is that all of it is executed. `fixtures/adversarial/shopify` runs
every disposition — the four ported rules and the four native snippets — with
positive and negative cases for each, so a README snippet that stops firing fails
`pnpm run check` rather than the next repo to paste it. `scripts/validate-rules.mjs`
gained a second pass that resolves every `magic/*` name written in any config or
doc against the plugin's actual rule map, and fails on a rule the plugin ships
but the README never documents.
