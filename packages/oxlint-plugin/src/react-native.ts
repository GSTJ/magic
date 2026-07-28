import type { EslintRuleModule } from "./rule-api.ts";

import { noColorLiterals } from "./rules/react-native/no-color-literals.ts";
import { noInlineStyles } from "./rules/react-native/no-inline-styles.ts";
import { noSingleElementStyleArrays } from "./rules/react-native/no-single-element-style-arrays.ts";
import { noUnusedStyles } from "./rules/react-native/no-unused-styles.ts";

export { noColorLiterals } from "./rules/react-native/no-color-literals.ts";
export { noInlineStyles } from "./rules/react-native/no-inline-styles.ts";
export { noSingleElementStyleArrays } from "./rules/react-native/no-single-element-style-arrays.ts";
export { noUnusedStyles } from "./rules/react-native/no-unused-styles.ts";

/**
 * magic-oxlint-plugin/react-native
 *
 * The four `react-native/*` rules `magic-oxlint-config`'s `react-native` and
 * `expo` variants run at `error`, ported from `eslint-plugin-react-native@5.0.0`
 * (MIT — see `THIRD-PARTY-NOTICES.md`) so that config no longer depends on it.
 *
 * The point of the port is a dependency, not a behaviour change: upstream
 * declares a **required** `eslint` peer that oxlint never calls, and pnpm's
 * `autoInstallPeers` — npm's default since 7 — honours it, so every consumer of
 * `magic-oxlint-config` installed eslint 9 and its `minimatch@3` →
 * `brace-expansion@1` tail (GHSA-mh99-v99m-4gvg) to run a linter that does not
 * execute a line of it.
 *
 * **The namespace is `react-native`, not `magic`, and that is deliberate.**
 * Rule ids appear in consumers' configs and in their
 * `// oxlint-disable-next-line react-native/no-inline-styles` comments. Renaming
 * them would turn a dependency swap into a migration across every React Native
 * repo, and oxlint takes the namespace from the `jsPlugins` entry's `name`, so
 * there is nothing to gain by it:
 *
 *   jsPlugins: [{ name: "react-native", specifier: "magic-oxlint-plugin/react-native" }]
 *
 * These four are therefore NOT registered under the `magic` namespace — the
 * "every magic rule is opt-in" promise in `index.ts` is untouched, and an
 * adversarial fixture asserts no emitted preset names a `magic/*` rule.
 */
const plugin: {
  meta: { name: string };
  rules: Record<string, EslintRuleModule>;
} = {
  meta: { name: "react-native" },
  rules: {
    "no-color-literals": noColorLiterals,
    "no-inline-styles": noInlineStyles,
    "no-single-element-style-arrays": noSingleElementStyleArrays,
    "no-unused-styles": noUnusedStyles,
  },
};

export default plugin;
