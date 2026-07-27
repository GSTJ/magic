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
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require_ = createRequire(import.meta.url);

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

/** Namespaces provided by JS plugins, which the Rust schema cannot know about. */
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
