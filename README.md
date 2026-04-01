# week5-team6-react2

React의 핵심 개념을 참고하되, 기존 `react`, `react-dom` 패키지를 사용하지 않고 우리가 직접 만든 모듈만으로 화면을 렌더링하는 프로젝트입니다.  
현재 결과물은 **커스텀 런타임 기반 비트코인 실시간 대시보드**이며, Vercel 같은 정적 호스팅 환경에서 열었을 때 가격, 그래프, 계약 히스토리가 갱신되는 화면을 목표로 합니다.

## 프로젝트 목표

- Component, State, Hooks를 직접 구현
- Virtual DOM + Diff + Patch를 직접 구현
- 최종적으로 비트코인 실시간 데이터를 1초 단위로 보여주는 화면 구현
- 기존 React 런타임 없이 우리가 만든 패키지/라이브러리만으로 동작

세부 설계 문서는 [docs/README.md](./docs/README.md) 와 [docs/requirements.md](./docs/requirements.md) 에 정리되어 있습니다.

## 가장 중요한 제약

- `react`, `react-dom`을 사용하지 않습니다.
- 화면은 반드시 우리가 직접 구현한 런타임 위에서 동작해야 합니다.
- 상태는 루트 컴포넌트에서만 관리합니다.
- 자식 컴포넌트는 props만 받는 stateless 순수 함수 형태를 유지합니다.

## 1. 코인 실시간 시세를 주제로 데모 웹을 만든 이유

![BTC Live Board Demo](./docs/assets/btc-live-board-demo-screenshot.png)

이 프로젝트의 핵심 목적은 `docs`에 정리한 React 핵심 이론을 실제로 움직이는 예제로 검증하는 것입니다.  
정적인 Todo 화면보다 **실시간 코인 시세 화면**이 더 적합했던 이유는, 데이터가 계속 바뀌기 때문에 상태 관리와 렌더링 최적화의 의미가 더 분명하게 드러나기 때문입니다.

[docs/01-virtual-dom.md](./docs/01-virtual-dom.md) 와 [docs/02-diff-algorithm.md](./docs/02-diff-algorithm.md) 에서는 Virtual DOM, Diff, Patch의 필요성을 설명합니다.  
실시간 가격, 1초 차트, 체결 히스토리처럼 자주 바뀌는 데이터는 "매번 전체 DOM을 다시 그리기"보다 "바뀐 부분만 비교해서 반영하기"가 왜 중요한지 보여주기에 적절합니다.

[docs/03-component.md](./docs/03-component.md), [docs/04-state.md](./docs/04-state.md), [docs/05-hooks.md](./docs/05-hooks.md) 에서는 함수형 컴포넌트, 루트 state, hooks 배열과 hook index 개념을 다룹니다.  
이 데모에서는 실시간 이벤트를 루트 `App`에 모으고, 자식 컴포넌트는 props만 받게 만들어 문서에서 정의한 `Lifting State Up` 구조를 그대로 따릅니다.

즉, 이 데모 주제는 아래 이론을 한 화면에서 동시에 확인하기 위해 선택했습니다.

- 외부 이벤트가 들어올 때 state가 어떻게 갱신되는가
- hook queue가 언제 처리되고 최신 state가 확정되는가
- state가 바뀐 뒤 새 Virtual DOM이 어떻게 만들어지는가
- 이전 Virtual DOM과 새 Virtual DOM을 어떻게 비교하는가
- 실제 DOM은 전체 교체가 아니라 어디만 부분 수정되는가

## 2. 동작하는 방식

아래 diagram은 **외부에서 가져다 사용하는 부분**과 **우리가 직접 개발한 부분**을 색으로 구분해서 정리한 것입니다.

- 노란색: 외부 시스템 / 브라우저 기본 기능 / 외부 데이터 소스
- 파란색: 우리가 직접 구현한 런타임, 상태 관리, 앱 로직

### 2-1. 이론에서 실제 데모까지

