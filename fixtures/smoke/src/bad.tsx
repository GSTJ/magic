// Every line below is deliberately wrong. See scripts/smoke.mjs for the exact
// list of rules this file is expected to trip.
import { useState } from "react";

import { unusedHelper } from "./helpers";

const FIXTURE_VALUE = process.env.FIXTURE_VALUE;

export const Bad = ({ items, tier }: { items: string[]; tier: number }) => {
  const [count, setCount] = useState(0);

  console.log(FIXTURE_VALUE);

  const label = tier > 2 ? (tier > 5 ? "gold" : "silver") : "bronze";

  return (
    <div onClick={() => setCount(count + 1)}>
      {items.length && <span>{label}</span>}
      {count}
    </div>
  );
};

export const wrapped = (ok: boolean) => {
  if (ok) {
    doWork();
    doMoreWork();
  }
};

declare function doWork(): void;
declare function doMoreWork(): void;
