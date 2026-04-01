const TEXT_ELEMENT = "TEXT_ELEMENT";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

let currentInstance = null;
let hookIndex = 0;

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

function createTextElement(value) {
  return {
    type: TEXT_ELEMENT,
    props: {
      nodeValue: String(value),
      children: [],
    },
  };
}

export function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...(props || {}),
      children: flattenChildren(children),
    },
  };
}

function isSvgType(type) {
  return ["svg", "path", "polyline", "polygon", "line", "circle", "rect", "defs", "linearGradient", "stop"].includes(type);
}

function createDomNode(vnode, namespace = null) {
  if (typeof vnode.type === "function") {
    const rendered = vnode.type(vnode.props || {});
    vnode._rendered = rendered;
    const dom = createDomNode(rendered, namespace);
    vnode._dom = dom;
    return dom;
  }

  if (vnode.type === TEXT_ELEMENT) {
    const dom = document.createTextNode(vnode.props.nodeValue);
    vnode._dom = dom;
    return dom;
  }

  const nextNamespace = namespace === SVG_NAMESPACE || isSvgType(vnode.type) ? SVG_NAMESPACE : null;
  const dom = nextNamespace
    ? document.createElementNS(SVG_NAMESPACE, vnode.type)
    : document.createElement(vnode.type);

  updateProps(dom, {}, vnode.props);

  vnode.props.children.forEach((child) => {
    const childDom = createDomNode(child, nextNamespace);
    dom.appendChild(childDom);
  });

  vnode._dom = dom;
  return dom;
}

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

function isEventProp(name) {
  return /^on[A-Z]/.test(name);
}

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

function patchComponent(parentDom, oldVNode, newVNode) {
  const previousRendered = oldVNode._rendered;
  const nextRendered = newVNode.type(newVNode.props || {});
  newVNode._rendered = nextRendered;

  patch(parentDom, previousRendered, nextRendered);
  newVNode._dom = getDomNode(nextRendered);
}

function patch(parentDom, oldVNode, newVNode) {
  if (!oldVNode && !newVNode) {
    return;
  }

  if (!newVNode) {
    removeDomNode(parentDom, oldVNode);
    return;
  }

  if (!oldVNode) {
    const dom = createDomNode(newVNode);
    parentDom.appendChild(dom);
    return;
  }

  if (oldVNode.type !== newVNode.type) {
    const nextDom = createDomNode(newVNode);
    parentDom.replaceChild(nextDom, getDomNode(oldVNode));
    return;
  }

  if (typeof newVNode.type === "function") {
    patchComponent(parentDom, oldVNode, newVNode);
    return;
  }

  if (newVNode.type === TEXT_ELEMENT) {
    const dom = oldVNode._dom;
    if (oldVNode.props.nodeValue !== newVNode.props.nodeValue) {
      dom.nodeValue = newVNode.props.nodeValue;
    }
    newVNode._dom = dom;
    return;
  }

  const dom = oldVNode._dom;
  newVNode._dom = dom;
  updateProps(dom, oldVNode.props, newVNode.props);
  patchChildren(dom, oldVNode.props.children, newVNode.props.children);
}

function depsChanged(previousDeps, nextDeps) {
  if (nextDeps === undefined || previousDeps === undefined) {
    return true;
  }

  if (previousDeps.length !== nextDeps.length) {
    return true;
  }

  return nextDeps.some((dep, index) => !Object.is(dep, previousDeps[index]));
}

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

export class FunctionComponent {
  constructor(component, props, container) {
    this.component = component;
    this.props = props;
    this.container = container;
    this.hooks = [];
    this.currentVNode = null;
    this.scheduled = false;
  }

  renderVNode() {
    currentInstance = this;
    hookIndex = 0;

    const nextVNode = this.component(this.props);

    currentInstance = null;
    return nextVNode;
  }

  mount() {
    this.currentVNode = this.renderVNode();
    this.container.innerHTML = "";
    this.container.appendChild(createDomNode(this.currentVNode));
    commitEffects(this);
  }

  update(nextProps = this.props) {
    this.props = nextProps;
    const nextVNode = this.renderVNode();
    patch(this.container, this.currentVNode, nextVNode);
    this.currentVNode = nextVNode;
    commitEffects(this);
  }
}

export function mountRoot(component, container, props = {}) {
  const instance = new FunctionComponent(component, props, container);
  instance.mount();
  return instance;
}

export function useState(initialState) {
  if (!currentInstance) {
    throw new Error("useState must be called during component render.");
  }

  const hook = currentInstance.hooks[hookIndex] ?? {
    type: "state",
    state: typeof initialState === "function" ? initialState() : initialState,
    queue: [],
  };

  if (hook.queue.length) {
    hook.queue.forEach((update) => {
      const nextState = typeof update === "function" ? update(hook.state) : update;
      hook.state = nextState;
    });
    hook.queue = [];
  }

  const instance = currentInstance;
  const localHook = hook;
  const setState = (update) => {
    localHook.queue.push(update);
    scheduleUpdate(instance);
  };

  currentInstance.hooks[hookIndex] = hook;
  hookIndex += 1;

  return [hook.state, setState];
}

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
