# Third-party notices

`magic-oxlint-plugin` bundles no dependencies. It does contain code derived from
one third-party project, listed below with its licence.

## eslint-plugin-react-native

- Upstream: https://github.com/intellicode/eslint-plugin-react-native
- Version read: `5.0.0`
- Licence: MIT

Derived files in this package:

| File                                                       | Derived from                                  |
| ---------------------------------------------------------- | --------------------------------------------- |
| `src/rules/react-native/no-inline-styles.ts`               | `lib/rules/no-inline-styles.js`               |
| `src/rules/react-native/no-color-literals.ts`              | `lib/rules/no-color-literals.js`              |
| `src/rules/react-native/no-single-element-style-arrays.ts` | `lib/rules/no-single-element-style-arrays.js` |
| `src/rules/react-native/no-unused-styles.ts`               | `lib/rules/no-unused-styles.js`               |
| `src/rules/react-native/stylesheet.ts`                     | `lib/util/stylesheet.js`                      |
| `src/rules/react-native/components.ts`                     | `lib/util/Components.js`                      |

These are ports rather than copies — the code is rewritten in TypeScript against
oxlint's `createOnce` rule API — but the matching logic, the reported nodes and
the message strings are upstream's, so upstream's copyright and licence travel
with them. Each file carries the attribution in its header. Divergences are
recorded at the site and in `README.md`.

`lib/util/Components.js` is itself derived from `eslint-plugin-react`
(MIT, Copyright (c) 2014 Yannick Croissant), which is why its author line names
Yannick Croissant.

### Licence

```
The MIT License (MIT)

Copyright (c) 2015 Tom Hastjarjanto

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