```mermaid
flowchart TD
    A["docs/01-virtual-dom.md"] --> B["VNode tree creation"]
    C["docs/02-diff-algorithm.md"] --> D["patch(oldVNode, newVNode)"]
    E["docs/03-component.md"] --> F["FunctionComponent root"]
    G["docs/04-state.md"] --> H["Root state in App"]
    I["docs/05-hooks.md"] --> J["useState / useEffect / useMemo"]
    B --> K["Realtime coin dashboard demo"]
    D --> K
    F --> K
    H --> K
    J --> K

    classDef doc fill:#fef3c7,stroke:#d97706,color:#92400e;
    classDef custom fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;
    class A,C,E,G,I doc;
    class B,D,F,H,J,K custom;
```

### 2-2. 앱 시작부터 첫 화면 렌더까지

```mermaid
flowchart TD
    A["Browser loads index.html"] --> B["src/main.js"]
    B --> C["mountRoot(App, container)"]
    C --> D["FunctionComponent instance"]
    D --> E["App()"]
    E --> F["Virtual DOM(VNode) tree"]
    F --> G["createDomNode()"]
    G --> H["Real DOM append"]
    H --> I["commitEffects()"]
    I --> J["useEffect starts feed"]

    classDef external fill:#fef3c7,stroke:#d97706,color:#92400e;
    classDef custom fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;
    class A,H external;
    class B,C,D,E,F,G,I,J custom;
```

### 2-3. 외부 WebSocket과 내부 런타임이 연결되는 방식

```mermaid
flowchart LR
    A["Binance Futures WebSocket"] --> B["src/app/binance-feed.js"]
    B --> C["payload 전달"]
    C --> D["App.js onEvent"]
    D --> E["setMarket(previousState => nextState)"]
    E --> F["hook.queue.push(update)"]
    F --> G["scheduleUpdate(instance)"]
    G --> H["next render starts"]
    H --> I["useState() processes queue"]
    I --> J["latest hook.state"]
    J --> K["App() creates new VNode"]
    K --> L["patch(oldVNode, newVNode)"]
    L --> M["changed DOM only"]
    M --> N["Price / Chart / Trades UI"]

    classDef external fill:#fef3c7,stroke:#d97706,color:#92400e;
    classDef custom fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;
    class A,C external;
    class B,D,E,F,G,H,I,J,K,L,M,N custom;
```

### 2-4. 무엇을 외부에서 사용했고, 무엇을 직접 만들었는가

- 외부에서 사용한 것
  - Binance Futures 공개 WebSocket 데이터
  - 브라우저의 `WebSocket`, `document`, `queueMicrotask`, `setInterval` 같은 기본 Web API
  - 정적 호스팅 환경
- 우리가 직접 만든 것
  - `createElement`
  - `FunctionComponent`
  - `useState`, `useEffect`, `useMemo`
  - `hook.queue` 기반 상태 갱신 처리
  - `patch()` 기반 Virtual DOM diff/patch
  - 비트코인 대시보드 UI와 데이터 가공 로직

즉, 외부에서 가져온 것은 **시장 데이터와 브라우저 기본 기능**이고, 화면이 갱신되는 핵심 로직은 우리가 직접 구현한 런타임이 담당합니다.

## 3. 프로젝트 진행 방식

이 프로젝트는 한 번에 전체 앱을 만들기보다, 이론 정리와 구현 단계를 분리해서 진행했습니다.

### 3-1. docs 기술 정리

먼저 React 핵심 기능을 문서로 나눠 정리했습니다.

- [docs/01-virtual-dom.md](./docs/01-virtual-dom.md)
- [docs/02-diff-algorithm.md](./docs/02-diff-algorithm.md)
- [docs/03-component.md](./docs/03-component.md)
- [docs/04-state.md](./docs/04-state.md)
- [docs/05-hooks.md](./docs/05-hooks.md)
- [docs/06-render-commit-phase.md](./docs/06-render-commit-phase.md)

그리고 현재 코드 기준 실행 순서를 따로 정리했습니다.

- [docs/execution-order-guide.md](./docs/execution-order-guide.md)

### 3-2. 프롬포트 정리

