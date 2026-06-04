/// 主题定义：与 KKCODER 保持一致的设计语言
export interface ThemeColors {
  bgMain: string;
  bgSidebar: string;
  bgTerminal: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  colorPrimary: string;
  colorPrimaryHover: string;
  bgActiveItem: string;
  textActiveItem: string;
  bgHoverItem: string;
  colorGreen: string;
  colorOrange: string;
  colorRed: string;
  shadowCard: string;
}

export const THEMES: Record<string, ThemeColors> = {
  "light-premium": {
    bgMain: "#ffffff",
    bgSidebar: "#f8f9fb",
    bgTerminal: "#f3f4f6",
    borderColor: "#e5e7eb",
    textPrimary: "#1a1a2e",
    textSecondary: "#6b7280",
    colorPrimary: "#4f6ef7",
    colorPrimaryHover: "#3b5de7",
    bgActiveItem: "#eef2ff",
    textActiveItem: "#4f6ef7",
    bgHoverItem: "#f3f4f6",
    colorGreen: "#22c55e",
    colorOrange: "#f59e0b",
    colorRed: "#ef4444",
    shadowCard: "0 4px 24px rgba(0,0,0,0.08)",
  },
  "dark-blue": {
    bgMain: "#0f172a",
    bgSidebar: "#1e293b",
    bgTerminal: "#1a2332",
    borderColor: "#334155",
    textPrimary: "#e2e8f0",
    textSecondary: "#94a3b8",
    colorPrimary: "#60a5fa",
    colorPrimaryHover: "#93c5fd",
    bgActiveItem: "#1e3a5f",
    textActiveItem: "#60a5fa",
    bgHoverItem: "#253a54",
    colorGreen: "#4ade80",
    colorOrange: "#fbbf24",
    colorRed: "#f87171",
    shadowCard: "0 4px 24px rgba(0,0,0,0.3)",
  },
  "dark-purple": {
    bgMain: "#1a1025",
    bgSidebar: "#231530",
    bgTerminal: "#1e1228",
    borderColor: "#3d2a5c",
    textPrimary: "#e0d4f5",
    textSecondary: "#9b8ab8",
    colorPrimary: "#a855f7",
    colorPrimaryHover: "#c084fc",
    bgActiveItem: "#3b1f5e",
    textActiveItem: "#c084fc",
    bgHoverItem: "#2d1a45",
    colorGreen: "#4ade80",
    colorOrange: "#fbbf24",
    colorRed: "#f87171",
    shadowCard: "0 4px 24px rgba(0,0,0,0.4)",
  },
  "dark-zinc": {
    bgMain: "#18181b",
    bgSidebar: "#27272a",
    bgTerminal: "#1f1f23",
    borderColor: "#3f3f46",
    textPrimary: "#e4e4e7",
    textSecondary: "#a1a1aa",
    colorPrimary: "#f59e0b",
    colorPrimaryHover: "#fbbf24",
    bgActiveItem: "#3f3f20",
    textActiveItem: "#fbbf24",
    bgHoverItem: "#2a2a2e",
    colorGreen: "#4ade80",
    colorOrange: "#fb923c",
    colorRed: "#f87171",
    shadowCard: "0 4px 24px rgba(0,0,0,0.3)",
  },
};

export const DEFAULT_THEME = "light-premium";

export function applyTheme(themeName: string) {
  const theme = THEMES[themeName] || THEMES[DEFAULT_THEME];
  const root = document.documentElement.style;
  root.setProperty("--bg-main", theme.bgMain);
  root.setProperty("--bg-sidebar", theme.bgSidebar);
  root.setProperty("--bg-terminal", theme.bgTerminal);
  root.setProperty("--border-color", theme.borderColor);
  root.setProperty("--text-primary", theme.textPrimary);
  root.setProperty("--text-secondary", theme.textSecondary);
  root.setProperty("--color-primary", theme.colorPrimary);
  root.setProperty("--color-primary-hover", theme.colorPrimaryHover);
  root.setProperty("--bg-active-item", theme.bgActiveItem);
  root.setProperty("--text-active-item", theme.textActiveItem);
  root.setProperty("--bg-hover-item", theme.bgHoverItem);
  root.setProperty("--color-green", theme.colorGreen);
  root.setProperty("--color-orange", theme.colorOrange);
  root.setProperty("--color-red", theme.colorRed);
  root.setProperty("--shadow-card", theme.shadowCard);
}
