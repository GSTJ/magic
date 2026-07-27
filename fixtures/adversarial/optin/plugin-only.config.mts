import base from "magic-oxlint-config/base";
import { defineConfig } from "oxlint";

/**
 * The opt-in guarantee, executed: the preset AND the plugin are both loaded,
 * and no `magic/*` rule is named. Every rule in magic-oxlint-plugin must stay
 * silent, on the same files the sibling config lights up.
 *
 * Loading the plugin is the point. `base/oxlint.config.mts` proves nothing here
 * — it never loads the plugin, so `magic/*` could not fire whatever the preset
 * said.
 */
export default defineConfig({
  extends: [base],
  jsPlugins: [{ name: "magic", specifier: "magic-oxlint-plugin" }],
});