설계 의도를 유지하면서 구현을 요청할 수 있도록 프롬프트 문서도 따로 정리했습니다.

- [docs/implementation-prompt.md](./docs/implementation-prompt.md)
- [docs/core-implementation-prompt.md](./docs/core-implementation-prompt.md)
- [docs/bitcoin-ui-prompt.md](./docs/bitcoin-ui-prompt.md)
- [docs/realtime-data-connection-prompt.md](./docs/realtime-data-connection-prompt.md)
- [docs/run-implementation-prompt.md](./docs/run-implementation-prompt.md)

### 3-3. mock 데이터로 먼저 개발

처음부터 실제 거래소 데이터를 붙이지 않고, 먼저 mock 데이터로 아래 흐름을 검증했습니다.

- 루트 state 관리 구조
- hook queue 기반 상태 갱신
- Virtual DOM 생성
- diff / patch
- 1초 단위 차트와 체결 히스토리 렌더링

이 단계의 목적은 네트워크 이슈 없이도 **우리 런타임 자체가 정상 동작하는지** 먼저 확인하는 것이었습니다.

### 3-4. 실제 WebSocket 연동

그 다음 mock 기반 구조를 유지한 상태에서 Binance Futures 공개 WebSocket을 연동했습니다.

- `btcusdt@markPrice@1s`
- `btcusdt@aggTrade`

이렇게 해서

- 가격
- 1초 캔들 차트
- 계약 체결 히스토리

를 실제 시장 데이터로 갱신하도록 확장했습니다.  
또한 연결 실패 시 mock 데이터로 fallback 하도록 해서, 학습용 데모가 네트워크 문제로 완전히 죽지 않게 구성했습니다.

## 4. 회고

이 섹션은 추후 팀원들이 프로젝트를 진행하면서 느낀 점, 아쉬웠던 점, 개선하고 싶은 점을 정리하는 공간입니다.

- 추후 작성 예정

## 현재 구현된 내부 로직

### 1. 커스텀 Virtual DOM 런타임

[src/lib/runtime.js](./src/lib/runtime.js) 에서 아래 기능을 직접 구현했습니다.

- `createElement`
  JSX 없이 VNode를 만드는 함수입니다.
- `FunctionComponent`
  함수형 컴포넌트를 감싸는 루트 렌더 단위입니다.
- `patch`
  이전 VNode와 새 VNode를 비교해 필요한 DOM만 갱신합니다.
- `useState`
  `hooks` 배열과 `hookIndex` 기반으로 상태를 유지합니다.
- `useEffect`
  렌더 후 effect를 실행하고 cleanup을 관리합니다.
- `useMemo`
  deps가 바뀔 때만 계산값을 갱신합니다.

런타임 흐름은 아래와 같습니다.

1. 루트 `FunctionComponent`가 컴포넌트 함수를 실행합니다.
2. 컴포넌트 함수는 VNode 트리를 반환합니다.
3. 최초 렌더에서는 실제 DOM을 생성합니다.
4. 상태가 바뀌면 같은 컴포넌트를 다시 실행합니다.
5. `patch`가 이전 트리와 새 트리를 비교해 바뀐 DOM만 갱신합니다.
6. 렌더가 끝난 뒤 `useEffect` effect를 실행합니다.

### 2. 루트 상태 기반 비트코인 대시보드

[src/app/App.js](./src/app/App.js) 는 모든 상태를 루트에서 관리하고, 자식 UI 컴포넌트는 props만 받아 렌더링합니다.

구성 요소:

- `Header`
- `PricePanel`
- `ChartPanel`
- `TradesPanel`
- `TickerStrip`

이 구조는 문서에서 정의한 `Lifting State Up` 제약을 그대로 따릅니다.

### 3. 데이터 계층

[src/app/market-data.js](./src/app/market-data.js) 는 대시보드에서 쓰는 데이터 가공 로직을 담당합니다.

- 초기 시장 상태 생성
- mock 가격 시계열 생성
- mock 체결 히스토리 생성
- live 가격 이벤트 반영
- live 체결 이벤트 반영
- 차트용 좌표 계산
- 가격/수량/시간 포맷팅

