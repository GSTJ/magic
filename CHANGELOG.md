# Changelog

Versions are per package. This file records rounds, because the packages ship
together and most of what a consumer needs to know spans more than one of them.

## 2026-07-28 — A breaking major could automerge itself into every repo

No npm package changed. The round ships as `v1.12.0`; `v1` moves onto it. Every
repo extending `github>GSTJ/magic` picks the fix up on its next Renovate run.

### Fixed: `default.json` granted automerge on majors instead of denying it

The rule described as "Non-major bumps automerge everywhere. Majors always get a
human" matched `["minor", "patch", "pin", "digest"]`. That matcher cannot match
a major, so the rule granted automerge to everything else and denied it to
nothing. Nothing else in the file denied majors as a class either.

Renovate evaluates every entry in `packageRules` and the last one to set a key
wins, so three later rules decided it: `magic-{/,}**`, the posthog group and
`matchManagers: ["github-actions"]` all set `automerge: true` with no
`matchUpdateTypes`, which covers majors. `matchDepTypes: ["devDependencies"]` is
the first rule and nothing after it touched `automerge` for a plain dev
dependency, so its `true` survived to the end and carried those majors on its
own.

Measured with Renovate 43.286.0's own `applyPackageRules`, four of five major
cases automerged with no human:

| Update                               | Before    | After |
| ------------------------------------ | --------- | ----- |
| `magic-oxlint-config` 1.2.0 -> 2.0.0 | automerge | human |
| `chalk` 4.1.2 -> 5.0.0 (dev dep)     | automerge | human |
| `posthog-js` 1.x -> 2.0.0            | automerge | human |
| `actions/checkout` v4 -> v7          | automerge | human |
| `typescript` 7 -> 8                  | human     | human |

`typescript` was already held by a rule of its own, which is why it is the one
row that did not change.

`magic-oxlint-config@2.0.0` is the live one. It is breaking, it removed three
rule names, and oxlint treats an unknown rule name as a fatal config error and
exits 1. It is sitting in the three-day
`minimumReleaseAge` quarantine in at least one consumer right now, and before
this fix it would have merged itself when the quarantine expired.

The gate is one rule, `{ "matchUpdateTypes": ["major"], "automerge": false }`,
and it is the last entry in `packageRules`. Being last is what makes it hold:
anything above it is overridden, and anything appended below it wins instead.

### Changed: dev-scope majors need a human too

The old reasoning was that dev dependencies are not shipped to users, so they
can merge themselves. That bounds the runtime blast radius and says nothing
about the operational one. A devDependency major is exactly how a breaking lint
or TypeScript change reaches every repo on the same morning, which is what
`magic-oxlint-config@2.0.0` would have done. Non-major dev bumps still merge
themselves once CI is green.

The devDependencies rule itself is unchanged, and stays unrestricted on purpose.
Adding `matchUpdateTypes` to it looked like the tidy fix and quietly dropped
`rollback`, `replacement`, `pinDigest` and `lockFileMaintenance` out of
automerge along with the majors, because those are update types too. Swept every
type through `applyPackageRules` to confirm the shipped version moves exactly
one: `major`, true to false. The other nine are untouched.

### New: `validate-renovate`

`pnpm run validate-renovate` fails the build if the major gate is missing,
narrowed by a `match*` key, no longer last, or duplicated, if any other rule
grants automerge on a major, if a rule has no description, or if
`minimumReleaseAge` drifts off three days. Twelve tests, and it fails against
the version of `default.json` that shipped in `v1.11.0`.

It checks structure and not behaviour on purpose. Re-implementing Renovate's
matchers to assert what the preset does would be the same defect the preset
already had: a check that believes a claim nobody verified against the tool.
The behavioural before-and-after runs through Renovate's real
`applyPackageRules` and is attached to the PR.

## 2026-07-28 — The docs landing ships as a shadcn item

No npm package changed. The round ships as `v1.11.0`; `v1` moves onto it. New:
`registry.json` at the repo root, and four files under
`registry/default/docs-landing`.

### New: `pnpm dlx shadcn@latest add GSTJ/magic/docs-landing`

The block is the shell of a package landing page: header, hero, stat strip,
sections with three layouts and five tones, a demo frame, a release timeline, a
final CTA, a footer, and a clipboard button for the install command. Demos,
examples, palette overrides and copy stay in the repo that installs it.

