/**
 * Fail the build when a config names a rule oxlint does not have.
 *
 * oxlint treats an unknown rule name as a fatal config error, not a warning, so
 * a single stale name takes down every consumer at once. Rules get renamed and
 * removed between oxlint minors (`react/jsx-no-leaked-render` and
 * `unicorn/no-array-push-push` are both in the MM reference config and both
 * gone by 1.75), which makes this the most valuable check in the repo.
 *
 * Source of truth is oxlint's own shipped JSON schema, so the check tracks
 * whatever oxlint version is installed.
 *
 * The schema cannot know about JS-plugin namespaces, so `magic/*` gets its own
 * pass below, against the built plugin's actual rule map. Verified on 1.75.0
 * that oxlint is equally unforgiving there — `x Rule 'no-ancestor-directory-imprt'
 * not found in plugin 'magic'`, config refused — so the same blast radius
 * applies, and the same check has to reach the docs, where a wrong rule name is
 * a config a consumer will paste and cannot run.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";

const require_ = createRequire(import.meta.url);

/** Every file under `dir`, recursively. */
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.name === "node_modules") return [];
    return entry.isDirectory() ? walk(full) : [full];
  });

// oxlint does not expose the schema through `exports`, so resolve the package
// root via its manifest and walk to the file.
const schemaPath = join(
  dirname(
    require_.resolve("oxlint/package.json", { paths: [import.meta.dirname] }),
  ),
  "configuration_schema.json",
);
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ruleMapRef = schema.definitions.OxlintRules.$ref.split("/").pop();
const knownRules = new Set(
  Object.keys(schema.definitions[ruleMapRef].properties),
);

/**
 * Namespaces provided by JS plugins, which the Rust schema cannot know about.
 * `magic` and `react-native` both come from `magic-oxlint-plugin` and get a
 * real check further down; `safe-jsx` is somebody else's package and only gets
 * this pass.
 */
const jsPluginNamespaces = new Set(["safe-jsx", "react-native", "magic"]);

const VARIANT_FILES = [
  "base.json",
  "react.json",
  "react-native.json",
  "next.json",
  "expo.json",
];

const configDir = join(import.meta.dirname, "..", "packages", "oxlint-config");
const present = new Set(readdirSync(configDir));
const variants = VARIANT_FILES.filter((file) => present.has(file));

if (variants.length !== VARIANT_FILES.length) {
  process.stderr.write(
    `validate-rules: expected ${VARIANT_FILES.length} emitted variants, found ${variants.length}. Run \`pnpm build\` first.\n`,
  );
  process.exit(1);
}

const collectRuleNames = (config) => [
  ...Object.keys(config.rules ?? {}),
  ...(config.overrides ?? []).flatMap((override) =>
    Object.keys(override.rules ?? {}),
  ),
];

const isKnown = (name) => {
  const namespace = name.includes("/") ? name.split("/")[0] : null;
  if (namespace && jsPluginNamespaces.has(namespace)) return true;

  // oxlint accepts both the bare name and the `eslint/` prefixed form.
  return knownRules.has(name) || knownRules.has(`eslint/${name}`);
};

const failures = variants.flatMap((variant) => {
  const config = JSON.parse(readFileSync(join(configDir, variant), "utf8"));
  return collectRuleNames(config)
    .filter((name) => !isKnown(name))
    .map((name) => `${variant}: unknown rule "${name}"`);
});

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.stderr.write(
    `\nvalidate-rules: ${failures.length} unknown rule name(s) against oxlint's schema.\n` +
      `See https://oxc.rs/docs/guide/usage/linter/rules.html — the rule was probably renamed or removed.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `validate-rules: OK — every rule in ${variants.length} variants exists in oxlint's schema.\n`,
);

// --------------------------------------------------------------------------
// Pass 2 — `magic/*` names, against the plugin that actually ships.
// --------------------------------------------------------------------------

const repoRoot = join(import.meta.dirname, "..");
const pluginDir = join(repoRoot, "packages", "oxlint-plugin");
const pluginModule = await import(join(pluginDir, "dist", "index.js"));
const pluginRules = new Set(Object.keys(pluginModule.default.rules));

/**
 * Every place a `magic/` rule name is written down. Configs break the linter;
 * docs break the next person to copy one. Both are worth failing the build for.
 */
