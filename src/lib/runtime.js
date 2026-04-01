// TEXT_ELEMENT는 문자열/숫자 자식을 "텍스트 전용 VNode"로 통일하기 위한 내부 타입이다.
const TEXT_ELEMENT = "TEXT_ELEMENT";

// SVG 태그는 일반 HTML과 다른 namespace를 사용하므로 별도 상수로 분리했다.
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// currentInstance는 "지금 어떤 함수형 컴포넌트를 렌더 중인지" 가리키는 전역 포인터다.
// useState / useEffect / useMemo가 state를 어디에 저장해야 할지 알기 위해 필요하다.
let currentInstance = null;

// hookIndex는 현재 렌더 중인 컴포넌트 안에서 "몇 번째 hook을 처리 중인지"를 나타낸다.
// React의 hook 규칙과 비슷하게, 호출 순서가 곧 hook의 식별자가 된다.
let hookIndex = 0;

/**
 * children을 항상 1차원 배열 형태로 정규화한다.
 *
 * 왜 필요한가?
 * - h("div", null, "a", "b")
 * - h("div", null, [child1, child2])
 * - 조건부 렌더링으로 null/false가 섞이는 경우
 *
 * 위와 같은 다양한 입력을 이후 단계에서 같은 방식으로 처리하기 위해
 * children을 "비어 있지 않은 VNode 배열" 형태로 맞춘다.
 */
function flattenChildren(children, bucket = []) {
  children.forEach((child) => {
    if (Array.isArray(child)) {
      flattenChildren(child, bucket);
      return;
    }

    if (child === null || child === undefined || child === false || child === true) {
      return;
    }

    if (typeof child === "string" || typeof child === "number") {
      bucket.push(createTextElement(child));
      return;
    }

    bucket.push(child);
  });

  return bucket;
}

/**
 * 문자열이나 숫자를 텍스트 VNode 객체로 감싼다.
 *
 * 이후 patch 단계에서는 이 객체도 일반 VNode처럼 비교할 수 있다.
 */
function createTextElement(value) {
  return {
    type: TEXT_ELEMENT,
    props: {
      nodeValue: String(value),
      children: [],
    },
  };
}

/**
 * JSX 대신 사용하는 VNode 생성 함수다.
 *
 * 초심자 관점에서 보면:
 * - 화면을 바로 만드는 함수는 아니다.
 * - "어떤 화면을 만들고 싶은지 설명하는 JS 객체"를 만드는 함수다.
 */
export function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...(props || {}),
      children: flattenChildren(children),
    },
  };
}

/**
 * 현재 태그가 SVG 계열인지 판별한다.
 *
 * SVG는 document.createElement 대신 document.createElementNS를 사용해야 한다.
 */
function isSvgType(type) {
  return ["svg", "path", "polyline", "polygon", "line", "circle", "rect", "text", "defs", "linearGradient", "stop"].includes(type);
}

/**
 * VNode를 실제 DOM 노드로 변환한다.
 *
 * 실행 순서 4:
 * 초기 마운트 시 renderVNode()가 만든 VNode 트리를 실제 DOM으로 바꾼다.
 */
function createDomNode(vnode, namespace = null) {
  // 함수형 컴포넌트라면 먼저 함수를 실행해서 "실제 자식 VNode"를 얻는다.
  if (typeof vnode.type === "function") {
    const rendered = vnode.type(vnode.props || {});
    vnode._rendered = rendered;
    const dom = createDomNode(rendered, namespace);
    vnode._dom = dom;
    return dom;
  }

  // 텍스트 VNode면 text node를 만든다.
  if (vnode.type === TEXT_ELEMENT) {
    const dom = document.createTextNode(vnode.props.nodeValue);
    vnode._dom = dom;
    return dom;
  }

  // HTML인지 SVG인지에 따라 DOM 생성 방식을 선택한다.
  const nextNamespace = namespace === SVG_NAMESPACE || isSvgType(vnode.type) ? SVG_NAMESPACE : null;
  const dom = nextNamespace
    ? document.createElementNS(SVG_NAMESPACE, vnode.type)
    : document.createElement(vnode.type);

  // 먼저 자신의 props를 반영한다.
  updateProps(dom, {}, vnode.props);

  // 그 다음 children을 재귀적으로 DOM으로 만든다.
  vnode.props.children.forEach((child) => {
    const childDom = createDomNode(child, nextNamespace);
    dom.appendChild(childDom);
  });

  // 이후 patch 단계가 DOM 노드를 재사용할 수 있도록 VNode에 참조를 저장한다.
  vnode._dom = dom;
  return dom;
}

/**
 * VNode에서 실제 DOM 노드를 찾는다.
 *
 * 함수형 컴포넌트 VNode는 자기 자신이 DOM을 가지지 않고,
 * 내부에서 렌더한 자식 VNode가 DOM을 가지므로 재귀적으로 내려간다.
 */
