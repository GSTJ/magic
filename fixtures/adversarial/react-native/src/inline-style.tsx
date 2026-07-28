// EXPECT: react-native(no-inline-styles) fires 8 times and stays silent on the
// 9 near-misses below. The rule is magic-oxlint-plugin's port of
// eslint-plugin-react-native's, and every branch of the upstream collector is
// represented here — object, array element, logical, conditional, unary — so a
// port that quietly narrows to "plain object literal" fails this fixture.
//
// The first line also still proves what it always proved: the jsPlugin loads
// under the react-native variant, down both the .mts and emitted-JSON paths.
import { View } from "react-native";

declare const cond: boolean;
declare const size: number;
declare const other: number;
declare const left: number;
declare const right: number;
declare const base: object;
declare const sheet: { row: object; column: object };

export const Card = () => (
  <View>
    {/* fires */}
    <View style={{ backgroundColor: "#ff0000", padding: 8 }} />
    <View style={[sheet.row, { margin: 4 }]} />
    <View style={cond ? { padding: 1 } : sheet.row} />
    <View style={cond && { padding: 1 }} />
    <View contentContainerStyle={{ padding: 2 }} />
    <View style={{ height: -1 }} />
    <View style={{ opacity: cond ? 1 : other }} />
    {/* one object, two literals, still one diagnostic */}
    <View style={{ padding: 4, margin: 5 }} />
    {/* SILENT FROM HERE — anything below that reports is a regression */}
    <View style={{}} />
    <View style={sheet.row} />
    <View style={[sheet.row, sheet.column]} />
    <View style={{ padding: size }} />
    <View style={{ ...base }} />
    <View style={{ opacity: cond ? left : right }} />
    <View style={{ transform: { x: size } }} />
    <View style="a-string-not-an-expression" />
    {/* A valueless style attribute. Upstream threw a TypeError out of the JS
        plugin host on this one and took every other rule in the file down with
        it; the port guards it. */}
    <View style />
  </View>
);
