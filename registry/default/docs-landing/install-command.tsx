"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./docs-landing.module.css";

type CopyState = "copied" | "failed" | "idle";

type InstallCommandProps = {
  command: string;
  className?: string;
  compact?: boolean;
};

const fallbackCopy = (command: string) => {
  const input = document.createElement("textarea");
  input.value = command;
  input.setAttribute("readonly", "");
  input.style.opacity = "0";
  input.style.position = "fixed";

  try {
    document.body.append(input);
    input.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    input.remove();
  }
};

const classes = (...values: (false | string | undefined)[]) =>
  values.filter(Boolean).join(" ");

const copyLabel = (copyState: CopyState) => {
  if (copyState === "copied") return "Copied";
  if (copyState === "failed") return "Copy failed";
  return "Copy";
};

const liveMessage = (copyState: CopyState) => {
  if (copyState === "copied") return "Install command copied";
  if (copyState === "failed") return "Couldn't copy the install command";
  return "";
};

export const InstallCommand = ({
  className,
  command,
  compact = false,
}: InstallCommandProps) => {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(
    () => () => {
      clearTimeout(resetTimer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    let copied = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(command);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) copied = fallbackCopy(command);

    setCopyState(copied ? "copied" : "failed");
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), 1800);
  }, [command]);

  return (
    <button
      aria-label={`Copy install command: ${command}`}
      className={classes(
        styles.installCommand,
        compact && styles.installCommandCompact,
        className,
      )}
      onClick={copy}
      type="button"
    >
      <span aria-hidden="true" className={styles.installPrompt}>
        $
      </span>
      <code>{command}</code>
      <span aria-hidden="true" className={styles.installCopy}>
        {copyLabel(copyState)}
      </span>
      <span aria-live="polite" className={styles.screenReaderOnly}>
        {liveMessage(copyState)}
      </span>
    </button>
  );
};
