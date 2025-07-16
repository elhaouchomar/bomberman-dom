import { events } from './event.js';

// vnode factory
export const createVNode = (tag, attrs = {}, children = []) => ({
  tag,
  attrs,
  children: Array.isArray(children)
    ? children.filter(Boolean)
    : [children].filter(Boolean)
});

// module-level state
let currentVNode = null;
let rootElement = null;

// either the initial render or an update
export const render = (vnode, container = document.body) => {
  if (!container || !(container instanceof HTMLElement))
    throw new Error('Invalid container element');

  if (!currentVNode) {
    container.innerHTML = '';
    container.appendChild(createDOM(vnode));
    rootElement = container;
  } else {
    const patches = diff(currentVNode, vnode);
    applyPatches(rootElement.firstChild, patches);
  }
  currentVNode = vnode;
};

// initial render, return the dom structure
const createDOM = (vnode) => {
  if (typeof vnode === 'string' || typeof vnode === 'number')
    return document.createTextNode(vnode);

  const el = document.createElement(vnode.tag);

  for (const [key, val] of Object.entries(vnode.attrs || {})) {
    if (key === 'key') continue;
    if (key === 'ref' && typeof val === 'function') {
      val(el)
    } else if (key.startsWith('on') && typeof val === 'function') {
      el[key] = val;
    } else if (key === 'value' || key === 'checked' || key === 'disabled') {
      el[key] = val;
    } else if (val != null) {
      el.setAttribute(key, val);
    }
  }
  //- Recursively Process children
  (vnode.children || []).forEach(c => c && el.appendChild(createDOM(c)));
  return el;
};

// return patch object in the form {type: 'UPDATE', attrs: { ... }, children: [ ... ] }
const diff = (o, n) => {
  if (!n) return { type: 'REMOVE' }; //- if new VNode is null, we need to remove the old VNode

  if (typeof o !== typeof n)
    return { type: 'REPLACE', node: n };

  if (typeof o === 'string' || typeof n === 'string')
    return o !== n ? { type: 'TEXT', value: n } : null;

  if (o.tag !== n.tag)
    return { type: 'REPLACE', node: n };

  if ((o.attrs?.key) !== (n.attrs?.key)) //- if key attributes differ, we replace the entire node
    return { type: 'REPLACE', node: n };

  const attrP = diffAttrs(o.attrs, n.attrs);
  const kidP = diffChildren(o.children || [], n.children || []);

  return (attrP || kidP) ? { type: 'UPDATE', attrs: attrP, children: kidP }
    : null;
};

// compares the attributes of two virtual nodes and returns a patche object with changes
const diffAttrs = (oldA = {}, newA = {}) => {
  const out = {};
  let changed = false;

  for (const [k, v] of Object.entries(newA))
    if (k !== 'key' && oldA[k] !== v) { out[k] = v; changed = true; } //- skip 'key' attribute

  for (const k in oldA)
    if (k !== 'key' && !(k in newA)) { out[k] = undefined; changed = true; }

  return changed ? out : null;
};

// compares two arrays of virtual nodes (children) and returns an array of patches
const diffChildren = (oldChildren = [], newChildren = []) => {
  const patches = []; //- this will store the patches for each child node, patches[i] corresponds to the i-th child in oldChildren
  let iO = 0, iN = 0;

  while (iO < oldChildren.length || iN < newChildren.length) {
    const oldChild = oldChildren[iO];;
    const newChild = newChildren[iN];

    if (!newChild) { patches[iO] = { type: 'REMOVE' }; iO++; continue; }
    if (!oldChild) { patches[iO] = { type: 'REPLACE', node: newChild }; iO++; iN++; continue; }

    const oldKey = oldChild.attrs?.key;
    const newKey = newChild.attrs?.key;

    if (oldKey === newKey) {
      patches[iO] = diff(oldChild, newChild); //- we recursively diff the old and new child nodes
      iO++; iN++; continue;
    }
    if (oldKey && !newChildren.some(c => c.attrs?.key === oldKey)) {
      patches[iO] = { type: 'REMOVE' };
      iO++; continue;
    }
    patches[iO] = { type: 'REPLACE', node: newChild };
    iO++; iN++;
  }

  return patches.some(p => p) ? patches : null;
};

// apply the patches to the DOM
const applyPatches = (dom, patch) => {
  if (!patch || !dom) return;

  switch (patch.type) {
    case 'REPLACE': {
      const n = createDOM(patch.node);
      dom.parentNode.replaceChild(n, dom);
      events.cleanupElement(dom);
      break;
    }
    case 'REMOVE':
      if (dom.parentNode) {
        events.cleanupElement(dom);
        dom.parentNode.removeChild(dom);
      }
      break;
    case 'TEXT':      
      if (dom.textContent !== patch.value) dom.textContent = patch.value;
      break;

    case 'UPDATE': {
      if (patch.attrs) {
        for (const [k, v] of Object.entries(patch.attrs)) {
          if (k === 'ref' && typeof v === 'function') {            
            v(dom)
          } else if (k === 'value') {
            if (dom.value !== v) dom.value = v;
          } else if (k === 'checked') {
            dom.checked = v;
          } else if (k.startsWith('on') && typeof v === 'function') {
            dom[k] = v;
          } else {
            v == null ? dom.removeAttribute(k) : dom.setAttribute(k, v);
          }
        }
      }

      /* ---- children ---- */
      if (patch.children) {
        const kids = Array.from(dom.childNodes);
        patch.children.forEach((cp, i) => {
          if (!cp) return;
          if (cp.type === 'REMOVE') {
            if (i < kids.length) {
              events.cleanupElement(kids[i]);
              dom.removeChild(kids[i]);
            }
            return;
          }
          if (cp.type === 'REPLACE') {
            const n = createDOM(cp.node);
            if (i < kids.length) {
              events.cleanupElement(kids[i]);
              dom.replaceChild(n, kids[i]);
            } else dom.appendChild(n);
            return;
          }
          if (i < kids.length) {
            applyPatches(kids[i], cp);
          } else {
            dom.appendChild(createDOM(cp.node));
          }
        });

        while (dom.childNodes.length > patch.children.length) {
          const extra = dom.lastChild;
          events.cleanupElement(extra);
          dom.removeChild(extra);
        }
      }
      break;
    }
  }
};

export { events };
