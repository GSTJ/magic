/**
 * Guard the two ways the CI half of this repo breaks consumers silently.
 *
 * 1. Refs. Every remote action under `.github/`, including this repo's own
 *    actions inside reusable workflows, uses an immutable commit SHA. Docs keep
 *    the moving major tag because that is the release channel consumers opted
 *    into.
 *
 * 2. Local action paths inside reusable workflows. `uses: ./.github/actions/x`
 *    in a `workflow_call` file resolves against the *caller's* checkout, not
 *    this repo's, so it silently looks for the action in the consumer's repo.
 *    Reusable workflows have to spell out
 *    `GSTJ/magic/.github/actions/x@<full-sha>`.
 *
 * Plus the install flag, because `pnpm install` without `--frozen-lockfile` in a
 * publishing path is how a lockfile drifts in CI and nowhere else.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = join(import.meta.dirname, "..");

/**
 * The major tag consumers point at. Keep it aligned with the README snippets
 * and the release workflow's tag-move step.
 */
const MAJOR_TAG = "v1";

const SELF = "GSTJ/magic/";
const BRANCHY = new Set(["main", "master", "develop", "HEAD"]);
const TAG = /^v\d+(?:\.\d+){0,2}$/;
const SHA = /^[0-9a-f]{40}$/;
const USES = /^\s*(?:-\s+)?uses:\s*(?<ref>\S+)/;
const VERSION_COMMENT = /\s+#\s+v\d+(?:\.\d+){0,2}\s*$/;
const DOC_REF = /GSTJ\/magic\/[\w./-]+@([\w.-]+)/g;

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const exists = (path) => {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
};

const show = (file) => relative(repoRoot, file);

/** Everything wrong with one `uses:` value, as sentences. */
export const problemsWithUses = (value, { isReusable, raw = "" }) => {
  if (value.startsWith("./")) {
    if (isReusable) {
      return [
        `reusable workflows cannot use a local path: "${value}" would resolve inside the caller's repo. Use ${SELF}...@<full-sha>.`,
      ];
    }
    return [];
  }

  if (!value.includes("@")) return [`"${value}" has no ref.`];

  const problems = [];
  const ref = value.split("@").at(-1);
  if (!SHA.test(ref)) {
    const kind = BRANCHY.has(ref) ? "branch" : "mutable tag";
    const owner = value.startsWith(SELF)
      ? "self-reference"
      : "third-party action";
    problems.push(
      `${owner} "${value}" uses a ${kind}; pin its full commit SHA.`,
    );
  } else if (!VERSION_COMMENT.test(raw)) {
    problems.push(
      `action "${value}" needs a readable version comment such as "# v1.2.3".`,
    );
  }
  return problems;
};

const githubDir = join(repoRoot, ".github");
const yamlFiles = walk(githubDir).filter(
  (file) => file.endsWith(".yml") || file.endsWith(".yaml"),
);

const failures = [];

for (const file of yamlFiles) {
  const text = readFileSync(file, "utf8");
  const isReusable = /^\s*workflow_call:/m.test(text);

  for (const [index, raw] of text.split("\n").entries()) {
    const line = index + 1;
    const match = USES.exec(raw);
    if (match) {
      failures.push(
        ...problemsWithUses(match.groups.ref, { isReusable, raw }).map(
          (problem) => `${show(file)}:${line}: ${problem}`,
        ),
      );
    }

    // The action's default input is the one place the command is a value rather
    // than a command line, and it carries the flag already. A comment — YAML's
    // or the shell's, they look the same here — is prose, not an install.
    const looseInstall =
      /\bpnpm install\b/.test(raw) &&
      !raw.trimStart().startsWith("#") &&
      !raw.includes("--frozen-lockfile") &&
      !/default:\s*pnpm install/.test(raw);
    if (looseInstall) {
      failures.push(
        `${show(file)}:${line}: \`pnpm install\` without --frozen-lockfile.`,
      );
    }
  }
}

// Every composite action must have the file GitHub looks for. A directory under
// .github/actions without one is a broken `uses:` waiting to happen.
const actionsDir = join(githubDir, "actions");
const actionDirs = readdirSync(actionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(actionsDir, entry.name));

for (const dir of actionDirs) {
  if (!exists(join(dir, "action.yml")))
    failures.push(`${show(dir)}: no action.yml`);
}

// Docs are consumption instructions. A snippet on @main is a repo on @main.
const docs = [
  join(repoRoot, "README.md"),
  ...readdirSync(join(repoRoot, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(repoRoot, "packages", entry.name, "README.md"))
    .filter((file) => exists(file)),
];

for (const file of docs) {
  const lines = readFileSync(file, "utf8").split("\n");
  failures.push(
    ...lines.flatMap((raw, index) =>
      [...raw.matchAll(DOC_REF)]
        .filter(([, ref]) => !TAG.test(ref))
        .map(
          ([snippet]) =>
            `${show(file)}:${index + 1}: "${snippet}" tells consumers to reference a branch. Use @${MAJOR_TAG}.`,
        ),
    ),
  );
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.stderr.write(
    `\nvalidate-workflows: ${failures.length} problem(s).\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `validate-workflows: OK — ${yamlFiles.length} workflow/action files and ${docs.length} READMEs, ` +
    `remote actions pinned by SHA and consumer docs on ${MAJOR_TAG}.\n`,
);
