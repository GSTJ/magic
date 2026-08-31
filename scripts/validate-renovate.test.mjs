import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";

import { renovateProblems } from "./validate-renovate.mjs";

const repoRoot = join(import.meta.dirname, "..");

const MAJOR_GATE = {
  description: "Majors always get a human, and this rule is last on purpose.",
  matchUpdateTypes: ["major"],
  automerge: false,
};

const COUPLED_RULES = [
  {
    description: "First-party shared tooling.",
    matchPackageNames: ["magic-{/,}**"],
    groupName: "magic tooling",
    automerge: true,
    minimumReleaseAge: null,
  },
  {
    description: "Coupled oxlint tooling.",
    matchPackageNames: [
      "oxlint",
      "oxlint-tsgolint",
      "magic-oxlint-config",
      "magic-oxlint-plugin",
    ],
    groupName: "oxlint toolchain",
    automerge: false,
    minimumReleaseAge: "14 days",
    separateMajorMinor: false,
  },
  {
    description: "Coupled oxfmt tooling.",
    matchPackageNames: ["oxfmt", "magic-oxfmt-config"],
    groupName: "oxfmt toolchain",
    automerge: false,
    minimumReleaseAge: "14 days",
    separateMajorMinor: false,
  },
  {
    description: "Coupled docs tooling.",
    matchPackageNames: ["fumadocs-{/,}**", "@fumadocs/{/,}**", "zbsearch"],
    groupName: "fumadocs",
    automerge: false,
    separateMajorMinor: false,
  },
];

const copyRules = (rules) => rules.map((rule) => structuredClone(rule));

const preset = (rules, coupledRules = COUPLED_RULES) => ({
  $schema: "https://docs.renovatebot.com/renovate-schema.json",
  minimumReleaseAge: "14 days",
  minimumReleaseAgeBehaviour: "timestamp-required",
  internalChecksFilter: "strict",
  prCreation: "immediate",
  platformAutomerge: false,
  osvVulnerabilityAlerts: false,
  vulnerabilityAlerts: {
    enabled: true,
    minimumReleaseAge: "14 days",
    prCreation: "immediate",
  },
  packageRules: [...copyRules(coupledRules), ...rules],
});

const mutateCoupledPreset = (mutation) => {
  const rules = copyRules(COUPLED_RULES);
  mutation(rules);
  return preset([MAJOR_GATE], rules);
};

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

test("pending updates open PRs at the root and for vulnerability alerts", () => {
  const checkedIn = JSON.parse(
    readFileSync(join(repoRoot, "default.json"), "utf8"),
  );

  assert.equal(checkedIn.prCreation, "immediate");
  assert.equal(checkedIn.vulnerabilityAlerts.prCreation, "immediate");
});

test("the checked-in coupled dependency groups stay exact", () => {
  const checkedIn = JSON.parse(
    readFileSync(join(repoRoot, "default.json"), "utf8"),
  );
  const oneGroup = (name) => {
    const matches = checkedIn.packageRules.filter(
      (rule) => rule.groupName === name,
    );
    assert.equal(matches.length, 1, `${name} must have exactly one rule`);
    return matches[0];
  };

  const fumadocs = oneGroup("fumadocs");
  assert.deepEqual(fumadocs.matchPackageNames, [
    "fumadocs-{/,}**",
    "@fumadocs/{/,}**",
    "zbsearch",
  ]);
  assert.equal(fumadocs.automerge, false);
  assert.equal(fumadocs.separateMajorMinor, false);

  const oxlint = oneGroup("oxlint toolchain");
  assert.deepEqual(oxlint.matchPackageNames, [
    "oxlint",
    "oxlint-tsgolint",
    "magic-oxlint-config",
    "magic-oxlint-plugin",
  ]);
  assert.equal(oxlint.automerge, false);
  assert.equal(oxlint.minimumReleaseAge, "14 days");
  assert.equal(oxlint.separateMajorMinor, false);

  const oxfmt = oneGroup("oxfmt toolchain");
  assert.deepEqual(oxfmt.matchPackageNames, ["oxfmt", "magic-oxfmt-config"]);
  assert.equal(oxfmt.automerge, false);
  assert.equal(oxfmt.minimumReleaseAge, "14 days");
  assert.equal(oxfmt.separateMajorMinor, false);

  const magicRules = checkedIn.packageRules.filter((rule) =>
    isDeepStrictEqual(rule.matchPackageNames, ["magic-{/,}**"]),
  );
  assert.equal(magicRules.length, 1);
  const [magic] = magicRules;
  assert.equal(magic.groupName, "magic tooling");
  assert.equal(magic.automerge, true);
  assert.equal(magic.minimumReleaseAge, null);

  const magicIndex = checkedIn.packageRules.indexOf(magic);
  assert.ok(
    magicIndex <
      checkedIn.packageRules.findIndex(
        (rule) => rule.groupName === "oxlint toolchain",
      ),
  );
  assert.ok(
    magicIndex <
      checkedIn.packageRules.findIndex(
        (rule) => rule.groupName === "oxfmt toolchain",
      ),
  );
});

