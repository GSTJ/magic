// PROBE: unguarded for..in. The old ESLint lineage banned ForInStatement via
// no-restricted-syntax; oxlint's closest rule is guard-for-in. Record whether
// anything fires under the default preset.
export const keysOf = (obj: Record<string, unknown>): string[] => {
  const keys: string[] = [];
  for (const key in obj) {
    keys.push(key);
  }
  return keys;
};
