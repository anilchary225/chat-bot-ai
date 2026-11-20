import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Moon,
  Sun,
} from "./DrawingIcons";

const STORAGE_KEY = "zenoxi-theme";

/** Read the current theme from the document, falling back to the visitor's system preference. */
function readTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* storage unavailable */ }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Shared light/dark toggle. Honors reduced motion and remembers the choice in localStorage. */
export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(readTheme);

  // Sync the toggle if the app changes the theme elsewhere (e.g. the chat sidebar).
  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener("zenoxi:theme-change", sync);
    return () => window.removeEventListener("zenoxi:theme-change", sync);
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable */ }
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content", next === "light" ? "#faf7f2" : "#0b0a09"
    );
    window.dispatchEvent(new CustomEvent("zenoxi:theme-change", { detail: next }));
  };

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <motion.span
          className="theme-toggle-thumb"
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </span>
      <span className="theme-toggle-icons" aria-hidden="true">
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
        >
          {theme === "light" ? <Sun size={15} /> : <Moon size={15} />}
        </motion.span>
      </span>
    </button>
  );
}