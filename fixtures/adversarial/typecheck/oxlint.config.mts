import base from "magic-oxlint-config/base";
import { defineConfig } from "oxlint";

// The root README, Step 2, character for character.
export default defineConfig({
  extends: [base],
  ignorePatterns: base.ignorePatterns,
});
