import { render } from "@solidjs/web";
import { App } from "./App";
import { lightTheme } from "./styles/theme.css";
import "./styles/global.css";

document.documentElement.classList.add(lightTheme);

const root = document.getElementById("root");
if (root) {
  render(() => <App />, root);
}
