# magic-codemods

Migration codemods for GSTJ projects. One binary today:

**`magic-kebab`** — renames files to kebab-case and rewrites every import that
pointed at them, so `unicorn/filename-case` can be turned on in a repo without a
week of hand-editing.

```sh
pnpm add -D magic-codemods
```

## Why this exists

`magic-oxlint-config` enables `unicorn/filename-case` at `kebabCase` in `base`,
which means every repo adopting the preset has a pile of `Button.tsx` and
`formatDate.ts` to deal with at once. Doing that by hand is a large, boring,
error-prone diff in the middle of a migration that is already changing
everything else. Doing it with `find | xargs mv` breaks every import in the repo
and, on macOS, silently does nothing at all for the case-only renames.

## Use it

Always in this order:

```sh
# 1. Land on a clean tree. The codemod refuses to run otherwise.
git status

# 2. Look at the plan. This changes nothing.
pnpm exec magic-kebab --dry-run

# 3. Read the SKIPPED, NEEDS REVIEW and CONFLICTS sections. Really read them.
#    Anything under CONFLICTS has to be resolved before --write does anything
#    useful for those files.

# 4. Apply.
pnpm exec magic-kebab --write

# 5. Verify, then commit as one rename-only commit.
pnpm exec tsc --noEmit && pnpm run lint && pnpm run test
git add -A && git commit -m "refactor: kebab-case filenames"
```

Commit the renames on their own. `git log --follow` survives this codemod
because git infers renames from content similarity at diff time, and a commit
that _only_ renames gives it the easiest possible job. Mixing a refactor into
the same commit is what breaks history.

### Options

```
--write               Apply the plan: rewrite specifiers, then git mv the files.
--dry-run             Explicit form of the default. Mutually exclusive with --write.
--detect <mode>       oxlint (default) | builtin
--root <dir>          Where to start looking for the repo. Default: cwd.
--tsconfig <path>     tsconfig whose `paths` drive alias rewriting.
--rename <old=new>    Override one target basename. Repeatable.
--allow-dirty         Skip the clean-tree check.
--strict              Exit 1 if anything needs manual review.
--json                Emit the whole result as JSON.
```

Positional arguments scope the run: `magic-kebab --dry-run src/components`.

Exit codes: `0` success, `1` refused (dirty tree, bad arguments) or the plan has
conflicts, or `--strict` and something needs review.

### `--detect oxlint` vs `--detect builtin`

The default asks **the repo's own oxlint** what is wrong and reads the
`unicorn(filename-case)` diagnostics, including the rename target out of the
diagnostic's own `help` text. That is the only way to be sure the codemod and CI
agree: the repo's `ignore` list, its `overrides`, its `ignorePatterns` all apply
for free, because the linter is the one answering.

`--detect builtin` applies this package's own copy of the rule to every tracked
file. Use it before a repo has adopted the preset, or when a full lint is too
slow. It knows nothing about that repo's exemptions, so it reports more — which
is where the skip list below comes in. `test/kebab.test.mjs` generates a corpus,
runs the real binary over it, and fails if the two ever disagree on a single
name.

Do **not** try to speed the default up with `oxlint -A all -D unicorn/filename-case`.
Verified on 1.75.0: `-D <rule>` re-enables the rule with its _default_ options
and throws away the config's `ignore` list, so a run scoped that way reports
every `[postId].tsx` in the repo.

## What it rewrites

| Form                                                                  | Handled      |
| --------------------------------------------------------------------- | ------------ |
| `import x from "./Button"` / `import type`                            | rewritten    |
| `export { x } from "./Button"`, `export * from`                       | rewritten    |
| `import("./Button")`, `typeof import("./Button")`                     | rewritten    |
| `require("./Button")`, `require.resolve(...)`                         | rewritten    |
| `jest.mock`, `vi.mock`, `requireActual`, `importActual`, and the rest | rewritten    |
| tsconfig `paths` aliases (`@/components/Button`)                      | rewritten    |
| `.js` specifiers standing in for `.ts` files (NodeNext)               | rewritten    |
| `import(`./${name}`)` and other computed specifiers                   | **reported** |
| `moduleNameMapper`, `resolve.alias`, bundler configs                  | **reported** |
| `package.json` `main` / `exports` / `bin`, `.md` docs, YAML           | **reported** |