test("every coupled group is required exactly once", () => {
  for (const groupName of ["fumadocs", "oxlint toolchain", "oxfmt toolchain"]) {
    withPreset(
      mutateCoupledPreset((rules) => {
        rules.splice(
          rules.findIndex((rule) => rule.groupName === groupName),
          1,
        );
      }),
      (problems) => {
        assert.ok(
          problems.some(
            (problem) =>
              problem.includes(groupName) && problem.includes("found 0"),
          ),
        );
      },
    );

    withPreset(
      mutateCoupledPreset((rules) => {
        rules.push(
          structuredClone(rules.find((rule) => rule.groupName === groupName)),
        );
      }),
      (problems) => {
        assert.ok(
          problems.some(
            (problem) =>
              problem.includes(groupName) && problem.includes("found 2"),
          ),
        );
      },
    );
  }
});

test("every coupled group keeps its exact package set", () => {
  const mutations = [
    ["fumadocs", "zbsearch"],
    ["oxlint toolchain", "magic-oxlint-plugin"],
    ["oxfmt toolchain", "magic-oxfmt-config"],
  ];

  for (const [groupName, removedPackage] of mutations) {
    withPreset(
      mutateCoupledPreset((rules) => {
        const rule = rules.find((item) => item.groupName === groupName);
        rule.matchPackageNames = rule.matchPackageNames.filter(
          (name) => name !== removedPackage,
        );
      }),
      (problems) => {
        assert.ok(
          problems.some(
            (problem) =>
              problem.includes(groupName) && problem.includes("match exactly"),
          ),
        );
      },
    );
  }
});

test("every coupled group keeps its review controls", () => {
  const mutations = [
    ["fumadocs", "automerge", true],
    ["fumadocs", "separateMajorMinor", true],
    ["oxlint toolchain", "automerge", true],
    ["oxlint toolchain", "minimumReleaseAge", null],
    ["oxlint toolchain", "separateMajorMinor", true],
    ["oxfmt toolchain", "automerge", true],
    ["oxfmt toolchain", "minimumReleaseAge", null],
    ["oxfmt toolchain", "separateMajorMinor", true],
  ];

  for (const [groupName, key, value] of mutations) {
    withPreset(
      mutateCoupledPreset((rules) => {
        const rule = rules.find((item) => item.groupName === groupName);
        rule[key] = value;
      }),
      (problems) => {
        assert.ok(
          problems.some(
            (problem) => problem.includes(groupName) && problem.includes(key),
          ),
        );
      },
    );
  }
});

test("the broad magic rule is required and keeps its exact controls", () => {
  withPreset(
    mutateCoupledPreset((rules) => {
      rules.shift();
    }),
    (problems) => {
      assert.ok(
        problems.some((problem) =>
          problem.includes("exactly one broad magic tooling rule; found 0"),
        ),
      );
    },
  );

  for (const [key, value] of [
    ["groupName", "other tooling"],
    ["automerge", false],
    ["minimumReleaseAge", "14 days"],
  ]) {
    withPreset(
      mutateCoupledPreset((rules) => {
        rules[0][key] = value;
      }),
      (problems) => {
        assert.ok(
          problems.some(
            (problem) =>
              problem.includes("broad magic tooling rule") &&
              problem.includes(key),
          ),
        );
      },
    );
  }
});