It writes four editable files into `components/docs-landing/`, imported as
`@/components/docs-landing/*`, and installs `gsap@3.15.0`. The CLI reads
`registry.json` and the source files straight from raw.githubusercontent, so the
GitHub address works with nothing hosting the repo. `public/r` holds the flat
payloads for the HTTPS address the shadcn Registry Directory will want later.
Nothing serves them yet, and the README says so.

Motion is scoped to the landing root through `gsap.context` and
`gsap.matchMedia`, and reverts on unmount. Under
`prefers-reduced-motion: reduce` the reveal ScrollTriggers are never created, so
every element renders at full opacity with no scrolling and no JavaScript needed
to make text appear.

### New: `validate-registry`, and a typecheck for files that are not a package

`pnpm run validate-registry` checks catalog metadata, item names and types, the
declared file list, the embedded source, missing and extra output under
`public/r`, and whether the generated payloads have gone stale against the
sources. It runs in `check` and in the reusable CI job.

Nothing under `registry/` is a package, so no build compiles it and `turbo run
typecheck` never saw it. `registry/tsconfig.json` extends
`magic-tsconfig/nextjs` and `pnpm run typecheck` now runs it too. Without that,
a TypeScript or React bump breaks these four files in a consumer's repo and
this one stays green.

## 2026-07-28 — The react-native rules are ours now, and eslint is gone

`magic-oxlint-config@2.0.0` (**breaking**), `magic-oxlint-plugin@1.2.0`.

### Breaking: three rule names disappear from the react-native and expo variants

`react-native/no-raw-text`, `react-native/sort-styles` and
`react-native/split-platform-components` are no longer valid rule names under
these presets. All three were set to `off`, so nothing loses coverage, but the
`off` entries had to go with them: oxlint treats a rule name a loaded plugin does
not define as a fatal config error, not a warning
(`Rule 'no-raw-text' not found in plugin 'react-native'`, exit 1).

If a repo turned one of the three back on, bring upstream in under its own
namespace:

```ts
jsPlugins: [{ name: "rn-upstream", specifier: "eslint-plugin-react-native" }],
rules: { "rn-upstream/no-raw-text": "error" },
```

The name has to differ from `react-native`; the preset claims that one. Nothing
else changes. The four rules the preset actually runs keep their ids, so configs
and `// oxlint-disable-next-line react-native/no-inline-styles` comments are
untouched.

### `no-inline-styles`, `no-color-literals`, `no-single-element-style-arrays` and `no-unused-styles` now ship from `magic-oxlint-plugin`

Ported from `eslint-plugin-react-native@5.0.0` (MIT, attribution in
`packages/oxlint-plugin/THIRD-PARTY-NOTICES.md`) and wired under the same
`react-native` namespace, because oxlint takes the namespace from the
`jsPlugins` entry's `name`.

Parity was measured, not assumed: both plugins over the same 13-file corpus
under oxlint 1.75.0, covering every branch of the upstream collectors and the
component gate that decides whether `no-unused-styles` says anything at all. 40
diagnostics each, identical rule id, byte offset, span length and message text,
and identical `--fix` output.

Three deliberate divergences, all recorded in the rule files and in DECISIONS.md
§4. The one worth knowing: upstream throws a `TypeError` on a valueless
`<View style />`, and under oxlint that aborts the JS plugin host for the whole
file, so every rule in the plugin goes quiet on it. The port guards it.

`fixtures/adversarial/react-native` grew from 6 expectations to 19, and
`validate-rules.mjs` gained a pass that fails the build if a variant names a
`react-native/*` rule the plugin does not export, or exports one no variant
enables. `pnpm run check` is 95/95, up from 83/83.

### What it does to a consumer's tree

Measured on a fresh install into an empty project.

| | `magic-oxlint-config@1.2.0` | `@2.0.0` |
| --- | --- | --- |
| `npm i`, packages added | 90 | 3 |
| `.pnpm` directories | 90 | 3 |
| `eslint` | 9.39.5 | absent |
| `minimatch` / `brace-expansion` | 3.1.5 / 1.1.16 | absent |
| `npm audit` | 5 high | 0 |

GHSA-mh99-v99m-4gvg reached consumers because upstream declared a required
`eslint` peer that oxlint never calls, and `autoInstallPeers` honoured it. The
`packageExtensions` stanza from v1.8.1 fixed it for this repo only; every
consumer had to add their own. Now there is nothing to add.
`eslint-plugin-safe-jsx@1.3.2` shipped the same fix upstream on the other arm,
so `^1.3.0` picks it up on any fresh resolve.