The split is deliberate. A `moduleNameMapper` key is a _regex_ whose escaping
belongs to whoever wrote it, and a `package.json` `exports` path is a published
contract. Guessing at either is how a codemod turns a lint fix into an outage, so
those are printed under `NEEDS REVIEW` and left exactly as they were.

One invariant makes the rest tractable: **directories never move.** Only the
basename stem changes, so only the last segment of any specifier is ever touched.

## What it refuses to rename

Framework conventions where the filename _is_ behaviour. These are also exempt in
`magic-oxlint-config`, and the two lists have to agree — anything the codemod
skips but the linter reports leaves a repo with an error that has no automated
fix.

| Pattern                        | Why                                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[postId].tsx`, `[[...x]].tsx` | The bracketed text is a route parameter name — it becomes `params.postId`. Renaming it changes the route contract, not the file. Next.js, expo-router, TanStack Router. |
| `__mocks__/AsyncStorage.ts`    | jest and vitest match `__mocks__/<x>` against the _module being mocked_. The name belongs to the package.                                                               |
| `App.tsx`                      | Bare RN's `index.js` imports `./App`, and classic Expo points `main` at `node_modules/expo/AppEntry.js` whose `import App from "../../App"` no codemod can reach.       |

A `__mocks__/Button.ts` sitting next to a `Button.tsx` **is** renamed, in lockstep
with its module — that one mocks something the repo owns.

`--rename Old.tsx=whatever.tsx` overrides the target and is the one thing that
gets past the skip list, for when a human has decided otherwise. It overrides a
target for a file the detector already reported; it is not a way to add files.

## Rename targets come from oxlint

The target is taken verbatim from the diagnostic's `help` field
(`Rename the file to 'pascal-thing.ts'`), so what you get is exactly what the
linter asked for. Its word-splitting has some sharp corners:

| Before                 | After                   |
| ---------------------- | ----------------------- |
| `HTTPServer.ts`        | `http-server.ts`        |
| `parseURLQuery.ts`     | `parse-url-query.ts`    |
| `MyComponent.test.tsx` | `my-component.test.tsx` |
| `Theme.ios.ts`         | `theme.ios.ts`          |
| `_Private.ts`          | `_private.ts`           |
| `S3.ts`                | `s-3.ts`                |
| `AppV2.ts`             | `app-v-2.ts`            |
| `OAuth2Client.ts`      | `o-auth2-client.ts`     |

The last three are ugly and they are what the rule wants. `--dry-run` is where
you catch them; `--rename S3.ts=s3.ts` is how you fix them.

## Two-step renames, and why

macOS ships APFS case-insensitive, so `Button.tsx` and `button.tsx` are the same
path. `git mv Button.tsx button.tsx` there is either refused as "destination
exists" or, with `-f`, becomes a no-op that still updates the index — producing a
commit that claims a rename the working tree never performed, and a file that
only appears once someone checks out on Linux.

Every rename therefore goes through a third name, unconditionally:

```
git mv Button.tsx .magic-kebab-tmp-…
git mv .magic-kebab-tmp-… button.tsx
```

This is invisible in history. Git records no rename operation in a commit at all;
it infers renames from content similarity when you ask for a diff. Two `git mv`s
before one commit produce exactly one rename in that commit.

## Programmatic use

```ts
import { runKebabCodemod, summarise } from "magic-codemods";

const result = runKebabCodemod({
  cwd: process.cwd(),
  paths: [],
  write: false,
  allowDirty: false,
  detect: "oxlint",
  tsconfig: undefined,
  overrides: new Map(),
});

console.log(summarise(result));
```

`isKebabCase`, `kebabifyBasename` and `skipReasonFor` are exported too, for
anything that needs to ask the same questions without running the whole codemod.
