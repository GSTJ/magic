import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { registryProblems } from "./validate-registry.mjs";

const repoRoot = join(import.meta.dirname, "..");

test("the checked-in shadcn registry is internally consistent", () => {
  assert.deepEqual(registryProblems(repoRoot), []);
});

test("registry validation rejects a missing source file", () => {
  const directory = mkdtempSync(join(tmpdir(), "magic-registry-"));

  try {
    writeFileSync(
      join(directory, "registry.json"),
      JSON.stringify({
        $schema: "https://ui.shadcn.com/schema/registry.json",
        name: "magic",
        homepage: "https://github.com/GSTJ/magic",
        items: [
          {
            name: "docs-landing",
            type: "registry:block",
            description: "Docs landing.",
            dependencies: ["gsap@3.15.0"],
            files: [
              {
                path: "registry/default/docs-landing/missing.tsx",
                type: "registry:component",
              },
            ],
          },
        ],
      }),
    );

    const problems = registryProblems(directory);
    assert.ok(
      problems.includes(
        'registry item "docs-landing" references missing file "registry/default/docs-landing/missing.tsx".',
      ),
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("registry validation catches product copy in the reusable block", () => {
  const directory = mkdtempSync(join(tmpdir(), "magic-registry-"));
  const sourceDirectory = join(
    directory,
    "registry",
    "default",
    "docs-landing",
  );

  try {
    mkdirSync(sourceDirectory, { recursive: true });
    writeFileSync(
      join(sourceDirectory, "docs-landing.tsx"),
      "const product = 'MagicModal'; // prefers-reduced-motion\n",
    );
    writeFileSync(
      join(directory, "registry.json"),
      JSON.stringify({
        $schema: "https://ui.shadcn.com/schema/registry.json",
        name: "magic",
        homepage: "https://github.com/GSTJ/magic",
        items: [
          {
            name: "docs-landing",
            type: "registry:block",
            description: "Docs landing.",
            dependencies: ["gsap@3.15.0"],
            files: [
              {
                path: "registry/default/docs-landing/docs-landing.tsx",
                type: "registry:component",
              },
            ],
          },
        ],
      }),
    );

    assert.ok(
      registryProblems(directory).includes(
        'registry item "docs-landing" contains product-specific term "MagicModal".',
      ),
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
