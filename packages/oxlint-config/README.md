<p align="center">
  <img alt="The five presets as layered cards: base, then react, branching into react-native and next, with expo stacked on react-native" src="https://assets.gabrieltaveira.dev/magic/magic-oxlint-config.png" />
</p>

<p align="center">Export the variant that matches your stack; every preset underneath it is already tuned.</p>

<p align="center">
  <a aria-label="npm version" href="https://www.npmjs.com/package/magic-oxlint-config"><img alt="npm version" src="https://shieldcn.dev/npm/magic-oxlint-config.svg?variant=branded&size=xs&mode=light" /></a>
</p>

## How it works

1. Pick the variant that matches the stack. Each one extends the previous, so every repo gets the
   same base rules plus only its framework's additions:

   ```
   base ─┬─ react ─┬─ react-native ── expo
         │         └─ next
   ```

2. Make the whole `oxlint.config.mts` a re-export of that variant.
3. Layer repo-specific rules on through `extendConfig`, never oxlint's `extends`, which silently
   drops fields (details in ["Do not use `extends`"](#do-not-use-extends)).

```ts
// oxlint.config.mts
export { default } from "magic-oxlint-config/react";
```

| Variant        | Import                             | For                           |
| -------------- | ---------------------------------- | ----------------------------- |
| `base`         | `magic-oxlint-config/base`         | Any TypeScript. No framework. |
| `react`        | `magic-oxlint-config/react`        | React web, no framework       |
| `react-native` | `magic-oxlint-config/react-native` | Bare React Native             |
| `next`         | `magic-oxlint-config/next`         | Next.js                       |
| `expo`         | `magic-oxlint-config/expo`         | Expo                          |

## Install

```sh
pnpm add -D oxlint magic-oxlint-config
```

## Extending

Layer repo-specific rules on top with `extendConfig`:

```ts
// oxlint.config.mts
import { extendConfig } from "magic-oxlint-config";
import react from "magic-oxlint-config/react";

export default extendConfig(react, {
  rules: { "no-console": "off" },
});
```

> **Do not consume this package through oxlint's `extends`.**
> `defineConfig({ extends: [react] })` drops the preset's `ignorePatterns` entirely (the local
> array replaces the preset's rather than adding to it), and there is no line you can add to a JS
> config that gets them back reliably. Details and the repro are in
> ["Do not use `extends`"](#do-not-use-extends) below.

### JSON consumers

Every variant also ships as plain JSON, generated from the same source at build time so it can't
drift. `.oxlintrc.json` has no `extendConfig`, so `extends` is the only path, and its `extends`
takes a file path rather than a package specifier, so the `node_modules` location has to be
spelled out. The preset's `ignorePatterns` have to be copied verbatim, because that is the one
field `extends` still drops:

```jsonc
// .oxlintrc.json
{
  "extends": ["./node_modules/magic-oxlint-config/react.json"],
  "ignorePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/.next/**",
    "**/.expo/**",
    "**/generated/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/*.d.ts",
    "**/*.min.js",
    "pnpm-lock.yaml",
  ],
}
```

Everything else travels, including `env` and `globals`, which are mirrored into a
`files: ["**"]` override precisely because JSON consumers have no alternative to `extends`. The
bare `jsPlugins` specifiers work too, because oxlint resolves them relative to the config file,
which in this case lives inside this package next to its own `node_modules`. Verified against a
real pnpm install of the packed tarball.

Still prefer `oxlint.config.mts`: the JSON path hardcodes a `node_modules` layout, and there the
ignore list is a copy that goes stale instead of the live `react.ignorePatterns`.

## What's in it

### Categories

`correctness`, `suspicious`, `pedantic`, `style` and `perf` are all `error`; `restriction` and
`nursery` are off. Individual rules get turned back off from there wherever the blanket switch is
wrong more often than it's right, see [`src/base.ts`](src/base.ts) for the list. This is the
strategy already running in invest-radar and in the MM mobile repo.

### Type-aware rules

Included but dormant. oxlint ignores them unless it's run with `--type-aware`, silently and
without error, so they cost nothing until a repo is ready. See the root README for the switch-on
checklist.

### JS plugins

`react` and below wire in `eslint-plugin-safe-jsx`, which has no oxlint equivalent and catches
`items.length && <Row/>` rendering a literal `0`. The React Native variants add
`magic-oxlint-plugin/react-native` on top, see [`src/react-native.ts`](src/react-native.ts) for
the rules it turns on. Both are dependencies of this package and resolve from here, so pnpm's
non-hoisted layout doesn't break them.

Those react-native rules used to come from `eslint-plugin-react-native`, which declares a
required `eslint` peer that oxlint never calls; `autoInstallPeers` honoured it and installed
eslint into every consumer anyway. The rule ids didn't change in the port, so existing configs
and `oxlint-disable` comments keep working. Full history in the root
[CHANGELOG](../../CHANGELOG.md).

### Deliberately absent

Per-repo conventions: component wrappers, service boundaries, ORM access patterns. Those go in
each repo's own config. See "Local overrides" in the root README.

## Notable behaviour

- `process.env` is banned via `no-restricted-properties`. `**/env.ts`, config files, scripts and
  `bin/` are exempt.
- Function declarations are banned via `func-style: expression`, replacing
  `eslint-plugin-prefer-arrow-functions`. Named exports are exempt so `export function GET()` and
  `export default function Page()` still work.
- Test files get the jest plugin, relaxed type-aware rules, `no-console` off, and a ban on
  `jest.clearAllMocks()` (use `clearMocks` in the jest config).
- Import order is not enforced here; oxlint has no `import/order`, so `oxfmt` owns it. See
  `magic-oxfmt-config`.
- Namespace imports are banned (`import/no-namespace`, the `@shopify/no-namespace-imports`
  replacement). `react` and below allow `import * as React from "react"` and `@radix-ui/*`; test
  files allow all of them, because that is how you spy on a module.

### Do not use `extends`

oxlint's `extends` drops three of the extended config's top-level fields: `ignorePatterns`, `env`
and `globals`. Severities, rule **options**, `categories`, `plugins`, `jsPlugins` and `overrides`
all travel fine. Verified by executing each one against a real install rather than reading
`--print-config`, which misreports most of this (see below).

This package now defends two of the three (see CHANGELOG for when): `env` and `globals` are
mirrored into a `files: ["**"]` override, and overrides survive `extends`. So `no-global-assign` on
`document`, and `__DEV__` in the React Native variants, now behave the same either way.

`ignorePatterns` cannot be defended (oxlint has no per-override ignore), and it is the field that
matters most:

```ts
// Reports ~500k diagnostics out of node_modules with no .gitignore in the way,
// and lints generated/, ios/ and android/ in every repo that commits them.
export default defineConfig({ extends: [expo] });

// Not a fix either: a local ignorePatterns REPLACES the preset's, it does not
// add to it. --print-config returns exactly ["**/foo/**"].
export default defineConfig({ extends: [expo], ignorePatterns: ["**/foo/**"] });
```

`ignorePatterns: expo.ignorePatterns` does restore them, and that recipe was documented in an
earlier release (see CHANGELOG). It is gone because it is a line you have to remember forever, in every repo, on every
variant, with a silent and enormous failure mode when you don't. The re-export has nothing to
forget. `.gitignore` is honoured separately, which is what hides the `node_modules` case in a
real repo; it does not cover the `ios/` and `android/` that bare React Native repos commit.

### `--print-config` cannot audit an `extends`-shaped config

Every consumption question above has to be answered by linting a file; `--print-config` cannot
answer it. The printer renders an `extends`-shaped config **post-expansion and pre-merge**, so it
reports:

- `categories: {}`, while every category rule is in fact live, expanded into the printed `rules`
  map as bare `"deny"`
- every rule's options stripped: `"typescript/consistent-type-definitions": "deny"` instead of
  `["deny", ["type"]]`, `unicorn/filename-case` without its `ignore` list,
  `no-restricted-properties` without its message
- `env: { builtin: true }`, `globals: {}`, and no `jsPlugins` at all

The preset has not been gutted, despite what the printed output implies. Seven consuming repos
took the output at face value during one upgrade round and three of them started re-declaring
rule options by hand.

The output is also actively misleading in the other direction: `env` and `globals` really _were_
dropped in an earlier release, and the printer showed that loss in exactly the same way it showed
the six fields that were fine. `ignorePatterns` is the only field it reports accurately here.

`fixtures/adversarial/extends` in this repo executes all of it (both config shapes, both
`--print-config` renderings) on every `pnpm run check`, so the paragraphs above stay true or CI
says so.

## Development

`base.json` and friends are generated. Edit `src/*.ts` and run `pnpm build`. `pnpm test` asserts
the JSON mirrors match the JS and that oxlint accepts every variant.
