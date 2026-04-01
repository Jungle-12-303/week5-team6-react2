# Component

## 개념 정리

Component는 UI를 독립적이고 재사용 가능한 단위로 분리하는 개념입니다.
props를 입력받아 VNode를 반환하는 함수입니다.

```js
function Button({ label, onClick }) {
  return createElement('button', { onClick }, label)
}
```

## 핵심 동작 원리

### 컴포넌트 VNode

`createElement`의 `type`이 함수이면 컴포넌트 VNode입니다.

```js
// 일반 VNode
{ type: 'div', props: { ... } }

// 컴포넌트 VNode
{ type: Button, props: { label: 'click', onClick: fn } }
```

### 컴포넌트 렌더링

컴포넌트 VNode를 만나면 함수를 호출해서 반환된 VNode로 재귀 처리합니다.

```js
function createDom(vnode) {
  if (typeof vnode.type === 'function') {
    const childVNode = vnode.type(vnode.props)  // 컴포넌트 함수 호출
    return createDom(childVNode)                 // 재귀
  }
  // ... 일반 DOM 노드 처리
}
```

### Fiber: 컴포넌트 인스턴스 추적

컴포넌트를 리렌더링하려면 이전 렌더 결과와 상태를 어딘가에 저장해야 합니다.
React는 이를 **Fiber** 라는 객체로 관리합니다.

```js
// Fiber 구조 (단순화)
{
  type: Button,           // 컴포넌트 함수
  props: { label: '...' },
  stateNode: domNode,     // 실제 DOM 노드
  alternate: oldFiber,    // 이전 렌더의 Fiber (diff용)
  hooks: [],              // useState, useEffect 등 훅 데이터
  child: fiber,           // 첫 번째 자식 Fiber
  sibling: fiber,         // 다음 형제 Fiber
  return: fiber,          // 부모 Fiber
}
```

### 리렌더링 흐름

```
setState 호출
  → 해당 컴포넌트의 Fiber를 작업 큐에 추가
  → 컴포넌트 함수 재실행 (새 VNode 생성)
  → 이전 Fiber(alternate)와 diff
  → 변경된 DOM만 업데이트
```

## 컴포넌트 라이프사이클

컴포넌트는 생성부터 소멸까지 세 단계를 거칩니다.

```
Mount   → Update → Unmount
(생성)     (갱신)    (제거)
```

### Mount (마운트)

컴포넌트가 처음으로 DOM에 추가되는 단계입니다.

- Fiber가 처음 생성됨 → `alternate`가 `null`
- 컴포넌트 함수가 처음 실행되고 실제 DOM 노드가 만들어짐
- `useEffect(fn, [])` 내부 effect 함수가 실행됨

```
alternate === null  →  Mount (최초 렌더)
alternate !== null  →  Update (재렌더)
```

### Update (업데이트)

props 또는 state가 변경되어 컴포넌트가 다시 렌더링되는 단계입니다.

- 이전 Fiber(`alternate`)가 존재함
- 컴포넌트 함수가 재실행되고 이전 Fiber와 diff
- deps가 변경된 `useEffect`의 cleanup 실행 → 새 effect 실행

### Unmount (언마운트)

컴포넌트가 DOM에서 제거되는 단계입니다.

- 부모의 새 렌더 결과에 해당 컴포넌트가 없으면 Deletion 태그가 붙음
- DOM 노드 제거
- `useEffect`의 cleanup 함수가 실행됨

---

### Fiber Effect 태그

커밋 단계에서 각 Fiber에 붙은 태그에 따라 DOM 작업이 결정됩니다.

| 태그 | 의미 | DOM 작업 |
|---|---|---|
| `Placement` | 새로 추가된 컴포넌트 | `appendChild` |
| `Update` | props/state 변경 | `updateProps` |
| `Deletion` | 제거된 컴포넌트 | `removeChild` |

```js
// Fiber에 태그를 붙이는 예시
if (!oldFiber) {
  newFiber.effectTag = 'Placement'
} else if (needsUpdate) {
  newFiber.effectTag = 'Update'
}
// 이전 트리에만 있고 새 트리에 없으면
oldFiber.effectTag = 'Deletion'
```

---

### 클래스형 ↔ 함수형 라이프사이클 대응

| 클래스형 메서드 | 함수형 Hook 대응 |
|---|---|
| `constructor` | `useState` 초기값 |
| `componentDidMount` | `useEffect(fn, [])` |
| `componentDidUpdate` | `useEffect(fn, [deps])` |
| `componentWillUnmount` | `useEffect(() => { return cleanup }, [])` |
| `shouldComponentUpdate` | `React.memo` / `useMemo` |

---

### cleanup 실행 타이밍

```
Update 시:
  이전 effect cleanup 실행
  → 새 effect 실행

Unmount 시:
  마지막 effect cleanup 실행
  (새 effect는 실행되지 않음)
```

cleanup이 없으면 이벤트 리스너, 타이머, 구독 등이 남아 메모리 누수가 발생합니다.

## 구현 시 고려할 점

- **컴포넌트 동일성 판단**: 같은 위치의 같은 함수 타입이면 같은 컴포넌트로 보고 재사용
- **props 변경 감지**: 함수 컴포넌트는 props가 바뀌면 재실행됨
- **children prop**: `props.children`을 통해 컴포넌트 내부에 외부 VNode를 주입할 수 있음
- **Fiber 트리 구성**: 실제 DOM 트리와 1:1로 대응되는 Fiber 트리를 별도로 유지해야 함
- **alternate 초기화**: 첫 렌더 시 모든 Fiber의 `alternate`는 `null`이어야 함
- **Deletion 처리**: 삭제할 Fiber는 별도의 deletions 배열로 모아서 커밋 단계에 처리

## 참고

- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
- [A deep dive into React Fiber](https://blog.logrocket.com/deep-dive-react-fiber/)
