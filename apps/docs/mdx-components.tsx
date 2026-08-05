import type { MDXComponents } from "mdx/types";

import { createMagicDocsMdxComponents } from "magic-docs/mdx";

import { MagicMark } from "@/components/magic-mark";

const components = (overrides: MDXComponents = {}): MDXComponents =>
  createMagicDocsMdxComponents({ MagicMark, ...overrides });

export const getMDXComponents = components;
export const useMDXComponents = components;