function getDomNode(vnode) {
  if (!vnode) {
    return null;
  }

  if (vnode._dom) {
    return vnode._dom;
  }

  if (vnode._rendered) {
    return getDomNode(vnode._rendered);
  }

  return null;
}

/**
 * 특정 VNode에 연결된 실제 DOM 노드를 부모에서 제거한다.
 */
function removeDomNode(parentDom, vnode) {
  if (!vnode) {
    return;
  }

  if (typeof vnode.type === "function") {
    removeDomNode(parentDom, vnode._rendered);
    return;
  }

  const dom = getDomNode(vnode);

  if (dom && parentDom.contains(dom)) {
    parentDom.removeChild(dom);
  }
}

/**
 * onClick, onInput 같은 이벤트 props인지 판별한다.
 */
function isEventProp(name) {
  return /^on[A-Z]/.test(name);
}

/**
 * DOM에 prop 하나를 적용한다.
 *
 * 여기서 하는 일:
 * - className -> class 속성 매핑
 * - style 객체 적용
 * - 이벤트 핸들러 등록
 * - 일반 속성/프로퍼티 반영
 */
function setProp(dom, name, value) {
  if (name === "children" || name === "key") {
    return;
  }

  if (name === "className") {
    dom.setAttribute("class", value || "");
    return;
  }

  if (name === "style" && value && typeof value === "object") {
    Object.entries(value).forEach(([styleName, styleValue]) => {
      dom.style[styleName] = styleValue;
    });
    return;
  }

  if (isEventProp(name)) {
    const eventName = name.slice(2).toLowerCase();
    dom.addEventListener(eventName, value);
    return;
  }

  if (name in dom && !(dom instanceof SVGElement)) {
    dom[name] = value;
    return;
  }

  if (value === false || value === null || value === undefined) {
    dom.removeAttribute(name);
    return;
  }

  dom.setAttribute(name, value);
}

/**
 * DOM에서 기존 prop 하나를 제거한다.
 *
 * updateProps에서 "예전에는 있었는데 지금은 없는 값"을 정리할 때 사용한다.
 */
function removeProp(dom, name, value) {
  if (name === "children" || name === "key") {
    return;
  }

  if (name === "className") {
    dom.removeAttribute("class");
    return;
  }

  if (name === "style" && value && typeof value === "object") {
    Object.keys(value).forEach((styleName) => {
      dom.style[styleName] = "";
    });
    return;
  }

  if (isEventProp(name)) {
    const eventName = name.slice(2).toLowerCase();
    dom.removeEventListener(eventName, value);
    return;
  }

  if (name in dom && !(dom instanceof SVGElement)) {
    try {
      dom[name] = "";
    } catch {
      dom.removeAttribute(name);
    }
    return;
  }

  dom.removeAttribute(name);
}

/**
 * oldProps와 newProps를 비교해 변경된 부분만 DOM에 반영한다.
 *
 * 실행 순서 10-1:
 * patch()가 "같은 타입의 DOM 노드"라고 판단한 뒤 props 차이만 업데이트한다.
 */
function updateProps(dom, oldProps, newProps) {
  Object.keys(oldProps).forEach((name) => {
    if (!(name in newProps)) {
      removeProp(dom, name, oldProps[name]);
    }
  });

  Object.keys(newProps).forEach((name) => {
    if (name === "children") {
      return;
    }

    const oldValue = oldProps[name];
    const newValue = newProps[name];

    if (oldValue !== newValue) {
      if (oldValue !== undefined) {
        removeProp(dom, name, oldValue);
      }
      setProp(dom, name, newValue);
    }
  });
}

/**
 * 자식 노드 배열을 비교한다.
 *
 * key가 없으면 인덱스 기준 비교를 하고,
 * key가 있으면 key 기반으로 재사용/이동/삭제를 판단한다.
 */
function patchChildren(parentDom, oldChildren, newChildren) {
  const keyed = newChildren.some((child) => child?.props?.key !== undefined) ||
    oldChildren.some((child) => child?.props?.key !== undefined);

  if (!keyed) {
    const length = Math.max(oldChildren.length, newChildren.length);

    for (let index = 0; index < length; index += 1) {
      patch(parentDom, oldChildren[index], newChildren[index]);
    }
    return;
  }

  const oldKeyed = new Map();
  const oldUnkeyed = [];
  const reused = new Set();

  oldChildren.forEach((child) => {
    const key = child?.props?.key;
    if (key !== undefined) {
      oldKeyed.set(key, child);
    } else {
      oldUnkeyed.push(child);
    }
  });

  let unkeyedIndex = 0;

  newChildren.forEach((child, index) => {
    const key = child?.props?.key;
    const matchedOldChild = key !== undefined ? oldKeyed.get(key) : oldUnkeyed[unkeyedIndex++];

    if (matchedOldChild) {
      reused.add(matchedOldChild);
    }

    patch(parentDom, matchedOldChild || null, child);

    const childDom = getDomNode(child);
    const referenceNode = parentDom.childNodes[index] || null;
    if (childDom && childDom !== referenceNode) {
      parentDom.insertBefore(childDom, referenceNode);
    }
  });

  oldChildren.forEach((child) => {
    if (!reused.has(child)) {
      removeDomNode(parentDom, child);
    }
  });
}

