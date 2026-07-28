import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, normalize, relative } from "node:path";

const modulePath = import.meta.filename;
const defaultRoot = join(import.meta.dirname, "..");

const ITEM_TYPES = new Set([
  "registry:base",
  "registry:block",
  "registry:component",
  "registry:file",
  "registry:font",
  "registry:hook",
  "registry:item",
  "registry:lib",
  "registry:page",
  "registry:style",
  "registry:theme",
  "registry:ui",
]);

const cleanRelativePath = (path) =>
  typeof path === "string" &&
  path.length > 0 &&
  !isAbsolute(path) &&
  !normalize(path).startsWith("..");

const duplicateValues = (values) => {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return [...duplicates];
};

const itemsIn = (registry) =>
  Array.isArray(registry?.items) ? registry.items : [];

const readRegistry = (repoRoot) => {
  const registryPath = join(repoRoot, "registry.json");
  if (!existsSync(registryPath)) {
    return { problems: ["registry.json does not exist."] };
  }

  try {
    return {
      problems: [],
      registry: JSON.parse(readFileSync(registryPath, "utf8")),
    };
  } catch (error) {
    return {
      problems: [`registry.json is not valid JSON: ${error.message}`],
    };
  }
};

const rootProblems = (registry) => {
  const problems = [];
  const items = itemsIn(registry);

  if (registry?.$schema !== "https://ui.shadcn.com/schema/registry.json") {
    problems.push("registry.json must use the current shadcn registry schema.");
  }
  if (registry?.name !== "magic") {
    problems.push('registry.json must keep the GitHub registry name "magic".');
  }
  if (registry?.homepage !== "https://github.com/GSTJ/magic") {
    problems.push(
      "registry.json must point at the public GSTJ/magic repository.",
    );
  }
  if (items.length === 0) {
    problems.push("registry.json must contain at least one item.");
  }

  problems.push(
    ...duplicateValues(items.map((item) => item.name)).map(
      (name) => `registry item "${name}" is declared more than once.`,
    ),
  );

  return problems;
};

const sourceFileProblems = (file, label, repoRoot) => {
  if (!cleanRelativePath(file.path)) {
    return [`${label} has an unsafe file path "${file.path}".`];
  }

  const problems = [];
  if (!existsSync(join(repoRoot, file.path))) {
    problems.push(`${label} references missing file "${file.path}".`);
  }
  if (!ITEM_TYPES.has(file.type)) {
    problems.push(
      `${label} file "${file.path}" has unsupported type "${file.type}".`,
    );
  }
  if (["registry:file", "registry:page"].includes(file.type) && !file.target) {
    problems.push(`${label} file "${file.path}" requires a target.`);
  }

  return problems;
};

const oneItemProblems = (item, repoRoot) => {
  const problems = [];
  const label = `registry item "${item.name ?? "(missing name)"}"`;
  const files = Array.isArray(item.files) ? item.files : [];

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.name ?? "")) {
    problems.push(`${label} must have a kebab-case name.`);
  }
  if (!ITEM_TYPES.has(item.type)) {
    problems.push(`${label} has unsupported type "${item.type}".`);
  }
  if (item.type === "registry:block" && files.length === 0) {
    problems.push(`${label} must contain files.`);
  }
  if (item.type === "registry:block" && !item.description?.trim()) {
    problems.push(`${label} must have a description.`);
  }

  problems.push(
    ...duplicateValues(files.map((file) => file.path)).map(
      (path) => `${label} declares "${path}" more than once.`,
    ),
    ...duplicateValues(files.map((file) => file.target).filter(Boolean)).map(
      (target) => `${label} writes to "${target}" more than once.`,
    ),
    ...files.flatMap((file) => sourceFileProblems(file, label, repoRoot)),
  );

  return problems;
};

const itemProblems = (registry, repoRoot) =>
  itemsIn(registry).flatMap((item) => oneItemProblems(item, repoRoot));

const docsLandingProblems = (registry, repoRoot) => {
  const docsLanding = itemsIn(registry).find(
    (item) => item.name === "docs-landing",
  );
  if (!docsLanding) {
    return ['registry.json must expose the "docs-landing" block.'];
  }

  const problems = [];
  if (docsLanding.type !== "registry:block") {
    problems.push('registry item "docs-landing" must be registry:block.');
  }
  if (!docsLanding.dependencies?.includes("gsap@3.15.0")) {
    problems.push(
      'registry item "docs-landing" must pin the tested GSAP dependency.',
    );
  }

  const source = (docsLanding.files ?? [])
    .filter(
      (file) =>
        cleanRelativePath(file.path) && existsSync(join(repoRoot, file.path)),
    )
    .map((file) => readFileSync(join(repoRoot, file.path), "utf8"))
    .join("\n");

  for (const productTerm of ["MagicModal", "react-native-magic-modal"]) {
    if (source.includes(productTerm)) {
      problems.push(
        `registry item "docs-landing" contains product-specific term "${productTerm}".`,
      );
    }
  }
  if (!source.includes("prefers-reduced-motion")) {
    problems.push(
      'registry item "docs-landing" must keep its reduced-motion behavior.',
    );
  }

  return problems;
};

export const registryProblems = (repoRoot = defaultRoot) => {
  const { problems, registry } = readRegistry(repoRoot);
  if (!registry) return problems;

  return [
    ...problems,
    ...rootProblems(registry),
    ...itemProblems(registry, repoRoot),
    ...docsLandingProblems(registry, repoRoot),
  ];
};

export const validateRegistry = (repoRoot = defaultRoot) => {
  const problems = registryProblems(repoRoot);
  if (problems.length > 0) {
    process.stderr.write(
      `${problems.map((problem) => `  - ${problem}`).join("\n")}\n`,
    );
    return false;
  }

  const shownRoot = relative(process.cwd(), repoRoot) || ".";
  process.stdout.write(
    `validate-registry: OK, ${shownRoot}/registry.json and its source files are consistent.\n`,
  );
  return true;
};

if (process.argv[1] && normalize(process.argv[1]) === normalize(modulePath)) {
  process.exitCode = validateRegistry() ? 0 : 1;
}
