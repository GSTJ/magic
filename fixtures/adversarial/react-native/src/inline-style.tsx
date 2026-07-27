// EXPECT: react-native(no-inline-styles) and react-native(no-color-literals)
// — proves the eslint-plugin-react-native jsPlugin actually loads under the
// react-native variant (both the .mts path and the emitted JSON path).
import { View } from "react-native";

export const Card = () => (
  <View style={{ backgroundColor: "#ff0000", padding: 8 }} />
);
