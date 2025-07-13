import { events } from './event.js';

/* -----------------------------------------------------------------
 * VNode factory
 * ----------------------------------------------------------------- */
export const createVNode = (tag, attrs = {}, children = []) => ({
  tag,
  attrs,
  children: Array.isArray(children)
    ? children.filter(Boolean)
    : [children].filter(Boolean)
});

/* -----------------------------------------------------------------
 * Module-level state
 * ----------------------------------------------------------------- */
let currentVNode = null;
let rootElement = null;

/* -----------------------------------------------------------------
* render()
* ----------------------------------------------------------------- */
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

/* -----------------------------------------------------------------
 * createDOM() – initial mount
 * ----------------------------------------------------------------- */
const createDOM = (vnode) => {
  if (typeof vnode === 'string' || typeof vnode === 'number')
    return document.createTextNode(vnode);

  const el = document.createElement(vnode.tag);

  for (const [key, val] of Object.entries(vnode.attrs || {})) {
    if (key === 'key') continue;

    if (key === 'ref' && typeof val === 'function') {
      val(el)
      continue;
    }

    if (key.startsWith('on') && typeof val === 'function') {
      el[key] = val;
    } else if (key === 'value' ||
      key === 'checked' ||
      key === 'disabled') {
      el[key] = val;
    } else if (val != null) {
      el.setAttribute(key, val);
    }
  }

  (vnode.children || []).forEach(c => c && el.appendChild(createDOM(c)));
  return el;
};

/* -----------------------------------------------------------------
 * diff() – produce patch object
 * ----------------------------------------------------------------- */
const diff = (o, n) => {
  if (!n) return { type: 'REMOVE' };

  if (typeof o !== typeof n)
    return { type: 'REPLACE', node: n };

  if (typeof o === 'string' || typeof n === 'string')
    return o !== n ? { type: 'TEXT', value: n } : null;

  if (o.tag !== n.tag)
    return { type: 'REPLACE', node: n };

  if ((o.attrs?.key) !== (n.attrs?.key))
    return { type: 'REPLACE', node: n };

  const attrP = diffAttrs(o.attrs, n.attrs);
  const kidP = diffChildren(o.children || [], n.children || []);

  return (attrP || kidP) ? { type: 'UPDATE', attrs: attrP, children: kidP }
    : null;
};

/* ----------------------------------------------------------------- */
const diffAttrs = (oldA = {}, newA = {}) => {
  const out = {};
  let changed = false;

  for (const [k, v] of Object.entries(newA))
    if (k !== 'key' && oldA[k] !== v) { out[k] = v; changed = true; }

  for (const k in oldA)
    if (k !== 'key' && !(k in newA)) { out[k] = undefined; changed = true; }

  return changed ? out : null;
};

/* ----------------------------------------------------------------- */
const diffChildren = (oC = [], nC = []) => {
  const patches = [];
  let iO = 0, iN = 0;

  while (iO < oC.length || iN < nC.length) {
    const o = oC[iO];
    const n = nC[iN];

    if (!n) { patches[iO] = { type: 'REMOVE' }; iO++; continue; }
    if (!o) { patches[iO] = { type: 'REPLACE', node: n }; iO++; iN++; continue; }

    const kO = o.attrs?.key;
    const kN = n.attrs?.key;

    if (kO === kN) {
      patches[iO] = diff(o, n);
      iO++; iN++; continue;
    }
    if (kO && !nC.some(c => c.attrs?.key === kO)) {
      patches[iO] = { type: 'REMOVE' };
      iO++; continue;
    }
    patches[iO] = { type: 'REPLACE', node: n };
    iO++; iN++;
  }

  return patches.some(p => p) ? patches : null;
};

/* -----------------------------------------------------------------
 * applyPatches()
 * ----------------------------------------------------------------- */
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
      /* ---- attributes (incl. ref) ---- */
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
