import "./index.css";
import type { FC } from "react";

import { Composition } from "remotion";

import { CodemodsDemo, CodemodsStill } from "../../codemods/demo/media";
import { DocsStill } from "../../docs/demo/media";
import { ObservabilityStill } from "../../observability/demo/media";
import { OxfmtStill } from "../../oxfmt-config/demo/media";
import { OxlintConfigStill } from "../../oxlint-config/demo/media";
import { OxlintPluginStill } from "../../oxlint-plugin/demo/media";
import { ReadmeStill } from "../../readme/demo/media";
import { ThemePaletteStill, ThemeStill } from "../../theme/demo/media";
import { TsconfigStill } from "../../tsconfig/demo/media";
import { MagicDemo } from "./compositions/magic";
import { MagicSocial } from "./compositions/social";
import { VideoDemo, VideoStill } from "./compositions/video";

/**
 * Hero stills share one frame spec so every README image lands identical. The
 * ids here are what the render scripts in package.json call; per-package work
 * happens in that package's own `demo/media.tsx`, never in this file. The
 * sibling imports are relative on purpose: a `demo/` subpath export would
 * advertise a path the published tarball never ships.
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
    <Composition component={VideoStill} id="Video" {...HERO} />
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
    <Composition
      component={VideoDemo}
      durationInFrames={450}
      fps={30}
      height={900}
      id="VideoDemo"
      width={1600}
    />
    <Composition
      component={MagicDemo}
      durationInFrames={450}
      fps={30}
      height={900}
      id="MagicDemo"
      width={1600}
    />
  </>
);
