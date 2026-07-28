import type { MDXComponents } from "mdx/types";

import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";

/**
 * The small, curated MDX vocabulary shared by every GSTJ package. These are
 * additive to Fumadocs' built-ins (cards, callouts, headings, and code blocks).
 */
export const createMagicDocsMdxComponents = (
  overrides: MDXComponents = {},
): MDXComponents => ({
  ...defaultMdxComponents,
  Accordion,
  Accordions,
  File,
  Files,
  Folder,
  Step,
  Steps,
  Tab,
  Tabs,
  TypeTable,
  ...overrides,
});
