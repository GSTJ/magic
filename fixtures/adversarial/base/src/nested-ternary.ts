// EXPECT: eslint(no-nested-ternary) (unicorn/no-nested-ternary may double up).
export const label = (tier: number): string =>
  tier > 2 ? (tier > 5 ? "gold" : "silver") : "bronze";
