# week5-team6-react2

React의 핵심 개념을 참고하되, 기존 `react`, `react-dom` 패키지를 사용하지 않고 우리가 직접 만든 모듈만으로 화면을 렌더링하는 프로젝트입니다.  
현재 결과물은 **커스텀 런타임 기반 비트코인 실시간 대시보드**이며, Vercel 같은 정적 호스팅 환경에서 열었을 때 가격, 그래프, 계약 히스토리가 갱신되는 화면을 목표로 합니다.

## 1. 코인 실시간 시세를 주제로 데모 웹을 만든 이유

![BTC Live Board Demo](./docs/assets/btc-live-board-demo-screenshot.png)

- 데이터가 1초마다 바뀌어 **State 변경 → 리렌더 흐름**을 반복적으로 확인하기에 적합하다
- 가격·차트·체결 내역이 동시에 갱신되어 **Diff/Patch로 필요한 DOM만 업데이트**하는 의미가 명확하게 드러난다
- 모든 state를 루트(App)에서 관리하고, 자식 컴포넌트는 props만 받아 렌더링만 담당한다
  — 데이터 흐름이 위에서 아래로 단방향으로 흐르기 때문에 어디서 상태가 바뀌는지 추적하기 쉽다

## 2. 동작하는 방식

### 2-1. 최초 렌더 흐름

```mermaid
flowchart TD
    A([브라우저가 index.html 파싱]) --> B

    subgraph HTML["index.html"]
        B["&lt;div id='app'&gt;&lt;/div&gt; 생성\n빈 상태"] --> C
        C["&lt;script type='module' src='./src/main.js'&gt;\nJS 로드 & 실행"]
    end

    C --> D

    subgraph MAIN["main.js"]
        D["document.getElementById('app')\n컨테이너 참조"] --> E
        E["mountRoot(App, container) 호출"]
    end

    E --> F

    subgraph MOUNT["mountRoot() → mount()  [runtime.js]"]
        F["new FunctionComponent(App, props, container)\nhooks=[], currentVNode=null"] --> G

        subgraph RENDER["renderVNode()"]
            G["currentInstance = this\nhookIndex = 0"] --> H
            H["App(props) 실행"] --> I

            subgraph HOOKS["훅 처리 (hooks 배열에 저장)"]
                I["useState()\nhooks[0] = { state, queue: [] }"] --> J
                J["useMemo()\nhooks[1] = { value, deps }"] --> K
                K["useEffect()\nhooks[2] = { effect, shouldRun: true }"]
            end

            K --> L["createElement(h) 호출\nVNode 트리 반환"]
            L --> M["currentInstance = null"]
        end

        M --> N

        subgraph CREATEDOM["createDomNode(vnode)"]
            N{"vnode.type 확인"} --> |함수| O
            N --> |TEXT_ELEMENT| P
            N --> |태그 문자열| Q
            O["함수 실행 → _rendered에 저장\n재귀 호출"]
            P["document.createTextNode()"]
            Q["document.createElement()\ndocument.createElementNS() (SVG)"] --> R
            R["updateProps()\nclassName / style / 이벤트 반영"] --> S
            S["children 재귀 처리\nappendChild"]
        end

        O & P & S --> T["container.appendChild(dom)\n#app 안에 삽입"]
        T --> U

        subgraph EFFECTS["commitEffects()"]
            U["hooks 배열 순회\nshouldRun=true인 effect만 실행"] --> V
            V["effect() 실행\n반환값을 cleanup으로 저장"]
        end
    end

    V --> W([화면에 UI 표시 완료])
```

### 2-2. 상태 변경 후 업데이트 흐름

```mermaid
flowchart TD
    A([사용자 이벤트 또는 WebSocket 데이터 수신]) --> B

    subgraph SETSTATE["setState()  [runtime.js]"]
        B["hook.queue.push(update)\nstate 즉시 변경 아님"] --> C
        C["scheduleUpdate(instance)"] --> D
        D{"instance.scheduled?"} --> |true - 중복 방지| Z([return])
        D --> |false| E
        E["instance.scheduled = true\nqueueMicrotask(() => instance.update())\n배치 처리: 여러 setState → 한 번만 렌더"]
    end

    E --> F

    subgraph UPDATE["instance.update()  [FunctionComponent]"]
        F["instance.scheduled = false"] --> G

        subgraph RENDER["renderVNode()"]
            G["currentInstance = this\nhookIndex = 0"] --> H
            H["App(props) 재실행"] --> I

            subgraph HOOKS["훅 재처리"]
                I["useState()\nhook.queue 순서대로 처리\n→ 최신 state 확정\nhook.queue = []"] --> J
                J["useMemo()\ndeps 변경? → factory() 재실행\n변경 없음? → 이전 값 재사용"] --> K
                K["useEffect()\ndeps 변경? → shouldRun = true\n변경 없음? → shouldRun = false"]
            end

            K --> L["새 VNode 트리 반환"]
            L --> M["currentInstance = null"]
        end

        M --> N

        subgraph PATCH["patch(container, oldVNode, newVNode)"]
            N{"노드 비교"} --> |타입 다름| O
            N --> |타입 같음| P
            N --> |newVNode 없음| Q
            N --> |oldVNode 없음| R
            O["replaceChild()\n서브트리 전체 교체"]
            P["updateProps()\npatchChildren()\n→ key 있으면 Map 기반 매핑\n→ key 없으면 인덱스 기준 비교"]
            Q["removeChild()"]
            R["appendChild()"]
        end

        O & P & Q & R --> S["this.currentVNode = nextVNode\n다음 diff를 위해 저장"]
        S --> T

        subgraph EFFECTS["commitEffects()"]
            T["hooks 배열 순회\nshouldRun=true인 effect만"] --> U
            U["이전 cleanup() 실행"] --> V
            V["새 effect() 실행\n반환값을 cleanup으로 교체"]
        end
    end

    V --> W([화면 업데이트 완료])
```

