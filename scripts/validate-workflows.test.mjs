import assert from "node:assert/strict";
import { test } from "node:test";

import {
  problemsWithMaestroWorkspace,
  problemsWithTurboCache,
  problemsWithUses,
} from "./validate-workflows.mjs";

const sha = "aa331e83282c2794edd474646c671f036dfabee0";

test("remote third-party actions require immutable refs", () => {
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
  const value = `actions/checkout@${sha}`;
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

test("self-references use the running workflow commit", () => {
  assert.deepEqual(
    problemsWithUses("$/.github/actions/setup", {
      isReusable: true,
      raw: "uses: $/.github/actions/setup",
    }),
    [],
  );
  assert.deepEqual(
    problemsWithUses("$/.github/workflows/ci.yml", {
      isReusable: false,
      raw: "uses: $/.github/workflows/ci.yml",
    }),
    [],
  );
  assert.deepEqual(
    problemsWithUses("$/.github/actions/setup@v1", {
      isReusable: true,
      raw: "uses: $/.github/actions/setup@v1",
    }),
    ['self-reference "$/.github/actions/setup@v1" must not include a ref.'],
  );
  assert.deepEqual(
    problemsWithUses("$/.github/actions/../workflows/ci.yml", {
      isReusable: true,
      raw: "uses: $/.github/actions/../workflows/ci.yml",
    }),
    [
      'self-reference "$/.github/actions/../workflows/ci.yml" must not traverse directories.',
    ],
  );

  for (const value of ["$/", "$/README.md", "$/.github/actions/"]) {
    assert.deepEqual(
      problemsWithUses(value, {
        isReusable: true,
        raw: `uses: ${value}`,
      }),
      [
        `self-reference "${value}" must name an action or workflow under $/.github/.`,
      ],
    );
  }

  for (const ref of ["v1", sha]) {
    const value = `GSTJ/magic/.github/actions/setup@${ref}`;
    assert.deepEqual(
      problemsWithUses(value, {
        isReusable: true,
        raw: `uses: ${value}`,
      }),
      [
        `legacy self-reference "${value}" can drift from the running workflow. Use $/.github/actions/setup.`,
      ],
    );
  }
});

test("workspace actions stay local to repository-owned workflows", () => {
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
    /Use \$\/\.\.\. instead/,
  );
});

test("Maestro workspaces stay independent of caller-controlled names", () => {
  const unsafe = `    - name: 🗂 Resolve the flow list
      env:
        IN_NAME: \${{ inputs.name }}
      run: |
        work="\${RUNNER_TEMP:-/tmp}/magic-maestro/\${IN_NAME}"
        rm -rf "$work"
        mkdir -p "$work"

    - name: Run`;

  assert.deepEqual(problemsWithMaestroWorkspace(unsafe), [
    "run-maestro flow resolution exposes the caller-controlled name input to filesystem setup.",
    "run-maestro flow resolution must create its workspace with mktemp under RUNNER_TEMP.",
    "run-maestro flow resolution must not recursively remove paths.",
  ]);

  const safe = `    - name: 🗂 Resolve the flow list
      run: |
        work="$(mktemp -d "\${RUNNER_TEMP:-/tmp}/magic-maestro.XXXXXX")"

    - name: Run`;

  assert.deepEqual(problemsWithMaestroWorkspace(safe), []);
  assert.deepEqual(
    problemsWithMaestroWorkspace(
      safe.replace(
        "\n\n    - name: Run",
        '\n        rm --force --recursive "$work"\n\n    - name: Run',
      ),
    ),
    ["run-maestro flow resolution must not recursively remove paths."],
  );
});

const safeTurboCache = `
echo "turbo-cache-path=$(under .turbo)"
- name: Turborepo cache
  uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
  with:
    path: \${{ steps.resolve.outputs.turbo-cache-path }}
    key: turbo-\${{ runner.os }}-\${{ runner.arch }}-\${{ github.repository_id }}-\${{ github.job }}-\${{ github.sha }}
    restore-keys: |
      turbo-\${{ runner.os }}-\${{ runner.arch }}-\${{ github.repository_id }}-\${{ github.job }}-
      turbo-\${{ runner.os }}-\${{ runner.arch }}-\${{ github.repository_id }}-
`;

test("Turbo cache persists its local directory with the pinned first-party action", () => {
  assert.deepEqual(problemsWithTurboCache(safeTurboCache), []);
});

test("Turbo cache rejects proxy cache-server actions", () => {
  const unsafe = safeTurboCache.replace(
    "actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0",
    "rharkor/caching-for-turbo@2238fae6eb9a9936f92356f54cb3660200d105e7 # v2.5.1",
  );

  assert.match(problemsWithTurboCache(unsafe).join("\n"), /cache-server/);
});

test("Turbo cache keys retain platform, job, commit and restore scopes", () => {
  for (const missing of [
    `path: \${{ steps.resolve.outputs.turbo-cache-path }}`,
    `\${{ runner.arch }}-`,
    `\${{ github.job }}-`,
    `\${{ github.sha }}`,
  ]) {
    assert.notDeepEqual(
      problemsWithTurboCache(safeTurboCache.replace(missing, "")),
      [],
    );
  }
});

test("Turbo cache requires the complete ordered restore-key block", () => {
  const jobKey = `turbo-\${{ runner.os }}-\${{ runner.arch }}-\${{ github.repository_id }}-\${{ github.job }}-`;
  const repoKey = `turbo-\${{ runner.os }}-\${{ runner.arch }}-\${{ github.repository_id }}-`;
  const restoreBlock = `    restore-keys: |
      ${jobKey}
      ${repoKey}
`;

  for (const unsafe of [
    safeTurboCache.replace(restoreBlock, ""),
    safeTurboCache.replace(`      ${jobKey}\n`, ""),
    safeTurboCache.replace(`      ${repoKey}\n`, ""),
    safeTurboCache.replace(
      restoreBlock,
      `    restore-keys: |
      ${repoKey}
      ${jobKey}
`,
    ),
  ]) {
    assert.match(
      problemsWithTurboCache(unsafe).join("\n"),
      /ordered Turbo restore-key block/,
    );
  }
});
