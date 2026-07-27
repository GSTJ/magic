import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { buildFixtureRepo, filenameCaseViolations } from "./fixture-repo.mjs";
import {
  cleanup,
  commitAll,
  git,
  magicKebab,
  makeTempRepo,
  run,
  tscBin,
  write,
} from "./helpers.mjs";

const read = (root, relativePath) =>
  readFileSync(join(root, relativePath), "utf8");

/** The `from -> to` pairs printed in any section of the CLI report. */
const plannedRenames = (output) =>
  [...output.matchAll(/^ {2}(\S+) -> (\S+)/gmu)]
    .map((match) => `${match[1]} -> ${match[2]}`)
    .sort();

/** git's own view, so a rename that only touched the index would show up. */
const listFiles = (root) =>
  git(root, "ls-files").stdout.split("\n").filter(Boolean).sort();

describe("magic-kebab preconditions", () => {
  let root;
  before(() => {
    root = buildFixtureRepo();
  });
  after(() => cleanup(root));

  it("refuses to run on a dirty tree", () => {
    writeFileSync(join(root, "src/utils/formatDate.ts"), "// dirty\n", {
      flag: "a",
    });
    const result = magicKebab(root, "--write");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Working tree is not clean/u);
    git(root, "checkout", "--", ".");
  });

  it("counts untracked files as dirty", () => {
    writeFileSync(join(root, "src/Stray.ts"), "export const stray = 1;\n");
    const result = magicKebab(root, "--write");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not clean/u);
    run("rm", [join(root, "src/Stray.ts")]);
  });

  it("--write and --dry-run are mutually exclusive", () => {
    const result = magicKebab(root, "--write", "--dry-run");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /contradict/u);
  });

  it("rejects an unknown --detect mode", () => {
    const result = magicKebab(root, "--detect", "vibes");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--detect must be/u);
  });
});

describe("magic-kebab --dry-run", () => {
  let root;
  let dry;
  before(() => {
    root = buildFixtureRepo();
    dry = magicKebab(root, "--dry-run");
  });
  after(() => cleanup(root));

  it("exits 0 and changes nothing at all", () => {
    assert.equal(dry.status, 0, dry.stderr);
    assert.equal(
      git(root, "status", "--porcelain", "--untracked-files=all").stdout.trim(),
      "",
      "dry run left the working tree dirty",
    );
  });

  it("plans every violating file and no others", () => {
    const planned = [...dry.stdout.matchAll(/^ {2}(\S+) -> (\S+)/gmu)].map(
      (match) => match[1],
    );
    assert.deepEqual(planned.sort(), [
      "src/components/Button.tsx",
      "src/components/LazyPanel.tsx",
      "src/components/UserProfile.tsx",
      "src/components/__mocks__/Button.ts",
      "src/theme/Theme.android.ts",
      "src/theme/Theme.ios.ts",
      "src/theme/Theme.ts",
      "src/utils/formatDate.ts",
    ]);
  });

  it("prints the specifier rewrites it would make, not just the renames", () => {
    assert.match(dry.stdout, /SPECIFIER REWRITES/u);
    assert.match(dry.stdout, /"\.\/Button" -> "\.\/button"/u);
    assert.match(
      dry.stdout,
      /"@\/utils\/formatDate" -> "@\/utils\/format-date"/u,
    );
    assert.match(
      dry.stdout,
      /"\.\.\/components\/Button\.tsx" -> "\.\.\/components\/button\.tsx"/u,
    );
  });

  it("never plans the route parameter or the package mock", () => {
    assert.doesNotMatch(dry.stdout, /\[postId\]\.tsx ->/u);
    assert.doesNotMatch(dry.stdout, /AsyncStorage\.ts ->/u);
  });

  it("has nothing to skip, because the preset already exempts those files", () => {
    // Two independent lines of defence: the preset's `ignore` list and
    // `__mocks__` override mean oxlint never reports them, so under the default
    // detection there is nothing for the skip list to catch. `--detect builtin`
    // below is where the skip list actually earns its keep.
    assert.match(dry.stdout, /0 skipped/u);
  });

  it("reports the computed import, the runner config and the doc", () => {
    assert.match(dry.stdout, /NEEDS REVIEW/u);
    assert.match(dry.stdout, /jest\.config\.js:\d+/u);
    assert.match(dry.stdout, /docs\/architecture\.md:\d+/u);
    assert.match(dry.stdout, /computed specifier/u);
  });

  it("is byte-identical to the plan --write then executes", () => {
    const second = magicKebab(root, "--dry-run");
    assert.equal(second.stdout, dry.stdout);
  });
});

