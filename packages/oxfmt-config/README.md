# magic-oxfmt-config

Shared oxfmt configuration. Replaces both `prettier` and
`@ianvs/prettier-plugin-sort-imports`.

## Install

```sh
pnpm add -D oxfmt@0.60.0 magic-oxfmt-config
```

## Use

oxfmt has **no `extends`** — the key isn't in its schema, and writing one is
silently ignored rather than reported. Sharing therefore happens in JavaScript:
oxfmt executes `.ts`/`.mts` config files, so a real package import works.

```ts
// oxfmt.config.mts
import base from "magic-oxfmt-config";

export default base;
```

Variants add ignore patterns for framework and native directories:

```ts
import { expo } from "magic-oxfmt-config"; // also: react, reactNative, next

export default expo;
```

Extending locally:

```ts
import base from "magic-oxfmt-config";

export default {
  ...base,
  ignorePatterns: [...(base.ignorePatterns ?? []), "vendor/**"],
};
```

### Formatting a file the shared config ignores

The shared ignore list is aimed at files a tool owns and nobody reads the diff
of — `CHANGELOG.md`, `*.generated.*`, minified output. A repo that writes one of
those by hand can take it back:

```ts
import base, { withoutIgnorePatterns } from "magic-oxfmt-config";

// This repo's CHANGELOG.md is hand-written, so it should be formatted.
export default withoutIgnorePatterns(base, ["**/CHANGELOG.md"]);
```

`withoutIgnorePatterns` throws on a pattern the config does not actually ignore,
rather than quietly doing nothing — this is a config format where unknown keys
and unmatched patterns both fail open.

**Naming an ignored path explicitly is an error, not a no-op.** oxfmt 0.60.0
exits **2** when every path it was handed is excluded:

```sh
$ oxfmt CHANGELOG.md
Expected at least one target file. All matched files may have been excluded by ignore rules.
$ echo $?
2
```

That is what breaks on the upgrade: a release script shaped like
`node tools/changelog.mjs && oxfmt CHANGELOG.md`, run from `npm version`, now
dies after rewriting the changelog and before `git add`. Either drop the
explicit `oxfmt CHANGELOG.md` (it is a no-op once the file is ignored) or opt out
with `withoutIgnorePatterns`.

### If you can't run a TS config

```sh
pnpm exec magic-oxfmt-init expo      # writes .oxfmtrc.json
pnpm exec magic-oxfmt-init --help
```

This writes a **snapshot**. Bumping `magic-oxfmt-config` won't update it — rerun
the command. The `.mts` path is strictly better; use this only if the toolchain
forces plain JSON.

**Pick one config file, not both.** oxfmt accepts exactly one of
`.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, `oxfmt.config.mts` per
directory. Two present is not a precedence question — every later oxfmt run
dies with `Failed to load configuration file. Both '.oxfmtrc.json' and
'oxfmt.config.mts' found in <dir>` and exits 1. So `magic-oxfmt-init` refuses to
write next to an existing config rather than leaving you in that state, and
`--force` does not override it (it only covers overwriting the file you named).
Delete the other config first, or `--out` the snapshot elsewhere.

## House style

Prettier's defaults, which is what the incumbent `@magic/prettier-config` used
(it set no formatting overrides at all), so existing repos already look like this.

| Option           | Value      | Note                                       |
| ---------------- | ---------- | ------------------------------------------ |
| `printWidth`     | `80`       | oxfmt defaults to **100** — set explicitly |
| `singleQuote`    | `false`    | double quotes                              |
| `semi`           | `true`     |                                            |
| `trailingComma`  | `"all"`    |                                            |
| `arrowParens`    | `"always"` |                                            |
| `tabWidth`       | `2`        |                                            |
| `bracketSpacing` | `true`     |                                            |
| `endOfLine`      | `"lf"`     | oxfmt has no `"auto"`                      |

The MM mobile reference repo uses 120 columns and single quotes. We went with the
incumbent instead, so migrating repos don't get a whole-tree reflow on top of
everything else changing.

## Import order

Ported from the `importOrder` the prettier config used. oxfmt's sorter is a port
of `eslint-plugin-perfectionist`, so groups match by **glob**, not regex.

1. Type imports
2. Type imports from react / react-native, then next, then expo
3. Node builtins
4. react / react-native / react-dom
5. next
6. expo
7. Other third-party
8. Workspace-internal (`~/`, `@/`, `#`)
9. Parent, sibling, index relatives
10. Stylesheets

Two behaviours worth knowing:

- **Custom groups outrank predefined ones and are first-match-wins.** A bare
  `react` group would swallow `import type { ReactNode } from "react"` out of the
  type group, which is why the `-type` variants are listed first.
- **Side-effect imports don't move.** `sortSideEffects: false`, because the
  position of `import "react-native-gesture-handler"` _is_ its meaning.
- **`internalPattern` is the exception to the glob rule.** It takes literal
  prefixes (`"@/"`), not globs (`"@/**"`). A glob there matches nothing, without
  error, and every aliased import quietly sorts into the third-party group next
  to `zod`. Ours is `["~/", "@/", "#"]`; if your repo aliases something else,
  add the prefix.

`sortPackageJson` is on (scripts keep their authored order), so the first run
reorders keys in every `package.json`. Harmless, but expect the diff.

## Gotchas

- There is no `.oxfmtignore`. oxfmt honours `.gitignore`, `.prettierignore`, and
  the config's `ignorePatterns`.
- Put a blank line between a file-level doc comment and the first `import`.
  Otherwise the comment is treated as that import's leading comment and gets
  carried down the file when the imports sort.
- Unknown config keys are accepted without warning, so a typo fails open.

## Development

```sh
pnpm build && pnpm test
```

Tests run the real oxfmt binary and assert on the formatted output, including the
import order and the 80-column wrap.
