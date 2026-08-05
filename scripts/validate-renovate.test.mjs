import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  minimumReleaseAge: "14 days",
  minimumReleaseAgeBehaviour: "timestamp-required",
  internalChecksFilter: "strict",
  prCreation: "not-pending",
  platformAutomerge: false,
  osvVulnerabilityAlerts: true,
  vulnerabilityAlerts: {
    enabled: true,
    minimumReleaseAge: "14 days",
    prCreation: "not-pending",
  },
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

test("magic itself is the explicit immediate-update exception", () => {
  const localConfig = JSON.parse(
    readFileSync(join(repoRoot, "renovate.json"), "utf8"),
  );
  const workspace = readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8");

  assert.equal(localConfig.minimumReleaseAge, "0 days");
  assert.equal(localConfig.vulnerabilityAlerts.minimumReleaseAge, "0 days");
  assert.match(workspace, /^minimumReleaseAge: 0$/m);
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
      assert.match(problems[0], /must keep minimumReleaseAge at "14 days"/);
    },
  );
});

test("weakening a strict release-age control fails", () => {
  withPreset(
    {
      ...preset([MAJOR_GATE]),
      minimumReleaseAgeBehaviour: "timestamp-optional",
    },
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /minimumReleaseAgeBehaviour/);
    },
  );
});

test("vulnerability PRs keep the same quarantine", () => {
  withPreset(
    {
      ...preset([MAJOR_GATE]),
      vulnerabilityAlerts: {
        enabled: true,
        minimumReleaseAge: null,
        prCreation: "immediate",
      },
    },
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /vulnerabilityAlerts/);
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
