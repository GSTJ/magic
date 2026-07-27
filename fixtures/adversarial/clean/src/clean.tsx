// FALSE-POSITIVE GUARD: this file must produce ZERO diagnostics under every
// variant (base, react, react-native, next, expo). Ordinary, idiomatic code —
// if any preset flags anything here, that's a false positive (or a preset
// choice worth flagging to the integrator).
import { useMemo } from "react";

interface Item {
  id: string;
  label: string;
}

const byLabel = (a: Item, b: Item): number => a.label.localeCompare(b.label);

export const ItemList = ({
  items,
  query,
}: {
  items: Item[];
  query: string;
}) => {
  const visible = useMemo(() => {
    const needle = query.toLowerCase();
    return items
      .filter((item) => item.label.toLowerCase().includes(needle))
      .toSorted(byLabel);
  }, [items, query]);

  if (visible.length === 0) {
    return <p>Nothing matches</p>;
  }

  return (
    <ul>
      {visible.map((item) => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ul>
  );
};
