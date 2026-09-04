"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { applyTheme, readStoredTheme, THEME_STORAGE_KEY, type Theme } from "./theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    setThemeState(readStoredTheme(window.localStorage));
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(document.documentElement, next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      return;
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error("useTheme requires a ThemeProvider ancestor");
  return value;
}
