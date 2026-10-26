export type Theme = "light" | "dark";
export const THEME_COOKIE = "dfctf-theme";

export function parseTheme(value: string | undefined | null): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/** The theme on screen. Dark is the default; light is an explicit choice. */
export function effectiveTheme(): Theme {
  return parseTheme(document.documentElement.dataset.theme) ?? "dark";
}

export function applyTheme(theme: Theme) {
  // Suppress every transition for the swap so colors don't smear, then restore after the next frame.
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.getComputedStyle(document.body).opacity;
  requestAnimationFrame(() => style.remove());
  window.dispatchEvent(new CustomEvent<Theme>("dfctf-theme", { detail: theme }));
}
