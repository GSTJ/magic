import { mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import {
  commitAll,
  makeTempRepo,
  oxlintBin,
  repoRoot,
  run,
  write,
} from "./helpers.mjs";

/**
 * The fixture lints with the *shipped* `unicorn/filename-case` entry and the
 * *shipped* `__mocks__` override, lifted straight out of the emitted
 * `base.json`. Pulling them from the artefact rather than restating them is what
 * makes this test able to catch a preset change that the codemod's skip list
 * does not follow — a state where a repo is left with a lint error no codemod
 * will fix.
 */
const presetFilenameCaseConfig = () => {
  const base = JSON.parse(
    readFileSync(join(repoRoot, "packages/oxlint-config/base.json"), "utf8"),
  );
  const rule = base.rules["unicorn/filename-case"];
  const mocksOverride = base.overrides.find(
    (override) => override.rules?.["unicorn/filename-case"] === "off",
  );
  if (rule === undefined || rule === "off") {
    throw new Error(
      "magic-oxlint-config no longer enables unicorn/filename-case in base — " +
        "this fixture and magic-kebab's whole reason to exist assume it is on.",
    );
  }
  if (mocksOverride === undefined) {
    throw new Error(
      "magic-oxlint-config no longer exempts __mocks__ from unicorn/filename-case.",
    );
  }
  return { rule, mocksOverride };
};

/**
 * A throwaway git repo carrying one instance of every hazard magic-kebab claims
 * to handle. Built fresh per test so nothing leaks between them.
 *
 * Deliberately included:
 *   - `Button.tsx`            case-only rename (`Button` -> `button`), the one
 *                             APFS turns into a no-op collision
 *   - `UserProfile.tsx`       multi-word rename reached through a path alias
 *   - `formatDate.ts`         camelCase, imported with an explicit extension
 *   - `index.ts`              barrel re-export (`export { x } from "./Button"`)
 *   - `LazyPanel.tsx`         only ever reached by a dynamic `import()`
 *   - `Theme.ts/.ios.ts`      platform-variant trio behind one specifier
 *   - `__mocks__/Button.ts`   mock of a local module — must follow its module
 *   - `__mocks__/AsyncStorage.ts`  mock of a *package* — must not move
 *   - `[postId].tsx`          route parameter — must not move
 *   - `page.tsx`, `_layout.tsx`, `+not-found.tsx`  already valid, must be no-ops
 *   - `jest.config.js`        moduleNameMapper regex — report, never rewrite
 *   - `docs/architecture.md`  prose reference — report, never rewrite
 */
export const buildFixtureRepo = () => {
  const root = makeTempRepo();

  write(
    root,
    "package.json",
    `${JSON.stringify({ name: "kebab-fixture", private: true, type: "module" }, null, 2)}\n`,
  );

  write(
    root,
    "tsconfig.json",
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "preserve",
          moduleResolution: "bundler",
          // `preserve` rather than `react-jsx` so the fixture typechecks
          // against the JSX shim below without a real React install.
          jsx: "preserve",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          allowImportingTsExtensions: true,
          paths: { "@/*": ["./src/*"] },
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,
  );

  const { rule, mocksOverride } = presetFilenameCaseConfig();
  write(
    root,
    ".oxlintrc.json",
    `${JSON.stringify(
      {
        plugins: ["unicorn"],
        ignorePatterns: ["**/node_modules/**", "**/*.d.ts"],
        rules: { "unicorn/filename-case": rule },
        overrides: [mocksOverride],
      },
      null,
      2,
    )}\n`,
  );

  // magic-kebab prefers the target repo's own oxlint, which is exactly what we
  // want it to use here. The whole package is linked, not just the `.bin` shim —
  // the shim is a JS launcher that resolves the real binary relative to itself,
  // so a lone symlink to it lands nowhere.
  write(root, ".gitignore", "node_modules/\n");
  mkdirSync(join(root, "node_modules", ".bin"), { recursive: true });
  symlinkSync(
    join(repoRoot, "node_modules", "oxlint"),
    join(root, "node_modules", "oxlint"),
  );
  symlinkSync(
    "../oxlint/bin/oxlint",
    join(root, "node_modules", ".bin", "oxlint"),
  );

  // A minimal JSX shim so `tsc --noEmit` can typecheck the fixture without
  // pulling React in.
  write(
    root,
    "src/jsx.d.ts",
    `declare namespace JSX {
  interface IntrinsicElements { [name: string]: Record<string, unknown> }
  type Element = unknown;
}
`,
  );

  write(
    root,
    "src/components/Button.tsx",
    `export interface ButtonProps { label: string }

export const Button = (props: ButtonProps) => <button>{props.label}</button>;

export default Button;
`,
  );

  write(
    root,
    "src/components/UserProfile.tsx",
    `import { Button } from "./Button";

export const UserProfile = () => <div><Button label="ok" /></div>;
`,
  );

  // Barrel: exercises `export … from` and default re-export.
  write(
    root,
    "src/components/index.ts",
    `export { Button, type ButtonProps } from "./Button";
export { UserProfile } from "./UserProfile";
export { default as ButtonDefault } from "./Button";
`,
  );

  write(
    root,
    "src/utils/formatDate.ts",
    `export const formatDate = (value: Date): string => value.toISOString();
`,
  );

  // Alias import + explicit-extension relative import in one file.
  write(
    root,
    "src/lib/api.ts",
    `import { formatDate } from "@/utils/formatDate";
import type { ButtonProps } from "../components/Button.tsx";

export const stamp = (props: ButtonProps): string =>
  props.label + formatDate(new Date());
`,
  );

  write(
    root,
    "src/components/LazyPanel.tsx",
    `export const LazyPanel = () => <section>lazy</section>;
export default LazyPanel;
`,
  );

  // Dynamic import, static import(), and a computed import() that must be
  // reported rather than guessed at.
  write(
    root,
    "src/lib/lazy.ts",
    `export const load = async () => import("../components/LazyPanel");
export const loadAliased = async () => import("@/components/LazyPanel");
export type PanelModule = typeof import("../components/LazyPanel");
export const loadDynamic = async (name: string) =>
  import(\`../components/\${name}LazyPanel\`);
`,
  );

  // Platform trio: one specifier, three files, one shared stem.
  for (const suffix of ["", ".ios", ".android"]) {
    write(
      root,
      `src/theme/Theme${suffix}.ts`,
      `export const theme = { platform: "${suffix || "default"}" } as const;\n`,
    );
  }
  write(
    root,
    "src/theme/consumer.ts",
    `import { theme } from "./Theme";

export const platform = theme.platform;
`,
  );

  // Mock of a local module — must move with it.
  write(
    root,
    "src/components/__mocks__/Button.ts",
    `export const Button = () => null;
`,
  );
  // Mock of a package — must not move.
  write(
    root,
    "src/__mocks__/AsyncStorage.ts",
    `export default { getItem: async () => null };
`,
  );

  // File-based router files: one exempt, three already valid.
  write(
    root,
    "src/app/[postId].tsx",
    `export default () => <main>post</main>;\n`,
  );
  write(root, "src/app/page.tsx", `export default () => <main>home</main>;\n`);
  write(
    root,
    "src/app/_layout.tsx",
    `export default () => <main>layout</main>;\n`,
  );
  write(
    root,
    "src/app/+not-found.tsx",
    `export default () => <main>404</main>;\n`,
  );

  // CommonJS require, in a file oxlint will lint.
  write(
    root,
    "src/legacy/loader.cjs",
    `const { Button } = require("../components/Button");
module.exports = { Button };
`,
  );

  // Runner config: a moduleNameMapper regex. Reported, never rewritten.
  write(
    root,
    "jest.config.js",
    `export default {
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^.+/Button$": "<rootDir>/src/components/Button",
  },
};
`,
  );

  write(
    root,
    "docs/architecture.md",
    `The design system entry point is \`src/components/Button.tsx\`.
`,
  );

  // A module path inside a *bare string literal*, passed to the repo's own
  // require-wrapper. Not an import, not a `require`, not a mock helper — no AST
  // pass calls this a specifier, and three of these went stale unreported in a
  // real migration.
  write(
    root,
    "src/lib/loader.ts",
    `export const loadModule = async (specifier: string): Promise<unknown> =>
  import(/* @vite-ignore */ specifier);
`,
  );
  write(
    root,
    "src/components/registry.ts",
    `import { loadModule } from "../lib/loader";

export const panel = async (): Promise<unknown> => loadModule("./LazyPanel");
`,
  );

  // The Expo config-plugin case, which is the same shape and the nastiest
  // failure: APFS resolves the stale path fine, so it only breaks on Linux/EAS.
  write(
    root,
    "plugins/WithMagicButton.ts",
    `export default (config: Record<string, unknown>): Record<string, unknown> =>
  config;
`,
  );
  write(
    root,
    "app.config.ts",
    `export default {
  name: "kebab-fixture",
  plugins: ["./plugins/WithMagicButton"],
};
`,
  );

  commitAll(root, "initial");
  return root;
};

/**
 * A monorepo with **no tsconfig at the root** — the shape that made magic-kebab
 * print `tsconfig: (none found)` and then rewrite relative imports while
 * silently leaving every `@/…` alias pointing at a file it had just renamed.
 *
 * `apps/web/tsconfig.json` holds the `paths`; `pnpm-workspace.yaml` is how the
 * resolver is expected to find it. `apps/api` has aliases defined only in a
 * bundler config the resolver cannot read, so its import is the case that must
 * land in NEEDS REVIEW rather than be quietly skipped.
 */
export const buildMonorepoFixtureRepo = () => {
  const root = makeTempRepo();

  write(
    root,
    "package.json",
    `${JSON.stringify({ name: "kebab-monorepo", private: true, type: "module" }, null, 2)}\n`,
  );
  write(
    root,
    "pnpm-workspace.yaml",
    `packages:\n  - "apps/*"\n\nminimumReleaseAge: 4320\n`,
  );

  const { rule, mocksOverride } = presetFilenameCaseConfig();
  write(
    root,
    ".oxlintrc.json",
    `${JSON.stringify(
      {
        plugins: ["unicorn"],
        ignorePatterns: ["**/node_modules/**", "**/*.d.ts"],
        rules: { "unicorn/filename-case": rule },
        overrides: [mocksOverride],
      },
      null,
      2,
    )}\n`,
  );

  write(root, ".gitignore", "node_modules/\n");
  mkdirSync(join(root, "node_modules", ".bin"), { recursive: true });
  symlinkSync(
    join(repoRoot, "node_modules", "oxlint"),
    join(root, "node_modules", "oxlint"),
  );
  symlinkSync(
    "../oxlint/bin/oxlint",
    join(root, "node_modules", ".bin", "oxlint"),
  );

  write(
    root,
    "apps/web/tsconfig.json",
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "preserve",
          moduleResolution: "bundler",
          strict: true,
          noEmit: true,
          paths: { "@/*": ["./src/*"] },
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,
  );
  write(
    root,
    "apps/web/src/components/CardHeader.ts",
    `export const CardHeader = (): string => "header";\n`,
  );
  write(
    root,
    "apps/web/src/pages/home.ts",
    `import { CardHeader } from "@/components/CardHeader";

export const home = (): string => CardHeader();
`,
  );

  // Aliases declared only in a bundler config. Nothing here can resolve `~/`,
  // so the import must be reported, not silently left behind.
  write(
    root,
    "apps/api/vite.config.ts",
    `export default { resolve: { alias: { "~": "./src" } } };\n`,
  );
  write(
    root,
    "apps/api/src/services/PaymentService.ts",
    `export const charge = (): number => 1;\n`,
  );
  write(
    root,
    "apps/api/src/routes/checkout.ts",
    `import { charge } from "~/services/PaymentService";

export const checkout = (): number => charge();
`,
  );

  commitAll(root, "initial");
  return root;
};

/**
 * Every `unicorn(filename-case)` diagnostic the fixture repo's own oxlint
 * reports, as repo-relative paths. This is the same question the codemod asks,
 * asked independently, so "the rule went silent" is a real assertion and not a
 * restatement of the plan.
 */
export const filenameCaseViolations = (root) => {
  const { stdout } = run(
    oxlintBin,
    ["-c", ".oxlintrc.json", "--format=json", "."],
    {
      cwd: root,
    },
  );
  const diagnostics = JSON.parse(stdout).diagnostics ?? [];
  return diagnostics
    .filter((diagnostic) => diagnostic.code === "unicorn(filename-case)")
    .map((diagnostic) => diagnostic.filename.replace(/^\.\//u, ""))
    .sort();
};