## 2026-07-28 — No native oxlint cover for the react-native rules

No npm package changed. The round ships as `v1.8.3`; `v1` moves onto it.

### Documented: why `eslint-plugin-react-native` stays

DECISIONS.md section 4 already recorded one half, that vendoring the four rules
risks silent rule loss rather than a throw, because oxlint resolves `jsPlugins`
specifiers from the consumer's config directory. This adds the other half.

Checked against oxlint's own `configuration_schema.json`: 1.75.0 carries 998
rules and 1.76.0 carries 1001, both across the same fourteen plugin prefixes,
none of them `react-native`. All four rule names are absent from both, and
`"plugins": ["react-native"]` is refused with `Unknown plugin: 'react-native'`.
On a probe file the four plugin rules report 4 diagnostics and oxlint's nearest
native rules report 2, and those two are `react-perf` rules this preset turns
off on purpose. `no-color-literals` and `no-unused-styles` have no native
analogue.

The version is stated so a future reader re-checks against a later oxlint
instead of re-deriving the whole thing.

## 2026-07-28 — Which plugin pins eslint to 9, and what consumers can do

No npm package changed. The round ships as `v1.8.2`; `v1` moves onto it.

### Documented: pinning eslint on npm and yarn

The previous round took GHSA-mh99-v99m-4gvg out of this repo's lockfile.
`packageExtensions` is per-repo, so a consumer running
`npm i magic-oxlint-config@1.2.0` still resolves the vulnerable copy.

Measured per plugin, installed alone into an empty npm project.
`eslint-plugin-safe-jsx@1.3.1` allows an eslint `^10` peer and resolves to
10.8.0, `minimatch@10.2.6` and the patched `brace-expansion@5.0.8`.
`eslint-plugin-react-native@5.0.0` caps at `^9`, and eslint 9 is the last major
that still depends on `@eslint/eslintrc` and resolves `@eslint/config-array`
onto `minimatch@3`. Together the cap wins, so the react-native plugin is what
holds a consumer install on `brace-expansion@1.1.16`.

The README now carries the npm and yarn form beside the pnpm stanza:
`"overrides": { "eslint": "^10" }` and `"resolutions": { "eslint": "^10" }`.
Either takes a fresh install from 78 packages and `brace-expansion@1.1.16` to 62
and `5.0.8`, with all four react-native rules and `safe-jsx/jsx-explicit-boolean`
still loading. The pnpm `packageExtensions` stanza does better, 92 `.pnpm`
directories to 6 with no `brace-expansion` at all.

### Assessed: vendoring the react-native rules into `magic-oxlint-plugin`

Not done. It is four rules rather than the two DECISIONS.md section 4 assumed,
and about 1230 lines once `lib/util/Components` and `lib/util/stylesheet` come
along, because `no-unused-styles` gates its `Program:exit` on
`components.all()`. The blocker is the `jsPlugins` specifier, which oxlint
resolves from the consumer's config directory: a wrong vendored specifier does
not throw, it silently stops the four rules reporting. Section 4 records what a
revisit needs, starting with fixtures asserting identical diagnostics on real
consumer code.

## 2026-07-28 — Dropping the unused eslint tree

No npm package changed. The round ships as `v1.8.1`; `v1` moves onto it.

### Fixed: `brace-expansion` GHSA-mh99-v99m-4gvg is out of the lockfile

CVE-2026-14257, unbounded expansion length, CVSS 7.5. The one vulnerable copy
was `brace-expansion@1.1.16` under `minimatch@3.1.5`, and it arrived through
eslint 9, which `autoInstallPeers` installs to satisfy the required `eslint`
peer on the two JS plugins `magic-oxlint-config` bundles. Nothing calls it:
oxlint loads both plugins through its own jsPlugin host.

There was no version to move to. `minimatch@3.1.5` pins `^1.1.7`; 1.1.16 is the
tip of the v1 line and its only change over 1.1.15 turns the `{a},b}` rewrite's
recursion into a loop, with no `maxLength` bound, so it still aborts at exit 134
on the advisory's own `'{a,b}'.repeat(1500)`. The backports went to 2.1.3,
3.0.3/3.0.4/3.0.5 and 5.0.8, and 3.x/5.x export a namespace instead of the
function, so `minimatch@3`'s `expand(pattern)` throws
`TypeError: expand is not a function` under either.

