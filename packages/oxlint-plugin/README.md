<p align="center">
  <img alt="Editor window with a lone wrapping if flagged by the magic/prefer-early-return diagnostic" src="https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-oxlint-plugin.png" />
</p>

<p align="center">Add one oxlint plugin. Opt into eight rules by hand, or use the react-native ones your preset already turns on.</p>

<p align="center">
  <a aria-label="npm version" href="https://www.npmjs.com/package/magic-oxlint-plugin"><img alt="npm version" src="https://shieldcn.dev/npm/magic-oxlint-plugin.svg?variant=branded&size=xs&mode=light" /></a>
</p>

## How it works

1. The package loads as an oxlint jsPlugin; the `name` field of the `jsPlugins` entry sets the
   namespace the rule ids use.
2. `magic/*` is eight rules, all opt-in. Nothing under that namespace is enabled by any
   `magic-oxlint-config` preset.
3. `react-native/*` is four rules ported from `eslint-plugin-react-native`, shipped from the
   separate `magic-oxlint-plugin/react-native` entry point. The `react-native` and `expo` presets
   enable all four at `error`. They live here so `magic-oxlint-config` can ship them without
   depending on a package whose required `eslint` peer pulled eslint 9 into every consumer.

```ts
// oxlint.config.mts
import { extendConfig } from "magic-oxlint-config";
import base from "magic-oxlint-config/base";

export default extendConfig(base, {
  jsPlugins: [{ name: "magic", specifier: "magic-oxlint-plugin" }],
  rules: {
    "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
  },
});
```

