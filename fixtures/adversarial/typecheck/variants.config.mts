import expoConfig from "magic-oxlint-config/expo";
import nextConfig from "magic-oxlint-config/next";
import reactConfig from "magic-oxlint-config/react";
import reactNativeConfig from "magic-oxlint-config/react-native";
import { defineConfig } from "oxlint";

// Every variant the README offers, each in the form the README prints. The bug
// this guards reproduced for all of them, not just `base`.
export const react = defineConfig({
  extends: [reactConfig],
  ignorePatterns: reactConfig.ignorePatterns,
});

export const reactNative = defineConfig({
  extends: [reactNativeConfig],
  ignorePatterns: reactNativeConfig.ignorePatterns,
});

export const next = defineConfig({
  extends: [nextConfig],
  ignorePatterns: nextConfig.ignorePatterns,
});

export const expo = defineConfig({
  extends: [expoConfig],
  ignorePatterns: expoConfig.ignorePatterns,
});