A `packageExtensions` block in `pnpm-workspace.yaml` marks the `eslint` peer
optional on both plugins instead. DECISIONS.md section 4 asks for that same fix
at the source; this applies it locally. The install goes from 187 resolved
packages to 101 and `brace-expansion` is left at 5.0.8 under ts-morph.
`pnpm run check` holds at 83/83, `safe-jsx(jsx-explicit-boolean)` and the
`eslint-plugin-react-native` jsPlugin both still load and fire.

### Changed: the README's pnpm recommendation

It said `peerDependencyRules.ignoreMissing: ["eslint"]`. On pnpm 11.17.0 that
silences the missing-peer warning and installs eslint anyway; a repro with one
dependency on `eslint-plugin-react-native@5.0.0` gives a byte-identical lockfile
with the block and without it. The README hands consumers the
`packageExtensions` block above now.

## 2026-07-28 — CI: the check job can go to the Mac too

No npm package changed. Everything here is in `.github/workflows/ci.yml` and the
README. The round ships as `v1.8.0`; `v1` moves onto it.

### Added: runner routing in `ci.yml`, in `e2e-ios.yml`'s dialect

`ci.yml` was `runs-on: ubuntu-latest` and nothing else. On a repo whose hosted
Actions billing has lapsed that is a workflow that cannot run at all — the job is
dispatched, dies in about three seconds with zero steps, and the repo has no CI.
The four inputs `e2e-ios.yml` already had now exist here too, spelled and
behaving identically, because one decision with two dialects is two bugs:

```yaml
with:
  runner-labels: '["self-hosted","macos-local"]'
  hosted-fallback-labels: '["ubuntu-latest"]'
  runner-heartbeat: ${{ vars.MAC_RUNNER_HEARTBEAT }}
  heartbeat-max-age-seconds: 600 # the default
```

A `🧭 Route` job — `ubuntu-latest`, `continue-on-error`, only present when
`hosted-fallback-labels` is set — compares the beacon against the window and
picks. The check job carries `needs: [route]` with `if: ${{ !cancelled() }}` and
reads `needs.route.outputs.labels || inputs.runs-on || inputs.runner-labels`, so
a router that was killed on arrival costs nothing: the output is empty, the chain
falls through to `runner-labels`, and the checks run. Routing that can stop the
work it is routing is worse than no routing, which is the lesson from the round
before this one.

The beacon is not a live lookup, for the reason it never can be:
`gh api repos/{repo}/actions/runners` needs the `administration` permission,
which `GITHUB_TOKEN` cannot hold under any `permissions:` block. A timer on the
Mac publishes `MAC_RUNNER_HEARTBEAT` as a repo variable instead, and
`vars.MAC_RUNNER_HEARTBEAT` is readable from any workflow for free.

### Unchanged: everything a consumer already depends on

Ten repos call this workflow and several require its context by name
(`ci / 👮 Lint, Format, Typecheck`, `checks / 👮 Lint, Format, Typecheck`). A
renamed context does not fail, it silently wedges every merge in that repo, so
the no-input path is byte-identical on purpose:

- the job is still `checkup`, still named `${{ inputs.job-name }}`, still
  defaulting to `👮 Lint, Format, Typecheck`. No `name:` gained an expression
  that could render literally when something upstream is skipped;
- `runs-on` resolves to the string `ubuntu-latest` — `fromJSON('"ubuntu-latest"')`,
  not a one-element array — so it is the same value the job had before;
- the `runs-on` **input** still works. Its default changed from `ubuntu-latest`
  to empty, which changes nothing: with neither input set the base is
  `runner-labels`, whose default is `ubuntu-latest`. Setting it still wins, and
  it is now the base the router starts from rather than a second way to say the
  same thing;
- `🧭 Route` is skipped when `hosted-fallback-labels` is unset. It shows up in
  the PR checks with a neutral conclusion, which satisfies nothing and blocks
  nothing.

### Changed: the pnpm store cache is hosted-only

New input `pnpm-store-cache: auto | true | false`, `auto` meaning "true on a
GitHub-hosted runner". On a persistent machine the store is already on disk and
shared with every other workflow there, and `hardlink` — what `setup` picks
off-hosted — is what makes installing from it nearly free. Restoring a cached
copy over it buys a download and a repack at the end. Hosted runners keep the
cache, where the disk is new every time.

