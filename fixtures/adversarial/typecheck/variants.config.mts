import { extendConfig } from "magic-oxlint-config";
import expoConfig from "magic-oxlint-config/expo";
import nextConfig from "magic-oxlint-config/next";
import reactConfig from "magic-oxlint-config/react";
import reactNativeConfig from "magic-oxlint-config/react-native";
import { defineConfig, type OxlintConfig } from "oxlint";

// Every variant the README offers, in both supported shapes. The bug this
// guards (`plugins?: string[]`, wider than oxlint's own literal union)
// reproduced for all of them, not just `base`.
export const react: OxlintConfig = reactConfig;
export const reactNative: OxlintConfig = reactNativeConfig;
export const next: OxlintConfig = nextConfig;
export const expo: OxlintConfig = expoConfig;

export const reactExtended = defineConfig(extendConfig(reactConfig, {}));
export const reactNativeExtended = defineConfig(
  extendConfig(reactNativeConfig, {}),
);
export const nextExtended = defineConfig(extendConfig(nextConfig, {}));
export const expoExtended = defineConfig(extendConfig(expoConfig, {}));
