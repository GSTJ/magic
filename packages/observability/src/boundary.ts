import type { ObservabilityClient, Properties } from "./core/types.ts";

import type { ComponentType, ErrorInfo, ReactNode } from "react";

import { Component, createElement } from "react";

import { normalizeError } from "./core/context.ts";

/**
 * One error boundary for React web and React Native.
 *
 * PostHog ships `PostHogErrorBoundary` in both `@posthog/react` and
 * `posthog-react-native`, and they are fine — but they report through whichever
 * SDK you imported them from, which means the two platforms end up with
 * different props, different fallback signatures and no shared context. This
 * one takes an {@link ObservabilityClient}, so it is the same component, with
 * the same props, on both, and it keeps working (rendering the fallback,
 * reporting nothing) when the client is a no-op.
 *
 * Built with `createElement` rather than JSX so that compiling this package
 * needs neither a JSX runtime nor `react-native`'s types. `react` is the only
 * runtime import, which is what keeps `magic-observability/expo` free of
 * `posthog-js` and vice versa.
 */

export type BoundaryFallbackProps = {
  error: Error;
  /** React's component stack, when it gave us one. */
  componentStack: string | null;
  /** Clears the error and re-renders `children`. */
  reset: () => void;
};

export type ObservabilityBoundaryProps = {
  /** Where the error goes. A no-op client renders the fallback and reports nothing. */
  client: ObservabilityClient;
  children?: ReactNode;
  /**
   * A component (gets {@link BoundaryFallbackProps}) or a plain node. Omitted
   * means render nothing — deliberate, so a boundary can be used purely as a
   * reporter around something that is allowed to disappear.
   */
  fallback?: ComponentType<BoundaryFallbackProps> | ReactNode;
  /** Merged into the `$exception` event. `{ screen: "checkout" }`, and so on. */
  context?: Properties;
  /** Runs after the report. For a toast, a router push, whatever else. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * Clears the error whenever any member changes — the usual "reset when the
   * route or the query key changes" lever.
   */
  resetKeys?: readonly unknown[];
};

type BoundaryState = {
  error: Error | null;
  componentStack: string | null;
};

/**
 * Exported so the reporting path can be tested without a renderer, and so a
 * hand-rolled boundary elsewhere can produce identically shaped events.
 */
export const reportBoundaryError = (
  client: ObservabilityClient,
  error: unknown,
  info: Pick<ErrorInfo, "componentStack"> | undefined,
  context: Properties | undefined,
): void => {
  client.captureError(error, {
    ...context,
    source: "error-boundary",
    componentStack: info?.componentStack ?? null,
  });
};

const keysChanged = (
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean => {
  if (previous === next) return false;
  if (!previous || !next) return true;
  if (previous.length !== next.length) return true;
  return previous.some((value, index) => !Object.is(value, next[index]));
};

export class ObservabilityBoundary extends Component<
  ObservabilityBoundaryProps,
  BoundaryState
> {
  override state: BoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error: normalizeError(error) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    reportBoundaryError(this.props.client, error, info, this.props.context);
    this.props.onError?.(normalizeError(error), info);
  }

  override componentDidUpdate(previous: ObservabilityBoundaryProps): void {
    if (this.state.error === null) return;
    if (!keysChanged(previous.resetKeys, this.props.resetKeys)) return;
    this.reset();
  }

  reset = (): void => {
    this.setState({ error: null, componentStack: null });
  };

  override render(): ReactNode {
    const { error, componentStack } = this.state;
    if (error === null) return this.props.children;

    const { fallback } = this.props;
    if (fallback === undefined || fallback === null) return null;

    if (typeof fallback === "function") {
      return createElement(fallback as ComponentType<BoundaryFallbackProps>, {
        error,
        componentStack,
        reset: this.reset,
      });
    }

    return fallback;
  }
}
