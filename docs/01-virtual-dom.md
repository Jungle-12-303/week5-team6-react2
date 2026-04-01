# Virtual DOM

## 개념 정리

Virtual DOM은 실제 DOM의 경량 JavaScript 객체 복사본입니다.

실제 DOM 조작은 브라우저 레이아웃 계산, 리페인트 등이 동반되어 비용이 큽니다.
Virtual DOM은 변경 사항을 먼저 JS 객체 수준에서 계산한 뒤, 실제로 바뀐 부분만 DOM에 반영합니다.

```
상태 변경
  → 새 Virtual DOM 트리 생성
  → 이전 트리와 비교 (diff)
  → 변경된 부분만 실제 DOM에 반영 (patch)
```

## 핵심 동작 원리

### VNode 구조

Virtual DOM의 각 노드(VNode)는 다음과 같은 JS 객체입니다.

```js
{
  type: 'div',           // 태그명 (string) 또는 컴포넌트 함수 (function)
  props: {
    className: 'box',
    onClick: () => {},
    children: [
      { type: 'span', props: { children: ['hello'] } }
    ]
  }
}
```

### createElement

JSX를 변환하면 `createElement` 호출이 됩니다.

```jsx
// JSX
<div className="box"><span>hello</span></div>

// 변환 결과
createElement('div', { className: 'box' },
  createElement('span', null, 'hello')
)
```

`createElement`는 VNode 객체를 반환합니다.

```js
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.flat(),
    },
  }
}
```

### render

VNode를 받아 실제 DOM 노드를 생성하고 컨테이너에 삽입합니다.

```js
function render(vnode, container) {
  const dom = createDom(vnode)
  container.appendChild(dom)
}

function createDom(vnode) {
  // 텍스트 노드
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return document.createTextNode(String(vnode))
  }

  const dom = document.createElement(vnode.type)

  // props 적용 (이벤트, 속성 등)
  applyProps(dom, vnode.props)

  // children 재귀 처리
  vnode.props.children.forEach(child => render(child, dom))

  return dom
}
```

## 구현 시 고려할 점

- **children 정규화**: `children`이 배열일 수도 있고 단일 값일 수도 있어서, 항상 배열로 통일해야 함
- **이벤트 처리**: `onClick` 같은 props는 `addEventListener`로 연결해야 함
- **null/undefined 처리**: 조건부 렌더링에서 `false`, `null`, `undefined`가 children으로 들어올 수 있음
- **컴포넌트 타입**: `type`이 함수면 컴포넌트이므로 호출해서 반환값을 재귀 처리해야 함

## 참고

- [React Without JSX](https://react.dev/reference/react/createElement)
- [The Inner Workings of Virtual DOM](https://rajaraodv.medium.com/the-inner-workings-of-virtual-dom-666ee7ad47cf)