`turbo-cache` stays on everywhere, deliberately: turbo reads its local cache
first and only reaches the Actions backend on a miss, so a warm machine never
pays for it, and a workspace some other workflow cleaned still gets its outputs
back instead of rebuilding them.

## 2026-07-28 — CI: what the first iOS E2E adoption found

No npm package changed. Everything here is in `.github/`. The round shipped as
`v1.7.0`, `v1.7.1` and `v1.7.2`; `v1` moves onto the last of them.

`would-you-rather` adopted `e2e-ios.yml@v1` the day it shipped and found seven
things, all of them by running into them. Every fix below has the run that
caused it.

### Fixed: `xcodebuild -version | head -1` could abort the build

`head` exits after the line it wanted, `xcodebuild` takes SIGPIPE writing the
next one, and its Objective-C runtime turns that into an
`NSFileHandleOperationException` abort — **exit 134**, which `set -o pipefail`
then makes the step's exit code. It needs `head` to win a race, so it is
intermittent, and it killed a real master run while only ever trying to read a
version string.

Every `| head` under `pipefail` in this repo is gone: the version is sliced with
parameter expansion, the workspace comes from a glob, and the two `find | head -1`
sites write a file and `read` the first line. `| tail` is fine and stays — tail
drains its input, so nothing is ever writing to a closed pipe.

### Changed: routing cannot take the suite down any more

`preflight` was one Ubuntu job doing three jobs' work, and it hard-gated the
macOS one. On a repo whose Actions billing has lapsed no `ubuntu-latest` job can
start at all, so the router failed on arrival, the E2E job refused to start, and
the suite silently stopped running (would-you-rather run 30324571838). It is now
three separate things, each answering to what it actually is:

| Job                  | When                          | Can it stop a merge?         |
| -------------------- | ----------------------------- | ---------------------------- |
| `🧭 Route`           | `hosted-fallback-labels` set  | No — `continue-on-error`     |
| `🚧 Quarantine lint` | `quarantine-file` set         | Yes, on purpose              |
| shard plan           | a step in the build job       | Yes, but it is the sharded shape's own input |

Consumers read `needs.route.outputs.labels || inputs.runner-labels`, so a router
that never ran costs nothing. The shard plan moved onto the macOS runner as the
build job's first step — before the checkout, so a malformed `shards` still
fails in seconds — which takes Ubuntu off the sharded path too.

A repo that was working around this with its own `route` job (there is one) can
delete it and pass `hosted-fallback-labels` instead.

### Fixed: `APP_ID` never reached the flows

`run-maestro` resolved the bundle id and then did not pass it. The Expo
templates write `appId: ${APP_ID}`, Maestro leaves an undefined variable as that
literal string, and the failure reads as "app not installed" rather than as a
missing variable — so the repos that hit it pasted their bundle id into
`maestro-env`, a second copy of a value read out of the built `Info.plist` a
step earlier. `-e APP_ID=<resolved>` is passed now, `app-id: off` opts out, and
an `APP_ID=` line in `maestro-env` still wins.

### Fixed: `native-cache-paths` missed the file that names the app

The default list did not include `env.js`/`env.ts`, which is where the obytes
Expo template computes `BUNDLE_ID` and `NAME` — so editing it changed
`Info.plist` while the `ios/` cache key did not move, and the build served the
old bundle. `<app>/env.*` and `Gemfile.lock` are on the list now, and the list
is printed in the log on every run.

The default also *reached* nobody through `e2e-ios.yml`: an action default
applies when an input is absent, and a reusable workflow forwarding its own
unset input passes `""` instead. The list lives in the step's environment now
and an empty input falls back to it, which is the only arrangement where both
callers get the same thing.

### New: `upload-artifacts`, and why flake stats need `always`

`e2e-ios.yml` never exposed `run-maestro`'s `upload-artifacts`, so a green run
uploaded no JUnit report — which quietly contradicts the flake-statistics recipe
in the README, because a flaky flow passes some of the time by definition and a
history of red runs alone has no denominator. Exposed, `on-failure` by default,
`always` documented as the thing flake stats require.

### New: `cache-maestro`, off where the cache is a liability

`~/.maestro` was cached unconditionally: 332 MB, 3m51 to upload cold, and on a
self-hosted Mac it is the login user's own Maestro install with their run
history under it. `auto` now means hosted-only. A runner that keeps its disk
does not need a cache of a directory it already has.

