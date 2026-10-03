"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type YchatTheme = "system" | "light" | "dark";

type ThemeContextValue = {
  theme: YchatTheme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: YchatTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(theme: YchatTheme): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function YchatThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<YchatTheme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("ychat:theme") as YchatTheme | null;
    const initial = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setThemeState(initial);

    const apply = (value: YchatTheme) => {
      const resolved = resolveTheme(value);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", resolved === "dark" ? "#06101d" : "#f5f8fc");
      setResolvedTheme(resolved);
    };

    apply(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (initial === "system") apply("system");
    };
    media.addEventListener?.("change", onChange);
    const onThemeRequest = (event: Event) => {
      const value = (event as CustomEvent<YchatTheme>).detail;
      if (value === "system" || value === "light" || value === "dark") {
        setThemeState(value);
        window.localStorage.setItem("ychat:theme", value);
        apply(value);
      }
    };
    window.addEventListener("ychat:set-theme", onThemeRequest);
    return () => {
      media.removeEventListener?.("change", onChange);
      window.removeEventListener("ychat:set-theme", onThemeRequest);
    };
  }, []);

  const setTheme = (value: YchatTheme) => {
    setThemeState(value);
    window.localStorage.setItem("ychat:theme", value);
    const resolved = resolveTheme(value);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#06101d" : "#f5f8fc");
    setResolvedTheme(resolved);
  };

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useYchatTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useYchatTheme must be used inside YchatThemeProvider");
  return value;
}
