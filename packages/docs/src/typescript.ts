import {
  createFileSystemGeneratorCache,
  createGenerator,
  remarkAutoTypeTable,
  type Generator,
  type GeneratorOptions,
  type RemarkAutoTypeTableOptions,
} from "fumadocs-typescript";

export type MagicDocsTypeScriptOptions = {
  /** Persistent build cache. Keep it inside an already-ignored build folder. */
  cacheDirectory?: string;
  generator?: Omit<GeneratorOptions, "cache">;
  remark?: Omit<RemarkAutoTypeTableOptions, "generator">;
};

export type MagicDocsTypeScriptPreset = {
  generator: Generator;
  remarkPlugin: [typeof remarkAutoTypeTable, RemarkAutoTypeTableOptions];
};

/**
 * Build-time TypeScript reference preset. It resolves paths relative to each
 * MDX file, unlike the server-only AutoTypeTable component, and emits the
 * regular Fumadocs TypeTable consumed by `magic-docs/mdx`.
 */
export const createMagicDocsTypeScript = (
  options: MagicDocsTypeScriptOptions = {},
): MagicDocsTypeScriptPreset => {
  const generator = createGenerator({
    ...options.generator,
    cache: createFileSystemGeneratorCache(
      options.cacheDirectory ?? ".next/fumadocs-typescript",
    ),
  });

  const remarkPlugin: [typeof remarkAutoTypeTable, RemarkAutoTypeTableOptions] =
    [
      remarkAutoTypeTable,
      {
        ...options.remark,
        generator,
      },
    ];

  return { generator, remarkPlugin };
};
