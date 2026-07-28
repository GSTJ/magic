/**
 * Fail the build when `magic-observability`'s entry points stop being isolated.
 *
 * The whole reason that package has five entry points instead of one is that a
 * consumer must never pay for the platforms it does not use: an Expo bundle
 * that reaches `posthog-js` ships a browser SDK to Hermes, and a browser chunk
 * that reaches `posthog-node` does not build at all. Nothing about that is
 * enforced by TypeScript — one convenience re-export from the wrong file and
 * the arrangement quietly collapses, in the consumer's bundler, weeks later,
 * not here.
 *
 * So: walk the actual built module graph from each entry point, collect every
 * bare specifier it can reach, and compare that against what the entry point is
 * allowed to reach. Same reasoning as `validate-rules.mjs` — check the artifact
 * that ships, not the source it was meant to come from.
 *
 * Also checks the boring things that are equally easy to get wrong: every
 * `exports` subpath points at a file that exists, every SDK reached is declared
 * as an optional peer, and every subpath is documented.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = join(import.meta.dirname, "..");
const packageDir = join(repoRoot, "packages", "observability");

const manifest = JSON.parse(
  readFileSync(join(packageDir, "package.json"), "utf8"),
);

/**
 * What each entry point may reach at runtime, and why.
 *
 * `react` is on the boundary-bearing entries because the shared error boundary
 * is a React class component. It is an optional peer, so a Node worker that
 * imports only `/node` never installs it.
 */
const ALLOWED = {
  ".": [],
  "./boundary": ["react"],
  "./web": ["posthog-js"],
  "./react": ["posthog-js", "@posthog/react", "react"],
  "./next": ["posthog-node"],
  "./node": ["posthog-node"],
  "./expo": ["posthog-react-native", "react"],
};

/** Bare specifiers that are Node built-ins and never anybody's dependency. */
const isBuiltin = (specifier) =>
  specifier.startsWith("node:") ||
  ["fs", "path", "url", "util", "process"].includes(specifier);

const SPECIFIER = /(?:from|import|require)\s*\(?\s*["']([^"']+)["']\)?/g;

/** Every specifier written in a built module, static or dynamic. */
const specifiersIn = (file) =>
  [...readFileSync(file, "utf8").matchAll(SPECIFIER)].map(
    ([, specifier]) => specifier,
  );

/** `@scope/name/sub` and `name/sub` both belong to their package. */
const packageOf = (specifier) => {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
};

/**
 * Bare specifiers reachable from `entryFile`, following relative imports.
 *
 * Type-only imports are already gone — TypeScript erases them — which is what
 * lets `expo/options.ts` reference `PostHogOptions` without the built module
 * importing `posthog-react-native`, and is why this walks `dist` and not `src`.
 */
const reachableBareSpecifiers = (entryFile) => {
  const seen = new Set();
  const bare = new Set();
  const queue = [entryFile];

  /** Either a sibling module to keep walking, or a package name to record. */
  const visit = (file, specifier) => {
    if (!specifier.startsWith(".")) {
      if (!isBuiltin(specifier)) bare.add(packageOf(specifier));
      return;
    }
    const target = resolve(dirname(file), specifier);
    if (existsSync(target)) queue.push(target);
  };

  while (queue.length > 0) {
    const file = queue.pop();
    if (!seen.has(file)) {
      seen.add(file);
      for (const specifier of specifiersIn(file)) visit(file, specifier);
    }
  }

  return bare;
};

const failures = [];

// --------------------------------------------------------------------------
// 1. Every declared subpath exists, and every subpath has a rule above.
// --------------------------------------------------------------------------

const subpaths = Object.keys(manifest.exports).filter(
  (subpath) => subpath !== "./package.json",
);

const fileFor = (subpath) =>
  join(packageDir, manifest.exports[subpath].default);

