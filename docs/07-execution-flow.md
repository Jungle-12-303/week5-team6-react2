# 실행 흐름 (Execution Flow)

## 전체 흐름 개요

```mermaid
flowchart TD
    A([브라우저가 index.html 파싱 시작]) --> B

    subgraph HTML["HTML 파싱 단계"]
        B[DOM 트리 생성\n div#app 빈 상태로 생성] --> C
        C[script 태그 발견\n src=main.js] --> D
        D[JS 파일 로드 & 실행 시작]
    end

    D --> E

    subgraph JS["JS 실행 단계"]
        E[document.getElementById 'app'\n 컨테이너 참조 획득] --> F
        F[mountRoot App, container 호출]
    end

    F --> G

    subgraph MOUNT["마운트 단계"]
        G[FunctionComponent 인스턴스 생성\n hooks 배열 초기화] --> H
        H[App 함수 실행\n props 전달] --> I

        subgraph VDOM["Virtual DOM 생성"]
            I[createElement 호출\n VNode 트리 구성] --> J
            J[자식 컴포넌트 순회\n 재귀적으로 VNode 생성]
        end

        J --> K

        subgraph RENDER["실제 DOM 변환"]
            K[VNode 타입 확인\n 문자열 or 함수] --> L
            L[document.createElement\n 실제 DOM 노드 생성] --> M
            M[props 적용\n 이벤트 리스너, 속성 등] --> N
            N[children 재귀 처리\n 자식 노드 생성 및 연결]
        end

        N --> O[container.appendChild\n #app 안에 DOM 트리 삽입]
    end

    O --> P

    subgraph EFFECT["렌더 완료 후"]
        P[useEffect 실행\n 사이드이펙트 처리\n ex. API 호출, 구독 등]
    end

    P --> Q([화면에 UI 표시 완료])
```

---

## 상태 변경 시 업데이트 흐름

```mermaid
flowchart TD
    A([사용자 이벤트 발생\n or 외부 데이터 수신]) --> B

    subgraph UPDATE["업데이트 단계"]
        B[setState 호출\n 새 값을 hook queue에 적재] --> C
        C[FunctionComponent.update 호출\n 리렌더 트리거] --> D
        D[App 함수 재실행\n hookIndex = 0 으로 리셋] --> E

        subgraph HOOKS["훅 재실행"]
            E[useState\n hook 배열에서 기존 상태 반환] --> F
            F[useEffect\n deps 변경 여부 확인] --> G
            G[useMemo\n deps 변경 시에만 재계산]
        end

        G --> H[새 Virtual DOM 트리 생성]
    end

    H --> I

    subgraph DIFF["Diff 단계 (비교)"]
        I[이전 VNode와 새 VNode 비교\n patch oldVNode, newVNode] --> J
        J{노드 타입 비교} --> |타입 다름| K
        J --> |타입 같음| L
        J --> |노드 없음| M
        J --> |새 노드만 있음| N

        K[서브트리 전체 교체\n replaceChild]
        L[props만 업데이트\n updateProps] --> O
        M[DOM 노드 제거\n removeChild]
        N[새 DOM 노드 추가\n appendChild]

        O[children 재귀 비교\n key 기반 매핑]
    end

    K & L & M & N & O --> P

    subgraph PATCH["Patch 단계 (반영)"]
        P[변경된 부분만\n 실제 DOM에 반영]
    end

    P --> Q

    subgraph AFTER["업데이트 완료 후"]
        Q[deps 변경된 useEffect\n cleanup 실행 → 새 effect 실행]
    end

    Q --> R([화면 업데이트 완료])
```

---

## 핵심 개념 정리

### 최초 렌더 vs 업데이트 렌더

| | 최초 렌더 (mount) | 업데이트 렌더 (update) |
|---|---|---|
| 트리거 | `mountRoot()` 호출 | `setState()` 호출 |
| hooks | 초기값으로 초기화 | 기존 상태 유지 |
| DOM | 새로 생성 후 삽입 | diff 후 변경분만 반영 |
| alternate | `null` | 이전 Fiber 참조 |
| useEffect | 모든 effect 실행 | deps 변경된 effect만 실행 |

### Virtual DOM이 실제 DOM으로 변환되는 과정

```
VNode { type: 'div', props: { className: 'box', children: [...] } }
  │
  ├── document.createElement('div')
  ├── dom.className = 'box'
  └── children 순회 → 재귀적으로 동일 과정 반복
        └── 완성된 자식 노드를 부모에 appendChild
```

### key 기반 리스트 업데이트

```
이전 children    새 children
key='a' ──────── key='a'   (재사용, props만 비교)
key='b'    ╲  ╱  key='c'   (신규 생성)
key='c' ────╳    key='b'   (재사용, 위치만 이동)
            ╱
           (key='b' 매칭)
```
