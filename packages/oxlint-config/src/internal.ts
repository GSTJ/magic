import { createRequire } from "node:module";

/** Mirrors oxlint's `AllowWarnDeny`. */
export type MagicOxlintSeverity =
  | "allow"
  | "off"
  | "warn"
  | "error"
  | "deny"
  | number;

/**
 * Mirrors oxlint's `DummyRule`. `Record<string, unknown>` looks equivalent and
 * is not: `unknown` is not assignable to `DummyRule`, so a config typed that way
 * cannot be handed to `defineConfig()`. Same failure as `plugins` below.
 */
export type MagicOxlintRuleEntry =
  | MagicOxlintSeverity
  | [MagicOxlintSeverity, ...unknown[]];

/**
 * The built-in plugin names oxlint accepts in `plugins`.
 *
 * Duplicated from oxlint's own `LintPluginOptionsSchema` on purpose — see the
 * `MagicOxlintConfig` docblock. It must stay a literal union rather than
 * `string[]`: oxlint types `plugins` as this exact union, and `string[]` is
 * *wider*, so a `string[]` field is not assignable to it. That is the direction
 * consumers need, and getting it wrong made the README's own
 * `defineConfig({ extends: [base] })` fail `tsc --noEmit` in every repo that put
 * `*.config.mts` in a tsconfig `include`.
 */
export type MagicOxlintPlugin =
  | "eslint"
  | "react"
  | "unicorn"
  | "typescript"
  | "oxc"
  | "import"
  | "jsdoc"
  | "jest"
  | "vitest"
  | "jsx-a11y"
  | "nextjs"
  | "react-perf"
  | "promise"
  | "node"
  | "vue";

/**
 * Minimal structural type for an oxlint config object. We deliberately do not
 * import `Oxlintrc` from `oxlint` — that would make `oxlint` a hard dependency
 * of this package's public types, and oxlint's JS-plugin surface is explicitly
 * outside semver. Consumers pass these objects into `defineConfig()` from their
 * own oxlint install, which is where the real typing happens.
 *
 * Not importing oxlint's types does *not* license being loose about them: every
 * field here has to be assignable to its `OxlintConfig` counterpart, or the
 * README's own two-line config fails to typecheck.
 * `fixtures/adversarial/typecheck` compiles that exact snippet against the real
 * `oxlint` types on every `pnpm run check`.
 */
export type MagicOxlintOverride = {
  files: string[];
  excludeFiles?: string[];
  rules?: Record<string, MagicOxlintRuleEntry>;
  plugins?: MagicOxlintPlugin[];
  jsPlugins?: (string | { name: string; specifier: string })[];
  env?: Record<string, boolean>;
  globals?: Record<string, "readonly" | "writable" | "off">;
};

export type MagicOxlintConfig = {
  plugins?: MagicOxlintPlugin[];
  jsPlugins?: (string | { name: string; specifier: string })[];
  categories?: Record<string, "off" | "warn" | "error">;
  env?: Record<string, boolean>;
  globals?: Record<string, "readonly" | "writable" | "off">;
  ignorePatterns?: string[];
  rules?: Record<string, MagicOxlintRuleEntry>;
  settings?: Record<string, unknown>;
  overrides?: MagicOxlintOverride[];
};

const require_ = createRequire(import.meta.url);

/**
 * `jsPlugins` specifiers are resolved by oxlint relative to the *consumer's*
 * config file, not relative to this package. Under pnpm's non-hoisted layout a
 * bare `"eslint-plugin-safe-jsx"` therefore fails to resolve, even though it is
 * a dependency of this package and physically present. Resolving to an absolute
 * path here — from this module's own location — sidesteps that entirely.
 *
 * The `MAGIC_OXLINT_BARE_SPECIFIERS` escape hatch exists for `scripts/emit-json.mjs`,
 * which has to emit portable bare specifiers into the shipped `.json` variants.
 */
// This package IS the build tool. There is no validated env module below it to
// import from, and the flag is only ever set by our own emit-json script.
// oxlint-disable-next-line no-restricted-properties
const useBareSpecifiers = process.env["MAGIC_OXLINT_BARE_SPECIFIERS"] === "1";

