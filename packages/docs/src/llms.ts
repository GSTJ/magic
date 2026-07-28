import type { LLMsOptions } from "fumadocs-core/mdx-plugins/remark-llms";
import type { GeneratedDoc } from "fumadocs-typescript";

import {
  renderPlaceholder,
  type PlaceholderData,
} from "fumadocs-core/mdx-plugins/remark-llms.runtime";

import { magicDocsPath, magicDocsUrl, type MagicDocsSite } from "./index.ts";

/**
 * Fumadocs' generated TypeTable prop contains a full ESTree. Preserve it as a
 * placeholder at build time, then render a concise reference for people and
 * agents instead of serializing that implementation detail into Markdown.
 */
export const magicDocsLlmMdxOptions: LLMsOptions = {
  mdxAsPlaceholder: ["TypeTable"],
};

const expressionValue = (
  attributes: Record<string, unknown>,
): string | null => {
  const expression = attributes.type;
  if (
    typeof expression !== "object" ||
    expression === null ||
    !("value" in expression) ||
    typeof expression.value !== "string"
  ) {
    return null;
  }
  return expression.value;
};

const singleLine = (value: string): string =>
  value.replaceAll("\n", " ").replaceAll(/\s+/g, " ").trim();

const escapeCode = (value: string): string =>
  singleLine(value).replaceAll("`", "\\`");

export const renderMagicDocsTypeTable = ({
  attributes,
  children,
}: PlaceholderData): string => {
  const serialized = expressionValue(attributes);
  if (serialized === null) return children;

  let doc: GeneratedDoc;
  try {
    doc = JSON.parse(serialized) as GeneratedDoc;
  } catch {
    return children;
  }

  const entries = doc.entries.map((entry) => {
    const defaultValue = entry.tags.find((tag) => tag.name === "default")?.text;
    const qualifiers = [
      entry.required ? "required" : "optional",
      entry.deprecated ? "deprecated" : undefined,
      defaultValue === undefined
        ? undefined
        : `default: ${singleLine(defaultValue)}`,
    ].filter((value): value is string => value !== undefined);
    const description = singleLine(entry.description);

    return (
      `- \`${escapeCode(entry.name)}\`: \`${escapeCode(entry.type)}\` ` +
      `(${qualifiers.join(", ")})${description ? ` — ${description}` : ""}`
    );
  });

  return [
    `### ${singleLine(doc.name)}`,
    doc.description === undefined ? "" : singleLine(doc.description),
    ...entries,
  ]
    .filter(Boolean)
    .join("\n\n");
};

export const renderMagicDocsLlmMarkdown = (
  processedMarkdown: string,
): Promise<string> =>
  renderPlaceholder(processedMarkdown, {
    TypeTable: renderMagicDocsTypeTable,
  });

export type MagicDocsLlmPage = {
  title: string;
  url: string;
  description?: string;
  processedMarkdown: string;
};

/** Produce one clean, self-identifying page for copy-Markdown/llms-full.txt. */
export const createMagicDocsLlmPage = async (
  site: MagicDocsSite,
  page: MagicDocsLlmPage,
): Promise<string> => {
  const title = singleLine(page.title);
  const description =
    page.description === undefined ? "" : singleLine(page.description);
  const markdown = await renderMagicDocsLlmMarkdown(page.processedMarkdown);

  return [
    `# ${title} (${magicDocsUrl(site, page.url)})`,
    description === "" ? "" : `> ${description}`,
    markdown,
  ]
    .filter(Boolean)
    .join("\n\n");
};

/**
 * Fumadocs' `llms(source).index()` emits application-relative page links.
 * Prefix those links because plain Markdown is outside Next's router.
 */
export const prefixMagicDocsLlmLinks = (
  site: MagicDocsSite,
  markdown: string,
): string =>
  markdown.replaceAll(
    /\]\((\/(?!\/)[^)\s]*)\)/g,
    (_match, path: string) => `](${magicDocsPath(site, path)})`,
  );
