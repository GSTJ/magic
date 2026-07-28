// EXPECT: no react-native(no-unused-styles) at all.
//
// This is the component gate, and it is the reason a shared styles module does
// not light up: with no React component in the file, the rule cannot see the
// consumers of the sheet, so upstream reports nothing rather than reporting
// everything. The port reproduces the gate — a version that drops it turns
// every `styles.ts` in a repo into a wall of false positives.
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  consumedElsewhere: { flex: 1 },
  alsoConsumedElsewhere: { flex: 2 },
});
