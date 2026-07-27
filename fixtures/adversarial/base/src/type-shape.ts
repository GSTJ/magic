// `typescript/consistent-type-definitions` is `["error", "type"]`. A type alias
// keeps the implicit index signature that `Record<string, unknown>` and Next's
// `Params` constraint need; autofixing this into an `interface` broke every use
// site while the declaration itself stayed green.
export type LngProps = { lng: string };

export const asRecord = (props: LngProps): Record<string, unknown> => props;

// EXPECT: this one IS reported — the rule still enforces one direction.
export interface WrongWayRound {
  a: number;
}
