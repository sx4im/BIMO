var h = Object.defineProperty;
var c = (t, s, e) => s in t ? h(t, s, { enumerable: !0, configurable: !0, writable: !0, value: e }) : t[s] = e;
var a = (t, s, e) => c(t, typeof s != "symbol" ? s + "" : s, e);
import { O as d } from "./orb-controller.js";
class u extends HTMLElement {
  constructor() {
    super();
    a(this, "canvas");
    a(this, "controller", null);
    this.canvas = document.createElement("canvas");
  }
  static get observedAttributes() {
    return ["state", "size", "theme", "speed", "paused", "aria-label"];
  }
  connectedCallback() {
    this.style.display || (this.style.display = "inline-flex", this.style.alignItems = "center", this.style.justifyContent = "center"), this.contains(this.canvas) || this.appendChild(this.canvas);
    const e = this.getOptionsFromAttributes();
    this.controller = new d(this.canvas, e), this.syncCanvasSize();
  }
  disconnectedCallback() {
    this.controller && (this.controller.destroy(), this.controller = null);
  }
  attributeChangedCallback(e, i, r) {
    if (i === r || !this.controller) return;
    const n = this.getOptionsFromAttributes();
    this.controller.updateOptions(n), this.syncCanvasSize();
  }
  syncCanvasSize() {
    this.style.width && (this.canvas.style.width = this.style.width), this.style.height && (this.canvas.style.height = this.style.height);
  }
  getOptionsFromAttributes() {
    const e = this.getAttribute("state"), i = this.getAttribute("size"), r = this.getAttribute("theme"), n = this.getAttribute("speed"), o = this.hasAttribute("paused"), l = this.getAttribute("aria-label");
    return {
      state: e || void 0,
      size: i ? parseInt(i, 10) : void 0,
      theme: r || void 0,
      speed: n ? parseFloat(n) : void 0,
      paused: o,
      ariaLabel: l || void 0
    };
  }
}
function p(t = "thinking-orb") {
  typeof customElements < "u" && !customElements.get(t) && customElements.define(t, u);
}
typeof customElements < "u" && p();
export {
  u as T,
  p as r
};
