import type { EslintRuleModule } from "./rule-api.ts";

import { noBarrelFile } from "./rules/no-barrel-file.ts";
import { noModuleMocks } from "./rules/no-module-mocks.ts";
import { preferEarlyReturn } from "./rules/prefer-early-return.ts";
import { preferSuspenseQuery } from "./rules/prefer-suspense-query.ts";

export { noBarrelFile } from "./rules/no-barrel-file.ts";
export { noModuleMocks } from "./rules/no-module-mocks.ts";
export { preferEarlyReturn } from "./rules/prefer-early-return.ts";
export { preferSuspenseQuery } from "./rules/prefer-suspense-query.ts";
export type { EslintRuleModule } from "./rule-api.ts";

/**
 * magic-oxlint-plugin
 *
 * Every rule here is **opt-in**. None is enabled by any magic-oxlint-config
 * preset — they're either policies rather than bug detectors, or they're
 * stack-specific. Enable the ones a given repo wants:
 *
 *   // oxlint.config.mts
 *   import { defineConfig } from "oxlint";
 *   import base from "magic-oxlint-config/base";
 *
 *   export default defineConfig({
 *     extends: [base],
 *     jsPlugins: [{ name: "magic", specifier: "magic-oxlint-plugin" }],
 *     rules: {
 *       "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
 *       "magic/no-barrel-file": "error",
 *     },
 *   });
 *
 * The bare specifier resolves because this package is a direct devDependency of
 * the consumer — which it has to be for the rules to be enabled at all.
 */
const plugin: {
  meta: { name: string };
  rules: Record<string, EslintRuleModule>;
} = {
  meta: { name: "magic" },
  rules: {
    "no-barrel-file": noBarrelFile,
    "no-module-mocks": noModuleMocks,
    "prefer-early-return": preferEarlyReturn,
    "prefer-suspense-query": preferSuspenseQuery,
  },
};

export default plugin;