### Fixed: a warm DerivedData was never being used — three causes, all of them

The headline of this round, and it took three fixes because each cause hid the
next one. Fixing them one at a time moved the measured build time by zero
seconds, twice, before the third landed.

**1. The workspace was thrown away every run.** `actions/checkout` defaults to
`clean: true`, which is `git clean -ffdx` — `node_modules` and `ios/` deleted.
The run then paid to restore `ios/` from a cache of a directory it had just
had, and the reinstalled `node_modules` made React Native's codegen re-emit
`ios/build/generated/**`: 84 files, identical byte for byte, each with a fresh
mtime. Xcode reads mtimes, so `ReactCodegen` recompiled and with it every pod
whose headers come from it. Left alone, `pnpm install --frozen-lockfile`
finishes in 194 ms with "Already up to date" and moves nothing.

`checkout-clean` is now `false` off a GitHub-hosted runner, and an `ios/` that
survives is reused from the workspace under a key stamp instead of being
restored over itself — the restore would put the archive's mtimes back and undo
the fix.

**2. The simulator changed every run.** Off a GitHub-hosted runner this action created a
simulator per run and deleted it afterwards. The UDID goes into `-destination`,
`-destination` goes into the build description, and a build description that
changed every run invalidated every target — so the persistent DerivedData was
restored, reported as a hit, and then recompiled from scratch, every time, for
as long as it has existed.

Measured on one Mac: same sources, same settings, same warm 2.0 GB tree, only
the device differing.

| Build                  | Wall | Compile tasks |
| ---------------------- | ---- | ------------- |
| repeat, same UDID      | 24s  | 4             |
| repeat, different UDID | 69s  | 310           |

`reuse-device` (auto: on off a hosted runner) keeps one device named
`magic-e2e` between runs and erases it before each, so it starts as clean as a
fresh one and keeps only its identity. The stale-device sweep still runs — it
now keeps one instead of removing them all, which is what it was really for.

**3. The install handed back different files.** See `package-import-method`
below.

### New: `package-import-method`, the third cause

pnpm's default `auto` clones (APFS copy-on-write), and a clone is a **new inode
with a new mtime** for every file. `actions/checkout` cleans ignored files, so
`node_modules` is reinstalled every run and every file in it came back newer
than the object files built from it — a full recompile of React Native's pods
on its own, independent of the simulator. `auto` now means `hardlink` off a
GitHub-hosted runner — same inodes, same mtimes — and pnpm's own default on one,
where nothing survives the job anyway.

This one was found first and fixed first, and on its own it changed nothing —
the simulator churn was already invalidating the build, and behind that the
workspace wipe was regenerating codegen. All three had to go.

Set in the environment for the install step only; nothing writes an `.npmrc`.
Which variable does the work depends on the pnpm version, measured by counting
hard links on the installed file, so the action sets both:

| pnpm  | `npm_config_package_import_method` | `PNPM_CONFIG_PACKAGE_IMPORT_METHOD` |
| ----- | ---------------------------------- | ----------------------------------- |
| 9, 10 | ✅                                 | ❌                                  |
| 11    | ❌                                 | ✅                                  |

pnpm 11 stopped reading `npm_config_*` at all — `npm_config_store_dir` does not
move the store either. Worth knowing before reaching for that prefix again.

### Fixed: a check called `🧪 ${{ matrix.shard.name }}`

A `name:` holding a matrix expression is rendered *literally* when the job is
skipped, and the unsharded shape — the default — skips it every run. So every
consumer carried a PR check named after the template. The shard job has no
`name:` now and the matrix vector is the bare shard name, which is what makes
GitHub's own naming do the right thing in both directions: `shard (core)` when
the matrix expands, plain `shard` when it does not.

## 2026-07-27 — CI: reusable iOS E2E

No npm package changed. Everything here is in `.github/`. The repo tag for this
round is `v1.6.0` — a minor, because `e2e-ios.yml` and two composites are new
and nothing existing changed shape — and `v1` moves onto it.

Three repos had hand-rolled Maestro pipelines with the same bugs in different
places, and a fourth had 87 flow YAMLs that CI never ran at all. This is the
union of what was measured across them, with every dead end left out.

### New: `GSTJ/magic/.github/workflows/e2e-ios.yml@v1`

