<p align="center">
  <img alt="A README skeleton with the standard's sections highlighted" src="https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-readme.png" />
</p>

<p align="center">The GSTJ README standard as code: an init that writes the skeleton and a check that catches structural drift.</p>

<p align="center">
  <a aria-label="npm version" href="https://www.npmjs.com/package/magic-readme"><img alt="npm version" src="https://shieldcn.dev/npm/magic-readme.svg?variant=branded&size=xs&mode=light" /></a>
  <a aria-label="npm downloads" href="https://www.npmjs.com/package/magic-readme"><img alt="npm downloads" src="https://shieldcn.dev/npm/magic-readme/downloads.svg?variant=branded&size=xs&mode=light" /></a>
  <a aria-label="GitHub stars" href="https://github.com/GSTJ/magic/stargazers"><img alt="GitHub stars" src="https://shieldcn.dev/github/GSTJ/magic/stars.svg?variant=branded&size=xs&mode=light" /></a>
  <a aria-label="license" href="https://github.com/GSTJ/magic/blob/main/LICENSE"><img alt="license" src="https://shieldcn.dev/github/GSTJ/magic/license.svg?variant=branded&size=xs&mode=light" /></a>
</p>

## How it works

1. `magic-readme init` writes the standard's skeleton into a directory.
2. You fill the placeholders: hero image, tagline, mechanism list, install commands, detail
   sections.
3. `magic-readme check` runs six mechanical rules over any README and exits 1 listing what is off.
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
npm install --save-dev magic-readme
```

Or run it once without installing:

```sh
npx magic-readme init
```

## Rules

`check` enforces the structure a machine can judge honestly. Prose quality stays a human concern:
the validator will not notice a hype tagline or a useless mechanism list, and review still has to.

1. A hero before the first heading: a `<p align="center">` block holding an `<img>` whose `src` is
   absolute https. Badge images do not count as the hero.
2. A centered tagline: a `<p align="center">` block with plain text and no image, also before the
   first heading.
3. At least one badge served from shieldcn.dev.
4. An `## Install` heading.
5. No em or en dashes outside fenced code blocks. House style bans them in prose; commas, periods,
   and parentheses cover every use.
6. No relative image srcs anywhere, markdown or HTML. npm renders READMEs away from the repo, so a
   relative path 404s on the package page.

Each problem comes back as a plain sentence with a line number where one helps, and `check` prints
them per file before exiting 1.

## Init

`init` copies the skeleton to `<dir>/README.md` (default the current directory) and refuses to
overwrite an existing file. The skeleton carries the standard's section order: hero, tagline,
badges, `## How it works`, `## Install`, then package detail sections. Placeholders sit in angle
brackets, and a fresh skeleton deliberately fails `check` until the placeholders are filled.

When rewriting an existing README onto the skeleton, keep the hard-won content: why the package
exists, configuration, gotchas. Relocate it under clear H2 sections after `## Install`.

## Media

Hero images come from one pipeline. `apps/demo-video`, a private Remotion app in this repo, renders
every package's hero still and demo media into the repo root `media/` directory, which is
committed. READMEs then point at the raw GitHub URL, in the shape
`https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-readme.png`, so the same file
renders on GitHub and on npm. Nothing is hand-screenshotted; the stills share the repo's own theme
and brand primitives.
