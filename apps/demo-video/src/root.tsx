import "./index.css";
import type { FC } from "react";

import { Composition } from "remotion";

import { CodemodsDemo, CodemodsStill } from "./compositions/codemods";
import { DocsStill } from "./compositions/docs";
import { ObservabilityStill } from "./compositions/observability";
import { OxfmtStill } from "./compositions/oxfmt-config";
import { OxlintConfigStill } from "./compositions/oxlint-config";
import { OxlintPluginStill } from "./compositions/oxlint-plugin";
import { ReadmeStill } from "./compositions/readme";
import { MagicSocial } from "./compositions/social";
import { ThemePaletteStill, ThemeStill } from "./compositions/theme";
import { TsconfigStill } from "./compositions/tsconfig";

/**
 * Hero stills share one frame spec so every README image lands identical. The
 * ids here are what the render scripts in package.json call; per-package work
 * happens in `compositions/<pkg>.tsx`, never in this file.
 */
const HERO = {
  durationInFrames: 1,
  fps: 30,
  height: 900,
  width: 1600,
} as const;

export const RemotionRoot: FC = () => (
  <>
    <Composition component={ThemeStill} id="Theme" {...HERO} />
    <Composition component={CodemodsStill} id="Codemods" {...HERO} />
    <Composition component={OxfmtStill} id="Oxfmt" {...HERO} />
    <Composition component={OxlintConfigStill} id="OxlintConfig" {...HERO} />
    <Composition component={OxlintPluginStill} id="OxlintPlugin" {...HERO} />
    <Composition component={TsconfigStill} id="Tsconfig" {...HERO} />
    <Composition component={DocsStill} id="Docs" {...HERO} />
    <Composition component={ObservabilityStill} id="Observability" {...HERO} />
    <Composition component={ReadmeStill} id="Readme" {...HERO} />
    <Composition
      component={ThemePaletteStill}
      durationInFrames={1}
      fps={30}
      height={500}
      id="ThemePalette"
      width={1600}
    />
    <Composition
      component={MagicSocial}
      durationInFrames={1}
      fps={30}
      height={640}
      id="MagicSocial"
      width={1280}
    />
    <Composition
      component={CodemodsDemo}
      durationInFrames={450}
      fps={30}
      height={900}
      id="CodemodsDemo"
      width={1600}
    />
  </>
);
