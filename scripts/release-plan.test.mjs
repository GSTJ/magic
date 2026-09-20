/**
 * The version arithmetic behind the tags consumers reference. It runs once per
 * release, in CI, with nobody watching — which is exactly the code that needs a
 * test in the repo rather than a careful reading.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  breakingChangeFor,
  bumpFor,
  highestVersion,
  nextVersion,
  notesFor,
  parseVersion,
} from "./release-plan.mjs";

test("parseVersion accepts both tag and bare forms, rejects the rest", () => {
  assert.deepEqual(parseVersion("v1.2.3"), [1, 2, 3]);
  assert.deepEqual(parseVersion("1.2.3"), [1, 2, 3]);
  assert.equal(parseVersion("v1.2"), null);
  assert.equal(parseVersion("v1.2.3-beta.1"), null);
  assert.equal(parseVersion("main"), null);
});

test("highestVersion sorts numerically, not lexically", () => {
  assert.equal(highestVersion(["v1.9.0", "v1.10.0", "v1.2.0"]), "1.10.0");
  assert.equal(highestVersion(["1.2.0", "junk", "v2.0.0"]), "2.0.0");
  assert.equal(highestVersion(["junk"]), null);
});

test("no commits means no release", () => {
  assert.equal(bumpFor([]), null);
});

test("feat is a minor, anything unremarkable is a patch", () => {
  assert.equal(bumpFor(["fix(ci): pin the runner"]), "patch");
  assert.equal(bumpFor(["docs: readme"]), "patch");
  assert.equal(bumpFor(["not a conventional commit at all"]), "patch");
  assert.equal(
    bumpFor(["docs: readme", "feat(setup): cache by default"]),
    "minor",
  );
});

test("a breaking marker wins over everything, in any position", () => {
  assert.equal(bumpFor(["feat!: drop node 20"]), "major");
  assert.equal(bumpFor(["feat(setup)!: drop node 20"]), "major");
  assert.equal(
    bumpFor(["fix: x", "chore: y\n\nBREAKING CHANGE: renamed"]),
    "major",
  );
  // A footer-shaped line that is not at the start of a line is not a footer.
  assert.equal(bumpFor(["fix: mentions BREAKING CHANGE: in prose"]), "patch");
});

test("breakingChangeFor prefers the footer text, in any wording or wrap", () => {
  assert.equal(
    breakingChangeFor("chore: y\n\nBREAKING CHANGE: renamed"),
    "renamed",
  );
  assert.equal(
    breakingChangeFor("fix: y\n\nBREAKING-CHANGE: renamed the other way"),
    "renamed the other way",
  );
  // A footer wraps across lines like any commit body; it all belongs to the
  // description, up to the end of the message.
  assert.equal(
    breakingChangeFor("fix: y\n\nBREAKING CHANGE: line one\nline two"),
    "line one\nline two",
  );
});

test("breakingChangeFor falls back to the subject for a bare `!`", () => {
  assert.equal(breakingChangeFor("feat!: drop node 20"), "feat!: drop node 20");
  assert.equal(
    breakingChangeFor("feat(setup)!: drop node 20\n\nsome body"),
    "feat(setup)!: drop node 20",
  );
});

test("breakingChangeFor is null for anything that isn't breaking", () => {
  assert.equal(breakingChangeFor("fix(ci): pin the runner"), null);
  assert.equal(breakingChangeFor("not conventional at all"), null);
  // Same guard bumpFor relies on: mid-line text is not a footer.
  assert.equal(
    breakingChangeFor("fix: mentions BREAKING CHANGE: in prose"),
    null,
  );
});

test("notesFor puts a BREAKING CHANGES section on top, only when one applies", () => {
  assert.equal(
    notesFor(["fix(ci): pin the runner", "docs: readme"]),
    "- fix(ci): pin the runner\n- docs: readme",
  );

  assert.equal(
    notesFor([
      "fix: x",
      "fix(oxlint-config)!: drop the dead rule\n\nBREAKING CHANGE: oxlint must be >=1.79.0",
    ]),
    [
      "## BREAKING CHANGES",
      "",
      "- oxlint must be >=1.79.0",
      "",
      "- fix: x",
      "- fix(oxlint-config)!: drop the dead rule",
    ].join("\n"),
  );
});

test("nextVersion zeroes the lower places", () => {
  assert.equal(nextVersion("v1.2.3", "patch"), "1.2.4");
  assert.equal(nextVersion("v1.2.3", "minor"), "1.3.0");
  assert.equal(nextVersion("v1.2.3", "major"), "2.0.0");
  assert.throws(() => nextVersion("main", "patch"), /not a version/);
});