즉, UI는 데이터를 직접 계산하지 않고 가공된 상태만 받아 렌더링합니다.

### 4. Binance WebSocket 연동

[src/app/binance-feed.js](./src/app/binance-feed.js) 에서 Binance USDⓈ-M Futures 공개 market stream을 연결합니다.

현재 사용하는 스트림:

- `btcusdt@markPrice@1s`
- `btcusdt@aggTrade`

동작 방식:

1. 앱 시작 시 Binance WebSocket 연결 시도
2. `markPrice@1s` 이벤트로 가격과 그래프 시계열 갱신
3. `aggTrade` 이벤트로 계약 히스토리와 볼륨 갱신
4. 연결 실패 또는 데이터 무응답 시 mock 피드로 자동 fallback

이렇게 해서 네트워크 제약이 있어도 화면이 완전히 죽지 않도록 구성했습니다.

## 현재 도출된 결과물

지금 브랜치에서 실행하면 아래 기능을 가진 페이지가 만들어집니다.

- 커스텀 런타임으로 렌더링되는 비트코인 대시보드
- 실시간 가격 표시
- 실시간 가격 그래프
- 실시간 계약 체결 히스토리
- feed 상태 표시
  Binance live 또는 mock fallback 여부를 UI에서 확인 가능
- 실제 WebSocket 연결 실패 시 mock 데이터로 계속 동작

즉, 결과물은 단순한 정적 화면이 아니라:

- 우리가 직접 구현한 렌더링 엔진
- 직접 구현한 상태 관리
- 직접 구현한 effect 처리
- 실제 시장 데이터 또는 fallback mock 데이터

를 합쳐 만든 실행 가능한 데모입니다.

## 파일 구조

```text
.
├── docs/
│   ├── requirements.md
│   ├── 01-virtual-dom.md ~ 06-render-commit-phase.md
│   └── 각종 구현 프롬프트 문서
├── scripts/
│   ├── start.mjs
│   └── verify.mjs
├── src/
│   ├── app/
│   │   ├── App.js
│   │   ├── binance-feed.js
│   │   └── market-data.js
│   ├── lib/
│   │   └── runtime.js
│   └── main.js
├── index.html
├── styles.css
└── package.json
```

## 실행 방법

```bash
npm run start
```

기본 실행 주소:

```text
http://localhost:4173
```

## 검증 방법

```bash
npm run verify
```

이 검증 스크립트는 최소한 아래 항목을 확인합니다.

- 런타임 주요 API 존재 여부
- 초기 시장 상태 생성 여부
- mock 상태 전이 동작 여부
- 차트 메타데이터 생성 여부
- 기본 포맷 함수 동작 여부

## 문서 참고

- 전체 문서 인덱스: [docs/README.md](./docs/README.md)
- 요구사항 정의: [docs/requirements.md](./docs/requirements.md)
- 실행용 프롬프트: [docs/run-implementation-prompt.md](./docs/run-implementation-prompt.md)

## 현재 한계와 다음 단계

- 현재 차트는 lightweight SVG 그래프입니다.
- 현재는 호가창(order book)을 구현하지 않았습니다.
- Binance 연결은 공개 market stream 기준이며, 실패 시 mock으로 대체됩니다.
- 다음 단계에서는 실제 order book 동기화, Vercel 배포 최적화, 런타임 기능 확장을 진행할 수 있습니다.

## 추가하면 좋을 부분

- 실제 order book 동기화 구조와 snapshot + diff 처리 설명
- runtime 내부의 `useState`, `scheduleUpdate`, `patch`를 코드 라인 기준으로 따라가는 상세 가이드
- mock 데이터 단계와 live WebSocket 단계의 차이를 비교한 문서
- 현재 diff/patch가 실제로 어느 DOM만 바꾸는지 보여주는 debug panel
- 팀 회고가 채워진 뒤, 구현 결정 이유와 트레이드오프를 따로 정리한 섹션