```yaml
jobs:
  e2e:
    uses: GSTJ/magic/.github/workflows/e2e-ios.yml@v1
    with:
      app-dir: apps/mobile
```

Prebuild, pods, `xcodebuild`, boot, install, flows, report, artifacts. Three job
topologies behind one input: `shards: "0"` is one macOS job (the default),
`shards: "3"` deals independent flows round-robin across a matrix, and a JSON
array names the shards for a suite whose flows share a fixture. Per-shard
`soft: true` reports without gating.

Measured on the repos it came from: 44m25 → 19m13 and 22m04 → 8m32 on hosted
runners, 6m41–12m18 on a Mac mini. The README section has the full table of
which default bought what.

### New: two composites

| Action                                        | What it is                                                       |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `GSTJ/magic/.github/actions/build-ios-app@v1` | prebuild + pods + `xcodebuild`, single-arch, three caches         |
| `GSTJ/magic/.github/actions/run-maestro@v1`   | install, launch probe, deep link, flows, JUnit summary, artifacts |

Both are usable on their own when a repo needs a shape the workflow does not
have.

### Changed: `setup-ios-e2e`

- `simulator-device` and `simulator-runtime` now default to empty, meaning
  "newest available". They used to default to `iPhone 17 Pro Max` / `iOS 26`,
  which is a pin against a runner image that drops runtimes without warning.
- The device picker ranks iPhones by generation and then Pro Max > Pro > Plus >
  plain > mini. It used to take the last entry, which is neither: a runtime
  lists its device types in Apple's order (last is an iPhone 11), and sorting by
  name puts "iPhone 9" above "iPhone 17".
- `boot: "false"` starts the boot without waiting, so it overlaps the compile.
  Measured: booting before `pnpm install` cost 220s on Setup Node, waiting after
  the build left the flows at 457s instead of 165s.
- The wait is bounded (`boot-timeout-seconds`, default 240) and erases and
  retries once. `simctl bootstatus -b` never returns on a wedged device, and an
  unbounded step already ate a cancelled hour at 10x macOS billing.
- `create-device` makes a dedicated device off a self-hosted runner and sweeps
  the ones earlier runs left behind. A hosted runner is destroyed after the job;
  a Mac mini accumulates one full disk image per run.

### New: quarantine, with an expiry

Point `quarantine-file` at a list of flow stems and they stop running and stop
failing the build. The `preflight` job lints the file first: `reason:`,
`owner:` and `added:` are all required, and an entry older than 30 days turns
the workflow red. Without the decay rule a quarantine file is a list of tests
that quietly stopped mattering.

Flake statistics across runs stayed a recipe rather than an action — see the
README. It needs your workflow filename, your artifact names and a suite-to-flow
mapping that depends on `per-flow`, and an action taking five inputs to express
those is harder to read than the Python it would replace. What is guaranteed is
the input side: a JUnit report per shard, named after the shard, on every run.

### Fixed: `validate-workflows` and prose

`pnpm install` inside a comment no longer counts as a missing
`--frozen-lockfile`.

## 2026-07-27 — magic-observability 1.0.0

New package. One PostHog layer for every product, replacing the two hand-rolled
ones that existed (pegada's and chatmode's, with different designs) and the
nothing that existed in the other five repos. No other package changed.

```sh
pnpm add magic-observability
# plus the one SDK your platform needs — all five are optional peers
```

### Five entry points, and why

| Import                         | For                                     | You install                    |
| ------------------------------ | --------------------------------------- | ------------------------------ |
| `magic-observability`          | types and helpers, no SDK               | nothing                        |
| `magic-observability/web`      | browser: Next client bundle, Vite SPA   | `posthog-js`                   |
| `magic-observability/react`    | provider, boundary, `usePostHog`        | `posthog-js`, `@posthog/react` |
| `magic-observability/next`     | Next **server**: `onRequestError`, RSC  | `posthog-node`                 |
| `magic-observability/node`     | workers, queue consumers, CLIs          | `posthog-node`                 |
| `magic-observability/expo`     | Expo and bare React Native              | `posthog-react-native`         |
| `magic-observability/boundary` | the error boundary on its own           | `react`                        |

The split is not tidiness. `posthog-js` in a Hermes bundle is dead weight and
`posthog-node` in a browser chunk does not build at all, and nothing in
TypeScript stops one convenience re-export from wiring them together. So
`pnpm run validate-observability` — new, in the `check` chain and in self-CI —
walks the *built* module graph from every entry point and fails the build if one
of them can reach an SDK it has no business reaching.

