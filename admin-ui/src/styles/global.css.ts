import { globalStyle } from "@vanilla-extract/css";
import { vars } from "./theme.css";

globalStyle("html, body", {
  margin: 0,
  padding: 0,
  fontFamily: vars.fontFamily.sans,
  fontSize: vars.fontSize.base,
  backgroundColor: vars.color.background,
  color: vars.color.text,
  minHeight: "100vh",
  boxSizing: "border-box",
});

globalStyle("*, *::before, *::after", {
  boxSizing: "inherit",
});
