import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";
const STORAGE_KEY = "study-coach-theme";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(preference: ThemePreference) {
  const isDark = preference === "dark" || (preference === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Storage can throw in a private window or when blocked — fall back
    // silently rather than breaking theme selection.
  }
  return "system";
}

type ThemeContextValue = { preference: ThemePreference; setPreference: (value: ThemePreference) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * The app's CSS already defines a full `.dark` palette (index.css) — nothing
 * was ever toggling that class. This wires up an actual light/dark/system
 * preference, persisted per-browser, applied by adding/removing `.dark` on
 * <html> (which every existing color token already responds to).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());

  useEffect(() => {
    applyTheme(preference);
    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = (value: ThemePreference) => {
    setPreferenceState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Best-effort persistence only.
    }
  };

  const value = useMemo(() => ({ preference, setPreference }), [preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
