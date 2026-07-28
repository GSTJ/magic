/**
 * Port of `react-native/no-unused-styles` from
 * `eslint-plugin-react-native@5.0.0` (`lib/rules/no-unused-styles.js`).
 *
 * Copyright (c) 2015 Tom Hastjarjanto. Licensed under the MIT licence; the full
 * notice is in `THIRD-PARTY-NOTICES.md` next to this package's README.
 *
 * A `StyleSheet.create` entry nothing reads is dead weight that still gets
 * registered at startup, and it is the usual residue of a deleted component.
 *
 * The matching is deliberately shallow, and every part of that is load-bearing
 * for which diagnostics appear:
 *
 * - A use is any `sheetName.entryName` member expression anywhere in the file,
 *   regardless of scope. `styles.row` in a comment-dead branch still counts.
 * - `styles.row.color` counts as nothing: upstream skips a member expression
 *   whose parent is another member expression, so the deeper access marks
 *   neither. Same for `styles["row"]`, whose property is not an identifier.
 * - Cross-file use is invisible. That is what the component gate below is for.
 *
 * **The component gate.** Upstream reports nothing unless it detected a React
 * component in the file, which is what keeps a shared `styles.ts` — sheets
 * exported and consumed elsewhere — from being reported as entirely unused. The
 * gate is reproduced in `components.ts`; see the divergences recorded there.
 *
 * **Anonymous sheets.** `StyleSheet.create({...})` bound to nothing has no name
 * upstream can print, and its entries are filed under the literal string
 * `"undefined"` — so the message reads `Unused style detected: undefined.row`.
 * Preserved; see `styleSheetName`.
 */

import {
  defineOxlintRule,
  type EslintRuleModule,
  type RuleContext,
} from "../../rule-api.ts";
import { createComponentDetector } from "./components.ts";
import {
  isStyleSheetDeclaration,
  type Node,
  potentialStyleReference,
  styleDeclarations,
  styleSheetName,
  styleSheetObjectNames,
} from "./stylesheet.ts";

const MESSAGE_ID = "unusedStyle";

export const noUnusedStyles: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow unused StyleSheet.create entries",
      recommended: false,
    },
    messages: {
      [MESSAGE_ID]: "Unused style detected: {{sheet}}.{{entry}}",
    },
    schema: [],
  },

  createChecks(context: RuleContext) {
    const components = createComponentDetector(context);
    let sheets = new Map<string, Node[]>();
    let references = new Set<string>();
    let objectNames = ["StyleSheet"];

    // Upstream folds component detection into the rule's own visitor map. The
    // node types are the ones its detection instructions cover; anything not
    // listed here was never fed to the detector upstream either.
    const detect = (node: unknown) => {
      components.visit(node as Node);
    };

    return {
      before() {
        sheets = new Map();
        references = new Set();
        objectNames = styleSheetObjectNames(context);
        components.reset();
      },

      ClassDeclaration: detect,
      FunctionDeclaration: detect,
      FunctionExpression: detect,
      ArrowFunctionExpression: detect,
      ThisExpression: detect,
      ReturnStatement: detect,

      ObjectExpression: detect,

      MemberExpression(node: unknown) {
        const reference = potentialStyleReference(node as Node);
        if (reference) references.add(reference);
      },

      CallExpression(node: unknown) {
        if (!isStyleSheetDeclaration(node, objectNames)) return;
        // A second sheet bound to the same name replaces the first, as upstream.
        sheets.set(
          styleSheetName(node as Node),
          styleDeclarations(node as Node),
        );
      },

      after() {
        if (!components.found()) {
          sheets = new Map();
          references = new Set();
          return;
        }

        for (const reference of references) {
          const [sheet, entry] = reference.split(".");
          const declared = sheets.get(sheet as string);
          if (declared) {
            sheets.set(
              sheet as string,
              declared.filter(
                (property) =>
                  (property.key as Node | undefined)?.name !== entry,
              ),
            );
          }
        }

        for (const [sheet, unused] of sheets) {
          for (const property of unused) {
            context.report({
              node: property,
              messageId: MESSAGE_ID,
              data: {
                sheet,
                entry: String((property.key as Node | undefined)?.name),
              },
            });
          }
        }

        sheets = new Map();
        references = new Set();
      },
    };
  },
});

export default noUnusedStyles;