/**
 * 함수형 컴포넌트 VNode끼리 비교할 때 사용하는 분기다.
 *
 * 함수형 컴포넌트는 최종적으로 DOM이 아니라 또 다른 VNode를 반환하므로,
 * 그 자식 VNode끼리 다시 patch를 수행한다.
 */
function patchComponent(parentDom, oldVNode, newVNode) {
  const previousRendered = oldVNode._rendered;
  const nextRendered = newVNode.type(newVNode.props || {});
  newVNode._rendered = nextRendered;

  patch(parentDom, previousRendered, nextRendered);
  newVNode._dom = getDomNode(nextRendered);
}

/**
 * 이 파일에서 가장 중요한 diff/patch 함수다.
 *
 * 실행 순서 10:
 * 새 VNode와 이전 VNode를 비교해서 실제 DOM에서 바뀐 부분만 업데이트한다.
 */
function patch(parentDom, oldVNode, newVNode) {
  // 둘 다 없으면 할 일이 없다.
  if (!oldVNode && !newVNode) {
    return;
  }

  // 새 노드가 없으면 삭제다.
  if (!newVNode) {
    removeDomNode(parentDom, oldVNode);
    return;
  }

  // 이전 노드가 없으면 새로 추가다.
  if (!oldVNode) {
    const dom = createDomNode(newVNode);
    parentDom.appendChild(dom);
    return;
  }

  // 타입이 다르면 같은 노드로 볼 수 없으므로 통째로 교체한다.
  if (oldVNode.type !== newVNode.type) {
    const nextDom = createDomNode(newVNode);
    parentDom.replaceChild(nextDom, getDomNode(oldVNode));
    return;
  }

  // 함수형 컴포넌트면 내부에서 렌더한 자식 VNode를 기준으로 비교한다.
  if (typeof newVNode.type === "function") {
    patchComponent(parentDom, oldVNode, newVNode);
    return;
  }

  // 텍스트 노드는 textContent만 비교하면 된다.
  if (newVNode.type === TEXT_ELEMENT) {
    const dom = oldVNode._dom;
    if (oldVNode.props.nodeValue !== newVNode.props.nodeValue) {
      dom.nodeValue = newVNode.props.nodeValue;
    }
    newVNode._dom = dom;
    return;
  }

  // 여기까지 왔다는 것은 "같은 타입의 DOM 노드"라는 뜻이다.
  const dom = oldVNode._dom;
  newVNode._dom = dom;
  updateProps(dom, oldVNode.props, newVNode.props);
  patchChildren(dom, oldVNode.props.children, newVNode.props.children);
}

/**
 * dependency 배열이 바뀌었는지 비교한다.
 *
 * useEffect / useMemo가 "다시 실행돼야 하는지" 결정할 때 사용한다.
 */
function depsChanged(previousDeps, nextDeps) {
  if (nextDeps === undefined || previousDeps === undefined) {
    return true;
  }

  if (previousDeps.length !== nextDeps.length) {
    return true;
  }

  return nextDeps.some((dep, index) => !Object.is(dep, previousDeps[index]));
}

/**
 * 렌더가 끝난 뒤 effect hook을 실행한다.
 *
 * 실행 순서 11:
 * patch로 DOM 반영이 끝난 뒤 cleanup -> effect 순서로 실행한다.
 */
function commitEffects(instance) {
  instance.hooks.forEach((hook) => {
    if (hook?.type !== "effect" || !hook.shouldRun) {
      return;
    }

    if (typeof hook.cleanup === "function") {
      hook.cleanup();
    }

    const cleanup = hook.effect();
    hook.cleanup = typeof cleanup === "function" ? cleanup : null;
    hook.shouldRun = false;
  });
}

/**
 * state 변경 후 "실제 update를 언제 돌릴지" 예약하는 함수다.
 *
 * 실행 순서 7:
 * setState가 여러 번 불려도 같은 마이크로태스크 안에서는 한 번만 update를 예약한다.
 */
function scheduleUpdate(instance) {
  if (instance.scheduled) {
    return;
  }

  instance.scheduled = true;

  queueMicrotask(() => {
    instance.scheduled = false;
    instance.update();
  });
}