`extendConfig` rather than oxlint's `extends`; the latter drops the preset's `ignorePatterns`. See
the [root README](../../README.md#step-2--oxlintconfigmts).

## Install

```sh
pnpm add -D magic-oxlint-plugin
```

## Rules

All eight `magic/*` rules are opt-in. Each one is either a policy call or specific to a
particular stack, so enabling it is a deliberate per-repo decision.

### `magic/prefer-early-return`

Port of `@shopify/prefer-early-return`. Flags a function whose entire body is a
single `if` with no `else`.

```ts
// reported
const handle = (ok: boolean) => {
  if (ok) {
    doA();
    doB();
  }
};

// fine
const handle = (ok: boolean) => {
  if (!ok) return;
  doA();
  doB();
};
```

Options: `maximumStatements` (default `0`), how many statements may sit inside
the lone `if` before it's reported. Upstream defaults this to `1`; `0` is what
the incumbent GSTJ ESLint config passed, so that's the default here, and the
only deliberate divergence.

A braceless consequent counts only when it's an expression statement, matching
upstream, so `() => { if (done) return; }` and `() => { if (bad) throw e; }`
are already the shape this rule asks for and are never reported.

Not auto-fixable. Inverting a condition correctly means understanding `&&`/`||`
precedence; a blind `!(...)` wrapper reads worse than the original.

### `magic/no-ancestor-directory-import`

Port of `@shopify/no-ancestor-directory-import`, reimplemented without a module
resolver. Flags an import or re-export that routes through the index file of the
current file's own directory or an ancestor of it.

```ts
// reported: the barrel above you re-exports you, so the graph loops
import { thing } from "..";
import { thing } from "../index";
import { thing } from ".";
export * from "..";

// fine: sideways and downward imports name a real file
import { thing } from "./thing";
import { thing } from "../other/index";
```

No options.

The upstream rule can't be loaded as a jsPlugin: it calls
`eslint-module-utils/resolve` and dies with
`Resolve error: unable to load resolver "node".`, the same failure
`@shopify/strict-component-boundaries` hits. The resolver turned out to buy
nothing: the set of paths upstream reports is exactly the specifiers made of
`.`/`..` segments with an optional trailing `index`, which is decidable from
syntax. Re-export forms are covered here and weren't upstream. Dynamic
`import("..")` isn't covered.

### `magic/react-require-autocomplete`

Port of `@shopify/react-require-autocomplete`. An autofillable `<input>` with no
`autoComplete` gets whatever the browser guesses, which is how password
managers fill an address into a one-time-code box. `autoComplete="off"` is a
fine answer; the rule wants the decision made.

`jsx-a11y/autocomplete-valid` is not a substitute: it checks that an
`autoComplete` value is legal, but says nothing when the attribute is missing
entirely.

Options: `inputComponents` (component names that render an `<input>` and
forward props).

An element with a spread attribute is skipped (`autoComplete` may be in the
spread), and a computed `type={kind}` is skipped (upstream falls back to
treating it as text) - both cut false positives against upstream.

### `magic/react-hooks-strict-return`

Port of `@shopify/react-hooks-strict-return`. A hook returning `[a, b, c, d]`
makes every call site memorise a positional order nothing checks. Two is the
limit that keeps `const [value, setValue] = useThing()` readable.

Object returns are never reported, at any size; that's the escape hatch, and
it matches upstream.

Options: `maximumReturnValues` (default `2`). Upstream hardcodes 2.

Upstream additionally resolves an indirect return (`const pair = [a, b, c];
return pair;`) through scope analysis. That path is dropped: it needs the array
literal in scope and assigned to the returned identifier, which a `useX` hook
rarely looks like. A `SpreadElement` counts as one value rather than being
expanded, so this errs toward silence.

### `magic/no-barrel-file`

Bans catch-all `export * from "..."` in package entry points. A wildcard
re-export pulls every transitive symbol into every consumer's module graph,
defeats subpath exports, and makes the public API unreadable. Named re-exports
are fine.

Generalised from invest-radar's `scripts/no-barrel.sh`, which was a separate CI
step that couldn't point at a line or be silenced per-case.

Options:

- `files`: path suffixes that count as entry points. Default:
  `["/src/index.ts", "/src/index.tsx", "/index.ts", "/index.tsx"]`
- `allow`: path substrings permitted to keep a barrel, for grandfathered
  facades.

```ts
"magic/no-barrel-file": ["error", { allow: ["foundation/core/src/index.ts"] }]
```

### `magic/no-module-mocks`

Bans `vi.mock()` / `jest.mock()` and friends in test files. Module mocks couple
a test to the module graph instead of to behaviour: they break on rename, hide
real integration failures, and let a test pass for reasons unrelated to the code
under test.

A distinct message fires when the call is inside a conditional, because mock
calls are hoisted and the conditional does not do what it looks like.

Options: `objects` (default `["vi", "jest"]`), `methods`, `testFilePattern`.

Generalised from the g2i `testing-policy/no-module-mocks` rule, which was
vitest-only. Not auto-fixable: removing the call leaves a test that imports the
real module and fails.

### `magic/prefer-suspense-query`

Steers tRPC / TanStack Query call sites from `useQuery` to `useSuspenseQuery`,
so loading and error states live in one `<Suspense>` / `<ErrorBoundary>` pair
instead of in every component as `isLoading` branches.

Walks the member chain back to its root identifier and only reports when that
root is configured, so an unrelated `something.useQuery()` is left alone.

Options: `roots` (default `["api", "trpc"]`), `hooks` (default `["useQuery"]`).

Not auto-fixable, deliberately. The return shape changes: `data` stops being
possibly-undefined, and surrounding `isLoading` / `isError` / `refetch` usage
has to be removed by hand. A rename alone produces code that doesn't compile.

### `magic/no-manual-classname`

Bans composing a `className` by hand. The value has to be a plain string or a
call: `cn()` to merge, `cva()` / `tv()` to declare variants.

```tsx
// reported
<div className={`ws-base${SIDE_CLASS[side]}`} />;
<div className={active ? "bg-accent p-2" : "bg-muted p-2"} />;

// fine
<div className="p-2 text-sm" />;
<div className={cn("p-2", active && "bg-accent")} />;
```

Two Tailwind classes that set the same property both survive a `${}` or a `+`,
and which one wins comes down to their order in the generated stylesheet.
`cn()` is the `tailwind-merge` wrapper that resolves that. A conditional in the
attribute has a separate problem: every branch repeats the classes the
branches share, so they drift.

Options:

- `attributes`: default `["className", "class"]`. NativeWind's extra class
  props (`contentContainerClassName`, `indicatorClassName`) go here.
- `composers`: default `["cn", "cva", "twMerge", "clsx", "cx"]`, the order the
  GSTJ repos reach for them in. It gates nothing: a call in `className` is
  never reported, whatever it calls, so `cn(cond ? a : b)` passes and there's
  no `allowTernaryInCn` option, the argument was never in scope.

Not auto-fixable: wrapping the expression in `cn()` renders the identical class
string, and picking which piece resolves which conflict is a judgement call a
fixer can't make safely.

Full rationale, the evidence behind the defaults, and the known gaps are in
[DECISIONS.md](../../DECISIONS.md) section 10.

## React Native

Four rules ported from `eslint-plugin-react-native` (MIT license, version pinned
in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)). They ship from a separate
entry point under the `react-native` namespace, and `magic-oxlint-config`'s
`react-native` and `expo` variants enable all four at `error`, so a repo on
either preset gets them without doing anything:

