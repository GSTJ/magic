/**
 * Guard the shared Renovate preset's ordering, because ordering is the whole
 * behaviour and nothing else in this repo checks it.
 *
 * Renovate evaluates every entry in `packageRules` and does not stop at the
 * first match, so the last rule that sets a key wins. `default.json` used to
 * carry a rule described as "Majors always get a human" whose matcher was
 * `["minor", "patch", "pin", "digest"]`. It granted automerge to non-majors and
 * never denied it to majors, and three later rules (magic tooling, posthog sdks,
 * github actions) set `automerge: true` with no update-type restriction, so a
 * breaking major automerged into every consumer with no review.
 *
 * What this file checks is structure, not behaviour: that the major gate exists,
 * that nothing narrows it, and that it is still the final rule. It deliberately
 * does not re-implement Renovate's matchers. Asserting behaviour a script only
 * believes it has is how the original bug read as correct for so long. The
 * behavioural proof runs against Renovate's own `applyPackageRules` and lives in
 * the PR that added this file.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, relative } from "node:path";
import { isDeepStrictEqual } from "node:util";

const modulePath = import.meta.filename;
const defaultRoot = join(import.meta.dirname, "..");

const RENOVATE_SCHEMA = "https://docs.renovatebot.com/renovate-schema.json";
const RELEASE_AGE = "14 days";

const COUPLED_GROUPS = [
  {
    groupName: "fumadocs",
    matchPackageNames: ["fumadocs-{/,}**", "@fumadocs/{/,}**", "zbsearch"],
    required: { automerge: false, separateMajorMinor: false },
  },
  {
    groupName: "oxlint toolchain",
    matchPackageNames: [
      "oxlint",
      "oxlint-tsgolint",
      "magic-oxlint-config",
      "magic-oxlint-plugin",
    ],
    required: {
      automerge: false,
      minimumReleaseAge: RELEASE_AGE,
      separateMajorMinor: false,
    },
  },
  {
    groupName: "oxfmt toolchain",
    matchPackageNames: ["oxfmt", "magic-oxfmt-config"],
    required: {
      automerge: false,
      minimumReleaseAge: RELEASE_AGE,
      separateMajorMinor: false,
    },
  },
];

const MAGIC_TOOLING_MATCHERS = ["magic-{/,}**"];

const isFirstPartyMatcher = (name) =>
  typeof name === "string" &&
  (name.startsWith("magic-") ||
    name === "GSTJ/magic" ||
    name.startsWith("GSTJ/magic/") ||
    name.startsWith("GSTJ/magic{"));

const sameMatchers = (actual, expected) =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  actual.every((name) => typeof name === "string") &&
  isDeepStrictEqual([...actual].sort(), [...expected].sort());

/**
 * Denies automerge on majors, but may still be scoped to some subset of them.
 * `typescript` majors are held back this way and are not the gate.
 */
const looksLikeGate = (rule) =>
  rule?.automerge === false &&
  isDeepStrictEqual(rule.matchUpdateTypes, ["major"]);

/** Anything that would stop a gate applying to every major there is. */
const narrowingKeys = (rule) =>
  Object.keys(rule).filter(
    (key) =>
      key !== "description" &&
      key !== "automerge" &&
      key !== "matchUpdateTypes" &&
      (key.startsWith("match") ||
        key.startsWith("exclude") ||
        key === "enabled"),
  );

/** Denies automerge on every major there is. There must be exactly one. */
const isMajorGate = (rule) =>
  looksLikeGate(rule) && narrowingKeys(rule).length === 0;

const rulesIn = (preset) =>
  Array.isArray(preset?.packageRules) ? preset.packageRules : [];

