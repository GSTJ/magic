// EXPECT: safe-jsx(jsx-explicit-boolean) on the `items.length &&` render.
// This file is also the --fix subject: the runner copies it, runs --fix on the
// copy, and asserts the copy gains Boolean(...) and stops tripping the rule.
export const List = ({ items }: { items: string[] }) => (
  <ul>{items.length && <li>{items[0]}</li>}</ul>
);
