import type { Rename } from "./plan.ts";
import type { AliasResolver } from "./resolve.ts";

import { existsSync } from "node:fs";
import { basename, join, relative } from "node:path";

import {
  Node,
  Project,
  type SourceFile,
  type StringLiteral,
  SyntaxKind,
} from "ts-morph";

import { isLintable, stemOf } from "./kebab.ts";

export interface Edit {
  readonly file: string;
  readonly line: number;
  readonly from: string;
  readonly to: string;
  readonly kind: string;
}

export interface ManualReview {
  readonly file: string;
  readonly line: number | undefined;
  readonly detail: string;
  readonly text: string;
}

export interface RewriteResult {
  readonly edits: Edit[];
  readonly manual: ManualReview[];
}

/**
 * Module-mocking helpers whose first argument is a module specifier resolved
 * exactly like an `import`. These are safe to rewrite; `moduleNameMapper` and
 * friends are not, and end up in `manual` instead.
 */
const MOCK_HELPERS = new Set([
  "jest.mock",
  "jest.unmock",
  "jest.doMock",
  "jest.dontMock",
  "jest.setMock",
  "jest.requireActual",
  "jest.requireMock",
  "vi.mock",
  "vi.unmock",
  "vi.doMock",
  "vi.doUnmock",
  "vi.importActual",
  "vi.importMock",
]);

const calleeName = (node: Node): string | undefined => {
  if (Node.isIdentifier(node)) return node.getText();
  if (Node.isPropertyAccessExpression(node)) {
    return `${node.getExpression().getText()}.${node.getName()}`;
  }
  return undefined;
};

/**
 * Rewrite one specifier given that the file it points at is keeping its
 * directory and changing its basename stem from `oldStem` to `newStem`.
 *
 * Only ever touches the **last segment**, and only its stem. Directories never
 * move, and the extension — present or absent, `.js`-standing-in-for-`.ts` or
 * not — is whatever the author wrote and stays that way.
 * `"@/components/Button"` → `"@/components/button"`; `"./Button.tsx"` →
 * `"./button.tsx"`; `"./Button.js"` → `"./button.js"`.
 *
 * Returns undefined when the last segment is not the renamed file's stem, which
 * means resolution went through a directory `index` and there is nothing here to
 * change.
 */
const rewrittenSpecifier = (
  specifier: string,
  oldStem: string,
  newStem: string,
): string | undefined => {
  const cut = specifier.lastIndexOf("/");
  const head = cut === -1 ? "" : specifier.slice(0, cut + 1);
  const tail = specifier.slice(cut + 1);

  const matches = tail === oldStem || tail.startsWith(`${oldStem}.`);
  return matches ? head + newStem + tail.slice(oldStem.length) : undefined;
};

interface SpecifierSite {
  readonly literal: StringLiteral;
  readonly kind: string;
}

const callSpecifierKind = (expression: Node): string | undefined => {
  if (expression.getKind() === SyntaxKind.ImportKeyword)
    return "dynamic-import";

  const name = calleeName(expression);
  if (name === undefined) return undefined;
  if (name === "require") return "require";
  if (name === "require.resolve") return "require-resolve";
  return MOCK_HELPERS.has(name) ? name : undefined;
};

const specifierLiterals = (sourceFile: SourceFile): SpecifierSite[] => {
  const found: SpecifierSite[] = [];

  const push = (node: Node | undefined, kind: string): void => {
    if (!node || !Node.isStringLiteral(node)) return;
    found.push({ literal: node, kind });
  };

  for (const declaration of sourceFile.getImportDeclarations()) {
    push(declaration.getModuleSpecifier(), "import");
  }
  for (const declaration of sourceFile.getExportDeclarations()) {
    push(declaration.getModuleSpecifier(), "export-from");
  }
  // `import("./x").Foo` and `typeof import("./x")` in type positions.
  for (const node of sourceFile.getDescendantsOfKind(SyntaxKind.ImportType)) {
    const argument = node.getArgument();
    if (Node.isLiteralTypeNode(argument)) {
      push(argument.getLiteral(), "import-type");
    }
  }
  for (const call of sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  )) {
    const kind = callSpecifierKind(call.getExpression());
    if (kind !== undefined) push(call.getArguments()[0], kind);
  }

  return found;
};

