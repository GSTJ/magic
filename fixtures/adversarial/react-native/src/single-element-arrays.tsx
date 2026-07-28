// EXPECT: react-native(no-single-element-style-arrays) fires twice, and the
// autofix converges to `style={x}` in one pass.
//
// The near-misses matter more than the hits here: this rule matches the
// attribute name `style` EXACTLY, while no-inline-styles matches any name
// containing "style". That asymmetry is upstream's and the port keeps it, so
// `contentContainerStyle={[one]}` below must stay silent.
import { View } from "react-native";

declare const sheet: { row: object; column: object };

export const Rows = () => (
  <View>
    {/* fires */}
    <View style={[sheet.row]} />
    <View style={[{ padding: 9 }]} />
    {/* SILENT */}
    <View style={[sheet.row, sheet.column]} />
    <View style={[]} />
    <View contentContainerStyle={[sheet.row]} />
    <View style={sheet.row} />
  </View>
);
