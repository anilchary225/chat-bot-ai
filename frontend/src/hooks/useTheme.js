import { useEffect, useState } from "react";

const KEY = "zenoxi-theme";

/** Shared light/dark theme control.
 *
 * - First visit: follows the visitor's `prefers-color-scheme`.
 * - Every change is remembered in `localStorage`.
 * - Respects `prefers-reduced-motion` indirectly through the caller.
 */
export default function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(KEY)
        || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#faf7f2" : "#0b0a09");
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return { theme, setTheme, toggle };
}