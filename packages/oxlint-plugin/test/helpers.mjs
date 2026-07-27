/**
 * Test harness: run the real oxlint binary over a temp file with the real
 * plugin loaded, and read the diagnostics back.
 *
 * Asserting against oxlint's actual output rather than a hand-rolled RuleTester
 * is the whole point — these rules exist to run under oxlint's `createOnce`
 * API, and a mock context would happily pass while the real integration broke.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const require_ = createRequire(import.meta.url);

const packageRoot = join(import.meta.dirname, "..");
const oxlintBin = join(
  dirname(require_.resolve("oxlint/package.json", { paths: [packageRoot] })),
  "bin",
  "oxlint",
);

/**
 * @param {{
 *   files: Record<string, string>,
 *   rules: Record<string, unknown>,
 *   overrides?: unknown[],
 * }} options
 * @returns {{ ruleId: string, message: string, file: string, line: number }[]}
 */
export const lint = ({ files, rules, overrides }) => {
  const dir = mkdtempSync(join(tmpdir(), "magic-oxlint-plugin-"));

  try {
    writeFileSync(
      join(dir, ".oxlintrc.json"),
      JSON.stringify({
        // An absolute specifier keeps resolution independent of where the temp
        // directory lands relative to node_modules.
        jsPlugins: [
          { name: "magic", specifier: join(packageRoot, "dist", "index.js") },
        ],
        rules,
        ...(overrides ? { overrides } : {}),
      }),
    );

    for (const [name, contents] of Object.entries(files)) {
      const target = join(dir, name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents);
    }

    let stdout = "";
    try {
      stdout = execFileSync(oxlintBin, ["--format", "json", "."], {
        cwd: dir,
        encoding: "utf8",
      });
    } catch (error) {
      // oxlint exits non-zero whenever it reports anything, which is the
      // normal case here. The JSON payload is still on stdout.
      stdout = error.stdout ?? "";
      if (!stdout) throw error;
    }

    const parsed = JSON.parse(stdout);
    const diagnostics = Array.isArray(parsed)
      ? parsed
      : (parsed.diagnostics ?? []);

    return diagnostics.map((diagnostic) => ({
      ruleId: diagnostic.code ?? diagnostic.ruleId ?? "",
      message: diagnostic.message ?? "",
      file: diagnostic.filename ?? diagnostic.fileName ?? "",
      line: diagnostic.labels?.[0]?.span?.line ?? 0,
    }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** Count diagnostics whose rule id contains `name`. */
export const countFor = (diagnostics, name) =>
  diagnostics.filter((diagnostic) => diagnostic.ruleId.includes(name)).length;