export const jsPlugin = (
  name: string,
  specifier: string,
): { name: string; specifier: string } => {
  if (useBareSpecifiers) return { name, specifier };

  try {
    return { name, specifier: require_.resolve(specifier) };
  } catch {
    // The plugin is a declared dependency, so this should not happen. If a
    // consumer has physically removed it, fall back to the bare specifier and
    // let oxlint produce its own (clearer) resolution error.
    return { name, specifier };
  }
};

const uniq = <T>(values: T[]): T[] => [...new Set(values)];

/**
 * An override entry that exists only to carry `env` and `globals`.
 *
 * oxlint's `extends` drops the extended config's top-level `env`, `globals` and
 * `ignorePatterns` — verified on 1.75.0, and the first two are *not* what
 * `--print-config` says they are (it under-reports `extends` across the board;
 * see the README's `extends` warning). The loss is real and it is silent:
 * `document = 1` stops firing `no-global-assign` because `env: { browser: true }`
 * never arrives, and `__DEV__` becomes undefined in the React Native variants.
 *
 * `overrides` **do** survive `extends`. So every variant mirrors its final
 * `env`/`globals` into a `files: ["**"]` entry, and the two fields reach the
 * linter down either path. Verified both ways in `fixtures/adversarial/extends`.
 *
 * The top-level fields stay as well: they are the canonical statement, they are
 * what `--print-config` renders on the supported consumption paths, and env
 * entries accumulate across matching override entries rather than replacing one
 * another, so carrying both costs nothing.
 *
 * `extendConfig` concatenates `overrides`, so composing variant on variant would
 * otherwise stack one carrier per level. Old carriers are dropped and a single
 * fresh one — built from the merged `env`/`globals` — is put back at the front,
 * where it cannot displace `mocksFilenameCase` from the end.
 */
const isEnvCarrier = (override: MagicOxlintOverride): boolean =>
  override.files.length === 1 &&
  override.files[0] === "**" &&
  !override.rules &&
  !override.plugins &&
  !override.jsPlugins &&
  !override.excludeFiles;

export const withEnvCarrier = (
  config: MagicOxlintConfig,
): MagicOxlintConfig => {
  const overrides = (config.overrides ?? []).filter(
    (override) => !isEnvCarrier(override),
  );

  if (!config.env && !config.globals) {
    return overrides.length === (config.overrides?.length ?? 0)
      ? config
      : { ...config, overrides };
  }

  const carrier: MagicOxlintOverride = { files: ["**"] };
  if (config.env) carrier.env = { ...config.env };
  if (config.globals) carrier.globals = { ...config.globals };

  return { ...config, overrides: [carrier, ...overrides] };
};

/**
 * Merge parent configs left-to-right, then the child on top. Arrays of
 * primitives (`plugins`, `ignorePatterns`) union rather than replace, because
 * oxlint's own `plugins` field *replaces* the base set and silently dropping a
 * parent's plugin is the kind of bug you only find three repos later.
 * `overrides` concatenate so a child can append a narrower block.
 */
export const extendConfig = (
  ...configs: MagicOxlintConfig[]
): MagicOxlintConfig => {
  const merged: MagicOxlintConfig = {};

  for (const config of configs) {
    if (config.plugins) {
      merged.plugins = uniq([...(merged.plugins ?? []), ...config.plugins]);
    }
    if (config.jsPlugins) {
      const byName = new Map<
        string,
        string | { name: string; specifier: string }
      >();
      for (const entry of [...(merged.jsPlugins ?? []), ...config.jsPlugins]) {
        byName.set(typeof entry === "string" ? entry : entry.name, entry);
      }
      merged.jsPlugins = [...byName.values()];
    }
    if (config.ignorePatterns) {
      merged.ignorePatterns = uniq([
        ...(merged.ignorePatterns ?? []),
        ...config.ignorePatterns,
      ]);
    }
    if (config.overrides) {
      merged.overrides = [...(merged.overrides ?? []), ...config.overrides];
    }
    if (config.categories) {
      merged.categories = { ...merged.categories, ...config.categories };
    }
    if (config.env) merged.env = { ...merged.env, ...config.env };
    if (config.globals)
      merged.globals = { ...merged.globals, ...config.globals };
    if (config.rules) merged.rules = { ...merged.rules, ...config.rules };
    if (config.settings) {
      merged.settings = { ...merged.settings, ...config.settings };
    }
  }

  return merged;
};