test("the reviewed toolchain rules must follow the broad magic exception", () => {
  withPreset(
    mutateCoupledPreset((rules) => {
      const [magic] = rules.splice(0, 1);
      rules.splice(3, 0, magic);
    }),
    (problems) => {
      assert.ok(
        problems.some(
          (problem) =>
            problem.includes("must come before") &&
            problem.includes("oxlint toolchain"),
        ),
      );
      assert.ok(
        problems.some(
          (problem) =>
            problem.includes("must come before") &&
            problem.includes("oxfmt toolchain"),
        ),
      );
    },
  );
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
        description: "A later package rule.",
        matchPackageNames: ["lodash"],
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
      assert.match(problems[0], /has no description/);
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

test("hiding pending updates at the root fails", () => {
  withPreset(
    { ...preset([MAJOR_GATE]), prCreation: "not-pending" },
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /prCreation/);
    },
  );
});

test("hiding pending vulnerability updates fails", () => {
  withPreset(
    {
      ...preset([MAJOR_GATE]),
      vulnerabilityAlerts: {
        enabled: true,
        minimumReleaseAge: "14 days",
        prCreation: "not-pending",
      },
    },
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /vulnerabilityAlerts/);
    },
  );
});

test("the experimental OSV source stays disabled", () => {
  withPreset(
    { ...preset([MAJOR_GATE]), osvVulnerabilityAlerts: true },
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /osvVulnerabilityAlerts/);
    },
  );
});

test("GitHub vulnerability alerts stay enabled", () => {
  withPreset(
    {
      ...preset([MAJOR_GATE]),
      vulnerabilityAlerts: {
        enabled: false,
        minimumReleaseAge: "14 days",
        prCreation: "immediate",
      },
    },
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /vulnerabilityAlerts/);
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

test("only first-party magic rules may drop the release-age quarantine", () => {
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
      assert.match(problems[0], /must set minimumReleaseAge/);
    },
  );
});

test("a mixed first-party and third-party rule cannot skip quarantine", () => {
  withPreset(
    preset([
      {
        description: "Mixed tooling.",
        matchPackageNames: ["magic-oxlint-config", "oxlint"],
        minimumReleaseAge: null,
      },
      MAJOR_GATE,
    ]),
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /only allowed when every package matcher/);
    },
  );
});

test("a rule without package matchers cannot skip quarantine", () => {
  withPreset(
    preset([
      {
        description: "A global exception.",
        minimumReleaseAge: null,
      },
      MAJOR_GATE,
    ]),
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /only allowed when every package matcher/);
    },
  );
});

test("a third-party rule may restate the full quarantine", () => {
  withPreset(
    preset([
      {
        description: "Coupled third-party tooling.",
        matchPackageNames: ["oxlint", "typescript"],
        minimumReleaseAge: "14 days",
      },
      MAJOR_GATE,
    ]),
    (problems) => {
      assert.deepEqual(problems, []);
    },
  );
});

test("a first-party-only rule may keep the full quarantine", () => {
  withPreset(
    preset([
      {
        description: "First-party shared tooling.",
        matchPackageNames: ["magic-oxlint-config", "magic-oxlint-plugin"],
        minimumReleaseAge: "14 days",
      },
      MAJOR_GATE,
    ]),
    (problems) => {
      assert.deepEqual(problems, []);
    },
  );
});

test("a lookalike GSTJ repository cannot skip quarantine", () => {
  withPreset(
    preset([
      {
        description: "A lookalike repository.",
        matchPackageNames: ["GSTJ/magical"],
        minimumReleaseAge: null,
      },
      MAJOR_GATE,
    ]),
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /only allowed when every package matcher/);
    },
  );
});

test("first-party magic packages may move immediately", () => {
  withPreset(
    preset([
      {
        description: "First-party shared tooling.",
        matchPackageNames: ["magic-observability"],
        minimumReleaseAge: null,
      },
      MAJOR_GATE,
    ]),
    (problems) => {
      assert.deepEqual(problems, []);
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
