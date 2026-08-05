import { readFileSync } from "node:fs";
import path from "node:path";

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setMuted(true);

// The workspace standardizes on typescript 7, whose CJS entry no longer
// exports `sys`. Remotion's esbuild-loader requires bare `typescript` only to
// read tsconfig.json and crashes on that hoisted copy. Handing it the raw
// tsconfig up front makes it skip the require entirely (esbuild parses the
// JSONC string itself), which is behavior-identical to what the loader would
// have produced with typescript 5.
const tsconfigRaw = readFileSync(
  path.join(process.cwd(), "tsconfig.json"),
  "utf8",
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

Config.overrideWebpackConfig((config) => {
  const rules = config.module?.rules ?? [];
  const esbuildLoaderOptions = rules
    .filter(isRecord)
    .flatMap((rule) => (Array.isArray(rule.use) ? rule.use : []))
    .filter(isRecord)
    .filter(
      (use) =>
        typeof use.loader === "string" && use.loader.includes("esbuild-loader"),
    )
    .map((use) => use.options)
    .filter(isRecord);

  for (const options of esbuildLoaderOptions) {
    options.tsconfigRaw = tsconfigRaw;
  }

  return config;
});
