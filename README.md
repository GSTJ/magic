<p align="center">
  <img alt="A tour of the repo: the magic mark, a file fixing its own lint, formatting and import order, the shared CI checks going green, and the theme palette washing through" src="https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-demo.gif" />
</p>

<p align="center">Change a lint rule or a CI step once. Every repo importing this one picks it up on its next run.</p>

<p align="center">
  <a href="https://gstj.github.io/magic/">Docs</a> | <a href="https://github.com/GSTJ/magic">GitHub</a>
</p>

## How it works

1. The packages below carry the configs. Projects consume them by re-export, so every field
   applies and a version bump is the whole upgrade. oxlint replaces ESLint; oxfmt replaces
   Prettier and `@ianvs/prettier-plugin-sort-imports`.
2. `.github/workflows` carries the CI: reusable `workflow_call` jobs and composite actions,
   consumed by tag (`@v1`). A fix lands here once and reaches every repo on its next run.
3. `default.json` at the root carries the Renovate policy, consumable as `github>GSTJ/magic`.

## Install

```sh
pnpm add -D oxlint oxfmt magic-oxlint-config magic-oxfmt-config magic-tsconfig
```

Pin `oxlint` and `oxfmt` exactly: both add and remove rules between minors, and an unknown rule
name is a fatal config error. Next, follow the
[setup for your project type](.github/workflows/README.md#setup-by-project-type) in the adoption
guide: four steps, with a copy-paste block for your project type.

## Packages

Each one has its own README with the full detail.

- [`magic-oxlint-config`](packages/oxlint-config) is the oxlint presets, one per project type (see
  the package README).
- [`magic-oxfmt-config`](packages/oxfmt-config) is the oxfmt config, import sort order included.
- [`magic-oxlint-plugin`](packages/oxlint-plugin) is opt-in lint rules with no oxlint equivalent.
- [`magic-tsconfig`](packages/tsconfig) is the TypeScript bases, one per project type (see the
  package README).
- [`magic-codemods`](packages/codemods) is `magic-kebab`, the kebab-case filename migration.
- [`magic-observability`](packages/observability) is PostHog init, `captureError`, and an error
  boundary, per platform.
- [`magic-docs`](packages/docs) is the Fumadocs setup end to end, theme through Pages deploy (see
  the package README for the pieces).
- [`magic-theme`](packages/theme) is Magic Theme, ported across editors and terminals (see the
  package README for which ones).
- [`magic-readmes`](packages/readme) is the README standard as code: a template, an `init`
  scaffold, and the `check` validator this repo runs on itself.
- [`magic-video`](packages/video) is the Remotion source for every README hero image and clip
  in `media/` (see the package README).
- `GSTJ/magic/docs-landing` is the editable shadcn block for dark package landing pages; see
  [its section in the adoption guide](.github/workflows/README.md#docs-landing-block).

Every image these READMEs embed is rendered by [`magic-video`](packages/video), which draws
from `magic-theme`'s own palette; nothing is hand-screenshotted.

## CI and automation

`.github/workflows` ships the reusable CI jobs ([`ci.yml`](.github/workflows/ci.yml),
[`release.yml`](.github/workflows/release.yml), [`e2e-ios.yml`](.github/workflows/e2e-ios.yml)) and
the composite actions they are built from, consumed by tag (`@v1`). Every adoption detail and
gotcha lives in the [adoption guide](.github/workflows/README.md).

## Development

```sh
pnpm install
pnpm run check   # build, validate rules, lint, format, typecheck, test, smoke
```

`pnpm run smoke` lints `fixtures/smoke` (a deliberately broken file) and asserts on exactly which
rules fire. If a config change stops catching leaked `&&` JSX or `process.env` access, that's
where it fails.

`pnpm run validate-rules` checks every rule name in every preset against oxlint's own shipped
JSON schema. Run it after any oxlint bump.

`pnpm run validate-readmes` holds every README here, this one included, to the same
`magic-readme check` the [readme package](packages/readme) publishes.

`pnpm run validate-observability` walks `magic-observability`'s built module graph from each
entry point and fails if one of them can reach an SDK it has no business reaching (`posthog-js`
from `/expo`, `posthog-node` from `/web`). That split is the package's whole reason for having
five entry points, nothing in TypeScript enforces it, and it would otherwise break in a
consumer's bundler weeks later.

`pnpm run adversarial` runs `fixtures/adversarial`, end-to-end expected-outcome checks against the
real binaries. See the fixture files for exactly what's covered.
