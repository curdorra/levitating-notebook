export const THEMES = ["linen", "specimen", "reverie"] as const;
export type Theme = (typeof THEMES)[number];

/** A saved theme that no longer exists (e.g. a retired one) falls back to Linen. */
export function resolveTheme(theme: string | null | undefined): Theme {
  return THEMES.includes(theme as Theme) ? (theme as Theme) : "linen";
}