/** Things that look like module references but cannot be resolved statically. */
const collectAmbiguous = (
  root: string,
  sourceFile: SourceFile,
  stems: Set<string>,
): ManualReview[] => {
  const file = relative(root, sourceFile.getFilePath());
  const stemList = [...stems];

  return sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .flatMap((call) => {
      const expression = call.getExpression();
      const name =
        expression.getKind() === SyntaxKind.ImportKeyword
          ? "import()"
          : calleeName(expression);

      const interesting =
        name !== undefined &&
        (name === "import()" || name === "require" || MOCK_HELPERS.has(name));
      if (!interesting) return [];

      const [first] = call.getArguments();
      if (!first || Node.isStringLiteral(first)) return [];

      const text = first.getText();
      if (!stemList.some((stem) => text.includes(stem))) return [];

      return [
        {
          file,
          line: first.getStartLineNumber(),
          detail: `\`${name}\` takes a computed specifier that mentions a renamed module. Only a human can tell what it resolves to.`,
          text: text.length > 120 ? `${text.slice(0, 117)}…` : text,
        },
      ];
    });
};

const isEdit = (value: Edit | ManualReview): value is Edit => "from" in value;

const byFileThenLine = (a: Edit, b: Edit): number => {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  return a.line - b.line;
};

export const rewriteImports = (
  root: string,
  renames: Rename[],
  sourcePaths: string[],
  resolver: AliasResolver,
  apply: boolean,
): RewriteResult => {
  const edits: Edit[] = [];
  const manual: ManualReview[] = [];
  if (renames.length === 0) return { edits, manual };

  // Keyed by absolute path, because that is what the resolver hands back.
  const byOldAbsolute = new Map<string, Rename>();
  const stems = new Set<string>();
  for (const rename of renames) {
    byOldAbsolute.set(join(root, rename.from), rename);
    stems.add(stemOf(basename(rename.from)));
  }

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true },
  });

  const sourceFiles = sourcePaths
    .filter(
      (path) => isLintable(basename(path)) && existsSync(join(root, path)),
    )
    .map((path) => project.addSourceFileAtPath(join(root, path)));

  /**
   * Decide what one specifier becomes: an edit, a note for a human, or nothing.
   * Pulled out of the loop so the loop stays readable and so the three outcomes
   * are visibly exhaustive.
   */
  const considerSite = (
    filePath: string,
    site: SpecifierSite,
  ): Edit | ManualReview | undefined => {
    const specifier = site.literal.getLiteralValue();
    const file = relative(root, filePath);
    const line = site.literal.getStartLineNumber();

    // A specifier can legitimately resolve to several files at once — the
    // `.ios` / `.android` / bare trio of a React Native platform module all
    // answer to `./Theme`. They share a stem, so one rewrite covers them; if
    // they ever disagreed, that would be a genuine ambiguity.
    const hits = resolver
      .candidates(filePath, specifier)
      .map((candidate) => byOldAbsolute.get(candidate))
      .filter((rename): rename is Rename => rename !== undefined);

    const targetStems = [
      ...new Set(hits.map((hit) => stemOf(basename(hit.to)))),
    ];
    const [first] = hits;
    const [newStem] = targetStems;

    if (targetStems.length > 1) {
      return {
        file,
        line,
        detail: `"${specifier}" resolves to several renamed files that are moving to different names (${targetStems.join(", ")}).`,
        text: site.literal.getText(),
      };
    }
    if (first === undefined || newStem === undefined) return undefined;

    const next = rewrittenSpecifier(
      specifier,
      stemOf(basename(first.from)),
      newStem,
    );
    if (next === undefined || next === specifier) return undefined;

    return { file, line, from: specifier, to: next, kind: site.kind };
  };

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();

    const outcomes = specifierLiterals(sourceFile).map((site) => ({
      site,
      outcome: considerSite(filePath, site),
    }));

    const fileEdits = outcomes
      .map(({ site, outcome }) => ({ site, outcome }))
      .filter(
        (entry): entry is { site: SpecifierSite; outcome: Edit } =>
          entry.outcome !== undefined && isEdit(entry.outcome),
      );

    manual.push(
      ...outcomes
        .map(({ outcome }) => outcome)
        .filter(
          (outcome): outcome is ManualReview =>
            outcome !== undefined && !isEdit(outcome),
        ),
      ...collectAmbiguous(root, sourceFile, stems),
    );

    edits.push(...fileEdits.map((entry) => entry.outcome));

    if (apply && fileEdits.length > 0) {
      for (const entry of fileEdits) {
        entry.site.literal.setLiteralValue(entry.outcome.to);
      }
      sourceFile.saveSync();
    }
  }

  edits.sort(byFileThenLine);
  return { edits, manual };
};
