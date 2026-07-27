const useState = <T>(initial: T): [T, (next: T) => void] => [
  initial,
  () => undefined,
];

/** Reported: four positional values and nothing that checks their order. */
export const useCounter = () => {
  const [value, setValue] = useState(0);
  return [value, setValue, () => setValue(0), value > 0];
};

/** NOT reported: two is the limit, and `const [a, setA] = useX()` still reads. */
export const usePair = () => {
  const [value, setValue] = useState(0);
  return [value, setValue];
};

/** NOT reported at any size: an object names its members. The escape hatch. */
export const useNamed = () => {
  const [value, setValue] = useState(0);
  return { isPositive: value > 0, reset: () => setValue(0), setValue, value };
};

/** NOT reported: not a hook. The rule only looks at `use*`. */
export const buildTuple = () => [1, 2, 3, 4];
