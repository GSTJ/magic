import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { stemOf } from "./kebab.ts";

export type SkipReason = {
  readonly rule: string;
  readonly explanation: string;
};

const segments = (relativePath: string): string[] =>
  relativePath.split(/[/\\]/u);

const RN_DEPENDENCIES = ["react-native", "expo"];

/**
 * Is the nearest enclosing package a React Native or Expo app?
 *
 * The `App.tsx` exemption has to be conditional, and this is why: the preset
 * only exempts `App` in the `react-native` and `expo` variants, so in a Vite or
 * Next repo the linter *will* demand the rename. A codemod that refuses it
 * anyway leaves exactly the state this whole design is trying to avoid — a lint
 * error with no automated fix. In a plain web app `src/App.tsx` is reached by an
 * ordinary `./App` import from `main.tsx`, which is rewritten like any other.
 *
 * Walks up from the file so a React Native app inside a monorepo is judged by
 * its own `package.json`, not the root's.
 */
const isReactNativePackage = (root: string, relativePath: string): boolean => {
  let directory = dirname(join(root, relativePath));

  while (directory.startsWith(root)) {
    const manifest = join(directory, "package.json");
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, "utf8")) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
          peerDependencies?: Record<string, string>;
        };
        const declared = new Set([
          ...Object.keys(parsed.dependencies ?? {}),
          ...Object.keys(parsed.devDependencies ?? {}),
          ...Object.keys(parsed.peerDependencies ?? {}),
        ]);
        return RN_DEPENDENCIES.some((name) => declared.has(name));
      } catch {
        return false;
      }
    }

    const parent = dirname(directory);
    if (parent === directory) return false;
    directory = parent;
  }

  return false;
};

/**
 * Filenames the codemod will not rename even when something reports them.
 *
 * This list and `filenameCaseIgnore` / the `__mocks__` override in
 * `magic-oxlint-config` are two halves of one decision and have to agree. If the
 * linter reports a file the codemod refuses to rename, a repo is left with a
 * lint error that has no automated fix — so anything added here needs a matching
 * exemption in the preset, and the fixture test asserts the pair stays in sync.
 *
 * The skip list is the wider of the two on purpose: it also covers cases the
 * *linter* is right about but where a blind rename is unsafe, and those get
 * printed for a human instead of silently dropped.
 */
export const skipReasonFor = (
  root: string,
  relativePath: string,
): SkipReason | undefined => {
  const name = basename(relativePath);
  const parts = segments(relativePath);

  if (name.includes("[")) {
    return {
      rule: "route-parameter",
      explanation:
        "Brackets in a filename are a file-based router's route parameter " +
        "(`[postId].tsx` becomes `params.postId`). Renaming it changes the route " +
        "contract, not just the file.",
    };
  }

  if (parts.includes("__mocks__")) {
    // A `__mocks__/X.ts` sitting next to a `X.ts` that we are renaming is ours
    // and should follow along; that case is handled by the plan builder, which
    // pairs them up. Everything else in `__mocks__` mirrors a *package* name.
    const parentOfMocks = dirname(dirname(relativePath));
    const stem = stemOf(name);
    const siblingExists =
      existsSync(join(root, parentOfMocks)) &&
      readdirSync(join(root, parentOfMocks)).some(
        (sibling) => stemOf(sibling) === stem && sibling !== name,
      );
    if (!siblingExists) {
      return {
        rule: "manual-mock",
        explanation:
          "jest and vitest resolve `__mocks__/<x>` by matching `<x>` against the " +
          "module being mocked. With no same-named sibling module next to the " +
          "`__mocks__` directory this is a package mock, and its name belongs to " +
          "the package.",
      };
    }
  }

  if (/^App\.[^.]+$/u.test(name) && isReactNativePackage(root, relativePath)) {
    return {
      rule: "react-native-entry",
      explanation:
        "React Native's `index.js` template imports `./App`, and classic Expo apps " +
        "point `main` at `node_modules/expo/AppEntry.js`, whose `import App from " +
        '"../../App"` no codemod can reach. On APFS the rename looks fine locally ' +
        "and only fails on a case-sensitive build (EAS, Linux CI).",
    };
  }

  if (parts.includes("node_modules") || parts.includes(".git")) {
    return {
      rule: "not-source",
      explanation: "Outside the repo's own sources.",
    };
  }

  return undefined;
};
