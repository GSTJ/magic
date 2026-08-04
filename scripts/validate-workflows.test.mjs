import assert from "node:assert/strict";
import { test } from "node:test";

import { problemsWithUses } from "./validate-workflows.mjs";

const sha = "aa331e83282c2794edd474646c671f036dfabee0";

test("remote actions require immutable refs", () => {
  assert.deepEqual(
    problemsWithUses("GSTJ/magic/.github/actions/setup@v1", {
      isReusable: true,
      raw: "uses: GSTJ/magic/.github/actions/setup@v1",
    }),
    [
      'self-reference "GSTJ/magic/.github/actions/setup@v1" uses a mutable tag; pin its full commit SHA.',
    ],
  );
  assert.deepEqual(
    problemsWithUses("actions/checkout@main", {
      isReusable: false,
      raw: "uses: actions/checkout@main",
    }),
    [
      'third-party action "actions/checkout@main" uses a branch; pin its full commit SHA.',
    ],
  );
});

test("immutable refs carry a readable release comment", () => {
  const value = `GSTJ/magic/.github/actions/setup@${sha}`;
  assert.deepEqual(
    problemsWithUses(value, { isReusable: true, raw: `uses: ${value}` }),
    [`action "${value}" needs a readable version comment such as "# v1.2.3".`],
  );
  assert.deepEqual(
    problemsWithUses(value, {
      isReusable: true,
      raw: `uses: ${value} # v1.12.1`,
    }),
    [],
  );
});

test("local actions stay local to repository-owned workflows", () => {
  assert.deepEqual(
    problemsWithUses("./.github/actions/setup", {
      isReusable: false,
      raw: "uses: ./.github/actions/setup",
    }),
    [],
  );
  assert.match(
    problemsWithUses("./.github/actions/setup", {
      isReusable: true,
      raw: "uses: ./.github/actions/setup",
    })[0],
    /would resolve inside the caller's repo/,
  );
});
