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

describe("shieldcn badge", () => {
  it("passes with at least one shieldcn.dev badge", () => {
    assert.deepEqual(validateReadme(valid), []);
  });

  it("fails when the badges come from somewhere else", () => {
    const foreign = valid.replaceAll("shieldcn.dev", "img.shields.io");
    assert.ok(
      validateReadme(foreign, { name: "magic-x" }).some((problem) =>
        problem.includes("shieldcn.dev badge"),
      ),
    );
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
