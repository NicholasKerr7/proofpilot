"use client";

import { useEffect } from "react";
import {
  defaultUserSettingsValues,
  type UserSettings
} from "@proofpilot/types";

/** Synchronizes persisted visual preferences with document-level theme selectors. */
export function useProofPilotTheme(settings: UserSettings | null) {
  useEffect(() => {
    const root = document.documentElement;
    const theme = settings?.theme ?? defaultUserSettingsValues.theme;
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme =
        theme === "SYSTEM" ? (colorScheme.matches ? "dark" : "light") : theme.toLowerCase();
      root.dataset.theme = resolvedTheme;
      root.classList.toggle("dark", resolvedTheme === "dark");
      root.classList.toggle("light", resolvedTheme === "light");
    };

    applyTheme();
    const accent = (settings?.accentColor ?? defaultUserSettingsValues.accentColor).toLowerCase();
    root.dataset.accent = accent;
    root.classList.toggle("accent-champagne", accent === "champagne");
    root.classList.toggle("accent-teal", accent === "teal");
    const reduceMotion = settings?.reduceMotion ?? defaultUserSettingsValues.reduceMotion;
    root.dataset.reduceMotion = String(reduceMotion);
    root.classList.toggle("reduce-motion", reduceMotion);

    if (theme === "SYSTEM") {
      colorScheme.addEventListener("change", applyTheme);
      return () => colorScheme.removeEventListener("change", applyTheme);
    }

    return undefined;
  }, [settings]);
}
