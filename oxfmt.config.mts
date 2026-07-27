import base from "magic-oxfmt-config";

/**
 * This is exactly the file every consumer repo writes — see the root README.
 * Keeping the repo's own formatting on the published config means a bad default
 * shows up here first.
 */
const config = {
  ...base,
  ignorePatterns: [
    ...(base.ignorePatterns ?? []),
    // Generated from packages/oxlint-config/src at build time.
    "packages/oxlint-config/*.json",
  ],
};

export default config;