const sourcesOfRuleNames = [
  join(repoRoot, "oxlint.config.mts"),
  join(repoRoot, "README.md"),
  join(pluginDir, "README.md"),
  join(repoRoot, "DECISIONS.md"),
  ...walk(join(repoRoot, "fixtures")).filter((file) =>
    file.endsWith("oxlint.config.mts"),
  ),
];

const MAGIC_RULE = /["`]magic\/([a-z-]+)["`]/g;

const nameFailures = sourcesOfRuleNames.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(MAGIC_RULE)]
    .map(([, rule]) => rule)
    .filter((rule) => !pluginRules.has(rule))
    .map(
      (rule) =>
        `${relative(repoRoot, file)}: "magic/${rule}" is not a rule in magic-oxlint-plugin`,
    );
});

// The reverse direction: a rule nobody documented is a rule nobody will enable.
const pluginReadme = readFileSync(join(pluginDir, "README.md"), "utf8");
const undocumented = [...pluginRules]
  .filter((rule) => !pluginReadme.includes(`magic/${rule}`))
  .map(
    (rule) =>
      `packages/oxlint-plugin/README.md: "magic/${rule}" is undocumented`,
  );

const magicFailures = [...new Set([...nameFailures, ...undocumented])];

if (magicFailures.length > 0) {
  process.stderr.write(`${magicFailures.join("\n")}\n`);
  process.stderr.write(
    `\nvalidate-rules: ${magicFailures.length} problem(s) with magic/* rule names.\n` +
      `oxlint refuses to start on an unknown rule under a loaded JS plugin, exactly as it does for a native one.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `validate-rules: OK — every magic/* name in ${sourcesOfRuleNames.length} configs and docs ` +
    `resolves to one of the ${pluginRules.size} rules the plugin exports, and every rule is documented.\n`,
);

// --------------------------------------------------------------------------
// Pass 3 — `react-native/*`, which the presets DO enable.
// --------------------------------------------------------------------------

/**
 * These four are the only rule names in this repo that a preset turns on from a
 * JS plugin, so they are the only ones where a typo reaches a consumer without
 * anybody opting in. Two directions, both failures:
 *
 *   - a name a variant enables that the plugin does not export — oxlint refuses
 *     the whole config with `Rule 'x' not found in plugin 'react-native'`;
 *   - a rule the plugin exports that no variant enables — dead code shipped to
 *     every consumer, and the symptom DECISIONS.md warned the port would have.
 *
 * The second half is what makes this worth writing: a broken jsPlugin specifier
 * does not throw, it just stops reporting, and a rule that is never named is
 * indistinguishable from one that is never reached.
 */
const rnModule = await import(join(pluginDir, "dist", "react-native.js"));
const rnRules = new Set(Object.keys(rnModule.default.rules));

const readVariant = (variant) =>
  JSON.parse(readFileSync(join(configDir, variant), "utf8"));

const rnEnabled = new Set(
  variants.flatMap((variant) =>
    collectRuleNames(readVariant(variant)).filter((name) =>
      name.startsWith("react-native/"),
    ),
  ),
);

const rnFailures = [
  ...[...rnEnabled]
    .map((name) => name.slice("react-native/".length))
    .filter((rule) => !rnRules.has(rule))
    .map(
      (rule) =>
        `emitted variants: "react-native/${rule}" is not a rule in magic-oxlint-plugin/react-native`,
    ),
  ...[...rnRules]
    .filter((rule) => !rnEnabled.has(`react-native/${rule}`))
    .map(
      (rule) =>
        `packages/oxlint-config: "react-native/${rule}" ships but no variant enables it`,
    ),
  ...[...rnRules]
    .filter((rule) => !pluginReadme.includes(`react-native/${rule}`))
    .map(
      (rule) =>
        `packages/oxlint-plugin/README.md: "react-native/${rule}" is undocumented`,
    ),
];

if (rnFailures.length > 0) {
  process.stderr.write(`${rnFailures.join("\n")}\n`);
  process.stderr.write(
    `\nvalidate-rules: ${rnFailures.length} problem(s) with react-native/* rule names.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `validate-rules: OK — all ${rnRules.size} react-native/* rules are enabled by a variant and documented.\n`,
);
