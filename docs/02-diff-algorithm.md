# Diff Algorithm

## 개념 정리

Diff Algorithm은 이전 Virtual DOM 트리와 새 Virtual DOM 트리를 비교해서
**변경된 부분만** 실제 DOM에 반영하는 알고리즘입니다.

두 트리를 완전히 비교하면 O(n³)이지만, React는 실용적인 가정을 두어 **O(n)** 으로 줄입니다.

## 핵심 동작 원리

### React의 핵심 가정 (Heuristics)

1. **타입(type)이 다르면** 서브트리 전체를 교체한다
2. **타입이 같으면** props만 업데이트한다
3. **리스트는 `key`** 로 항목을 추적한다

### patch 함수 흐름

```
patch(oldVNode, newVNode, parentDom)
  │
  ├── newVNode가 없음 → DOM 노드 제거
  ├── oldVNode가 없음 → DOM 노드 추가
  ├── 둘 다 텍스트 → textContent 업데이트
  ├── type이 다름  → 노드 교체 (replaceChild)
  └── type이 같음
        ├── props 업데이트 (updateProps)
        └── children 재귀 비교
```

### props 업데이트

```js
function updateProps(dom, oldProps, newProps) {
  // 제거된 props
  Object.keys(oldProps).forEach(key => {
    if (!(key in newProps)) removeprop(dom, key)
  })
  // 추가/변경된 props
  Object.keys(newProps).forEach(key => {
    if (oldProps[key] !== newProps[key]) setProp(dom, key, newProps[key])
  })
}
```

### key를 이용한 리스트 비교

`key`가 없으면 인덱스 기준으로 비교하므로 리스트 중간 삽입/삭제 시 비효율적입니다.

```
// key 없음 - 인덱스 기준 비교
[A, B, C] → [A, X, B, C]
  B→X 업데이트, C→B 업데이트, 새 C 추가 (3번 조작)

// key 있음 - key 기반 매핑
[A, B, C] → [A, X, B, C]
  X 추가만 하면 됨 (1번 조작)
```

key 기반 구현 핵심:
1. 이전 children을 `{ [key]: vnode }` 맵으로 변환
2. 새 children을 순회하며 같은 key가 있으면 patch, 없으면 새로 생성
3. 남은 이전 노드는 제거

## 구현 시 고려할 점

- **DOM 노드 참조 유지**: VNode에 실제 DOM 노드(`_dom`)를 저장해 두어야 patch 시 찾을 수 있음
- **이벤트 핸들러 교체**: 이벤트는 `removeEventListener` 후 `addEventListener` 해야 메모리 누수 없음
- **컴포넌트 VNode**: `type`이 함수인 경우 함수를 실행한 결과물(VNode)을 재귀적으로 diff
- **Fragment 처리**: 여러 자식을 감싸는 래퍼 없이 반환하는 경우 처리 필요

## 참고

- [React Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html)
- [Write your own virtual DOM](https://medium.com/@deathmood/write-your-own-virtual-dom-ee74acc13060)
