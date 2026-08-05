import { useEffect, useState } from "react";

import theme from "magic-theme/vscode/themes/magic-theme-color-theme.json";
import { cancelRender, continueRender, delayRender } from "remotion";
import {
  type BundledLanguage,
  createHighlighter,
  type Highlighter,
  type ThemedToken,
  type ThemeRegistrationRaw,
} from "shiki";

/**
 * Re-exported so a package drawing its own media types its token state without
 * depending on shiki itself; `magic-video/shiki` is the only door it needs.
 */
export type { ThemedToken };

/**
 * One highlighter for the whole render, loaded with the actual published
 * theme JSON so every code shot is pixel-honest against a real editor.
 */
const themeRegistration = theme as unknown as ThemeRegistrationRaw;

let highlighterPromise: Promise<Highlighter> | undefined;

const getHighlighter = (): Promise<Highlighter> => {
  highlighterPromise ??= createHighlighter({
    langs: ["typescript", "tsx", "json", "shellscript"],
    themes: [themeRegistration],
  });
  return highlighterPromise;
};

export const tokenize = async (
  code: string,
  lang: BundledLanguage = "tsx",
): Promise<ThemedToken[][]> => {
  const highlighter = await getHighlighter();
  return highlighter.codeToTokensBase(code, { lang, theme: themeRegistration });
};

/**
 * Tokenizing is async and Remotion screenshots frames synchronously, so the
 * bridge is delayRender: hold the frame, tokenize, continue. Returns null
 * until the tokens exist; render nothing (or a plain pane) meanwhile.
 */
export const useTokens = (
  code: string,
  lang: BundledLanguage = "tsx",
): ThemedToken[][] | null => {
  const [handle] = useState(() => delayRender(`shiki tokenize (${lang})`));
  const [lines, setLines] = useState<ThemedToken[][] | null>(null);

  useEffect(() => {
    tokenize(code, lang)
      .then((tokens) => {
        setLines(tokens);
        continueRender(handle);
      })
      .catch((error: unknown) => {
        cancelRender(error);
      });
  }, [code, lang, handle]);

  return lines;
};
