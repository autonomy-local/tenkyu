import { style } from "@vanilla-extract/css";
import { vars } from "./styles/theme.css";

export const layout = style({
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
});

export const header = style({
  backgroundColor: vars.color.surface,
  borderBottom: `1px solid ${vars.color.border}`,
  padding: `${vars.space.md} ${vars.space.lg}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

export const title = style({
  margin: 0,
  fontSize: vars.fontSize.xl,
  fontWeight: 600,
  color: vars.color.text,
});

export const badge = style({
  fontSize: vars.fontSize.xs,
  color: vars.color.primary,
  backgroundColor: vars.color.surfaceMuted,
  padding: `${vars.space.xs} ${vars.space.sm}`,
  borderRadius: vars.borderRadius.full,
  fontWeight: 500,
});

export const main = style({
  flex: 1,
  padding: vars.space.xl,
  maxWidth: "1200px",
  margin: "0 auto",
  width: "100%",
});

export const card = style({
  backgroundColor: vars.color.surface,
  borderRadius: vars.borderRadius.md,
  border: `1px solid ${vars.color.border}`,
  padding: vars.space.xl,
  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
});

export const cardTitle = style({
  marginTop: 0,
  marginBottom: vars.space.sm,
  fontSize: vars.fontSize.lg,
  color: vars.color.text,
});

export const cardDescription = style({
  margin: 0,
  fontSize: vars.fontSize.sm,
  color: vars.color.textMuted,
  lineHeight: 1.6,
});
