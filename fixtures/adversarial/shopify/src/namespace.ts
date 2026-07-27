// Reported: `import * as` defeats tree-shaking and hides what is actually used.
import * as pathUtil from "node:path";

import * as React from "react";

// NOT reported: `react` and `@radix-ui/*` are the two exceptions the incumbent
// `@shopify/no-namespace-imports` allow list carried, re-declared on
// `import/no-namespace` in the `react` preset.
import * as Dialog from "@radix-ui/react-dialog";

export const all = [React, Dialog, pathUtil];