### 2-3. 우리 팀 구현 특징

상태 변경 후 업데이트 흐름은 모든 팀이 비슷해 보일 수 있지만, 실제 구현 방식은 꽤 달라질 수 있습니다.  
이 프로젝트에서 우리 팀이 선택한 방식은 아래와 같습니다.

- `setState`는 값을 바로 바꾸지 않고 hook 내부 `queue`에 먼저 저장합니다.
  다음 렌더에서 queue를 순서대로 처리해 최종 state를 확정합니다.
- 상태 변경 직후 즉시 렌더하지 않고, `scheduleUpdate`로 다음 마이크로태스크에 렌더를 한 번만 예약합니다.
  그래서 짧은 시간 안에 여러 상태 변경이 들어와도 한 번의 업데이트 흐름으로 묶을 수 있습니다.
- hooks는 컴포넌트 인스턴스 내부의 `hooks` 배열과 `hookIndex`로 관리합니다.
  즉 `useState`, `useEffect`, `useMemo` 모두 “호출 순서”를 기준으로 같은 배열 안에서 추적합니다.
- 차트는 외부 차트 라이브러리를 사용하지 않고, `svg`, `line`, `rect`, `polyline`, `text` 같은 SVG DOM 요소를 직접 Virtual DOM으로 생성해 렌더링합니다.
  런타임은 SVG 태그를 `createElementNS(...)`로 실제 SVG DOM에 붙여 실시간 차트를 구성합니다.
- `useEffect`는 DOM patch 이후 실행합니다.
  즉 화면이 먼저 반영된 뒤, WebSocket 연결이나 cleanup 같은 부수효과를 처리합니다.
- `useMemo`는 deps가 바뀔 때만 다시 계산합니다.
  현재 프로젝트에서는 차트를 그리기 위한 range, 좌표, 이동평균선 같은 파생 데이터를 계산할 때 사용합니다.

정리하면, 우리 팀 구현의 핵심은  
**queue 기반 state 처리 → 마이크로태스크 단위 렌더 예약 → hook 기반 실행 관리 → effect 후처리**  
흐름으로 볼 수 있습니다.

## 3. 프로젝트 진행 방식

```mermaid
flowchart TD
    subgraph STEP1["① 개념 정리"]
        A1["Virtual DOM"]
        A2["Diff Algorithm"]
        A3["Component\n+ 라이프사이클"]
        A4["State"]
        A5["Hooks\nuseState / useEffect / useMemo"]
        A6["렌더 단계\n& 커밋 단계"]
    end

    subgraph STEP2["② 런타임 구현"]
        B1["createElement"]
        B2["FunctionComponent\nmount / update"]
        B3["patch\nDiff / Patch"]
        B4["useState\nhook.queue 기반"]
        B5["useEffect\ncommitEffects"]
        B6["useMemo\ndeps 캐싱"]
    end

    subgraph STEP3["③ mock으로 검증"]
        C1["mock 데이터로\n1초 갱신 구조 확인"]
        C2["루트 state 관리\n구조 검증"]
        C3["diff / patch\n동작 확인"]
    end

    subgraph STEP4["④ WebSocket 연동"]
        D1["Binance\nbtcusdt@markPrice@1s\nbtcusdt@aggTrade"]
        D2["실시간 가격\n차트 / 체결 내역"]
        D3["연결 실패 시\nmock fallback"]
    end

    STEP1 --> STEP2 --> STEP3 --> STEP4
```

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

### 3-2. 프롬프트 정리

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

실시간 가격, 1초 캔들 차트, 계약 체결 히스토리를 실제 시장 데이터로 갱신하도록 확장했습니다.
또한 연결 실패 시 mock 데이터로 fallback 하도록 해서, 학습용 데모가 네트워크 문제로 완전히 죽지 않게 구성했습니다.

## 4. 회고

각 개념은 따로 이해할 수 있어도, 실제 코드에서 전체 흐름을 파악하는 것이 가장 어려웠다.
특히 LLM이 작성한 코드를 보면서 흐름을 추적하는 것은 더욱 어려웠다. 코드 자체는 동작하지만 왜 이렇게 연결되어 있는지 맥락을 잡기까지 시간이 많이 걸렸다.
