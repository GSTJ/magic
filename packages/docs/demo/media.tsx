import type { CSSProperties, FC } from "react";

import { CODE, COLORS } from "magic-video/brand";
import { FONTS } from "magic-video/fonts";
import {
  BrandMark,
  SceneBackground,
  WindowFrame,
} from "magic-video/primitives";

/**
 * The docs hero: a browser window on a rendered Fumadocs page, showing the
 * three things the preset standardizes at once. Sidebar navigation, the
 * content column, and a generated type table. The page mocked up is the
 * `react-native-magic-modal` reference page the site contract example in the
 * README defines, so the still and the docs tell the same story.
 */

const CENTERED: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 30,
};

const NAME: CSSProperties = {
  fontFamily: FONTS.sans,
  fontWeight: 700,
  fontSize: 44,
  letterSpacing: -1.4,
  color: COLORS.fg,
};

type NavItem = { active?: boolean; label: string };
type NavGroup = { items: NavItem[]; title: string };

const NAV: NavGroup[] = [
  {
    items: [
      { label: "Overview" },
      { label: "Install" },
      { label: "Quickstart" },
    ],
    title: "Get started",
  },
  {
    items: [
      { label: "Imperative flow" },
      { label: "Typed results" },
      { label: "Recipes" },
    ],
    title: "Guides",
  },
  {
    items: [
      { active: true, label: "ModalProps" },
      { label: "MagicModalHideReason" },
      { label: "Hooks" },
    ],
    title: "Reference",
  },
];

type Row = {
  fallback?: string;
  name: string;
  required?: boolean;
  type: string;
};

const ROWS: Row[] = [
  { name: "children", required: true, type: "ReactNode" },
  {
    fallback: '"down"',
    name: "swipeDirection",
    type: '"up" | "down" | "left" | "right"',
  },
  { fallback: "0.2", name: "dampingFactor", type: "number" },
  { fallback: "true", name: "hideKeyboardOnOpen", type: "boolean" },
  { fallback: "hide()", name: "onBackdropPress", type: "() => void" },
];

/** Prop, type, default. The grid every generated reference table shares. */
const TABLE_COLUMNS: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "250px 1fr 150px",
  gap: 24,
  alignItems: "baseline",
};

const NavLink: FC<NavItem> = ({ active, label }) => (
  <div
    style={{
      backgroundColor: active ? COLORS.selection : "transparent",
      borderRadius: 8,
      color: active ? COLORS.fg : COLORS.fgMuted,
      fontFamily: FONTS.sans,
      fontWeight: active ? 600 : 400,
      fontSize: 16,
      padding: "6px 12px",
    }}
  >
    {label}
  </div>
);

const Sidebar: FC = () => (
  <div
    style={{
      width: 258,
      flexShrink: 0,
      boxSizing: "border-box",
      padding: "20px 16px",
      borderRight: `1px solid ${COLORS.border}`,
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 9,
        padding: "7px 12px",
        fontFamily: FONTS.sans,
        fontSize: 14,
        color: COLORS.fgMuted,
      }}
    >
      Search docs
      <span style={{ fontFamily: FONTS.mono, fontSize: 12, opacity: 0.8 }}>
        /
      </span>
    </div>
    {NAV.map((group) => (
      <div
        key={group.title}
        style={{ display: "flex", flexDirection: "column", gap: 3 }}
      >
        <div
          style={{
            fontFamily: FONTS.sans,
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: COLORS.fgMuted,
            opacity: 0.75,
            padding: "0 12px 5px",
          }}
        >
          {group.title}
        </div>
        {group.items.map((item) => (
          <NavLink key={item.label} {...item} />
        ))}
      </div>
    ))}
  </div>
);

const TypeTable: FC = () => (
  <div style={{ marginTop: 30 }}>
    <div
      style={{
        ...TABLE_COLUMNS,
        paddingBottom: 10,
        borderBottom: `1px solid ${COLORS.border}`,
        fontFamily: FONTS.sans,
        fontWeight: 600,
        fontSize: 12,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: COLORS.fgMuted,
      }}
    >
      <div>Prop</div>
      <div>Type</div>
      <div>Default</div>
    </div>
    {ROWS.map((row) => (
      <div
        key={row.name}
        style={{
          ...TABLE_COLUMNS,
          padding: "12px 0",
          borderBottom: `1px solid ${COLORS.line}`,
          fontFamily: FONTS.mono,
          fontSize: 16.5,
          letterSpacing: -0.3,
        }}
      >
        <div style={{ color: CODE.parameter }}>
          {row.name}
          {row.required ? (
            <span
              style={{
                marginLeft: 10,
                padding: "1px 7px",
                border: `1px solid ${COLORS.error}`,
                borderRadius: 6,
                color: COLORS.error,
                fontSize: 11,
              }}
            >
              required
            </span>
          ) : null}
        </div>
        <div style={{ color: CODE.type }}>{row.type}</div>
        <div style={{ color: COLORS.fgMuted }}>{row.fallback ?? "-"}</div>
      </div>
    ))}
  </div>
);

const ContentColumn: FC = () => (
  <div
    style={{
      flex: 1,
      boxSizing: "border-box",
      padding: "30px 44px",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: FONTS.mono,
        fontSize: 13.5,
        color: COLORS.fgMuted,
      }}
    >
      <div>Reference / ModalProps</div>
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 7,
          padding: "5px 11px",
        }}
      >
        Copy Markdown
      </div>
    </div>
    <div
      style={{
        marginTop: 24,
        fontFamily: FONTS.sans,
        fontWeight: 700,
        fontSize: 42,
        letterSpacing: -1.4,
        color: COLORS.fg,
      }}
    >
      ModalProps
    </div>
    <div
      style={{
        marginTop: 12,
        fontFamily: FONTS.sans,
        fontSize: 18,
        lineHeight: 1.5,
        color: COLORS.fgMuted,
      }}
    >
      Props for every modal shown through{" "}
      <span style={{ color: CODE.fn, fontFamily: FONTS.mono, fontSize: 16.5 }}>
        magicModal.show()
      </span>
      , generated from source at build time.
    </div>
    <TypeTable />
  </div>
);

export const DocsStill: FC = () => (
  <SceneBackground>
    <div style={CENTERED}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <BrandMark size={46} />
        <div style={NAME}>magic-docs</div>
      </div>
      <WindowFrame
        height={620}
        title="gstj.github.io/react-native-magic-modal"
        width={1240}
      >
        <div style={{ display: "flex", height: "100%" }}>
          <Sidebar />
          <ContentColumn />
        </div>
      </WindowFrame>
    </div>
  </SceneBackground>
);
