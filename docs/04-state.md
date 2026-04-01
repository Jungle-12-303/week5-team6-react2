# State

## 개념 정리

State는 컴포넌트 내부에서 관리하는 변경 가능한 데이터입니다.
State가 바뀌면 해당 컴포넌트가 리렌더링됩니다.

props는 외부에서 주어지는 값(읽기 전용), state는 컴포넌트 자신이 관리하는 값입니다.

## 핵심 동작 원리

### useState 기본 동작

```js
function Counter() {
  const [count, setCount] = useState(0)

  return createElement('button', {
    onClick: () => setCount(count + 1)
  }, count)
}
```

1. 첫 렌더: `useState(0)` → `count = 0` 저장 후 반환
2. 클릭: `setCount(1)` → 상태 업데이트 + 리렌더 예약
3. 리렌더: `useState(0)` 재호출 → 저장된 `count = 1` 반환 (초기값 무시)

### 상태 저장 위치

상태는 컴포넌트 함수 바깥 어딘가에 저장되어야 재렌더 후에도 유지됩니다.
Fiber 노드에 연결된 **hooks 배열** 에 저장합니다.

```js
fiber.hooks = [
  { state: 1, queue: [] },  // 첫 번째 useState
  { state: 'hi', queue: [] }, // 두 번째 useState
]
```

### 인덱스(cursor) 기반 식별

훅은 이름이 없고 **호출 순서(index)** 로 식별됩니다.

```js
let hookIndex = 0  // 현재 처리 중인 훅 인덱스

function useState(initialState) {
  const hook = currentFiber.hooks[hookIndex] ?? { state: initialState, queue: [] }
  currentFiber.hooks[hookIndex] = hook
  hookIndex++

  const setState = (newState) => {
    hook.queue.push(newState)
    scheduleRender(currentFiber)  // 리렌더 예약
  }

  return [hook.state, setState]
}
```

### 배치 업데이트 (Batching)

여러 `setState`가 한 이벤트 핸들러 안에서 호출될 때, 각각 리렌더하지 않고 한 번만 리렌더합니다.

```js
// 나쁜 동작: 2번 렌더
setA(1)  // 렌더 1
setB(2)  // 렌더 2

// 올바른 동작: 1번 렌더
setA(1)  // 큐에 적재
setB(2)  // 큐에 적재
// → 이벤트 루프 끝에 한 번만 렌더
```

구현 방법: `setTimeout(flushRender, 0)` 또는 `Promise.resolve().then(flushRender)` 로 마이크로태스크 큐에 렌더를 미룸

### 함수형 업데이트

```js
// 이전 상태를 기반으로 업데이트할 때
setCount(prev => prev + 1)
```

`queue`에 함수가 들어온 경우, 현재 state에 적용해서 다음 state를 계산합니다.

```js
hook.queue.forEach(update => {
  hook.state = typeof update === 'function' ? update(hook.state) : update
})
hook.queue = []
```

## 구현 시 고려할 점

- **렌더 중 hookIndex 초기화**: 매 렌더 시작 시 `hookIndex = 0`으로 리셋해야 함
- **currentFiber 전역 변수**: 훅은 현재 렌더 중인 Fiber를 알아야 상태를 저장할 위치를 찾을 수 있음
- **조건부 훅 금지**: 훅 호출 순서가 바뀌면 인덱스가 틀어지므로 조건문 안에서 훅 호출 불가
- **Object.is 비교**: 새 state가 이전 state와 동일하면 리렌더 생략 가능

## 참고

- [useState – React 공식 문서](https://react.dev/reference/react/useState)
- [How Does React Tell a Class from a Function?](https://overreacted.io/how-does-react-tell-a-class-from-a-function/)