const releaseAgeRuleProblem = (rule, index) => {
  if (!("minimumReleaseAge" in rule)) return null;

  const names = Array.isArray(rule.matchPackageNames)
    ? rule.matchPackageNames
    : [];
  const firstPartyOnly =
    names.length > 0 && names.every((name) => isFirstPartyMatcher(name));

  return rule.minimumReleaseAge === RELEASE_AGE ||
    (rule.minimumReleaseAge === null && firstPartyOnly)
    ? null
    : `packageRules[${index}] must set minimumReleaseAge to "${RELEASE_AGE}"; null is only allowed when every package matcher is first-party GSTJ/magic tooling.`;
};

const groupContract = (rules, specification) => {
  const matches = rules.filter(
    (rule) => rule.groupName === specification.groupName,
  );
  if (matches.length !== 1) {
    return {
      problems: [
        `default.json must declare exactly one "${specification.groupName}" package rule; found ${matches.length}.`,
      ],
      rule: null,
    };
  }

  const [rule] = matches;
  const problems = [];
  if (!sameMatchers(rule.matchPackageNames, specification.matchPackageNames)) {
    problems.push(
      `the "${specification.groupName}" rule must match exactly ${JSON.stringify(specification.matchPackageNames)}.`,
    );
  }
  for (const [key, expected] of Object.entries(specification.required)) {
    if (rule[key] !== expected) {
      problems.push(
        `the "${specification.groupName}" rule must keep ${key} at ${JSON.stringify(expected)}.`,
      );
    }
  }

  return { problems, rule };
};

const magicToolingProblems = (rules, toolchainRules) => {
  const candidates = rules.filter((rule) =>
    sameMatchers(rule.matchPackageNames, MAGIC_TOOLING_MATCHERS),
  );
  if (candidates.length !== 1) {
    return [
      `default.json must declare exactly one broad magic tooling rule; found ${candidates.length}.`,
    ];
  }

  const [magic] = candidates;
  const problems = [];
  const required = {
    groupName: "magic tooling",
    automerge: true,
    minimumReleaseAge: null,
  };
  for (const [key, expected] of Object.entries(required)) {
    if (magic[key] !== expected) {
      problems.push(
        `the broad magic tooling rule must keep ${key} at ${JSON.stringify(expected)}.`,
      );
    }
  }

  const magicIndex = rules.indexOf(magic);
  for (const toolchain of toolchainRules.filter(Boolean)) {
    if (magicIndex >= rules.indexOf(toolchain)) {
      problems.push(
        `the broad magic tooling rule must come before "${toolchain.groupName}" so the reviewed toolchain policy wins.`,
      );
    }
  }

  return problems;
};

const coupledGroupProblems = (preset) => {
  const rules = rulesIn(preset);
  const contracts = COUPLED_GROUPS.map((specification) =>
    groupContract(rules, specification),
  );

  return [
    ...contracts.flatMap(({ problems }) => problems),
    ...magicToolingProblems(
      rules,
      contracts
        .filter(
          ({ rule }) =>
            rule?.groupName === "oxlint toolchain" ||
            rule?.groupName === "oxfmt toolchain",
        )
        .map(({ rule }) => rule),
    ),
  ];
};

const readPreset = (repoRoot) => {
  const presetPath = join(repoRoot, "default.json");
  if (!existsSync(presetPath)) {
    return { problems: ["default.json does not exist."] };
  }

  try {
    return {
      problems: [],
      preset: JSON.parse(readFileSync(presetPath, "utf8")),
    };
  } catch (error) {
    return { problems: [`default.json is not valid JSON: ${error.message}`] };
  }
};

const shapeProblems = (preset) => {
  const problems = [];

  if (preset?.$schema !== RENOVATE_SCHEMA) {
    problems.push(`default.json must set "$schema" to ${RENOVATE_SCHEMA}.`);
  }
  if (rulesIn(preset).length === 0) {
    problems.push("default.json must declare packageRules.");
  }
  for (const [index, rule] of rulesIn(preset).entries()) {
    if (!rule?.description?.toString().trim()) {
      problems.push(`packageRules[${index}] has no description.`);
    }
  }

  return problems;
};

