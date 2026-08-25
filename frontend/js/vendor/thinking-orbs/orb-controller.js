var it = Object.defineProperty;
var rt = (o, t, s) => t in o ? it(o, t, { enumerable: !0, configurable: !0, writable: !0, value: s }) : o[t] = s;
var D = (o, t, s) => rt(o, typeof t != "symbol" ? t + "" : t, s);
function V(o, t) {
  const s = Math.sin(o * 12.9898 + t * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function at(o, t) {
  const s = Math.PI * (3 - Math.sqrt(5)), a = 1 - 2 * (o + 0.5) / t, e = Math.sqrt(1 - a * a), n = o * s;
  return [e * Math.cos(n), a, e * Math.sin(n)];
}
function ct(o, t) {
  return Math.atan2(Math.sin(o - t), Math.cos(o - t));
}
function _(o, t, s, a, e) {
  const n = Math.sin(t), r = Math.cos(t), i = Math.sin(o), c = Math.cos(o);
  return (l, h, d) => {
    const u = l * c + d * i, p = -l * i + d * c, x = h * r - p * n, g = h * n + p * r;
    return [s + u * e, a - x * e, g];
  };
}
function q(o, t, s, a = 0.3) {
  t.sort((e, n) => e.z - n.z);
  for (const e of t) {
    const n = e.a ?? 1;
    if (n < 0.02) continue;
    const r = Math.min(1, Math.max(0, e.white)), i = Math.round((s ? 1 - r : r) * 255);
    o.fillStyle = `rgba(${i},${i},${i},${n})`, o.beginPath(), o.arc(e.x, e.y, Math.max(a, e.r), 0, Math.PI * 2), o.fill();
  }
}
function $(o, t) {
  return (o / 300) ** t;
}
function ht(o, t, s, a) {
  const e = 2 * t * s + a, n = o % e, r = new Array(t).fill(0);
  let i = -1;
  if (n < 2 * t * s) {
    const c = Math.floor(n / s), l = (n - c * s) / s, d = 1 - (1 - Math.min(1, l / 0.7)) ** 3;
    if (c < t) {
      for (let u = 0; u < c; u++) r[u] = 1;
      r[c] = d, i = c;
    } else {
      const u = 2 * t - 1 - c;
      for (let p = 0; p < u; p++) r[p] = 1;
      r[u] = 1 - d, i = u;
    }
  }
  return { amount: r, active: i };
}
function dt(o, t, s) {
  let [a, e, n] = o, r = !1;
  for (let i = 0; i < t.length; i++) {
    if (s.amount[i] <= 0) continue;
    const c = t[i], l = c.axis === 0 ? a : c.axis === 1 ? e : n;
    if (l < c.lo || l >= c.hi) continue;
    i === s.active && (r = !0);
    const h = c.ang * s.amount[i], d = Math.cos(h), u = Math.sin(h);
    if (c.axis === 0) {
      const p = e * d - n * u;
      n = e * u + n * d, e = p;
    } else if (c.axis === 1) {
      const p = a * d + n * u;
      n = -a * u + n * d, a = p;
    } else {
      const p = a * d - e * u;
      e = a * u + e * d, a = p;
    }
  }
  return [a, e, n, r];
}
function lt(o) {
  const t = [];
  for (let s = 0; s < o; s++) {
    const a = Math.min(2, Math.floor(V(s, 2.3) * 3)), e = -1 + 0.5 * Math.min(3, Math.floor(V(s, 5.9) * 4)), n = V(s, 7.7) < 0.5 ? 1 : -1;
    t.push({ axis: a, lo: e, hi: e + 0.5, ang: n * Math.PI / 2 });
  }
  return t;
}
const ut = (o, t, s, a, e) => {
  const r = t / 2, i = t / 2, c = t / 2 * 0.82, l = 0.4 + 0.06 * Math.sin(s * 0.35), h = _(s * 0.5, l, r, i, c), d = s * (0.5 + (1.7 - 0.5) * (e.scanMul ?? 1)), u = $(t, e.rsPow ?? 0.6), p = e.dimBase ?? 1, x = [], g = e.latRings ?? 17, O = e.lonDensity ?? 44;
  for (let y = 0; y <= g; y++) {
    const M = -Math.PI / 2 + y / g * Math.PI, P = Math.cos(M), S = Math.sin(M), k = Math.max(1, Math.round(Math.abs(P) * O));
    for (let C = 0; C < k; C++) {
      const z = C / k * 2 * Math.PI, [v, R, f] = h(P * Math.cos(z), S, P * Math.sin(z)), m = (f + 1) / 2, b = ct(z + s * 0.5, d), w = Math.exp(-(b * b) / 0.18) * Math.max(0, f);
      x.push({
        x: v,
        y: R,
        z: f,
        r: ((e.rBase ?? 0.6) + (e.rDepth ?? 1.7) * m + (e.rBoost ?? 1) * w) * u,
        white: (e.inkFar ?? 0.62) - (e.inkSpan ?? 0.54) * m,
        // dimBase < 1 fades un-scanned dots so the meridian reads clearly
        a: p + (1 - p) * Math.min(1, w)
      });
    }
  }
  q(o, x, a, e.rMin);
}, pt = (o, t, s, a, e) => {
  const n = t / 2, r = t / 2, i = t / 2 * 0.82, c = _(s * 0.55, 0.35 + 0.1 * Math.sin(s * 0.9), n, r, i), l = $(t, e.rsPow ?? 0.6), h = e.moveCount ?? 14, d = lt(h), u = ht(s, h, 0.42, 1.2), p = [], x = e.latRings ?? 15, g = e.lonDensity ?? 40;
  for (let O = 0; O <= x; O++) {
    const y = -Math.PI / 2 + O / x * Math.PI, M = Math.cos(y), P = Math.sin(y), S = Math.max(1, Math.round(Math.abs(M) * g));
    for (let k = 0; k < S; k++) {
      const C = k / S * 2 * Math.PI, [z, v, R, f] = dt([M * Math.cos(C), P, M * Math.sin(C)], d, u), [m, b, w] = c(z, v, R), A = (w + 1) / 2;
      p.push({
        x: m,
        y: b,
        z: w,
        r: ((e.rBase ?? 0.6) + (e.rDepth ?? 1.7) * A + (f ? e.rActive ?? 0.3 : 0)) * l,
        white: (e.inkFar ?? 0.62) - (e.inkSpan ?? 0.54) * A - (f ? 0.14 : 0)
      });
    }
  }
  q(o, p, a, e.rMin);
}, ft = (o, t, s, a, e) => {
  const n = t / 2, r = t / 2, i = t / 2 * 0.874, c = _(s * 0.18, 0.38, n, r, 1), l = $(t, e.rsPow ?? 0.6), h = [], d = e.rings ?? 15, u = e.lonDensity ?? 40;
  for (let p = 0; p <= d; p++) {
    const x = -Math.PI / 2 + p / d * Math.PI, g = Math.cos(x), O = Math.sin(x), y = 0.62 * Math.sin(s * 2.1 - p * 0.52) + 0.38 * Math.sin(s * 1.27 + p * 0.83), M = i * (0.88 + 0.105 * y), P = Math.max(1, Math.round(Math.abs(g) * u));
    for (let S = 0; S < P; S++) {
      const k = S / P * 2 * Math.PI, [C, z, v] = c(g * Math.cos(k) * M, O * M, g * Math.sin(k) * M), R = (v / i + 1) / 2, f = Math.max(0, y);
      h.push({
        x: C,
        y: z,
        z: v,
        r: ((e.rBase ?? 0.6) + (e.rDepth ?? 1.7) * R) * (1 + 0.4 * f) * l,
        white: 0.66 - 0.56 * R - 0.1 * f
      });
    }
  }
  q(o, h, a, e.rMin);
};
function Mt(o) {
  return o * o * (3 - 2 * o);
}
function st(o) {
  const t = o.length, s = [];
  let a = 0;
  for (let e = 0; e < t; e++) {
    const n = o[e], r = o[(e + 1) % t], i = Math.hypot(r[0] - n[0], r[1] - n[1]);
    s.push(i), a += i;
  }
  return (e) => {
    let n = e * a, r = 0;
    for (; n > s[r] && r < t - 1; )
      n -= s[r], r++;
    const i = o[r], c = o[(r + 1) % t], l = s[r] ? Math.min(1, n / s[r]) : 0;
    return [i[0] + (c[0] - i[0]) * l, i[1] + (c[1] - i[1]) * l];
  };
}
const Y = (o) => {
  const t = -Math.PI / 2 + o * 2 * Math.PI;
  return [Math.cos(t) * 0.24, Math.sin(t) * 0.24];
}, mt = st([
  [0, -0.26],
  [0.24, 0.16],
  [-0.24, 0.16]
]), bt = st([
  [0, -0.2],
  [0.2, -0.2],
  [0.2, 0.2],
  [-0.2, 0.2],
  [-0.2, -0.2]
]), Q = [Y, mt, bt];
function gt(o) {
  return Math.max(6, Math.round(34 * o));
}
const j = 1.4, et = 0.9, K = j + et, vt = (o, t, s, a, e) => {
  const n = Q.length, i = (Number.isFinite(s) ? Math.max(0, s) : 0) % (K * n), c = Math.floor(i / K), l = Number.isFinite(c) ? Math.min(n - 1, Math.max(0, c)) : 0, h = i - l * K, d = h > j ? Mt((h - j) / et) : 0, u = e.spread ?? 1, p = Q[l] || Y, x = Q[(l + 1) % n] || Y, g = 160, O = [];
  for (let f = 0; f < g; f++) {
    const m = f / g, b = p(m), w = x(m);
    O.push([(b[0] + (w[0] - b[0]) * d) * u, (b[1] + (w[1] - b[1]) * d) * u]);
  }
  const y = [];
  let M = 0;
  for (let f = 0; f < g; f++) {
    const m = O[f], b = O[(f + 1) % g], w = Math.hypot(b[0] - m[0], b[1] - m[1]);
    y.push(w), M += w;
  }
  const P = gt(e.iconD ?? 1), S = (e.rDot ?? 0.021) * 1.35 * u, k = 1 + 0.02 * Math.sin(h * 3.1), C = [], z = t / 2;
  let v = 0, R = 0;
  for (let f = 0; f < P; f++) {
    const m = f / P * M;
    for (; R + y[v] < m && v < g - 1; )
      R += y[v], v++;
    const b = O[v], w = O[(v + 1) % g], A = y[v] ? Math.min(1, (m - R) / y[v]) : 0, L = (b[0] + (w[0] - b[0]) * A) * k, N = (b[1] + (w[1] - b[1]) * A) * k;
    C.push({
      x: z + L * t,
      y: z + N * t,
      z: 0,
      r: Math.max(0.35, S * t),
      white: 0.1
    });
  }
  q(o, C, a, e.rMin);
}, yt = (o, t, s, a, e) => {
  const n = t / 2, r = t / 2, i = t / 2 * 0.82, c = _(s * 0.12, 0.3, n, r, 1), l = $(t, e.rsPow ?? 0.6), h = [], d = e.orbitN ?? 12, u = e.ghostN ?? 40, p = e.particles ?? 3;
  for (let x = 0; x < d; x++) {
    const g = V(x, 1.7), O = V(x, 5.2), y = V(x, 8.9), M = i * (0.45 + 0.52 * g), P = g * 2 * Math.PI, S = Math.acos(2 * O - 1), k = Math.sin(S) * Math.cos(P), C = Math.cos(S), z = Math.sin(S) * Math.sin(P);
    let v = -C, R = k;
    const f = 0, m = Math.max(1e-6, Math.sqrt(v * v + R * R));
    v /= m, R /= m;
    const b = C * f - z * R, w = z * v - k * f, A = k * R - C * v, L = (0.25 + 0.55 * y) * (y > 0.5 ? 1 : -1);
    for (let N = 0; N < u; N++) {
      const I = N / u * 2 * Math.PI, [T, B, E] = c(
        (v * Math.cos(I) + b * Math.sin(I)) * M,
        (R * Math.cos(I) + w * Math.sin(I)) * M,
        (f * Math.cos(I) + A * Math.sin(I)) * M
      ), F = (E / M + 1) / 2;
      h.push({
        x: T,
        y: B,
        z: E,
        r: (e.ghostR ?? 0.9) * l,
        white: 0.72,
        a: (e.ghostA ?? 0.5) * (0.4 + 0.6 * F)
      });
    }
    for (let N = 0; N < p; N++) {
      const I = s * L + N / p * 2 * Math.PI + O * 6, [T, B, E] = c(
        (v * Math.cos(I) + b * Math.sin(I)) * M,
        (R * Math.cos(I) + w * Math.sin(I)) * M,
        (f * Math.cos(I) + A * Math.sin(I)) * M
      ), F = (E / M + 1) / 2;
      h.push({
        x: T,
        y: B,
        z: E,
        r: ((e.partR ?? 1.2) + (e.partRDepth ?? 1.6) * F) * l,
        white: 0.3 - 0.22 * F
      });
    }
  }
  q(o, h, a, e.rMin);
}, xt = (o, t, s, a, e) => {
  const n = t / 2, r = t / 2, i = t / 2 * 0.78, c = e.spin ?? 1, l = _(s * 0.1 * c, 0.3, n, r, 1), h = $(t, e.rsPow ?? 0.6), d = [], u = e.ghostN ?? 150;
  for (let m = 0; m < u; m++) {
    const b = at(m, u), [w, A, L] = l(b[0] * i, b[1] * i, b[2] * i), N = (L / i + 1) / 2;
    d.push({ x: w, y: A, z: L, r: 0.8 * h, white: 0.78, a: 0.1 + 0.22 * N });
  }
  const p = s * 0.24 * c, x = 0.55 + 0.3 * Math.sin(s * 0.18) * c, g = Math.cos(p), O = 0, y = Math.sin(p), M = -y * Math.sin(x), P = Math.cos(x), S = g * Math.sin(x), k = O * S - y * P, C = y * M - g * S, z = g * P - O * M, v = e.lanes ?? 5, R = e.segs ?? 88, f = Math.max(1, Math.round(v * (e.bandMul ?? 1)));
  for (let m = 0; m < f; m++) {
    const b = (m - (f - 1) / 2) * 0.075, w = Math.abs(m - (f - 1) / 2) / Math.max(1, (f - 1) / 2);
    for (let A = 0; A < R; A++) {
      const L = A / R * 2 * Math.PI, N = (0.16 * Math.sin(L * 3 - s * 1.7 + m * 0.22) + 0.07 * Math.sin(L * 5 + s * 1.1)) * (e.wobMul ?? 1), I = b + N, T = g * Math.cos(L) + M * Math.sin(L) + k * I, B = O * Math.cos(L) + P * Math.sin(L) + C * I, E = y * Math.cos(L) + S * Math.sin(L) + z * I, F = Math.sqrt(T * T + B * B + E * E), [nt, ot, G] = l(T / F * i, B / F * i, E / F * i), H = (G / i + 1) / 2;
      d.push({
        x: nt,
        y: ot,
        z: G,
        r: ((e.rBase ?? 1.1) + (e.rDepth ?? 1.7) * H) * (1 - 0.25 * w) * h,
        white: 0.52 - 0.44 * H + 0.18 * w,
        a: 0.4 + 0.6 * H
      });
    }
  }
  q(o, d, a, e.rMin);
}, W = {
  orbits: yt,
  globe: ut,
  rubik: pt,
  wave: ft,
  ribbon: xt,
  morph: vt
}, wt = [
  ["latRings", "lonDensity"],
  ["rings", "lonDensity"],
  ["lanes", "segs"]
], Rt = ["orbitN", "ghostN"], Dt = ["iconD"], Ot = ["rBase", "rDepth", "rActive", "rDot", "ghostR", "partR", "partRDepth"];
function Pt(o, t) {
  const s = { ...o }, a = /* @__PURE__ */ new Set(), e = Math.sqrt(t);
  for (const [n, r] of wt) {
    const i = s[n], c = s[r];
    i != null && c != null && !a.has(n) && !a.has(r) && (s[n] = Math.max(2, Math.round(i * e)), s[r] = Math.max(2, Math.round(c * e)), a.add(n), a.add(r));
  }
  for (const n of Rt) {
    const r = s[n];
    r != null && !a.has(n) && (s[n] = Math.max(1, Math.round(r * t)));
  }
  for (const n of Dt) {
    const r = s[n];
    r != null && (s[n] = Math.max(0.02, r * t));
  }
  return s;
}
function St(o, t) {
  const s = { ...o };
  for (const a of Ot) {
    const e = s[a];
    e != null && (s[a] = e * t);
  }
  return s.rSizeMul = (s.rSizeMul ?? 1) * t, s;
}
const J = {
  globe: {
    latRings: 17,
    lonDensity: 44,
    rBase: 0.6,
    rDepth: 1.7,
    rBoost: 1,
    inkFar: 0.62,
    inkSpan: 0.54,
    rsPow: 0.6,
    rMin: 0.3
  },
  orbits: {
    orbitN: 12,
    ghostN: 40,
    ghostR: 0.9,
    ghostA: 0.5,
    particles: 3,
    partR: 1.2,
    partRDepth: 1.6,
    rsPow: 0.6,
    rMin: 0.3
  },
  rubik: {
    latRings: 15,
    lonDensity: 40,
    moveCount: 14,
    rBase: 0.6,
    rDepth: 1.7,
    rActive: 0.3,
    inkFar: 0.62,
    inkSpan: 0.54,
    rsPow: 0.6,
    rMin: 0.3
  },
  wave: {
    rings: 15,
    lonDensity: 40,
    rBase: 0.6,
    rDepth: 1.7,
    rsPow: 0.6,
    rMin: 0.3
  },
  ribbon: {
    lanes: 5,
    segs: 88,
    ghostN: 150,
    rBase: 1.1,
    rDepth: 1.7,
    rsPow: 0.6,
    rMin: 0.3
  },
  morph: {
    rDot: 0.021,
    iconD: 1,
    rMin: 0.25
  }
}, kt = {
  working: "orbits",
  searching: "globe",
  solving: "rubik",
  listening: "wave",
  composing: "ribbon",
  shaping: "morph"
}, X = {
  orbits: {
    64: { speed: 1.885, count: 1, size: 1 },
    20: { speed: 3.9, count: 0.238, size: 2.4 }
  },
  globe: {
    64: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } },
    20: { speed: 2.665, count: 0.105, size: 1.75, extra: { scanMul: 4.335, dimBase: 0.45 } }
  },
  rubik: {
    64: { speed: 1.82, count: 0.35, size: 1.05 },
    20: { speed: 1.95, count: 0.088, size: 1.9 }
  },
  wave: {
    64: { speed: 4.388, count: 0.341, size: 1 },
    20: { speed: 3.998, count: 0.105, size: 1.6 }
  },
  ribbon: {
    64: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } },
    20: { speed: 3.12, count: 0.051, size: 1.073, extra: { spin: 0, bandMul: 4.94, wobMul: 1 } }
  },
  morph: {
    64: { speed: 2.405, count: 0.54, size: 0.395, extra: { spread: 1.45 } },
    20: { speed: 2.08, count: 0.53, size: 1.011, extra: { spread: 1.45 } }
  }
}, Z = /* @__PURE__ */ new Map();
function tt(o, t) {
  const s = kt[o] ?? "orbits", e = Number(t) <= 32 ? 20 : 64, n = `${s}-${e}`, r = Z.get(n);
  if (r) return r;
  const i = X[s] ?? X.orbits, c = i[e] ?? i[64];
  let h = { ...J[s] ?? J.orbits };
  c.count !== 1 && (h = Pt(h, c.count)), c.size !== 1 && (h = St(h, c.size)), c.extra && (h = { ...h, ...c.extra });
  const d = { mode: s, speed: c.speed ?? 1, opts: h };
  return Z.set(n, d), d;
}
const Ct = {
  state: "working",
  size: 64,
  theme: "auto",
  speed: 1,
  paused: !1
}, It = {
  working: "Working…",
  searching: "Searching…",
  solving: "Solving…",
  listening: "Listening…",
  composing: "Composing…",
  shaping: "Shaping…"
};
function U(o) {
  if (!o || typeof window > "u" || !window.getComputedStyle)
    return {};
  const t = window.getComputedStyle(o), s = {}, a = t.getPropertyValue("--orb-size").trim();
  if (a) {
    const i = parseFloat(a);
    isNaN(i) || (s.size = i);
  }
  const e = t.getPropertyValue("--orb-speed").trim();
  if (e) {
    const i = parseFloat(e);
    isNaN(i) || (s.speed = i);
  }
  const n = t.getPropertyValue("--orb-color-dark").trim();
  n && (s.colorDark = n);
  const r = t.getPropertyValue("--orb-color-light").trim();
  return r && (s.colorLight = r), s;
}
class zt {
  constructor(t) {
    D(this, "listener", null);
    D(this, "isReduced", !1);
    D(this, "onChange");
    this.onChange = t, this.init();
  }
  getIsReduced() {
    return this.isReduced;
  }
  init() {
    if (typeof matchMedia > "u") return;
    const t = matchMedia("(prefers-reduced-motion: reduce)");
    this.isReduced = t.matches, this.listener = (s) => {
      this.isReduced = s.matches, this.onChange(this.isReduced);
    }, t.addEventListener("change", this.listener);
  }
  destroy() {
    this.listener && typeof matchMedia < "u" && matchMedia("(prefers-reduced-motion: reduce)").removeEventListener("change", this.listener);
  }
}
function Lt(o) {
  let t = o;
  for (; t; ) {
    const s = t.getAttribute("data-theme");
    if (s === "dark") return !0;
    if (s === "light") return !1;
    if (t.classList.contains("dark")) return !0;
    if (t.classList.contains("light")) return !1;
    t = t.parentElement;
  }
  return null;
}
function At() {
  return typeof matchMedia < "u" && matchMedia("(prefers-color-scheme: dark)").matches;
}
class Nt {
  constructor(t, s, a) {
    D(this, "element");
    D(this, "theme");
    D(this, "onChange");
    D(this, "mediaQueryListener", null);
    D(this, "mutationObserver", null);
    D(this, "isDark", !0);
    this.element = t, this.theme = s, this.onChange = a, this.init();
  }
  updateTheme(t, s) {
    s !== void 0 && (this.element = s), this.theme = t, this.reevaluate();
  }
  getResolvedDark() {
    return this.isDark;
  }
  init() {
    if (this.reevaluate(), typeof matchMedia < "u") {
      const t = matchMedia("(prefers-color-scheme: dark)");
      this.mediaQueryListener = () => this.reevaluate(), t.addEventListener("change", this.mediaQueryListener);
    }
    typeof MutationObserver < "u" && typeof document < "u" && (this.mutationObserver = new MutationObserver(() => this.reevaluate()), this.mutationObserver.observe(document.documentElement, {
      attributes: !0,
      attributeFilter: ["class", "data-theme"],
      subtree: !0
    }));
  }
  reevaluate() {
    let t = !0;
    this.theme === "dark" ? t = !0 : this.theme === "light" ? t = !1 : t = Lt(this.element) ?? At(), this.isDark !== t && (this.isDark = t, this.onChange(this.isDark));
  }
  destroy() {
    this.mediaQueryListener && typeof matchMedia < "u" && matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", this.mediaQueryListener), this.mutationObserver && this.mutationObserver.disconnect();
  }
}
class Ft {
  constructor(t, s) {
    D(this, "canvas");
    D(this, "options");
    D(this, "themeObserver");
    D(this, "motionObserver");
    D(this, "intersectionObserver", null);
    D(this, "rafId", 0);
    D(this, "isRunning", !1);
    D(this, "isVisible", !0);
    D(this, "isDestroyed", !1);
    D(this, "onVisibilityChangeHandler");
    D(this, "loop", () => {
      !this.isRunning || this.isDestroyed || (this.renderCurrentFrame(), this.rafId = requestAnimationFrame(this.loop));
    });
    this.canvas = t, this.options = { ...Ct, ...s }, this.canvas.getAttribute("role") || this.canvas.setAttribute("role", "img"), this.updateAriaLabel(), this.motionObserver = new zt(() => {
      this.renderCurrentFrame();
    }), this.themeObserver = new Nt(this.canvas, this.options.theme, () => {
      this.renderCurrentFrame();
    }), this.onVisibilityChangeHandler = () => {
      typeof document < "u" && document.visibilityState === "hidden" ? this.stop() : this.isVisible && this.start();
    }, this.initIntersectionObserver(), typeof document < "u" && document.addEventListener("visibilitychange", this.onVisibilityChangeHandler), this.setupCanvasAndRender();
  }
  updateOptions(t) {
    var s;
    this.isDestroyed || (this.options = { ...this.options, ...t }, this.updateAriaLabel(), (s = this.themeObserver) == null || s.updateTheme(this.options.theme, this.canvas), this.setupCanvasAndRender());
  }
  destroy() {
    var t, s;
    this.isDestroyed || (this.isDestroyed = !0, this.stop(), (t = this.themeObserver) == null || t.destroy(), (s = this.motionObserver) == null || s.destroy(), this.intersectionObserver && this.intersectionObserver.disconnect(), typeof document < "u" && document.removeEventListener("visibilitychange", this.onVisibilityChangeHandler));
  }
  updateAriaLabel() {
    const t = this.options.ariaLabel || It[this.options.state] || "Loading...";
    this.canvas.setAttribute("aria-label", t);
  }
  setupCanvasAndRender() {
    var e;
    const s = U(this.canvas).size ?? this.options.size, a = Math.min(2, typeof devicePixelRatio < "u" && devicePixelRatio || 1);
    this.canvas.width = Math.round(s * a), this.canvas.height = Math.round(s * a), this.canvas.style.width = `${s}px`, this.canvas.style.height = `${s}px`, this.canvas.style.display = "block", this.renderCurrentFrame(), !this.options.paused && !((e = this.motionObserver) != null && e.getIsReduced()) ? this.start() : this.stop();
  }
  renderFrameAt(t) {
    const s = this.canvas.getContext("2d");
    if (!s) return;
    const e = U(this.canvas).size ?? this.options.size, n = typeof e == "number" && Number.isFinite(e) && e > 0 ? e : 64, r = Math.min(2, typeof devicePixelRatio < "u" && devicePixelRatio || 1), { mode: i, opts: c } = tt(this.options.state, n), l = W[i] || W.orbits, h = this.themeObserver ? this.themeObserver.getResolvedDark() : !0;
    s.setTransform(r, 0, 0, r, 0, 0), s.clearRect(0, 0, n, n);
    const d = Number.isFinite(t) ? t : 0;
    l(s, n, d, h, c);
  }
  renderCurrentFrame() {
    var l;
    if ((l = this.motionObserver) != null && l.getIsReduced()) {
      this.renderFrameAt(0.6);
      return;
    }
    const t = U(this.canvas), s = t.size ?? this.options.size, a = typeof s == "number" && Number.isFinite(s) && s > 0 ? s : 64, e = t.speed ?? this.options.speed, n = typeof e == "number" && Number.isFinite(e) ? e : 1, { speed: r } = tt(this.options.state, a), i = (r || 1) * n, c = performance.now() / 1e3 * i;
    this.renderFrameAt(c);
  }
  start() {
    var t;
    this.isRunning || this.options.paused || (t = this.motionObserver) != null && t.getIsReduced() || this.isDestroyed || (this.isRunning = !0, this.rafId = requestAnimationFrame(this.loop));
  }
  stop() {
    this.isRunning = !1, this.rafId && (cancelAnimationFrame(this.rafId), this.rafId = 0);
  }
  initIntersectionObserver() {
    typeof IntersectionObserver < "u" && (this.intersectionObserver = new IntersectionObserver(([t]) => {
      this.isVisible = t.isIntersecting, this.isVisible && typeof document < "u" && document.visibilityState !== "hidden" ? this.start() : this.stop();
    }), this.intersectionObserver.observe(this.canvas));
  }
}
export {
  Ct as D,
  W as M,
  Ft as O,
  zt as R,
  kt as S,
  Nt as T,
  It as a,
  tt as b,
  U as r
};