```ts
// what the preset does, if you want them without it
jsPlugins: [
  { name: "react-native", specifier: "magic-oxlint-plugin/react-native" },
],
rules: {
  "react-native/no-inline-styles": "error",
  "react-native/no-color-literals": "error",
  "react-native/no-single-element-style-arrays": "error",
  "react-native/no-unused-styles": "error",
},
```

The namespace is `react-native` rather than `magic` on purpose. Rule ids show up
in repo configs and in `// oxlint-disable-next-line react-native/no-inline-styles`
comments, and oxlint takes the namespace from the `jsPlugins` entry's `name`, so
keeping it costs nothing and renaming would cost a migration in every React
Native repo.

### `react-native/no-inline-styles`

An object literal in a `style` prop is a new object every render, and
`StyleSheet` never sees it, so it crosses the bridge again each time.

```tsx
// reported
<View style={{ padding: 8 }} />
<View style={[styles.row, { margin: 4 }]} />
<View style={cond ? { padding: 1 } : styles.row} />
<View style={{ height: -1 }} />

// fine
<View style={styles.row} />
<View style={{ padding: spacing.small }} />
<View style={{ ...base }} />
```

It matches any attribute whose name contains "style", so
`contentContainerStyle` counts. A property only makes the object reportable when
its value is a literal, a conditional with a literal branch, or unary `-`/`+` on
a literal.

### `react-native/no-color-literals`

A hard-coded colour can't follow a theme. Any property whose name contains
"color", in a style prop or inside `StyleSheet.create`:

```tsx
// reported
<View style={{ borderColor: "blue" }} />;
const styles = StyleSheet.create({ tinted: { shadowColor: "#000" } });

// fine
<View style={{ borderColor: theme.border }} />;
```

Only the top level of each style object is inspected, which is upstream's reach.
`settings["react-native/style-sheet-object-names"]` still works if a repo uses
`EStyleSheet.create` or similar.

### `react-native/no-single-element-style-arrays`

`style={[styles.row]}` allocates a fresh array every render for nothing.
Autofixable: the fix unwraps it to `style={styles.row}`.

Unlike `no-inline-styles`, this one matches the attribute name `style` exactly,
so `contentContainerStyle={[styles.row]}` is not reported. That asymmetry is
upstream's and the port keeps it.

### `react-native/no-unused-styles`

A `StyleSheet.create` entry nothing reads still gets registered at startup, and
it is the usual residue of a deleted component.

Matching is per-file and shallow, which is what keeps it quiet. A use is any
`sheet.entry` member expression anywhere in the file; `styles.row.color` and
`styles["row"]` mark nothing. And the rule reports nothing at all unless it
detected a React component in the file, so a shared `styles.ts` whose sheets
are consumed elsewhere stays silent.

### Divergences from upstream

- A valueless `<View style />` no longer crashes the linter. Upstream's
  `no-single-element-style-arrays` reads `node.value.expression` unguarded. Under
  oxlint that TypeError aborts the JS plugin host for the whole file, so every
  rule in this plugin goes quiet on it.
- The component detection walks `node.parent` instead of scopes. Same
  enclosing-function sequence, no dependency on how oxlint names its scopes.
- `ClassProperty` is not handled. Upstream registers that visitor and no
  parser has emitted the node since ESTree renamed it to `PropertyDefinition`,
  so the branch never runs upstream either.

Everything else matches, message strings included. All three divergences are recorded in the rule
files. Parity was measured by running both plugins over the same 13-file corpus: 40 diagnostics
each, identical rule, byte offset, span length and message, plus identical `--fix` output. A
fourteenth file holds the crash case, which only one of the two survives.
`fixtures/adversarial/react-native` keeps the behaviour pinned.

### Not ported

`no-raw-text`, `sort-styles` and `split-platform-components` are not ported. The
preset set all three to `off`, so nothing here loses coverage, but a repo that
turned one back on needs to bring upstream in itself, under its own namespace:

```ts
jsPlugins: [
  { name: "rn-upstream", specifier: "eslint-plugin-react-native" },
],
rules: { "rn-upstream/no-raw-text": "error" },
```

The namespace has to differ from `react-native` (the preset already claims that
one). Doing this puts the eslint peer back in the tree; pin `eslint` to `^10` if
that matters (the root README has the snippet).

## Rules covered natively instead

These have a real oxlint rule behind them, so there's nothing to port. Wire them
in the consuming repo's config.

