# 렌더 단계 & 커밋 단계

## 개념 정리

React는 화면을 업데이트할 때 두 단계로 작업을 분리합니다.

```
렌더 단계 (Render Phase)    →    커밋 단계 (Commit Phase)
"무엇을 바꿔야 하는가?"           "실제로 바꾼다"
 순수 계산, 중단 가능              DOM 조작, 중단 불가
```

이 분리가 중요한 이유:
- **렌더 단계는 부수효과(side effect)가 없어야 합니다.** 같은 입력이면 항상 같은 출력 (순수 함수)
- **커밋 단계는 원자적(atomic)으로 실행됩니다.** 중간에 멈추면 UI가 불완전한 상태가 되기 때문

---

## 렌더 단계 (Render Phase)

### 하는 일

1. 컴포넌트 함수 실행 → 새 VNode(Fiber) 트리 생성
2. 이전 Fiber 트리(`alternate`)와 diff → 변경 사항 탐지
3. 변경된 Fiber에 effect 태그 부착 (`Placement`, `Update`, `Deletion`)
4. 변경이 필요한 Fiber를 **effectList**에 수집

### 핵심 특징

- **DOM을 건드리지 않습니다.** 모든 작업이 메모리 안에서 JS 객체(Fiber)로 이루어짐
- **중단하고 재시작할 수 있습니다.** (React의 Concurrent Mode에서 활용)
  - 더 긴급한 작업(예: 사용자 입력)이 들어오면 현재 렌더를 중단하고 우선 처리 가능
- `useState`, `useReducer`, `useMemo` 등 훅의 값이 이 단계에서 결정됨

### 의사 코드

```js
function performRenderPhase(rootFiber) {
  let currentFiber = rootFiber

  while (currentFiber) {
    // 1. 컴포넌트 함수 실행 (함수형 컴포넌트인 경우)
    if (typeof currentFiber.type === 'function') {
      currentFiber.hooks = []
      hookIndex = 0
      const childVNode = currentFiber.type(currentFiber.props)
      reconcileChildren(currentFiber, childVNode)  // diff
    }

    // 2. 다음 작업 단위로 이동 (child → sibling → parent 순)
    if (currentFiber.child) {
      currentFiber = currentFiber.child
    } else {
      // leaf 노드에 도달 → effectList에 추가 후 형제/부모로 이동
      collectEffect(currentFiber)
      currentFiber = currentFiber.sibling ?? currentFiber.return
    }
  }
}
```

---

## 커밋 단계 (Commit Phase)

### 하는 일

렌더 단계에서 수집한 effectList를 순서대로 처리합니다.
세 단계로 나뉘며, 각 단계마다 effectList 전체를 순회합니다.

```
Before Mutation  →  Mutation  →  Layout
  (DOM 변경 전)      (DOM 변경)    (DOM 변경 후)
```

### 1단계: Before Mutation

- DOM 변경 직전에 처리해야 할 작업
- 예: 스크롤 위치 저장, `getSnapshotBeforeUpdate` 호출

### 2단계: Mutation

- 실제 DOM 조작이 이루어지는 단계
- effect 태그에 따라 작업이 결정됨

```js
function commitMutation(fiber) {
  if (fiber.effectTag === 'Placement') {
    fiber.return.stateNode.appendChild(fiber.stateNode)
  } else if (fiber.effectTag === 'Update') {
    updateProps(fiber.stateNode, fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === 'Deletion') {
    fiber.return.stateNode.removeChild(fiber.stateNode)
  }
}
```

### 3단계: Layout

- DOM 변경이 완료된 직후에 실행
- `useLayoutEffect`의 effect 함수가 이 단계에서 **동기적**으로 실행됨
- 화면에 반영된 DOM 크기/위치를 읽어야 할 때 사용

### 핵심 특징

- **절대 중단되지 않습니다.** 일관성 없는 UI 상태를 방지하기 위해 한 번에 완료
- useEffect와 useLayoutEffect의 실행 타이밍이 이 단계에서 결정됨

---

## useEffect vs useLayoutEffect 실행 타이밍

```
렌더 단계
  └── 커밋 단계
        ├── Before Mutation
        ├── Mutation (DOM 변경)
        ├── Layout
        │     └── useLayoutEffect 실행 ← 동기, DOM 변경 직후
        │
        └── (브라우저가 화면을 그림)
              └── useEffect 실행 ← 비동기, 화면 반영 후
```

| | useEffect | useLayoutEffect |
|---|---|---|
| 실행 시점 | 브라우저 페인트 이후 | DOM 변경 직후, 페인트 전 |
| 실행 방식 | 비동기 | 동기 |
| 주 용도 | API 호출, 구독, 타이머 | DOM 크기/위치 측정, 스크롤 조작 |
| 주의 | 깜빡임 발생 가능 | 오래 걸리면 렌더 블로킹 |

> **대부분의 경우 useEffect를 사용하세요.**
> DOM을 직접 측정해야 할 때만 useLayoutEffect를 고려하세요.

---

## 전체 흐름 요약

```
상태 변경 / props 변경
  │
  ▼
[렌더 단계]
  컴포넌트 함수 실행
  → 새 Fiber 트리 생성
  → 이전 트리와 diff
  → effectList 수집
  (DOM 변경 없음, 중단 가능)
  │
  ▼
[커밋 단계]
  Before Mutation
  → Mutation (DOM 반영)
  → Layout (useLayoutEffect)
  (중단 불가)
  │
  ▼
브라우저 화면 렌더
  │
  ▼
useEffect 실행 (비동기)
```

---

## 구현 시 고려할 점

- **렌더 단계에서 DOM 조작 금지**: 컴포넌트 함수 실행 중 `document.getElementById` 등으로 DOM을 직접 변경하면 안 됨
- **effectList 분리**: 렌더 단계에서 수집한 변경 목록을 커밋 단계에서 일괄 처리해야 일관성 보장
- **Deletion 별도 관리**: 삭제 대상 Fiber는 새 트리에 없으므로 `deletions` 배열로 따로 관리
- **커밋 단계 원자성**: 커밋 도중 에러가 발생하면 전체 트리가 불완전해질 수 있으므로 주의

## 참고

- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
- [Inside Fiber: in-depth overview of the new reconciliation algorithm in React](https://blog.ag-grid.com/inside-fiber-an-in-depth-overview-of-the-new-reconciliation-algorithm-in-react/)
- [useEffect vs useLayoutEffect](https://kentcdodds.com/blog/useeffect-vs-uselayouteffect)
