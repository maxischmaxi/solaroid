import { THEMES, type Theme } from "./themes";

let active: Theme = THEMES.classic;

export function getActiveTheme(): Theme {
  return active;
}

export function setActiveTheme(t: Theme): void {
  active = t;
}