| ESLint rule                         | oxlint replacement                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `@shopify/no-namespace-imports`     | `import/no-namespace` with `ignore` globs (already on in `magic-oxlint-config`)       |
| `@shopify/restrict-full-import`     | `no-restricted-imports` with `importNames: ["default"]`, plus `import/no-namespace`   |
| `@shopify/jsx-no-hardcoded-content` | `react/jsx-no-literals` (snippet below)                                               |
| `react/jsx-no-leaked-render`        | `safe-jsx/jsx-explicit-boolean` for the `&&` case; the native oxlint rule was removed |
| `prefer-arrow-functions/*`          | `func-style: ["error", "expression"]`                                                 |
| `unused-imports/no-unused-imports`  | `no-unused-vars` already reports unused imports                                       |
| `import/order`                      | `oxfmt` sorts imports, so it never reaches lint                                       |

`restrict-full-import` is per-repo config, since which packages are off-limits
is a project decision:

```jsonc
"no-restricted-imports": ["error", { "paths": [
  { "name": "lodash", "importNames": ["default"],
    "message": "Import the single function you need: `lodash/debounce`." }
]}]
```

This reports both `import lodash from "lodash"` and
`import { default as lodash } from "lodash"`, and leaves
`import { debounce } from "lodash"` alone. The namespace half
(`import * as _ from "lodash"`) is `import/no-namespace`'s job. Upstream also
caught `const _ = require("lodash")`; there is no native equivalent, and it does
not come up in ESM/TS.

`jsx-no-hardcoded-content` is an i18n rule and only pays off with an i18n setup.
When you want it:

```jsonc
"react/jsx-no-literals": ["error", {
  "noStrings": true,
  "ignoreProps": true,
  "allowedStrings": ["·", "—"],
  "elementOverrides": { "Trans": { "allowElement": true } }
}]
```

`elementOverrides` needs `allowElement: true` to exempt an element;
`{ "noStrings": false }` reads like it should work and does nothing. And
`restrictedAttributes` does not narrow checking to the attributes you list: it
reports every string attribute and just uses a different message for the listed
ones, so `ignoreProps: true` is the way to stay on children only.

## Rules considered and dropped

| ESLint rule                            | Why it isn't here                                                                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@shopify/strict-component-boundaries` | Can't load under oxlint (`unable to load resolver "node"`), and its core heuristic (a PascalCase path segment means "another component") is dead under the house kebab-case filename convention. See below |
| `testing-library/*`                    | `eslint-plugin-testing-library` works as a jsPlugin unmodified; add it per repo rather than shipping the dependency to everyone                                                                            |

For component boundaries, `no-restricted-imports` `patterns` does the job and is
architecture-specific anyway, so it belongs in the consuming repo:

```jsonc
"no-restricted-imports": ["error", { "patterns": [
  { "group": ["**/components/*/**"],
    "message": "Do not reach into a component's folder. Import from its entry point." }
]}]
```

This reports `../components/Card/internal/thing`, leaves `../components/Card`
alone.

## Porting vs loading `@shopify/eslint-plugin`

Measured with `@shopify/eslint-plugin` loaded as
`{ name: "shopify", specifier: "@shopify/eslint-plugin" }`:

| Rule                           | Result under oxlint                     |
| ------------------------------ | --------------------------------------- |
| `prefer-early-return`          | Fires correctly                         |
| `no-namespace-imports`         | Fires correctly                         |
| `restrict-full-import`         | Fires correctly                         |
| `jsx-no-hardcoded-content`     | Fires correctly                         |
| `react-require-autocomplete`   | Fires correctly                         |
| `react-hooks-strict-return`    | Fires correctly                         |
| `no-ancestor-directory-import` | Fails: `unable to load resolver "node"` |
| `strict-component-boundaries`  | Fails: `unable to load resolver "node"` |

Compatibility mostly holds; the blocker is weight. `@shopify/eslint-plugin`
drags in a second copy of the ESLint ecosystem (`eslint-plugin-import-x`,
`eslint-plugin-jest`, `eslint-plugin-jsx-a11y`, `typescript-eslint`,
`prettier`) into every consumer of a config whose entire point is that oxlint
replaced all of it. Porting the four rules worth keeping is a few hundred lines
with tests.

## Authoring notes

Every rule ships both entry points at once, `createOnce` (oxlint's fast path,
where the visitor object is built once for the whole run instead of per file)
and `create` (ESLint's classic API), from a single `createChecks` body. See
`src/rule-api.ts`. There's no environment detection: oxlint's own types say
"if `createOnce` method is present, `create` is ignored", and ESLint doesn't
know `createOnce` exists, so each linter picks its own path.

Because the `createOnce` closure runs once per lint run, anything that varies
per file has to be read inside `before()`: the filename, and `context.options`,
which oxlint documents as "rule options for this rule on this file" and which
`overrides` / nested configs can change between files.

Tests run the real oxlint binary over temp files with the real plugin loaded, so
they exercise the actual integration rather than a mock context.

```sh
pnpm build && pnpm test
```