/**
 * 함수형 컴포넌트 하나를 관리하는 가장 작은 실행 단위다.
 *
 * 이 객체가 들고 있는 것:
 * - component: 실제 함수형 컴포넌트 함수
 * - props: 현재 props
 * - hooks: 현재 컴포넌트의 state/effect/memo 저장소
 * - currentVNode: 직전 렌더 결과
 */
export class FunctionComponent {
  constructor(component, props, container) {
    this.component = component;
    this.props = props;
    this.container = container;
    this.hooks = [];
    this.currentVNode = null;
    this.scheduled = false;
  }

  /**
   * 실행 순서 3 / 9:
   * 현재 컴포넌트 함수를 실행해서 "새 VNode 트리"를 얻는다.
   */
  renderVNode() {
    currentInstance = this;
    hookIndex = 0;

    const nextVNode = this.component(this.props);

    currentInstance = null;
    return nextVNode;
  }

  /**
   * 실행 순서 2 ~ 5:
   * 최초 마운트 시 VNode를 만든 뒤 실제 DOM을 생성해 container에 붙인다.
   */
  mount() {
    this.currentVNode = this.renderVNode();
    this.container.innerHTML = "";
    this.container.appendChild(createDomNode(this.currentVNode));
    commitEffects(this);
  }

  /**
   * 실행 순서 8 ~ 11:
   * state 변경 후 새 VNode를 만들고, 이전 VNode와 비교한 뒤 변경된 DOM만 반영한다.
   */
  update(nextProps = this.props) {
    this.props = nextProps;
    const nextVNode = this.renderVNode();
    patch(this.container, this.currentVNode, nextVNode);
    this.currentVNode = nextVNode;
    commitEffects(this);
  }
}

/**
 * 앱의 루트 컴포넌트를 마운트한다.
 *
 * 실행 순서 1 ~ 2:
 * main.js가 호출하는 시작점이다.
 */
export function mountRoot(component, container, props = {}) {
  const instance = new FunctionComponent(component, props, container);
  instance.mount();
  return instance;
}

/**
 * state hook 구현이다.
 *
 * 실행 순서 6:
 * 컴포넌트가 다시 렌더될 때 queue에 쌓여 있던 update를 먼저 처리하고,
 * 그 다음 최신 state와 setState 함수를 반환한다.
 */
export function useState(initialState) {
  if (!currentInstance) {
    throw new Error("useState must be called during component render.");
  }

  const hook = currentInstance.hooks[hookIndex] ?? {
    type: "state",
    state: typeof initialState === "function" ? initialState() : initialState,
    queue: [],
  };

  // 실행 순서 6-1:
  // 이전 setState 호출들이 남긴 queue를 여기서 한 번에 처리한다.
  if (hook.queue.length) {
    hook.queue.forEach((update) => {
      const nextState = typeof update === "function" ? update(hook.state) : update;
      hook.state = nextState;
    });
    hook.queue = [];
  }

  const instance = currentInstance;
  const localHook = hook;

  // 실행 순서 6-2:
  // setState는 state를 즉시 바꾸지 않고 queue에 넣은 뒤 update를 예약한다.
  const setState = (update) => {
    localHook.queue.push(update);
    scheduleUpdate(instance);
  };

  currentInstance.hooks[hookIndex] = hook;
  hookIndex += 1;

  return [hook.state, setState];
}

/**
 * effect hook 구현이다.
 *
 * 렌더 중에는 effect를 "지금 바로 실행"하지 않고,
 * 실행 예약 정보만 hook에 저장해 둔다.
 */
export function useEffect(effect, deps) {
  if (!currentInstance) {
    throw new Error("useEffect must be called during component render.");
  }

  const hook = currentInstance.hooks[hookIndex] ?? {
    type: "effect",
    deps: undefined,
    cleanup: null,
    effect,
    shouldRun: true,
  };

  hook.shouldRun = depsChanged(hook.deps, deps);
  hook.deps = deps;
  hook.effect = effect;

  currentInstance.hooks[hookIndex] = hook;
  hookIndex += 1;
}

/**
 * memo hook 구현이다.
 *
 * deps가 바뀌지 않았다면 이전 계산 결과를 재사용한다.
 */
export function useMemo(factory, deps) {
  if (!currentInstance) {
    throw new Error("useMemo must be called during component render.");
  }

  const hook = currentInstance.hooks[hookIndex] ?? {
    type: "memo",
    deps: undefined,
    value: undefined,
  };

  if (depsChanged(hook.deps, deps)) {
    hook.value = factory();
    hook.deps = deps;
  }

  currentInstance.hooks[hookIndex] = hook;
  hookIndex += 1;

  return hook.value;
}