### What it does that a `posthog.init` call does not

- **Error tracking is on by default, in code, on all three platforms.** On the
  web PostHog makes exception autocapture a project setting; `initWebAnalytics`
  sets `capture_exceptions: true` so a fresh project reports from the first
  deploy instead of waiting for someone to find a toggle. It is the first signal
  source self-driving reads.
- **`captureError(error, context)` normalises whatever was thrown.** `throw
  "nope"` and `throw { code: 500 }` are legal and produce an exception with no
  stack; error-shaped objects are rebuilt, everything else becomes a searchable
  `NonError`. chatmode's `Logger.error` did this by hand and pegada's `sendError`
  did not.
- **Nested context is flattened to dotted keys**, three deep, with `undefined`
  dropped. PostHog's property filters work on scalars.
- **One error boundary for web and React Native.** A plain class component built
  with `createElement`, so it needs neither a JSX runtime nor `react-native`'s
  types, and it takes a client rather than an SDK.
- **Serverless flush timings are a named option**, not a thing each repo
  rediscovers: `runtime: "serverless"` is `flushAt: 1, flushInterval: 0`.
- **`onRequestError` for Next** skips the edge runtime, reads `distinct_id` off
  the `ph_phc_*_posthog` cookie so server exceptions join the right person, and
  flushes before the function freezes.

### No key, no noise

With no key resolved, every `init*` returns a no-op client and **nothing is
written to the console**, in any code path. A repo cloned without a `.env`
boots; a dev who never set a token is not nagged. If you want to know, pass
`onDisabled` / `onInternalError`.

### Env var convention

`NEXT_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`, `POSTHOG_KEY`, each with a
matching `_HOST`. Host defaults to `https://us.i.posthog.com`.

Vite is the exception and the README says so: Vite does not populate
`process.env` in the browser, so a Vite app passes
`key: import.meta.env.VITE_POSTHOG_KEY` explicitly. `import.meta.env.VITE_*` is
only substituted where it is written literally, and a library cannot write it on
your behalf.

### Still manual, in PostHog's UI

Project creation and the token, putting that token in Vercel/EAS/Actions,
turning on session replay, the project-level exception-autocapture setting that
gates native crash capture, and a personal API key for source map upload. And
self-driving itself: it is open beta, a closed loop rather than an SDK feature,
enabled with `npx @posthog/wizard self-driving`, and it needs AI data processing
turned on at the organisation level. The two things it wants from the app —
events flowing and error tracking on — are what this package defaults to. See
the [package README](packages/observability#what-still-has-to-be-done-by-hand-in-posthog).

## 2026-07-27 — `magic/no-manual-classname` in magic-oxlint-plugin 1.1.0

One new opt-in rule. No other package changed, and no preset turns it on.

`magic/no-manual-classname` bans composing a `className` by hand: template
literals with interpolations, `+` concatenation, a ternary or `&&` inside the
attribute, and the same shapes assembled into a `const` one line above the JSX.
Composition goes through `cn()`; a variant axis goes through `cva` or `tv`.

```ts
// oxlint.config.mts
import { extendConfig } from "magic-oxlint-config";
import react from "magic-oxlint-config/react";

export default extendConfig(react, {
  jsPlugins: [{ name: "magic", specifier: "magic-oxlint-plugin" }],
  rules: { "magic/no-manual-classname": "error" },
});
```

Options are `attributes` (default `["className", "class"]`, for NativeWind's
extra class props) and `composers` (default `["cn", "cva", "twMerge", "clsx",
"cx"]`, which picks the helper name the diagnostics recommend). The rule
inspects the shape of the attribute's value and nothing inside a call, so
`cn(cond ? a : b)` passes.

Measured against these repos before it shipped: 22 reports in
gabriel-taveira-portfolio, 11 in chatmode, 6 in invest-radar, 1 in
padrinhos-ana-julia-gabriel, 0 in e-card, pegada and would-you-rather. Not
auto-fixable, on purpose: wrapping the expression in `cn()` renders the
identical string, and splitting it into the right arguments is a judgement call.
See [DECISIONS.md](DECISIONS.md) section 10 and the [plugin
README](packages/oxlint-plugin#magicno-manual-classname).

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