const majorGateProblems = (preset) => {
  const rules = rulesIn(preset);
  const gates = rules.filter((rule) => isMajorGate(rule));

  if (gates.length === 0) {
    const nearest = rules.findIndex((rule) => looksLikeGate(rule));
    if (nearest !== -1) {
      return [
        `packageRules[${nearest}] denies automerge on majors but is narrowed by ${narrowingKeys(rules[nearest]).join(", ")}; the gate must apply to every major.`,
      ];
    }
    return [
      'default.json must end with a rule that denies automerge on majors: { "matchUpdateTypes": ["major"], "automerge": false }.',
    ];
  }
  if (gates.length > 1) {
    return [
      `default.json declares ${gates.length} major-automerge gates; there must be exactly one, and it must be last.`,
    ];
  }

  const problems = [];
  const [gate] = gates;
  const position = rules.indexOf(gate);

  if (position !== rules.length - 1) {
    problems.push(
      `the major-automerge gate is packageRules[${position}] of ${rules.length}; it must be last, because Renovate applies rules in order and ${rules.length - 1 - position} rule(s) after it can set automerge back to true.`,
    );
  }

  for (const [index, rule] of rules.entries()) {
    if (
      rule !== gate &&
      rule?.automerge === true &&
      (rule.matchUpdateTypes ?? []).includes("major")
    ) {
      problems.push(
        `packageRules[${index}] grants automerge on majors ("${rule.description ?? ""}"); majors need a human.`,
      );
    }
  }

  return problems;
};

const releaseAgeProblems = (preset) => {
  const problems = [];

  if (preset?.minimumReleaseAge !== RELEASE_AGE) {
    problems.push(
      `default.json must keep minimumReleaseAge at "${RELEASE_AGE}"; pnpm 11 enforces its own release-age floor on --frozen-lockfile and the two numbers have to agree.`,
    );
  }

  const requiredPolicy = [
    ["minimumReleaseAgeBehaviour", "timestamp-required"],
    ["internalChecksFilter", "strict"],
    ["prCreation", "immediate"],
    ["platformAutomerge", false],
    ["osvVulnerabilityAlerts", false],
  ];
  for (const [key, expected] of requiredPolicy) {
    if (preset?.[key] !== expected) {
      problems.push(
        `default.json must keep ${key} at ${JSON.stringify(expected)}.`,
      );
    }
  }

  const alerts = preset?.vulnerabilityAlerts;
  if (
    alerts?.enabled !== true ||
    alerts?.minimumReleaseAge !== RELEASE_AGE ||
    alerts?.prCreation !== "immediate"
  ) {
    problems.push(
      `default.json vulnerabilityAlerts must stay enabled, keep minimumReleaseAge at "${RELEASE_AGE}", and use prCreation "immediate".`,
    );
  }

  problems.push(
    ...rulesIn(preset)
      .map((rule, index) => releaseAgeRuleProblem(rule, index))
      .filter(Boolean),
  );

  return problems;
};

export const renovateProblems = (repoRoot = defaultRoot) => {
  const { problems, preset } = readPreset(repoRoot);
  if (!preset) return problems;

  return [
    ...problems,
    ...shapeProblems(preset),
    ...majorGateProblems(preset),
    ...coupledGroupProblems(preset),
    ...releaseAgeProblems(preset),
  ];
};

export const validateRenovate = (repoRoot = defaultRoot) => {
  const problems = renovateProblems(repoRoot);
  if (problems.length > 0) {
    process.stderr.write(
      `${problems.map((problem) => `  - ${problem}`).join("\n")}\n`,
    );
    return false;
  }

  const shownRoot = relative(process.cwd(), repoRoot) || ".";
  process.stdout.write(
    `validate-renovate: OK, ${shownRoot}/default.json denies automerge on majors and the gate is the last rule.\n`,
  );
  return true;
};

if (process.argv[1] && normalize(process.argv[1]) === normalize(modulePath)) {
  process.exitCode = validateRenovate() ? 0 : 1;
}
