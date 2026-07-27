import base from "magic-oxlint-config/base";
import { defineConfig } from "oxlint";

// Default preset only. No magic plugin, no opt-in rules — files here assert
// what the DEFAULT preset does and does not catch.
export default defineConfig({ extends: [base] });
