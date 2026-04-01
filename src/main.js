import { mountRoot } from "./lib/runtime.js";
import { App } from "./app/App.js";

// 실행 순서 1:
// index.html 안의 #app DOM을 찾아서 "우리 런타임의 시작점"으로 사용한다.
const container = document.getElementById("app");

if (!container) {
  throw new Error("App container not found.");
}

// 실행 순서 2:
// mountRoot가 FunctionComponent 인스턴스를 만들고 최초 렌더를 시작한다.
mountRoot(App, container);
