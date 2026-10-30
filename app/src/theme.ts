import { emit } from "@tauri-apps/api/event";
import { getSetting, setSetting } from "./db";

/** Aparência da projeção. Tamanhos em % da altura da tela, para valer em qualquer resolução. */
export type Theme = {
  fontFamily: string;
  fontSize: number;
  color: string;
  background: string;
  backgroundImage: string;
  shadow: boolean;
  align: "center" | "left";
  uppercase: boolean;
  fade: boolean;
  /** Margem lateral e vertical, em % da tela. */
  margin: number;
};

export const DEFAULT_THEME: Theme = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: 9,
  color: "#ffffff",
  background: "#000000",
  backgroundImage: "",
  shadow: true,
  align: "center",
  uppercase: false,
  fade: true,
  margin: 6,
};

export const FONT_CHOICES: { label: string; value: string }[] = [
  { label: "Sistema (sem serifa)", value: DEFAULT_THEME.fontFamily },
  { label: "Georgia (serifa)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Helvetica / Arial", value: "'Helvetica Neue', Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Impact (títulos)", value: "Impact, 'Arial Black', sans-serif" },
];

export function parseTheme(raw: string): Theme {
  if (!raw.trim()) return DEFAULT_THEME;
  try {
    const data = JSON.parse(raw) as Partial<Theme>;
    return { ...DEFAULT_THEME, ...data };
  } catch {
    return DEFAULT_THEME;
  }
}

export async function loadTheme(): Promise<Theme> {
  return parseTheme(await getSetting("theme"));
}

/** Grava o tema e avisa as janelas abertas (projetor e palco). */
export async function saveTheme(theme: Theme) {
  await setSetting("theme", JSON.stringify(theme));
  await emit("theme-changed", theme);
}
