/**
 * Turning whatever was thrown, plus whatever the caller knew at the time, into
 * something PostHog can index.
 *
 * Two problems, both seen in the repos this package replaces:
 *
 *   - `throw "nope"` and `throw { code: 500 }` are legal, and `captureException`
 *     given a non-Error produces an event with no stack and no message.
 *     chatmode's `Logger.error` normalised by hand; pegada's `sendError` did
 *     not. Now neither has to.
 *   - Context objects are nested (`{ request: { id, path } }`), and PostHog
 *     property filters work on scalars. Nesting them means the property exists
 *     but nobody can filter on it.
 */
import type { Properties } from "./types.ts";

/** How deep {@link flattenContext} recurses before it gives up and stringifies. */
const MAX_DEPTH = 3;

/** Longest string a flattened value may be before it is truncated. */
const MAX_STRING_LENGTH = 8192;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/** `JSON.stringify` that cannot throw, for cycles and BigInt. */
const safeStringify = (value: unknown): string => {
  try {
    const seen = new WeakSet<object>();
    return (
      JSON.stringify(value, (_key, entry: unknown) => {
        if (typeof entry === "bigint") return `${entry.toString()}n`;
        if (typeof entry !== "object" || entry === null) return entry;
        if (seen.has(entry)) return "[Circular]";
        seen.add(entry);
        return entry;
      }) ?? String(value)
    );
  } catch {
    return Object.prototype.toString.call(value);
  }
};

const truncate = (value: string): string =>
  value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}… [truncated]`
    : value;

/** A short, readable rendering of a value for an error message. */
export const describeValue = (value: unknown): string => {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object" || typeof value === "function") {
    return truncate(safeStringify(value));
  }
  return truncate(String(value));
};

/**
 * Whatever was thrown, as an `Error`.
 *
 * Error-shaped objects (a string `message`, and often `name`/`stack`) are
 * rebuilt rather than wrapped, because their stack is the useful one — this is
 * what a serialised error crossing a worker or an RPC boundary looks like.
 * Anything else becomes a `NonError`, which is a searchable exception type in
 * PostHog and tells you the throw site is wrong.
 */
export const normalizeError = (value: unknown): Error => {
  if (value instanceof Error) return value;

  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  ) {
    const source = value as {
      message: string;
      name?: unknown;
      stack?: unknown;
    };
    const error = new Error(source.message);
    if (typeof source.name === "string") error.name = source.name;
    if (typeof source.stack === "string") error.stack = source.stack;
    return error;
  }

  const error = new Error(`Non-error thrown: ${describeValue(value)}`);
  error.name = "NonError";
  return error;
};

/** One key's worth of flattened output. Split out so the walk has no `continue`. */
const flattenValue = (
  path: string,
  value: unknown,
  depth: number,
): Properties => {
  if (value === undefined) return {};
  if (value === null || typeof value === "boolean") return { [path]: value };
  if (typeof value === "number") {
    return { [path]: Number.isFinite(value) ? value : String(value) };
  }
  if (typeof value === "string") return { [path]: truncate(value) };
  if (value instanceof Date) return { [path]: value.toISOString() };

  if (value instanceof Error) {
    return {
      [`${path}.name`]: value.name,
      [`${path}.message`]: truncate(value.message),
      ...(value.stack ? { [`${path}.stack`]: truncate(value.stack) } : {}),
    };
  }

  if (isPlainObject(value) && depth < MAX_DEPTH) {
    return flattenContext(value, path, depth + 1);
  }

  return { [path]: describeValue(value) };
};

/**
 * One flat property bag, with nested keys joined by `.`.
 *
 * `undefined` values are dropped rather than sent — PostHog stores an explicit
 * `null` differently from an absent property, and a context helper that
 * scatters nulls across every event makes the property list unusable.
 */
export const flattenContext = (
  context: Properties | undefined,
  prefix = "",
  depth = 0,
): Properties => {
  if (!context) return {};

  const output: Properties = {};
  for (const [key, value] of Object.entries(context)) {
    Object.assign(
      output,
      flattenValue(prefix ? `${prefix}.${key}` : key, value, depth),
    );
  }
  return output;
};

/**
 * Later objects win, and an explicit `undefined` does not erase an earlier
 * value — it is treated as "I have nothing to say about this key".
 */
export const mergeContext = (
  ...contexts: readonly (Properties | undefined)[]
): Properties => {
  const output: Properties = {};
  for (const context of contexts) {
    for (const [key, value] of Object.entries(context ?? {})) {
      if (value !== undefined) output[key] = value;
    }
  }
  return output;
};

/**
 * The properties for an `$exception` event: defaults, then the call-site
 * context, flattened, with `distinctId` removed because it is routed
 * separately.
 */
export const buildErrorProperties = (
  defaultContext: Properties | undefined,
  context: Properties | undefined,
): Properties => {
  const merged = mergeContext(defaultContext, context);
  delete merged["distinctId"];
  return flattenContext(merged);
};
