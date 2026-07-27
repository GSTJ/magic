import next from "magic-oxlint-config/next";
import { defineConfig } from "oxlint";

// The README's Next.js snippet, including the `ignorePatterns` re-declaration
// that `extends` makes mandatory.
export default defineConfig({
  extends: [next],
  ignorePatterns: next.ignorePatterns,
});