describe("magic-kebab --write", () => {
  let root;
  let before_;
  let applied;

  before(() => {
    root = buildFixtureRepo();
    before_ = listFiles(root);
    applied = magicKebab(root, "--write");
  });
  after(() => cleanup(root));

  it("exits 0", () => {
    assert.equal(applied.status, 0, applied.stderr + applied.stdout);
  });

  it("performs the case-only rename for real, not just in the index", () => {
    // The whole reason for the temp-name dance: on APFS `Button.tsx` and
    // `button.tsx` are the same path, so a naive `git mv -f` updates the index
    // and leaves the file untouched. Check git and the filesystem separately.
    assert.ok(listFiles(root).includes("src/components/button.tsx"));
    assert.ok(!listFiles(root).includes("src/components/Button.tsx"));

    const onDisk = run("ls", [join(root, "src/components")]).stdout.split("\n");
    assert.ok(
      onDisk.includes("button.tsx"),
      "filesystem still has the old casing",
    );
    assert.ok(!onDisk.includes("Button.tsx"));
  });

  it("leaves no temp files behind", () => {
    assert.equal(
      listFiles(root).filter((file) => file.includes("magic-kebab-tmp")).length,
      0,
    );
  });

  it("renames multi-word and camelCase files", () => {
    const files = listFiles(root);
    assert.ok(files.includes("src/components/user-profile.tsx"));
    assert.ok(files.includes("src/utils/format-date.ts"));
    assert.ok(files.includes("src/components/lazy-panel.tsx"));
  });

  it("moves the whole platform-variant trio together", () => {
    const files = listFiles(root);
    for (const suffix of ["", ".ios", ".android"]) {
      assert.ok(files.includes(`src/theme/theme${suffix}.ts`), suffix);
      assert.ok(!files.includes(`src/theme/Theme${suffix}.ts`), suffix);
    }
  });

  it("drags a local module's __mocks__ along but leaves the package mock", () => {
    const files = listFiles(root);
    assert.ok(files.includes("src/components/__mocks__/button.ts"));
    assert.ok(files.includes("src/__mocks__/AsyncStorage.ts"));
  });

  it("leaves router files alone", () => {
    const files = listFiles(root);
    assert.ok(files.includes("src/app/[postId].tsx"));
    assert.ok(files.includes("src/app/page.tsx"));
    assert.ok(files.includes("src/app/_layout.tsx"));
    assert.ok(files.includes("src/app/+not-found.tsx"));
  });

  it("renames only — it never changes a directory or loses a file", () => {
    assert.equal(listFiles(root).length, before_.length);
    for (const file of listFiles(root)) {
      assert.ok(
        before_.some(
          (old) =>
            old.slice(0, old.lastIndexOf("/")) ===
            file.slice(0, file.lastIndexOf("/")),
        ),
        `${file} landed in a directory that did not exist before`,
      );
    }
  });

  it("rewrites relative, alias, extension-bearing and barrel specifiers", () => {
    assert.match(
      read(root, "src/components/user-profile.tsx"),
      /from "\.\/button"/u,
    );
    assert.match(read(root, "src/components/index.ts"), /from "\.\/button"/u);
    assert.match(
      read(root, "src/components/index.ts"),
      /from "\.\/user-profile"/u,
    );
    assert.match(read(root, "src/lib/api.ts"), /from "@\/utils\/format-date"/u);
    assert.match(
      read(root, "src/lib/api.ts"),
      /from "\.\.\/components\/button\.tsx"/u,
    );
  });

  it("rewrites dynamic import(), import-type and require()", () => {
    const lazy = read(root, "src/lib/lazy.ts");
    assert.match(lazy, /import\("\.\.\/components\/lazy-panel"\)/u);
    assert.match(lazy, /import\("@\/components\/lazy-panel"\)/u);
    assert.match(lazy, /typeof import\("\.\.\/components\/lazy-panel"\)/u);
    assert.match(
      read(root, "src/legacy/loader.cjs"),
      /require\("\.\.\/components\/button"\)/u,
    );
  });

  it("does not touch the template-literal import it cannot resolve", () => {
    assert.match(read(root, "src/lib/lazy.ts"), /\$\{name\}LazyPanel/u);
  });

  it("does not touch the runner config or the docs", () => {
    assert.match(read(root, "jest.config.js"), /src\/components\/Button/u);
    assert.match(read(root, "docs/architecture.md"), /Button\.tsx/u);
  });

  it("silences unicorn/filename-case", () => {
    assert.deepEqual(filenameCaseViolations(root), []);
  });

  it("leaves the repo typechecking", () => {
    const result = run(tscBin, ["-p", "tsconfig.json", "--noEmit"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });

  it("keeps git log --follow continuity across the rename", () => {
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "kebab-case");

    for (const [oldPath, newPath] of [
      ["src/components/Button.tsx", "src/components/button.tsx"],
      ["src/components/UserProfile.tsx", "src/components/user-profile.tsx"],
      ["src/theme/Theme.ios.ts", "src/theme/theme.ios.ts"],
    ]) {
      const log = git(root, "log", "--follow", "--format=%s", "--", newPath)
        .stdout.split("\n")
        .filter(Boolean);
      assert.deepEqual(
        log,
        ["kebab-case", "initial"],
        `history for ${newPath} does not reach back past the rename`,
      );

      const numstat = git(
        root,
        "log",
        "--follow",
        "--name-status",
        "--format=",
        "--",
        newPath,
      ).stdout;
      assert.match(
        numstat,
        new RegExp(`R\\d+\\s+${oldPath.replaceAll("/", String.raw`\/`)}`, "u"),
        `git did not record ${oldPath} -> ${newPath} as a rename`,
      );
    }
  });

  it("is idempotent — a second run finds nothing", () => {
    const second = magicKebab(root, "--dry-run");
    assert.equal(second.status, 0);
    assert.match(second.stdout, /Nothing to rename\./u);
  });
});

describe("magic-kebab options", () => {
  let root;
  before(() => {
    root = buildFixtureRepo();
  });
  after(() => cleanup(root));

  it("--detect builtin plans exactly what --detect oxlint plans", () => {
    const withOxlint = magicKebab(root, "--dry-run", "--detect", "oxlint");
    const withBuiltin = magicKebab(root, "--dry-run", "--detect", "builtin");

    assert.deepEqual(
      plannedRenames(withBuiltin.stdout),
      plannedRenames(withOxlint.stdout),
    );
  });

  it("--detect builtin falls back on the skip list for what the preset would have exempted", () => {
    // The builtin detector knows nothing about the repo's `ignore` list or
    // `overrides`, so it *does* flag `[postId].tsx` and `AsyncStorage.ts`. This
    // is the case the skip list exists for, and the reason the two lists have to
    // stay in agreement: whatever the preset exempts, the codemod must refuse.
    const result = magicKebab(root, "--dry-run", "--detect", "builtin");
    assert.match(result.stdout, /SKIPPED/u);
    assert.match(result.stdout, /\[postId\]\.tsx {2}\[route-parameter\]/u);
    assert.match(result.stdout, /AsyncStorage\.ts {2}\[manual-mock\]/u);
    assert.doesNotMatch(result.stdout, /\[postId\]\.tsx ->/u);
    assert.doesNotMatch(result.stdout, /AsyncStorage\.ts ->/u);
  });

  it("--rename overrides a target, and carries the paired mock with it", () => {
    const result = magicKebab(
      root,
      "--dry-run",
      "--rename",
      "Button.tsx=btn.tsx",
    );
    assert.match(
      result.stdout,
      /src\/components\/Button\.tsx -> src\/components\/btn\.tsx {2}\[override\]/u,
    );
    assert.match(
      result.stdout,
      /src\/components\/__mocks__\/Button\.ts -> src\/components\/__mocks__\/btn\.ts {2}\[paired-mock\]/u,
    );
  });

  it("--rename forces a file past the skip list, but only one the detector saw", () => {
    // `--rename` overrides the *target* of a reported violation; it is not a way
    // to add files. Under the default detection the preset exempts the package
    // mock outright, so there is nothing to override and the flag is inert.
    const inert = magicKebab(
      root,
      "--dry-run",
      "--rename",
      "AsyncStorage.ts=async-storage.ts",
    );
    assert.doesNotMatch(inert.stdout, /AsyncStorage\.ts ->/u);

    const forced = magicKebab(
      root,
      "--dry-run",
      "--detect",
      "builtin",
      "--rename",
      "AsyncStorage.ts=async-storage.ts",
    );
    assert.match(
      forced.stdout,
      /src\/__mocks__\/AsyncStorage\.ts -> src\/__mocks__\/async-storage\.ts {2}\[override\]/u,
    );
  });

  it("rejects a --rename target that would still violate the rule", () => {
    const result = magicKebab(
      root,
      "--dry-run",
      "--rename",
      "Button.tsx=Btn.tsx",
    );
    assert.equal(result.status, 1);
    assert.match(result.stdout, /CONFLICTS/u);
    assert.match(result.stdout, /still violates unicorn\/filename-case/u);
  });

  it("rejects a --rename target that moves the file", () => {
    const result = magicKebab(
      root,
      "--dry-run",
      "--rename",
      "Button.tsx=elsewhere/button.tsx",
    );
    assert.equal(result.status, 1);
    assert.match(result.stdout, /never moves a file between directories/u);
  });

  it("--strict fails when anything needs review", () => {
    const result = magicKebab(root, "--dry-run", "--strict");
    assert.equal(result.status, 1);
  });

  it("--json emits a machine-readable plan", () => {
    const result = magicKebab(root, "--dry-run", "--json");
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.applied, false);
    assert.ok(parsed.plan.renames.length > 0);
    assert.ok(parsed.edits.length > 0);
  });

  it("scopes to the paths it is given", () => {
    const result = magicKebab(
      root,
      "--dry-run",
      "--detect",
      "builtin",
      "src/utils",
    );
    const planned = [...result.stdout.matchAll(/^ {2}(\S+) -> /gmu)].map(
      (match) => match[1],
    );
    assert.deepEqual(planned, ["src/utils/formatDate.ts"]);
  });

  it("detects a collision instead of destroying a file", () => {
    const collision = buildFixtureRepo();
    try {
      // `Format-Date.ts` and `formatDate.ts` both want `format-date.ts`.
      writeFileSync(
        join(collision, "src/utils/Format-Date.ts"),
        "export const other = 1;\n",
      );
      git(collision, "add", "-A");
      git(collision, "commit", "-q", "-m", "add collider");

      const result = magicKebab(collision, "--dry-run");
      assert.equal(result.status, 1);
      assert.match(result.stdout, /CONFLICTS/u);
      assert.match(result.stdout, /all of them want this name/u);

      // Neither side of the collision is renamed — both are pulled out of the
      // plan, not just the second one found.
      const renamesBlock =
        /RENAMES \(\d+\)\n([\s\S]*?)\n\n/u.exec(result.stdout)?.[1] ?? "";
      assert.doesNotMatch(renamesBlock, /formatDate\.ts/u);
      assert.doesNotMatch(renamesBlock, /Format-Date\.ts/u);
      assert.ok(existsSync(join(collision, "src/utils/formatDate.ts")));
    } finally {
      cleanup(collision);
    }
  });
});

