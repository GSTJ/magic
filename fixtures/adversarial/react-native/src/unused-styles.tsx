// EXPECT: react-native(no-unused-styles) fires 3 times — everything except
// `used`. The three silent ones are the matching rules that decide it:
//
//   deepAccessOnly     `styles.deepAccessOnly.flex` marks nothing, because the
//                      inner member expression's parent is another one
//   computedAccessOnly `styles["computedAccessOnly"]` is not an identifier
//                      property, so it marks nothing either
//   notThisSheet       a same-named property on a different object must not
//                      mark this sheet's entry as used
import { StyleSheet, View } from "react-native";

declare const elsewhere: { neverReferenced: number };

export const Used = () => <View style={styles.used} />;

export const Deep = () => {
  const flex = Number(styles.deepAccessOnly.flex);
  const computed = styles["computedAccessOnly"];
  const decoy = elsewhere.neverReferenced;
  return <View>{[flex, computed, decoy].length}</View>;
};

const styles = StyleSheet.create({
  used: { flex: 1 },
  neverReferenced: { flex: 2 },
  deepAccessOnly: { flex: 3 },
  computedAccessOnly: { flex: 4 },
});
