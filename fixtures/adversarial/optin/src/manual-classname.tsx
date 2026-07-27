// EXPECT with magic/no-manual-classname ON: 6 diagnostics.
//   - the SIDE_CLASS splice, via a const  -> fires, with the `cva`/`tv` message
//   - the same splice inline              -> fires, same message
//   - the `+` concatenation               -> fires
//   - the ternary in the attribute        -> fires
//   - the `&&` in the attribute           -> fires
//   - the hand-built `const` behind one   -> fires
//   - everything under "NOT reported"     -> must stay silent
//
// EXPECT with the rule NOT named in the config (plugin-only.config.mts):
//   - zero diagnostics from this file, which is the opt-in guarantee.
type Side = "left" | "right" | "inline";

declare const cn: (...parts: unknown[]) => string;
declare const button: (options: { size: "sm" | "lg" }) => string;

// The screenshot, transcribed from gabriel-taveira-portfolio's marginalia.tsx:
// a variant axis written as a Record, held together by leading spaces, spliced
// back in with `${}`. This is what `cva`/`tv` declare properly.
const SIDE_CLASS: Record<Side, string> = {
  left: " ws-marginalia-left",
  right: " ws-marginalia-right",
  inline: "",
};

export const Marginalia = ({ side }: { side: Side }) => {
  const className = `ws-marginalia${SIDE_CLASS[side]}`;
  return <span className={className} />;
};

export const Handle = ({ side }: { side: Side }) => (
  <div className={`ws-base${SIDE_CLASS[side]}`} />
);

export const Concatenated = ({ extra }: { extra: string }) => (
  <div className={"p-2 " + extra} />
);

export const Ternary = ({ active }: { active: boolean }) => (
  <div className={active ? "bg-accent p-2" : "bg-muted p-2"} />
);

export const AndAnd = ({ active }: { active: boolean }) => (
  <div className={active && "bg-accent"} />
);

// One line up is still by hand. Same-file `const`, single declaration.
export const ViaConst = ({ active }: { active: boolean }) => {
  const classes = `p-2 ${active ? "bg-accent" : "bg-muted"}`;
  return <div className={classes} />;
};

// --- NOT reported ------------------------------------------------------------

// The composer is the answer, so it has to survive the rule. Its arguments are
// its own business — a ternary in there is fine.
export const Composed = ({ active }: { active: boolean }) => (
  <div className={cn("p-2", active && "bg-accent", active ? "on" : "off")} />
);

// A `cva`/`tv` result, called.
export const Variant = ({ size }: { size: "sm" | "lg" }) => (
  <div className={button({ size })} />
);

// A plain literal, a template with nothing interpolated, a pass-through prop.
// The prop is read as `props.className` rather than destructured on purpose:
// destructuring it would bind the name `className` a second time in this file,
// and the rule gives up on a name it sees bound twice. `rules.test.mjs` covers
// the destructured spelling, in a file with no such collision.
export const Plain = (props: { className: string }) => (
  <>
    <div className="p-2 text-sm" />
    <div className={`p-2 text-sm`} />
    <div className={props.className} />
  </>
);

// `||` and `??` in an attribute read as a default, not as composition.
export const Defaulted = ({ own }: { own?: string }) => (
  <>
    <div className={own || "p-2"} />
    <div className={own ?? "p-2"} />
  </>
);

// Other attributes are not this rule's business.
export const OtherAttributes = ({ label }: { label: string }) => (
  <img alt={`icon for ${label}`} src={"/i/" + label} />
);