/** A one-file app whose entry point is `src/App.tsx`, imported from `main.tsx`. */
const withEntry = (dependencies) => {
  const root = makeTempRepo();
  write(
    root,
    "package.json",
    `${JSON.stringify({ name: "entry-fixture", private: true, dependencies }, null, 2)}\n`,
  );
  write(root, "src/App.tsx", "export default () => null;\n");
  write(root, "src/main.tsx", 'import App from "./App";\n\nexport { App };\n');
  commitAll(root, "initial");
  return root;
};

describe("the App.tsx exemption is conditional on it being a React Native app", () => {
  // The preset only exempts `App` in the `react-native` and `expo` variants. If
  // the codemod skipped it everywhere, a Vite or Next repo would be left with a
  // reported violation nothing will fix — the exact state this design avoids.
  it("skips App.tsx in a React Native package", () => {
    const root = withEntry({ "react-native": "0.81.0" });
    try {
      const result = magicKebab(root, "--dry-run", "--detect", "builtin");
      assert.match(result.stdout, /src\/App\.tsx {2}\[react-native-entry\]/u);
      assert.doesNotMatch(result.stdout, /src\/App\.tsx ->/u);
    } finally {
      cleanup(root);
    }
  });

  it("skips App.tsx in an Expo package", () => {
    const root = withEntry({ expo: "54.0.0" });
    try {
      const result = magicKebab(root, "--dry-run", "--detect", "builtin");
      assert.match(result.stdout, /src\/App\.tsx {2}\[react-native-entry\]/u);
    } finally {
      cleanup(root);
    }
  });

  it("renames App.tsx in a plain web package, and fixes the import", () => {
    const root = withEntry({ react: "19.2.0", vite: "8.0.0" });
    try {
      const result = magicKebab(root, "--write", "--detect", "builtin");
      assert.equal(result.status, 0, result.stderr);
      assert.ok(
        git(root, "ls-files").stdout.includes("src/app.tsx"),
        "App.tsx was not renamed in a non-React-Native package",
      );
      assert.match(read(root, "src/main.tsx"), /from "\.\/app"/u);
    } finally {
      cleanup(root);
    }
  });
});
