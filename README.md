<p align="center">
  <img alt="The magic social card: the sparkle mark and wordmark on the theme's night background" src="https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-social.png" />
</p>

<p align="center">Lint, format, TypeScript, CI, and Renovate settings in one place. Twelve repos stop each having their own slightly-wrong version.</p>

<p align="center">
  <a aria-label="GitHub stars" href="https://github.com/GSTJ/magic/stargazers"><img alt="GitHub stars" src="https://shieldcn.dev/github/GSTJ/magic/stars.svg?variant=branded&size=xs&mode=light" /></a>
  <a aria-label="license" href="https://github.com/GSTJ/magic/blob/main/LICENSE"><img alt="license" src="https://shieldcn.dev/github/GSTJ/magic/license.svg?variant=branded&size=xs&mode=light" /></a>
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
pnpm add -D oxlint@1.75.0 oxfmt@0.60.0 magic-oxlint-config magic-oxfmt-config magic-tsconfig
```

Pin `oxlint` and `oxfmt` exactly: both add and remove rules between minors, and an unknown rule
name is a fatal config error. Then follow the
[setup for your project type](.github/workflows/README.md#setup-by-project-type) in the adoption
guide: four steps, with copy-paste blocks for Next.js, Expo, bare React Native, React web, and
plain TypeScript.

## Packages

Each one has its own README with the full detail.

- [`magic-oxlint-config`](packages/oxlint-config) is the oxlint presets: `base`, `react`,
  `react-native`, `next`, `expo`.
- [`magic-oxfmt-config`](packages/oxfmt-config) is the oxfmt config, import sort order included.
- [`magic-oxlint-plugin`](packages/oxlint-plugin) is eight opt-in lint rules with no oxlint
  equivalent.
- [`magic-tsconfig`](packages/tsconfig) is the TypeScript bases: `base`, `internal-package`,
  `nextjs`, `expo`.
- [`magic-codemods`](packages/codemods) is `magic-kebab`, the kebab-case filename migration.
- [`magic-observability`](packages/observability) is PostHog init, `captureError`, and an error
  boundary, per platform.
- [`magic-docs`](packages/docs) is the Fumadocs theme, layout and MDX presets, the TypeScript
  reference, and the Pages deploy.
- [`magic-theme`](packages/theme) is Magic Theme for Cursor / VS Code, Warp, Ghostty, and
  Alacritty.
- [`magic-readme`](packages/readme) is the README standard as code: a template, an `init`
  scaffold, and the `check` validator this repo runs on itself.
- `GSTJ/magic/docs-landing` is the editable shadcn block for dark package landing pages; see
  [its section in the adoption guide](.github/workflows/README.md#docs-landing-block).

Every image these READMEs embed is rendered by [`apps/demo-video`](apps/demo-video), a private
Remotion app that draws from `magic-theme`'s own palette; nothing is hand-screenshotted.

## CI and automation

`.github/workflows` ships reusable `workflow_call` jobs ([`ci.yml`](.github/workflows/ci.yml),
[`release.yml`](.github/workflows/release.yml), [`e2e-ios.yml`](.github/workflows/e2e-ios.yml))
and the composite actions they are built from, consumed by tag (`@v1`). Adoption
per project type, the Mac-runner routing, the measured iOS E2E defaults, the Renovate policy, the
pnpm 11 migration notes, and every gotcha live in the
[adoption guide](.github/workflows/README.md).

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

`pnpm run adversarial` runs `fixtures/adversarial`, end-to-end expected-outcome checks against
the real binaries: every emitted variant on a clean file, the opt-in plugin rules, the
restricted-imports snippet from the adoption guide, safe-jsx's autofix convergence, and oxfmt's
import-sort edge cases.
