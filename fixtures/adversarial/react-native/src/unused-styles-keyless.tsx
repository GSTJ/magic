// EXPECT: react-native(no-unused-styles) fires 3 times, with 3 different
// message shapes, because the entry name comes straight off `key.name`:
//
//   [key]         a computed *identifier* key still has `.name` -> `styles.key`
//   "kebab-key"   a string-literal key has none                 -> `styles.`
//   [`tpl`]       nor does a template-literal key               -> `styles.`
//
// Upstream builds the message with
// `["Unused style detected: ", sheet, ".", node.key.name].join("")`, and
// `Array#join` renders a missing name as the empty string, hence the bare
// trailing dot. Interpolating the raw value instead writes `styles.undefined`,
// which is a different message for the same code. That is the one thing the
// port got wrong on its first pass, so the text is pinned whole here rather
// than left for the next reader to rediscover.
import { StyleSheet, View } from "react-native";

const key = "dynamic";

export const Keyless = () => <View style={styles.reachable} />;

const styles = StyleSheet.create({
  reachable: { flex: 1 },
  [key]: { flex: 2 },
  "kebab-key": { flex: 3 },
  [`tpl`]: { flex: 4 },
});
