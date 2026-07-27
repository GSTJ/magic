// PROBE: `with` statement. Only legal in sloppy-mode scripts, so this is a
// CommonJS-style .js file. Record whether oxlint parses it and whether no-with
// (or anything) fires under the default preset.
const settings = { volume: 5 };

with (settings) {
  // eslint-disable-next-line no-undef
  module.exports = { volume };
}
