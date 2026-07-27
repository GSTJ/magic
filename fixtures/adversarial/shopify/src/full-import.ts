// Reported: the whole of lodash for one function.
import lodash from "lodash";
// Reported: the same thing spelled differently — `importNames: ["default"]`
// catches the aliased form too.
import { default as underscore } from "lodash";
// NOT reported: this is the shape the message asks for.
import { debounce } from "lodash/debounce.js";

export const all = [lodash, underscore, debounce];
