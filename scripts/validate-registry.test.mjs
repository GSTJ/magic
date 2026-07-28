import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { registryProblems } from "./validate-registry.mjs";

const repoRoot = join(import.meta.dirname, "..");
const itemSchema = "https://ui.shadcn.com/schema/registry-item.json";

const writeFixture = (
  directory,
  {
    sourceContent = "const demo = true; // prefers-reduced-motion\n",
    writeSource = true,
  } = {},
) => {
  const sourcePath = "registry/default/docs-landing/docs-landing.tsx";
  const sourceDirectory = join(
    directory,
    "registry",
    "default",
    "docs-landing",
  );
  const outputDirectory = join(directory, "public", "r");
  const registry = {
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
            path: sourcePath,
            type: "registry:component",
          },
        ],
      },
    ],
  };

  mkdirSync(outputDirectory, { recursive: true });
  if (writeSource) {
    mkdirSync(sourceDirectory, { recursive: true });
    writeFileSync(join(directory, sourcePath), sourceContent);
  }

  writeFileSync(join(directory, "registry.json"), JSON.stringify(registry));
  writeFileSync(
    join(outputDirectory, "registry.json"),
    JSON.stringify(registry),
  );
  writeFileSync(
    join(outputDirectory, "docs-landing.json"),
    JSON.stringify({
      $schema: itemSchema,
      ...registry.items[0],
      files: [
        {
          ...registry.items[0].files[0],
          content: sourceContent,
        },
      ],
    }),
  );

  return {
    catalogPath: join(outputDirectory, "registry.json"),
    itemPath: join(outputDirectory, "docs-landing.json"),
    registry,
    sourcePath,
  };
};

test("the checked-in shadcn registry is internally consistent", () => {
  assert.deepEqual(registryProblems(repoRoot), []);
});

test("registry validation rejects a missing source file", () => {
  const directory = mkdtempSync(join(tmpdir(), "magic-registry-"));

  try {
    const { registry } = writeFixture(directory, { writeSource: false });
    registry.items[0].files[0].path =
      "registry/default/docs-landing/missing.tsx";
    writeFileSync(join(directory, "registry.json"), JSON.stringify(registry));
    writeFileSync(
      join(directory, "public", "r", "registry.json"),
      JSON.stringify(registry),
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

  try {
    writeFixture(directory, {
      sourceContent:
        "const product = 'MagicModal'; // prefers-reduced-motion\n",
    });

    assert.ok(
      registryProblems(directory).includes(
        'registry item "docs-landing" contains product-specific term "MagicModal".',
      ),
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("registry validation rejects stale content in a published item", () => {
  const directory = mkdtempSync(join(tmpdir(), "magic-registry-"));

  try {
    const { itemPath, registry } = writeFixture(directory);
    writeFileSync(
      itemPath,
      JSON.stringify({
        $schema: itemSchema,
        ...registry.items[0],
        files: [
          {
            ...registry.items[0].files[0],
            content: "const stale = true;\n",
          },
        ],
      }),
    );

    const problems = registryProblems(directory);
    assert.ok(
      problems.includes(
        'public/r/docs-landing.json embeds stale content for "registry/default/docs-landing/docs-landing.tsx".',
      ),
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("registry validation rejects catalog drift and stale output", () => {
  const directory = mkdtempSync(join(tmpdir(), "magic-registry-"));

  try {
    const { catalogPath, registry } = writeFixture(directory);
    writeFileSync(
      catalogPath,
      JSON.stringify({
        ...registry,
        homepage: "https://example.com",
      }),
    );
    writeFileSync(join(directory, "public", "r", "retired-item.json"), "{}");

    const problems = registryProblems(directory);
    assert.ok(
      problems.includes(
        'public/r/registry.json is out of sync with registry.json; run "pnpm dlx shadcn@latest build registry.json --output public/r".',
      ),
    );
    assert.ok(
      problems.includes(
        'public/r contains unexpected output "retired-item.json".',
      ),
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
