export type Theme = "light" | "dark";
export const THEME_COOKIE = "dfctf-theme";

export function parseTheme(value: string | undefined | null): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/** The theme currently on screen: an explicit choice on <html>, else the system preference. */
export function effectiveTheme(): Theme {
  const chosen = parseTheme(document.documentElement.dataset.theme);
  if (chosen) return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent<Theme>("dfctf-theme", { detail: theme }));
}
