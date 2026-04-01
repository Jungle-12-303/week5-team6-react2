# Hooks

## 개념 정리

Hooks는 함수형 컴포넌트에서 상태(state)와 사이드이펙트(side effect)를 다루는 방법입니다.
클래스 컴포넌트 없이도 React의 모든 기능을 사용할 수 있게 해줍니다.

**사이드이펙트**: 렌더링 자체와 무관한 작업 — API 호출, DOM 직접 조작, 타이머, 구독 등

## 핵심 동작 원리

### 훅의 핵심 규칙

1. **최상위에서만 호출**: 조건문, 반복문, 중첩 함수 안에서 호출하면 안 됨
2. **함수 컴포넌트 안에서만 호출**: 일반 JS 함수에서 호출 불가

이 규칙이 존재하는 이유: 훅은 **호출 순서(index)** 로 식별되기 때문에, 순서가 바뀌면 잘못된 상태가 반환됨

```js
// 잘못된 예 - 조건에 따라 훅 호출 순서가 달라짐
function Component({ show }) {
  if (show) {
    const [a, setA] = useState(0)  // 어떤 렌더에서는 index 0, 다른 렌더에서는 없음
  }
  const [b, setB] = useState('')   // index가 0이 될 수도, 1이 될 수도 있어서 오류
}
```

### 공통 내부 구조

모든 훅은 현재 렌더 중인 Fiber의 `hooks` 배열에 데이터를 저장합니다.

```js
let currentFiber = null  // 현재 렌더 중인 컴포넌트의 Fiber
let hookIndex = 0        // 현재 처리 중인 훅 번호

// 컴포넌트 렌더 시작 시
function renderComponent(fiber) {
  currentFiber = fiber
  hookIndex = 0
  fiber.hooks = fiber.hooks ?? []
  // 컴포넌트 함수 실행...
}
```

---

## useState

→ [04-state.md](./04-state.md) 참고

---

## useEffect

### 개념

렌더링이 끝난 후 실행되는 사이드이펙트를 등록합니다.
deps(의존성 배열)가 변경될 때만 effect를 재실행합니다.

```js
useEffect(() => {
  // 마운트 시, 또는 deps 변경 시 실행
  document.title = `Count: ${count}`

  return () => {
    // cleanup: 다음 effect 실행 전 or 언마운트 시 실행
    document.title = 'App'
  }
}, [count])  // count가 바뀔 때만 재실행
```

### 내부 구현

```js
function useEffect(effect, deps) {
  const hook = currentFiber.hooks[hookIndex] ?? {}
  const prevDeps = hook.deps

  // deps가 없거나 변경됐으면 effect 재실행 예약
  const hasChanged = !prevDeps || deps.some((d, i) => !Object.is(d, prevDeps[i]))

  if (hasChanged) {
    hook.effect = effect  // 렌더 후 실행할 effect 저장
  }

  hook.deps = deps
  currentFiber.hooks[hookIndex] = hook
  hookIndex++
}

// 렌더가 끝난 후 commitEffects 호출
function commitEffects(fiber) {
  fiber.hooks.forEach(hook => {
    if (hook.effect) {
      if (hook.cleanup) hook.cleanup()     // 이전 cleanup 실행
      hook.cleanup = hook.effect()         // effect 실행, cleanup 저장
      hook.effect = null
    }
  })
}
```

### deps 패턴 정리

| deps | 실행 시점 |
|---|---|
| 없음 (`useEffect(fn)`) | 매 렌더마다 실행 |
| 빈 배열 (`useEffect(fn, [])`) | 마운트 시 한 번만 실행 |
| 값 포함 (`useEffect(fn, [a, b])`) | `a` 또는 `b` 변경 시 실행 |

---

## useRef

### 개념

렌더 간에 유지되는 mutable 객체를 만듭니다.
값이 바뀌어도 **리렌더를 유발하지 않습니다.**

주요 사용처:
- DOM 노드에 직접 접근 (`ref.current = domNode`)
- 렌더 간 값을 유지해야 하지만 화면에는 영향 없는 경우 (타이머 ID, 이전 값 등)

```js
function Input() {
  const inputRef = useRef(null)

  const focus = () => inputRef.current.focus()  // DOM 직접 조작

  return createElement('input', { ref: inputRef })
}
```

### 내부 구현

```js
function useRef(initialValue) {
  const hook = currentFiber.hooks[hookIndex] ?? { current: initialValue }
  currentFiber.hooks[hookIndex] = hook
  hookIndex++
  return hook  // { current: ... } 객체 자체를 반환
}
```

`useRef`는 단순히 렌더 간 유지되는 `{ current }` 객체입니다.
`useState`와 달리 값이 바뀌어도 리렌더를 트리거하지 않습니다.

---

## useMemo

### 개념

deps가 변경될 때만 값을 재계산합니다.
비용이 큰 계산의 결과를 캐싱할 때 사용합니다.

```js
const sortedList = useMemo(() => {
  return hugeList.sort(compareFunc)  // 매 렌더마다 정렬하지 않음
}, [hugeList])
```

### 내부 구현

```js
function useMemo(factory, deps) {
  const hook = currentFiber.hooks[hookIndex] ?? {}
  const prevDeps = hook.deps

  const hasChanged = !prevDeps || deps.some((d, i) => !Object.is(d, prevDeps[i]))

  if (hasChanged) {
    hook.value = factory()  // 재계산
    hook.deps = deps
  }

  currentFiber.hooks[hookIndex] = hook
  hookIndex++
  return hook.value
}
```

---

## useCallback

### 개념

함수를 메모이제이션합니다. `useMemo`에서 factory가 함수를 반환하는 것과 동일합니다.
주로 자식 컴포넌트에 콜백을 넘길 때 불필요한 리렌더를 방지하는 용도로 사용합니다.

```js
const handleClick = useCallback(() => {
  doSomething(a, b)
}, [a, b])

// 아래와 동일
const handleClick = useMemo(() => () => doSomething(a, b), [a, b])
```

---

## 구현 시 고려할 점

- **hookIndex 초기화**: 컴포넌트 렌더 시작 시 반드시 `hookIndex = 0`으로 리셋
- **currentFiber 동기화**: 훅 호출 시점에 `currentFiber`가 올바른 Fiber를 가리켜야 함
- **cleanup 순서**: 새 effect 실행 전에 이전 cleanup을 먼저 실행해야 함
- **렌더 후 effect 실행**: useEffect는 DOM이 업데이트된 이후에 실행되어야 함 (렌더 도중 아님)
- **Object.is 비교**: deps 비교 시 `===` 대신 `Object.is`를 써야 `NaN`, `-0` 등을 올바르게 처리

## 참고

- [Hooks at a Glance – React 공식 문서](https://react.dev/reference/react/hooks)
- [Why Do React Hooks Rely on Call Order?](https://overreacted.io/why-do-hooks-rely-on-call-order/)
- [A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/)
