import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { renovateProblems } from "./validate-renovate.mjs";

const repoRoot = join(import.meta.dirname, "..");

const MAJOR_GATE = {
  description: "Majors always get a human, and this rule is last on purpose.",
  matchUpdateTypes: ["major"],
  automerge: false,
};

const preset = (rules) => ({
  $schema: "https://docs.renovatebot.com/renovate-schema.json",
  minimumReleaseAge: "3 days",
  packageRules: rules,
});

const withPreset = (value, assertions) => {
  const directory = mkdtempSync(join(tmpdir(), "magic-renovate-"));
  try {
    writeFileSync(
      join(directory, "default.json"),
      `${JSON.stringify(value, null, 2)}\n`,
    );
    assertions(renovateProblems(directory));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
};

test("the checked-in preset passes", () => {
  assert.deepEqual(renovateProblems(repoRoot), []);
});

test("a preset with no major gate fails", () => {
  withPreset(
    preset([
      {
        description: "Non-major bumps automerge everywhere.",
        matchUpdateTypes: ["minor", "patch"],
        automerge: true,
      },
    ]),
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /must end with a rule that denies automerge/);
    },
  );
});

test("the gate must be the last rule, not merely present", () => {
  withPreset(
    preset([
      MAJOR_GATE,
      {
        description: "magic tooling, unrestricted.",
        matchPackageNames: ["magic-{/,}**"],
        automerge: true,
      },
    ]),
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /must be last/);
      assert.match(problems[0], /1 rule\(s\) after it/);
    },
  );
});

test("a narrowed gate fails, because it stops covering every major", () => {
  withPreset(
    preset([{ ...MAJOR_GATE, matchPackageNames: ["typescript"] }]),
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /narrowed by matchPackageNames/);
    },
  );
});

test("a scoped major denial alongside the gate is fine", () => {
  withPreset(
    preset([
      {
        description: "TypeScript majors change emit. Human review.",
        matchPackageNames: ["typescript"],
        matchUpdateTypes: ["major"],
        automerge: false,
      },
      MAJOR_GATE,
    ]),
    (problems) => {
      assert.deepEqual(problems, []);
    },
  );
});

test("another rule granting automerge on majors fails", () => {
  withPreset(
    preset([
      {
        description: "Ship majors on Fridays.",
        matchPackageNames: ["lodash"],
        matchUpdateTypes: ["major"],
        automerge: true,
      },
      MAJOR_GATE,
    ]),
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /grants automerge on majors/);
    },
  );
});

test("two gates fail, because only one can be last", () => {
  withPreset(preset([MAJOR_GATE, MAJOR_GATE]), (problems) => {
    assert.equal(problems.length, 1);
    assert.match(problems[0], /declares 2 major-automerge gates/);
  });
});

test("a rule without a description fails", () => {
  withPreset(
    preset([{ matchPackageNames: ["lodash"], automerge: true }, MAJOR_GATE]),
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /packageRules\[0\] has no description/);
    },
  );
});

test("weakening minimumReleaseAge fails", () => {
  withPreset(
    { ...preset([MAJOR_GATE]), minimumReleaseAge: "1 day" },
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /must keep minimumReleaseAge at "3 days"/);
    },
  );
});

test("only the GSTJ/magic tag rule may drop the release-age quarantine", () => {
  withPreset(
    preset([
      {
        description: "This repo's own tags are not npm releases.",
        matchPackageNames: ["GSTJ/magic", "GSTJ/magic{/,}**"],
        minimumReleaseAge: null,
      },
      {
        description: "Some other package, sneaking past the quarantine.",
        matchPackageNames: ["lodash"],
        minimumReleaseAge: null,
      },
      MAJOR_GATE,
    ]),
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(
        problems[0],
        /packageRules\[1\] overrides minimumReleaseAge/,
      );
    },
  );
});

test("a preset that is not valid JSON is reported, not thrown", () => {
  const directory = mkdtempSync(join(tmpdir(), "magic-renovate-"));
  try {
    writeFileSync(join(directory, "default.json"), "{ nope");
    const problems = renovateProblems(directory);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /is not valid JSON/);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("a missing preset is reported", () => {
  const directory = mkdtempSync(join(tmpdir(), "magic-renovate-"));
  try {
    const problems = renovateProblems(directory);
    assert.deepEqual(problems, ["default.json does not exist."]);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
