import { mountRoot } from "./lib/runtime.js";
import { App } from "./app/App.js";

const container = document.getElementById("app");

if (!container) {
  throw new Error("App container not found.");
}

mountRoot(App, container);
