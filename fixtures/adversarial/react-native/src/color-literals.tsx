// EXPECT: react-native(no-color-literals) fires 6 times — three inline, three
// inside StyleSheet.create — and is silent on the rest. The two entry points
// are separate code paths upstream, so both are exercised.
import { StyleSheet, View } from "react-native";

declare const theme: { bg: string };
declare const cond: boolean;
declare const fallback: string;

export const Swatches = () => (
  <View>
    {/* fires */}
    <View style={{ borderColor: "blue" }} />
    <View style={[{ color: "red" }, sheet.plain]} />
    <View style={{ color: cond ? "red" : fallback }} />
    {/* SILENT: "colour" does not contain "color" */}
    <View style={{ colour: "red" }} />
    {/* SILENT: the value comes from a token */}
    <View style={{ color: theme.bg }} />
    {/* SILENT: neither branch is a literal */}
    <View style={{ color: cond ? theme.bg : fallback }} />
    {/* Every sheet entry is referenced, so no-unused-styles stays out of this
        fixture's way. */}
    <View
      style={[
        sheet.tinted,
        sheet.shadowed,
        sheet.conditioned,
        sheet.tokened,
        sheet.plain,
      ]}
    />
  </View>
);

export const sheet = StyleSheet.create({
  // fires
  tinted: { color: "red", padding: 1 },
  shadowed: { shadowColor: "#000" },
  conditioned: { color: cond ? "red" : fallback },
  // SILENT
  tokened: { backgroundColor: theme.bg },
  plain: { padding: 2 },
});

// SILENT: `create` on something that is not a StyleSheet, and a StyleSheet
// method that is not `create`. Both are the guard against matching on the
// method name alone.
const NotAStyleSheet = { create: (value: object) => value };
export const decoy = NotAStyleSheet.create({ tinted: { color: "red" } });
export const merged = StyleSheet.compose({ color: "red" }, {});
