# 실행 순서 가이드

이 문서는 `main` 브랜치 기준으로, 현재 프로젝트가 **어떤 순서로 실행되는지**를 초심자 관점에서 정리한 문서입니다.

관련 코드 파일:

- `src/main.js`
- `src/lib/runtime.js`
- `src/app/App.js`
- `src/app/binance-feed.js`
- `src/app/market-data.js`

## 전체 흐름 한눈에 보기

```text
1. 브라우저가 src/main.js 실행
2. mountRoot(App, container) 호출
3. FunctionComponent 인스턴스 생성
4. App() 실행 -> 첫 VNode 트리 생성
5. createDomNode()로 실제 DOM 생성
6. useEffect 실행 -> Binance WebSocket 또는 mock 타이머 연결
7. 실시간 이벤트 수신
8. setState 호출 -> hook.queue에 update 저장
9. queueMicrotask로 update 예약
10. 다음 렌더에서 hook.queue를 처리해 최신 state 계산
11. App() 다시 실행 -> 새 VNode 트리 생성
12. patch()가 이전 VNode와 새 VNode를 비교
13. 실제 DOM에서 바뀐 부분만 업데이트
14. commitEffects()가 effect 실행 / cleanup 정리
```

---

## 1. 앱 시작

시작점은 `src/main.js` 입니다.

```js
const container = document.getElementById("app");
mountRoot(App, container);
```

여기서 하는 일:

1. `index.html` 안의 `#app` DOM을 찾음
2. `mountRoot(App, container)` 호출
3. 이 시점부터 우리 커스텀 런타임이 실행됨

---

## 2. 루트 컴포넌트 마운트

`mountRoot()`는 `FunctionComponent` 인스턴스를 만들고 `mount()`를 호출합니다.

위치:

- `src/lib/runtime.js`

핵심 순서:

1. `new FunctionComponent(component, props, container)`
2. `instance.mount()`
3. `mount()` 안에서 `renderVNode()` 호출
4. `renderVNode()` 안에서 `App()` 실행

즉, **React처럼 보이는 함수형 컴포넌트도 실제로는 우리가 만든 `FunctionComponent` 객체가 관리**합니다.

---

## 3. 첫 렌더에서 VNode 생성

`App()`은 실제 DOM을 직접 만들지 않습니다.
대신 `h(...)` 호출을 통해 **VNode 객체 트리**를 만듭니다.

예를 들면:

- `Header`
- `PricePanel`
- `ChartPanel`
- `TradesPanel`
- `TickerStrip`

이런 자식 컴포넌트들도 결국 VNode를 반환합니다.

즉:

- 컴포넌트 함수 실행 결과 = DOM이 아니라 VNode

---

## 4. 최초 DOM 생성

첫 렌더에서는 이전 화면이 없으므로 `createDomNode()`가 VNode 트리를 실제 DOM으로 바꿉니다.

여기서 하는 일:

1. 함수형 컴포넌트면 먼저 실행해서 내부 VNode를 얻음
2. 텍스트면 text node 생성
3. 일반 태그면 element 생성
4. props 적용
5. children 재귀 생성

즉, **초기 화면은 VNode -> DOM 변환**으로 만들어집니다.

---

## 5. 최초 effect 실행

초기 DOM 생성이 끝나면 `commitEffects()`가 실행됩니다.

현재 프로젝트에서는 `App()` 안의 `useEffect`가 여기서 동작합니다.

하는 일:

1. Binance WebSocket 연결 시도
2. 실패 시 mock 피드 준비
3. cleanup 함수 저장

---

## 6. 실시간 이벤트 수신

실시간 데이터는 `src/app/binance-feed.js` 에서 받습니다.

현재 사용하는 stream:

- `btcusdt@markPrice@1s`
- `btcusdt@aggTrade`

이벤트가 들어오면 `App`의 `onEvent`로 전달되고, 거기서 `setMarket(...)`가 호출됩니다.

---

## 7. setState는 바로 state를 바꾸지 않음

많이 헷갈리는 부분입니다.

`setState`를 호출해도 **그 즉시 hook.state가 바뀌는 것은 아닙니다.**

실제로는:

1. update 함수를 `hook.queue`에 넣음
2. `scheduleUpdate(instance)` 호출
3. 다음 마이크로태스크에 `instance.update()` 예약

즉 `setState`는 "지금 바꿔"가 아니라
**"다음 업데이트 때 이 변경을 반영해"** 라는 요청에 가깝습니다.

---

## 8. hook.queue 처리

다음 렌더가 시작되면 `useState()` 안에서 먼저 queue를 읽습니다.

핵심 코드 개념:

```js
if (hook.queue.length) {
  hook.queue.forEach((update) => {
    const nextState = typeof update === "function" ? update(hook.state) : update;
    hook.state = nextState;
  });
  hook.queue = [];
}
```

여기서 하는 일:

1. queue에 쌓인 update를 순서대로 적용
2. 마지막 결과를 `hook.state`에 저장
3. queue를 비움

즉, **이 시점이 실제 state가 최신값으로 확정되는 순간**입니다.

---

## 9. 새 VNode 트리 생성

queue를 처리한 뒤, 같은 `App()`을 다시 실행합니다.

이때는:

- 이전 state가 아니라
- queue가 반영된 최신 state로

새 VNode 트리를 다시 만듭니다.

중요:

- 현재 구조는 루트 state가 바뀌면 `App()`과 자식 컴포넌트 함수들이 다시 실행됩니다.
- 하지만 실제 DOM을 바로 통째로 지우는 것은 아닙니다.

---

## 10. diff / patch

새 VNode가 만들어지면 `patch(oldVNode, newVNode)`가 실행됩니다.

비교 규칙:

1. 새 노드가 없으면 삭제
2. 이전 노드가 없으면 추가
3. 타입이 다르면 교체
4. 텍스트면 `nodeValue`만 비교
5. 타입이 같으면:
   - props 비교
   - children 재귀 비교

리스트에 `key`가 있으면 key 기준으로 재사용/이동을 시도합니다.

즉, **화면 전체 DOM을 통째로 다시 만드는 것이 아니라, 바뀐 부분만 업데이트**합니다.

---

## 11. 왜 VDOM을 쓴다고 말할 수 있나

이 프로젝트는 데이터를 직접 DOM에 꽂지 않습니다.

실제 흐름:

1. JSON 수신
2. state 계산
3. 새 VNode 생성
4. 이전 VNode와 비교
5. DOM 일부만 수정

이 구조이기 때문에, 현재 프로젝트는 분명히 **Virtual DOM + Diff/Patch 방식**으로 동작한다고 볼 수 있습니다.

---

## 12. 현재 hook 사용 위치

현재 `src` 기준으로 hook은 **루트 `App`에서만 사용**합니다.

사용 중인 hook:

- `useState`
- `useEffect`
- `useMemo`

자식 컴포넌트:

- `Header`
- `PricePanel`
- `ChartPanel`
- `TradesPanel`
- `TickerStrip`

는 hook 없이 props만 받습니다.

즉, 현재 코드는 문서에서 요구한
**"상태는 최상단 컴포넌트에서 관리, 자식은 stateless"**
구조를 따르고 있습니다.

---

## 13. 초심자가 특히 주의해서 볼 부분

### 1. setState는 바로 state를 바꾸지 않는다

- queue에 넣는다
- 다음 렌더에서 처리한다

### 2. 컴포넌트 함수 재실행과 DOM 재생성은 다르다

- 컴포넌트 함수는 다시 실행될 수 있다
- 하지만 DOM은 patch가 필요한 부분만 바꾼다

### 3. hook은 호출 순서가 중요하다

- `hookIndex`로 식별하기 때문에
- 호출 순서가 바뀌면 잘못된 state가 연결될 수 있다

---

## 14. 추천 읽기 순서

처음 이해할 때는 아래 순서로 보는 걸 추천합니다.

1. `src/main.js`
2. `src/lib/runtime.js`
   - `mountRoot`
   - `FunctionComponent`
   - `useState`
   - `patch`
3. `src/app/App.js`
4. `src/app/binance-feed.js`
5. `src/app/market-data.js`

이 순서대로 보면 "앱 시작 -> state 변경 -> VDOM 생성 -> diff -> DOM 반영"이 비교적 자연스럽게 읽힙니다.
