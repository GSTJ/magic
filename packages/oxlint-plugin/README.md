# magic-oxlint-plugin

Twelve oxlint rules with no usable built-in equivalent, in two namespaces.

`magic/*` is eight rules and **all opt-in** — nothing under that namespace is
enabled by any `magic-oxlint-config` preset. They're policies rather than bug
detectors, or they're stack-specific, and both kinds of rule should be a
deliberate choice per repo.

`react-native/*` is four rules ported from `eslint-plugin-react-native`, and
those the `react-native` and `expo` presets do turn on. They live here so
`magic-oxlint-config` can ship them without depending on a package whose
required `eslint` peer pulled eslint 9 into every consumer. See
[the section below](#react-native).

## Install

```sh
pnpm add -D magic-oxlint-plugin
```

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

`extendConfig`, not oxlint's `extends` — the latter drops the preset's
`ignorePatterns`. See the [root README](../../README.md#step-2--oxlintconfigmts).

## Rules

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

Options: `maximumStatements` (default `0`) — how many statements may sit inside
the lone `if` before it's reported. Upstream defaults this to `1`; `0` is what
the incumbent GSTJ ESLint config passed, so that's the default here. It is the
only deliberate divergence.

A braceless consequent counts only when it's an expression statement, matching
upstream. `() => { if (done) return; }` and `() => { if (bad) throw e; }` are
already the shape this rule asks for and are never reported.

Not auto-fixable. Inverting a condition correctly means understanding `&&`/`||`
precedence; a blind `!(...)` wrapper reads worse than the original.

### `magic/no-ancestor-directory-import`

Port of `@shopify/no-ancestor-directory-import`, reimplemented without a module
resolver. Flags an import or re-export that routes through the index file of the
current file's own directory or an ancestor of it.

```ts
// reported — the barrel above you re-exports you, so the graph loops
import { thing } from "..";
import { thing } from "../index";
import { thing } from ".";
export * from "..";

// fine — sideways and downward imports name a real file
import { thing } from "./thing";
import { thing } from "../other/index";
```

No options.

The upstream rule can't be loaded as a jsPlugin: it calls
`eslint-module-utils/resolve` and dies with
`Resolve error: unable to load resolver "node".`, the same failure
`@shopify/strict-component-boundaries` hits. The resolver turned out to buy
nothing — the set of paths upstream reports is exactly the specifiers made of
`.`/`..` segments with an optional trailing `index`, which is decidable from
syntax. Re-export forms are covered here and weren't upstream. Dynamic
`import("..")` isn't covered.

### `magic/react-require-autocomplete`

Port of `@shopify/react-require-autocomplete`. An autofillable `<input>` with no
`autoComplete` gets whatever the browser guesses — which is how password
managers fill an address into a one-time-code box. `autoComplete="off"` is a
fine answer; the rule wants the decision made.

`jsx-a11y/autocomplete-valid` is **not** a substitute. It checks that an
`autoComplete` value is legal, and says nothing when the attribute is missing —
verified against oxlint 1.75.0.

Options: `inputComponents` — component names that render an `<input>` and
forward props.

Two divergences from upstream, both to cut false positives: an element with a
spread attribute is skipped (`autoComplete` may be in the spread), and a
computed `type={kind}` is skipped (upstream falls back to treating it as text).

### `magic/react-hooks-strict-return`

Port of `@shopify/react-hooks-strict-return`. A hook returning `[a, b, c, d]`
makes every call site memorise a positional order nothing checks. Two is the
limit that keeps `const [value, setValue] = useThing()` readable.

Object returns are never reported, at any size — that's the escape hatch, and
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

- `files` — path suffixes that count as entry points. Default:
  `["/src/index.ts", "/src/index.tsx", "/index.ts", "/index.tsx"]`
- `allow` — path substrings permitted to keep a barrel, for grandfathered
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

Not auto-fixable, deliberately. The return shape changes — `data` stops being
possibly-undefined, and surrounding `isLoading` / `isError` / `refetch` usage
has to be removed by hand. A rename alone produces code that doesn't compile.

### `magic/no-manual-classname`

Bans composing a `className` by hand. The attribute's value has to be a plain
string or a call — `cn()` to merge, `cva()` / `tv()` to declare variants.

```tsx
// reported
<div className={`ws-base${SIDE_CLASS[side]}`} />;
<div className={"p-2 " + extra} />;
<div className={active ? "bg-accent p-2" : "bg-muted p-2"} />;
<div className={active && "bg-accent"} />;

// reported too: one line up is still by hand
const classes = `p-2 ${active ? "bg-accent" : "bg-muted"}`;
<div className={classes} />;

// fine
<div className="p-2 text-sm" />;
<div className={cn("p-2", active && "bg-accent")} />;
<div className={button({ size })} />;
```

Two Tailwind classes that set the same property both survive a `${}` or a `+`,
and which one wins comes down to their order in the generated stylesheet. That's
what `tailwind-merge` resolves, and `cn()` is the two-line wrapper around it
that shadcn's `components.json` already generates into `@/lib/utils` in four of
the GSTJ repos. A conditional in the attribute has a separate problem: every
branch repeats the classes the branches share, so they drift.

The shape it was written for is `gabriel-taveira-portfolio`'s `marginalia.tsx`:

```tsx
const SIDE_CLASS: Record<Side, string> = {
  left: " ws-marginalia-left",
  right: " ws-marginalia-right",
  inline: "",
};
const className = `ws-marginalia${SIDE_CLASS[side]}`;
```

The leading spaces are what hold the concatenation together, so a template
literal reading from an object of class strings gets a message naming `cva`/`tv`
instead of the generic one. And the splice sits in a `const` above the JSX, so
the rule follows a same-file `const` into the attribute.

Options:

- `attributes` — default `["className", "class"]`. NativeWind's extra class
  props (`contentContainerClassName`, `indicatorClassName`) go here.
- `composers` — default `["cn", "cva", "twMerge", "clsx", "cx"]`, in descending
  order of how often each appears across the GSTJ repos: `cn` 457 call sites,
  `cva` 20, and `twMerge`/`clsx`/`cx` only inside the six `cn` definitions
  those repos have between them. It picks the name the diagnostics tell you to
  reach for, so a repo whose helper is `tw()` gets usable advice. It gates nothing: a call in
  `className` is never reported, whatever it calls, because only the shape of
  the value is inspected. That's also why `cn(cond ? a : b)` passes, and why
  there's no `allowTernaryInCn` option; the argument was never in scope.

  `tv` is missing from the default list because `tailwind-variants` isn't a
  dependency of any GSTJ repo. It still appears in the messages, and
  `className={tv(...)()}` passes either way.

What it doesn't catch:

- `element.className = ...` outside JSX. Real, in
  `invest-radar/sources/browser-ext/entrypoints/popup/main.ts`, but that's a
  DOM property assignment in a package with no `cn` to route it through.
- A `let`, or a name bound twice in the file. A `className` prop next to a
  hand-built `const className` is that collision, and it's a common one; the
  rule stops rather than guess which binding reaches the JSX.
- Composition behind a function or module boundary —
  `className={buildClasses(side)}`. The helper may use `cn` already.
- `||` and `??`. In an attribute those read as a default
  (`className={own ?? "p-2"}`), the inverse of what `&&` does.

A lookup table imported from another module is still caught, just less
specifically: without the object literal in view, the generic `template` message
fires instead of the `cva`/`tv` one.

Not auto-fixable. Wrapping the expression in `cn()` renders the identical class
string; the value is in splitting it into arguments, so falsy pieces drop out
and conflicts merge. A fixer would have to decide which piece belongs where, and
it'd get that wrong in the rendered output without failing anything.
`magic/prefer-early-return` and `magic/prefer-suspense-query` are off-limits to
`--fix` for the same kind of reason.

The name describes what's banned. `prefer-cn` would name one of two right
answers, since a variant axis wants `cva`/`tv`, and `no-classname-concat` covers
`+` alone. See [DECISIONS.md](../../DECISIONS.md) section 10 for
the evidence behind the defaults.

Measured before shipping, over the repos themselves: 22 reports in
`gabriel-taveira-portfolio`, 11 in `chatmode`, 6 in `invest-radar`, 1 in
`padrinhos-ana-julia-gabriel`, and 0 in `e-card`, `pegada` and
`would-you-rather`, which already route every composition through `cn`.

## React Native

Four rules ported from `eslint-plugin-react-native@5.0.0` (MIT — see
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)). They ship from a separate
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

Matching is per-file and shallow, which is what keeps it quiet rather than
noisy. A use is any `sheet.entry` member expression anywhere in the file;
`styles.row.color` and `styles["row"]` mark nothing. And the rule reports
nothing at all unless it detected a React component in the file, so a shared
`styles.ts` whose sheets are consumed elsewhere stays silent.

### Divergences from upstream

Three, all recorded in the rule files:

- **A valueless `<View style />` no longer crashes the linter.** Upstream's
  `no-single-element-style-arrays` reads `node.value.expression` unguarded. Under
  oxlint that TypeError aborts the JS plugin host for the whole file, so every
  rule in this plugin goes quiet on it, not just that one.
- **The component detection walks `node.parent` instead of scopes.** Same
  enclosing-function sequence, no dependency on how oxlint names its scopes.
- **`ClassProperty` is not handled.** Upstream registers that visitor and no
  parser has emitted the node since ESTree renamed it to `PropertyDefinition`,
  so the branch never runs upstream either.

Everything else matches, message strings included. Parity was measured by
running both plugins over the same 13-file corpus under oxlint 1.75.0: 40
diagnostics each, identical rule, byte offset, span length and message, plus
identical `--fix` output. A fourteenth file holds the crash case, which only one
of the two survives. `fixtures/adversarial/react-native` keeps the
behaviour pinned.

### The three rules that did not come along

`no-raw-text`, `sort-styles` and `split-platform-components` are not ported. The
preset set all three to `off`, so nothing here loses coverage, but a repo that
turned one back on needs to bring upstream in itself, under its own namespace:

```ts
jsPlugins: [
  { name: "rn-upstream", specifier: "eslint-plugin-react-native" },
],
rules: { "rn-upstream/no-raw-text": "error" },
```

The namespace has to differ from `react-native` — the preset already claims that
one. Doing this puts the eslint peer back in the tree; pin `eslint` to `^10` if
that matters (the root README has the snippet).

## Rules covered natively instead

These have a real oxlint rule behind them, so there's nothing to port. Wire them
in config, not here.

| ESLint rule                         | oxlint replacement                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `@shopify/no-namespace-imports`     | `import/no-namespace` with `ignore` globs — already on in `magic-oxlint-config`            |
| `@shopify/restrict-full-import`     | `no-restricted-imports` with `importNames: ["default"]`, plus `import/no-namespace`        |
| `@shopify/jsx-no-hardcoded-content` | `react/jsx-no-literals` — see the snippet below                                            |
| `react/jsx-no-leaked-render`        | `safe-jsx/jsx-explicit-boolean` for the `&&` case; the oxlint rule was removed before 1.75 |
| `prefer-arrow-functions/*`          | `func-style: ["error", "expression"]`                                                      |
| `unused-imports/no-unused-imports`  | `no-unused-vars` already reports unused imports                                            |
| `import/order`                      | Not a lint concern here — `oxfmt` sorts imports                                            |

`restrict-full-import` is per-repo config, since which packages are off-limits
is a project decision:

```jsonc
"no-restricted-imports": ["error", { "paths": [
  { "name": "lodash", "importNames": ["default"],
    "message": "Import the single function you need: `lodash/debounce`." }
]}]
```

Verified on oxlint 1.75.0: this reports both `import lodash from "lodash"` and
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

Two gotchas found while verifying this against 1.75.0. `elementOverrides` needs
`allowElement: true` to exempt an element — `{ "noStrings": false }` reads like
it should work and does nothing. And `restrictedAttributes` does **not** narrow
checking to the attributes you list: it reports every string attribute and just
uses a different message for the listed ones, so `ignoreProps: true` is the way
to stay on children only.

## Rules considered and dropped

| ESLint rule                            | Why it isn't here                                                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@shopify/strict-component-boundaries` | Can't load under oxlint (`unable to load resolver "node"`), and its core heuristic — a PascalCase path segment means "another component" — is dead under the house kebab-case filename convention. See below |
| `testing-library/*`                    | `eslint-plugin-testing-library` works as a jsPlugin unmodified; add it per repo rather than shipping the dependency to everyone                                                                              |

For component boundaries, `no-restricted-imports` `patterns` does the job and is
architecture-specific anyway, so it belongs in the consuming repo:

```jsonc
"no-restricted-imports": ["error", { "patterns": [
  { "group": ["**/components/*/**"],
    "message": "Do not reach into a component's folder. Import from its entry point." }
]}]
```

Verified on 1.75.0: reports `../components/Card/internal/thing`, leaves
`../components/Card` alone.

## Why not just load `@shopify/eslint-plugin` as a jsPlugin

It was tested, not assumed. Under oxlint 1.75.0 with
`@shopify/eslint-plugin@50.0.0` loaded as
`{ name: "shopify", specifier: "@shopify/eslint-plugin" }`:

| Rule                           | Result under oxlint                          |
| ------------------------------ | -------------------------------------------- |
| `prefer-early-return`          | Fires correctly                              |
| `no-namespace-imports`         | Fires correctly                              |
| `restrict-full-import`         | Fires correctly                              |
| `jsx-no-hardcoded-content`     | Fires correctly                              |
| `react-require-autocomplete`   | Fires correctly                              |
| `react-hooks-strict-return`    | Fires correctly                              |
| `no-ancestor-directory-import` | **Fails** — `unable to load resolver "node"` |
| `strict-component-boundaries`  | **Fails** — `unable to load resolver "node"` |

So compatibility isn't the blocker; weight is. `@shopify/eslint-plugin` pulls in
262 transitive packages and ~97 MB — a second copy of the ESLint ecosystem
(`eslint-plugin-import-x`, `eslint-plugin-jest`, `eslint-plugin-jsx-a11y`,
`typescript-eslint`, `prettier`) — landing in every consumer of a config whose
entire point is that oxlint replaced all of it. Porting the four rules worth
keeping is a few hundred lines with tests.

## Authoring notes

Every rule ships both entry points at once — `createOnce` (oxlint's fast path,
where the visitor object is built once for the whole run instead of per file)
and `create` (ESLint's classic API) — from a single `createChecks` body. See
`src/rule-api.ts`. There's no environment detection: oxlint's own types say
"if `createOnce` method is present, `create` is ignored", and ESLint doesn't
know `createOnce` exists, so each linter picks its own path.

Because the `createOnce` closure runs once per lint run, anything that varies
per file has to be read inside `before()` — the filename, and `context.options`,
which oxlint documents as "rule options for this rule on this file" and which
`overrides` / nested configs can change between files.

Tests run the real oxlint binary over temp files with the real plugin loaded, so
they exercise the actual integration rather than a mock context.

```sh
pnpm build && pnpm test
```
