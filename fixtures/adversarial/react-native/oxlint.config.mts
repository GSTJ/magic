import reactNative from "magic-oxlint-config/react-native";
import { defineConfig } from "oxlint";

// The react-native variant PLUS the root README's "Local overrides" snippet,
// verbatim — the supported way a repo bans Touchables/Image with per-import
// custom messages.
export default defineConfig({
  extends: [reactNative],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "react-native",
            importNames: ["TouchableOpacity", "TouchableHighlight"],
            message:
              "Import { PressableArea } from '@/components/PressableArea' instead.",
          },
          {
            name: "react-native",
            importNames: ["Image"],
            message: "Import { Image } from '@/components/Image' instead.",
          },
        ],
      },
    ],
  },
});
