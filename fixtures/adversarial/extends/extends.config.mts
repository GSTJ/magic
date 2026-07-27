import reactNative from "magic-oxlint-config/react-native";
import { defineConfig } from "oxlint";

// The unsupported shape, kept here on purpose. `extends` drops the preset's
// `ignorePatterns` outright, and used to drop `env` and `globals` with it —
// magic-oxlint-config 1.2.0 mirrors those two into an override so they survive.
// The runner diffs this against flat.config.mts to keep both halves honest: the
// two fields that now agree, and the one that still does not.
export default defineConfig({ extends: [reactNative] });
