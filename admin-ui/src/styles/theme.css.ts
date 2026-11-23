import { createTheme, createThemeContract } from "@vanilla-extract/css";

export const vars = createThemeContract({
  color: {
    background: null,
    surface: null,
    surfaceMuted: null,
    text: null,
    textMuted: null,
    primary: null,
    primaryHover: null,
    border: null,
    danger: null,
  },
  space: {
    none: null,
    xs: null,
    sm: null,
    md: null,
    lg: null,
    xl: null,
    "2xl": null,
  },
  fontSize: {
    xs: null,
    sm: null,
    base: null,
    lg: null,
    xl: null,
    "2xl": null,
  },
  fontFamily: {
    sans: null,
    mono: null,
  },
  borderRadius: {
    sm: null,
    md: null,
    lg: null,
    full: null,
  },
});

export const lightTheme = createTheme(vars, {
  color: {
    background: "#f8fafc",
    surface: "#ffffff",
    surfaceMuted: "#f1f5f9",
    text: "#0f172a",
    textMuted: "#64748b",
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    border: "#e2e8f0",
    danger: "#dc2626",
  },
  space: {
    none: "0",
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
  },
  fontSize: {
    xs: "12px",
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "20px",
    "2xl": "24px",
  },
  fontFamily: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  borderRadius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    full: "9999px",
  },
});
