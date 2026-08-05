import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateReadme } from "../lib/validate.mjs";

const HERO = `<p align="center">
  <img alt="magic-x hero" src="https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-x.png" />
</p>`;

const TAGLINE = `<p align="center">Reads one file and writes one report.</p>`;

const BADGES = `<p align="center">
  <a aria-label="npm version" href="https://www.npmjs.com/package/magic-x"><img alt="npm version" src="https://shieldcn.dev/npm/magic-x.svg?variant=branded&size=xs&mode=light" /></a>
</p>`;

const BODY = `## How it works

1. Reads the file.
2. Writes the report.

## Install

\`\`\`sh
npm install magic-x
\`\`\`
`;

const valid = [HERO, TAGLINE, BADGES, BODY].join("\n\n");

describe("hero image", () => {
  it("passes a centered absolute-https hero before the first heading", () => {
    assert.deepEqual(validateReadme(valid), []);
  });

  it("fails when the hero sits after a heading", () => {
    const moved = [TAGLINE, BADGES, BODY, HERO].join("\n\n");
    assert.ok(
      validateReadme(moved).some((problem) => problem.includes("no hero")),
    );
  });

  it("fails when the hero src is not https", () => {
    const insecure = valid.replace(
      "https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-x.png",
      "http://raw.githubusercontent.com/GSTJ/magic/main/media/magic-x.png",
    );
    assert.ok(
      validateReadme(insecure).some((problem) => problem.includes("no hero")),
    );
  });
});

describe("tagline", () => {
  it("passes a centered text block with no image", () => {
    assert.deepEqual(validateReadme(valid), []);
  });

  it("fails without one before the first heading", () => {
    const bare = [HERO, BADGES, BODY].join("\n\n");
    assert.ok(
      validateReadme(bare).some((problem) => problem.includes("no tagline")),
    );
  });
});

describe("npm version badge", () => {
  it("passes when the badge points at the package's own name", () => {
    assert.deepEqual(validateReadme(valid, { name: "magic-x" }), []);
  });

  it("fails when the badge comes from somewhere else", () => {
    const foreign = valid.replaceAll("shieldcn.dev", "img.shields.io");
    assert.ok(
      validateReadme(foreign, { name: "magic-x" }).some((problem) =>
        problem.includes("no npm version badge for magic-x"),
      ),
    );
  });

  it("fails when the badge names a different package", () => {
    assert.ok(
      validateReadme(valid, { name: "magic-y" }).some((problem) =>
        problem.includes("no npm version badge for magic-y"),
      ),
    );
  });

  it("exempts a README with no package name, badges or not", () => {
    const bare = [HERO, TAGLINE, BODY].join("\n\n");
    assert.deepEqual(validateReadme(bare), []);
  });

  it("never asks for a stars or license badge", () => {
    const onlyNpm = [HERO, TAGLINE, BADGES, BODY].join("\n\n");
    const problems = validateReadme(onlyNpm, { name: "magic-x" }).join(" ");
    assert.ok(!problems.includes("stars"));
    assert.ok(!problems.includes("license"));
  });
});

describe("install heading", () => {
  it("passes with an ## Install heading", () => {
    assert.deepEqual(validateReadme(valid), []);
  });

  it("fails without one", () => {
    const renamed = valid.replace("## Install", "## Setup");
    assert.ok(
      validateReadme(renamed).some((problem) =>
        problem.includes("`## Install`"),
      ),
    );
  });
});

describe("dashes", () => {
  it("allows em dashes inside fenced code blocks", () => {
    const fenced = `${valid}\n\`\`\`txt\nplan — apply\n\`\`\`\n`;
    assert.deepEqual(validateReadme(fenced), []);
  });

  it("fails on an em dash in prose", () => {
    const dashed = `${valid}\nMechanism — marketing.\n`;
    assert.ok(
      validateReadme(dashed).some((problem) => problem.includes("em/en dash")),
    );
  });

  it("fails on an en dash in prose", () => {
    const dashed = `${valid}\nPages 3–4.\n`;
    assert.ok(
      validateReadme(dashed).some((problem) => problem.includes("em/en dash")),
    );
  });
});

describe("relative image srcs", () => {
  it("passes when every image src is absolute", () => {
    assert.deepEqual(validateReadme(valid), []);
  });

  it("fails on a relative markdown image", () => {
    const local = `${valid}\n![demo](./media/demo.gif)\n`;
    assert.ok(
      validateReadme(local).some((problem) =>
        problem.includes('"./media/demo.gif" is relative'),
      ),
    );
  });

  it("fails on a relative html image", () => {
    const local = `${valid}\n<img alt="demo" src="media/demo.png" />\n`;
    assert.ok(
      validateReadme(local).some((problem) =>
        problem.includes('"media/demo.png" is relative'),
      ),
    );
  });
});

describe("pinned versions", () => {
  it("passes an unpinned install snippet", () => {
    assert.deepEqual(validateReadme(valid), []);
  });

  it("fails on an exact pin in a code block", () => {
    const pinned = valid.replace(
      "npm install magic-x",
      "npm install magic-x@1.2.3",
    );
    assert.ok(
      validateReadme(pinned).some((problem) =>
        problem.includes('"magic-x@1.2.3" pins an exact version'),
      ),
    );
  });

  it("fails on a pinned scoped package", () => {
    const pinned = valid.replace(
      "npm install magic-x",
      "npm install @magic/theme@2.0.1",
    );
    assert.ok(
      validateReadme(pinned).some((problem) =>
        problem.includes('"@magic/theme@2.0.1" pins an exact version'),
      ),
    );
  });

  it("passes a moving major tag", () => {
    const tagged = valid.replace(
      "npm install magic-x",
      "uses: GSTJ/magic/.github/workflows/ci.yml@v1\nnpm install magic-x@2",
    );
    assert.deepEqual(validateReadme(tagged), []);
  });

  it("passes a range, which floats with releases", () => {
    const ranged = valid.replace(
      "npm install magic-x",
      "npm install magic-x@^1.2.3",
    );
    assert.deepEqual(validateReadme(ranged), []);
  });

  it("ignores a version written in prose", () => {
    const prose = `${valid}\nThe repo pins oxlint@1.2.3 in its own manifest.\n`;
    assert.deepEqual(validateReadme(prose), []);
  });
});
