<p align="center">
  <img alt="A README skeleton with the standard's sections highlighted" src="https://assets.gabrieltaveira.dev/magic/magic-readme.png" />
</p>

<p align="center">Scaffold a README from the standard. Check any file back and get a line number for every rule it breaks.</p>

<p align="center">
  <a aria-label="npm version" href="https://www.npmjs.com/package/magic-readmes"><img alt="npm version" src="https://shieldcn.dev/npm/magic-readmes.svg?variant=branded&size=xs&mode=light" /></a>
</p>

## How it works

1. `magic-readme init` writes the standard's skeleton into a directory.
2. You fill the placeholders: hero image, tagline, mechanism list, install commands, detail
   sections.
3. `magic-readme check` runs seven mechanical rules over any README and exits 1 listing what is
   off.
4. In this repo, `pnpm run check` runs the same validator over every package README plus the root
   one.

```sh
$ magic-readme check README.md
README.md
  - no tagline: a <p align="center"> block with plain text and no image must come before the first heading.
  - no `## Install` heading.

magic-readme: 2 problem(s).
```

## Install

```sh
npm install --save-dev magic-readmes
```

Or run it once without installing:

```sh
npx magic-readmes init
```

The package is `magic-readmes`; the command it installs is `magic-readme`. npx runs a package's
only bin whatever that bin is called, so `npx magic-readmes init` works.

## Rules

`check` enforces the structure a machine can judge honestly. Prose quality stays a human concern:
the validator will not notice a hype tagline or a useless mechanism list, and review still has to.

1. A hero before the first heading: a `<p align="center">` block holding an `<img>` whose `src` is
   absolute https. Badge images do not count as the hero.
2. A centered tagline: a `<p align="center">` block with plain text and no image, also before the
   first heading.
3. An npm version badge from shieldcn.dev pointing at the package's own name, taken from the
   adjacent `package.json`. Private packages and loose files have no npm page, so they skip this
   one.
4. An `## Install` heading.
5. No em or en dashes outside fenced code blocks. House style bans them in prose; commas, periods,
   and parentheses cover every use.
6. No relative image srcs anywhere, markdown or HTML. npm renders READMEs away from the repo, so a
   relative path 404s on the package page.
7. No exact `name@x.y.z` pins inside fenced code blocks. Install lines get copied, and a patch
   version in one is wrong the day after the next release. Moving tags like `@v1` and `@2` pass,
   and so do ranges.

Each problem comes back as a plain sentence with a line number where one helps, and `check` prints
them per file before exiting 1.

## Badges

Badges are marketing, so a README carries only the ones that sell it. npm version and npm
downloads do that: they say the package is alive and people install it. Stars and license badges
came off every README here, because the star count is zero and the license badge renders
`unknown`, and both of those argue against installing. Bring either back on a package where the
number helps.

## Init

`init` copies the skeleton to `<dir>/README.md` (default the current directory) and refuses to
overwrite an existing file. The skeleton carries the standard's section order: hero, tagline,
badges, `## How it works`, `## Install`, then package detail sections. Placeholders sit in angle
brackets, and a fresh skeleton deliberately fails `check` until the placeholders are filled.

When rewriting an existing README onto the skeleton, keep the hard-won content: why the package
exists, configuration, gotchas. Relocate it under clear H2 sections after `## Install`.

## Media

Hero images come from one pipeline. `magic-video`, the Remotion package in this repo
(`packages/video`), renders every package's hero still and demo media into the repo root `media/`
directory, which is committed. READMEs then point at the raw GitHub URL, in the shape
`https://assets.gabrieltaveira.dev/magic/magic-readme.png`, so the same file
renders on GitHub and on npm. Nothing is hand-screenshotted; the stills share the repo's own theme
and brand primitives.