/** Both halves of a subpath — the runtime file and its .d.ts — have to exist. */
const missingTargets = subpaths.flatMap((subpath) =>
  ["default", "types"]
    .map((condition) => [condition, manifest.exports[subpath][condition]])
    .filter(([, target]) => !target || !existsSync(join(packageDir, target)))
    .map(
      ([condition, target]) =>
        `exports["${subpath}"].${condition} is ${target ?? "missing"}, which does not resolve. Run \`pnpm build\` first.`,
    ),
);

failures.push(
  ...missingTargets,
  ...subpaths
    .filter((subpath) => !(subpath in ALLOWED))
    .map(
      (subpath) =>
        `exports["${subpath}"] has no entry in ALLOWED — decide which SDKs it may reach and add it here.`,
    ),
  ...Object.keys(ALLOWED)
    .filter((subpath) => !subpaths.includes(subpath))
    .map(
      (subpath) =>
        `ALLOWED lists "${subpath}", which is not in the package's exports map.`,
    ),
);

// --------------------------------------------------------------------------
// 2. The isolation guarantee itself.
// --------------------------------------------------------------------------

const checkable = subpaths.filter(
  (subpath) => subpath in ALLOWED && existsSync(fileFor(subpath)),
);

const reached = new Map(
  checkable.map((subpath) => [
    subpath,
    reachableBareSpecifiers(fileFor(subpath)),
  ]),
);

for (const [subpath, found] of reached) {
  const allowed = new Set(ALLOWED[subpath]);
  failures.push(
    ...[...found]
      .filter((specifier) => !allowed.has(specifier))
      .map(
        (specifier) =>
          `magic-observability${subpath.slice(1)} reaches "${specifier}", which it is not allowed to. ` +
          `A consumer importing it would have to install that SDK.`,
      ),
  );
}

// --------------------------------------------------------------------------
// 3. Every SDK reached is an optional peer, so consumers install only theirs.
// --------------------------------------------------------------------------

const peers = manifest.peerDependencies ?? {};
const peerMeta = manifest.peerDependenciesMeta ?? {};

/** Why this specifier is not a properly declared optional peer, if it is not. */
const peerProblem = (specifier, subpath) => {
  if (!(specifier in peers)) {
    return `"${specifier}" is reachable from ${subpath} but is not a peerDependency.`;
  }
  if (peerMeta[specifier]?.optional !== true) {
    return `peerDependency "${specifier}" must be optional — otherwise every consumer installs every SDK.`;
  }
  return null;
};

for (const [subpath, found] of reached) {
  failures.push(
    ...[...found]
      .map((specifier) => peerProblem(specifier, subpath))
      .filter(Boolean),
  );
}

// --------------------------------------------------------------------------
// 4. A subpath nobody documented is a subpath nobody will import.
// --------------------------------------------------------------------------

const readme = readFileSync(join(packageDir, "README.md"), "utf8");

failures.push(
  ...subpaths
    .map(
      (subpath) =>
        `magic-observability${subpath === "." ? "" : subpath.slice(1)}`,
    )
    .filter((importPath) => !readme.includes(importPath))
    .map(
      (importPath) =>
        `packages/observability/README.md never mentions \`${importPath}\`.`,
    ),
);

// --------------------------------------------------------------------------

if (failures.length > 0) {
  process.stderr.write(`${failures.map((line) => `  - ${line}`).join("\n")}\n`);
  process.stderr.write(
    `\nvalidate-observability: ${failures.length} problem(s) with magic-observability's entry points.\n` +
      `The per-platform split is the package's whole reason to exist; see ${relative(
        repoRoot,
        join(packageDir, "README.md"),
      )}.\n`,
  );
  process.exit(1);
}

const summary = [...reached]
  .map(
    ([subpath, found]) =>
      `  ${subpath.padEnd(11)} → ${[...found].sort().join(", ") || "(no SDK)"}`,
  )
  .join("\n");

process.stdout.write(
  `validate-observability: OK — ${subpaths.length} entry points, each reaching only its own SDKs.\n${summary}\n`,
);
