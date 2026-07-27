import { createRequire } from "node:module";

/**
 * Minimal structural type for an oxlint config object. We deliberately do not
 * import `Oxlintrc` from `oxlint` — that would make `oxlint` a hard dependency
 * of this package's public types, and oxlint's JS-plugin surface is explicitly
 * outside semver. Consumers pass these objects into `defineConfig()` from their
 * own oxlint install, which is where the real typing happens.
 */
export interface MagicOxlintConfig {
  plugins?: string[];
  jsPlugins?: (string | { name: string; specifier: string })[];
  categories?: Record<string, "off" | "warn" | "error">;
  env?: Record<string, boolean>;
  globals?: Record<string, "readonly" | "writable" | "off">;
  ignorePatterns?: string[];
  rules?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  overrides?: {
    files: string[];
    excludeFiles?: string[];
    rules?: Record<string, unknown>;
    plugins?: string[];
    jsPlugins?: (string | { name: string; specifier: string })[];
    env?: Record<string, boolean>;
    globals?: Record<string, "readonly" | "writable" | "off">;
  }[];
}

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
