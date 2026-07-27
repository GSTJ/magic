/**
 * Work out the next repo tag from the conventional commits since the last one.
 *
 * The repo tag is what consumers reference — `GSTJ/magic/.github/workflows/ci.yml@v1`
 * and `GSTJ/magic/.github/actions/setup@v1` both resolve through it — so it has
 * to move on every release, independently of the npm package versions, which are
 * hand-bumped per package and published by `pnpm -r publish` only when the
 * registry does not already have that version.
 *
 * Two consequences worth knowing:
 *
 *   - A docs-only release still cuts a patch tag. Tags are free, `pnpm publish`
 *     no-ops on unchanged versions, and a repo where "the tag is behind main"
 *     is a state nobody can reason about.
 *   - With no `v*` tag at all, the base is the highest package version in
 *     `packages/*`, so the first automated release lands next to the packages
 *     rather than at v0.0.1.
 *
 * Run it standalone (`node scripts/release-plan.mjs`) to see the plan; it writes
 * to $GITHUB_OUTPUT when that is set.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..");

const git = (...args) =>
  execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** Sortable tuple, or null when the string is not a plain semver version. */
export const parseVersion = (value) => {
  const match = SEMVER.exec(value.trim());
  if (!match) return null;
  return match.slice(1, 4).map(Number);
};

export const compareVersions = (a, b) =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Highest of a list of version strings, ignoring anything unparseable.
 * Prereleases are deliberately not supported: nothing here ships one.
 */
export const highestVersion = (values) => {
  const parsed = values.map(parseVersion).filter(Boolean);
  if (parsed.length === 0) return null;
  return parsed.sort(compareVersions).at(-1).join(".");
};

const CONVENTIONAL = /^(?<type>[a-z]+)(?<scope>\([^)]*\))?(?<breaking>!)?:/i;

/**
 * The bump a set of commit messages asks for, or null for "nothing to release".
 *
 * A `!` marker or a `BREAKING CHANGE:` footer is major, `feat` is minor, and
 * everything else — including commits that are not conventional at all — is a
 * patch. Being generous with patch is the safe direction: the failure mode is a
 * tag nobody needed, not a fix that never reached a consumer.
 */
export const bumpFor = (messages) => {
  if (messages.length === 0) return null;
  let bump = "patch";
  for (const message of messages) {
    const [subject] = message.split("\n");
    const match = CONVENTIONAL.exec(subject.trim());
    const breaking =
      match?.groups.breaking === "!" || /^BREAKING[ -]CHANGE:/m.test(message);
    if (breaking) return "major";
    if (match?.groups.type.toLowerCase() === "feat") bump = "minor";
  }
  return bump;
};

export const nextVersion = (base, bump) => {
  const parsed = parseVersion(base);
  if (!parsed) throw new Error(`not a version: ${base}`);
  const [major, minor, patch] = parsed;
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

/** Latest `v*` tag by version order — creation order is not reliable here. */
const latestTag = () => {
  const tags = git("tag", "--list", "v*")
    .split("\n")
    .filter((tag) => parseVersion(tag));
  const highest = highestVersion(tags);
  return highest ? `v${highest}` : null;
};

const packageVersions = () =>
  readdirSync(join(repoRoot, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = join(
        repoRoot,
        "packages",
        entry.name,
        "package.json",
      );
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      return { name: manifest.name, version: manifest.version };
    })
    .filter((entry) => entry.name && entry.version);

const plan = () => {
  const packages = packageVersions();
  const tag = latestTag();
  const base = tag ?? `v${highestVersion(packages.map((p) => p.version))}`;

  const range = tag ? `${tag}..HEAD` : "HEAD";
  const messages = git("log", range, "--no-merges", "--format=%B%x00")
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const requestedRaw = (process.env.RELEASE_AS ?? "").trim();
  const requested = requestedRaw ? parseVersion(requestedRaw) : null;
  if (requestedRaw && !requested) {
    throw new Error(
      `release-as must be a plain version, got "${requestedRaw}"`,
    );
  }

  const bump = bumpFor(messages);
  if (!bump && !requested) {
    return { release: false, base, reason: `no commits since ${base}` };
  }

  const version = requested ? requested.join(".") : nextVersion(base, bump);
  if (compareVersions(parseVersion(version), parseVersion(base)) <= 0) {
    throw new Error(`${version} does not move forward from ${base}`);
  }

  return {
    release: true,
    base,
    bump: requested ? "explicit" : bump,
    version,
    tag: `v${version}`,
    major: `v${parseVersion(version)[0]}`,
    commits: messages.length,
    notes: messages.map((message) => `- ${message.split("\n")[0]}`).join("\n"),
    packages,
  };
};

// Importing this file (the tests do) must not shell out to git.
if (process.argv[1] === import.meta.filename) {
  const result = plan();

  if (process.env.GITHUB_OUTPUT) {
    const scalars = Object.entries(result)
      .filter(([key]) => key !== "notes" && key !== "packages")
      .map(([key, value]) => `${key}=${value}`);
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `${scalars.join("\n")}\nnotes<<MAGIC_RELEASE_NOTES\n${result.notes ?? ""}\nMAGIC_RELEASE_NOTES\n`,
    );
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
