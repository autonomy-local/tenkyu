import { render } from "@solidjs/web";
import { App } from "./App";
import "./styles/global.css";

const root = document.getElementById("root");
if (root) {
  render(() => <App />, root);
}
