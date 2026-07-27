// EXPECT: three no-restricted-imports diagnostics —
//   TouchableOpacity  -> PressableArea message
//   TouchableHighlight-> PressableArea message
//   Image             -> Image wrapper message (its OWN message, not the first
//                        entry's — this is the per-entry-message behaviour the
//                        old no-restricted-syntax workaround existed for)
// View must NOT be flagged.
import {
  Image,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from "react-native";

export const Buttons = () => (
  <View>
    <TouchableOpacity />
    <TouchableHighlight />
    <Image />
  </View>
);
