"use client";

import { useSyncExternalStore, useTransition } from "react";
import { setTheme } from "@/app/actions/account";
import { THEMES, type Theme } from "@/lib/themes";

const LABELS: Record<Theme, { name: string; hint: string }> = {
  linen: { name: "Linen", hint: "Daylight and leaf shadows" },
  specimen: { name: "Specimen", hint: "X-ray botanicals and scan notes" },
  reverie: { name: "Reverie", hint: "Soft light and grainy colour" },
};

// The source of truth is <html data-theme>; every picker on the page follows it.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = () => (document.documentElement.dataset.theme as Theme) ?? "linen";
const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
};

/**
 * Switches the theme instantly on <html>. When `persist` is set (signed-in
 * users), the choice is also saved to the account.
 */
export function ThemePicker({ persist = false, compact = false }: { persist?: boolean; compact?: boolean }) {
  const current = useSyncExternalStore(subscribe, readTheme, () => null);
  const [, startTransition] = useTransition();

  function choose(theme: Theme) {
    applyTheme(theme);
    if (persist) startTransition(() => setTheme(theme));
  }

  return (
    <div className={`theme-picker ${compact ? "theme-picker-compact" : ""}`} role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={current === t}
          className="theme-swatch"
          data-swatch={t}
          onClick={() => choose(t)}
          title={LABELS[t].hint}
        >
          <span className="theme-swatch-chip" />
          <span className="theme-swatch-name">{LABELS[t].name}</span>
          {!compact && <span className="theme-swatch-hint">{LABELS[t].hint}</span>}
        </button>
      ))}
    </div>
  );
}
