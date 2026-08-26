// Regression for ScrollFollower + reasoning policy — run with: node test-scroll-follower-regression.mjs
// jsdom: no layout engine, so scrollTop/scrollHeight/clientHeight are faked
// through a geometry object the test mutates between scroll events.
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div class='chat-page'><div class='composer'></div></div></body></html>", { pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

global.window = window;
global.document = document;
global.Event = window.Event;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
window.Element.prototype.scrollTo = undefined; // force fallback branch like old browsers

const geom = { sh: 2000, st: 0, ch: 800 };
Object.defineProperty(window.Element.prototype, "scrollHeight", { get() { return geom.sh; }, configurable: true });
Object.defineProperty(window.Element.prototype, "scrollTop", {
  get() { return geom.st; }, set(v) { geom.st = v; }, configurable: true,
});
Object.defineProperty(window.Element.prototype, "clientHeight", { get() { return geom.ch; }, configurable: true });
window.addEventListener("resize", () => {});
const raf = () => new Promise((r) => setTimeout(r, 5));

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log(`ok: ${name}`); }
  else { fail++; console.log(`FAIL: ${name}${extra !== undefined ? ` -> ${extra}` : ""}`); }
}

const root = new URL("./js/", import.meta.url);
const bust = (p) => `${root.href}${p}?v=${Date.now()}`;
const { ScrollFollower } = await import(bust("chat/scroll-follower.js"));
const feedMod = await import(bust("chat/message-feed.js"));
const msgMod = await import(bust("components/message.js"));

const page = document.querySelector(".chat-page");
const scroller = document.createElement("div");
scroller.className = "chat-stream";
const inner = document.createElement("div");
scroller.append(inner);
page.prepend(scroller);

// ---- TEST 1: user scroll-up (no generation) shows jump button -------------
geom.sh = 5000; geom.st = 4200; // auto-scroll parked at bottom
const fol = new ScrollFollower(scroller);
fol.mount();
scroller.dispatchEvent(new window.Event("scroll")); // record baseline
await raf();
geom.st = 3800; // genuine upward gesture (no height change)
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
check("T1: scroll-up shows button", !!document.querySelector(".stream-jump-pill"));
check("T1: follower detached", fol.pinned === false);
check("T1: pill bottom = composer+12px", document.querySelector(".stream-jump-pill")?.style.bottom === "12px",
  document.querySelector(".stream-jump-pill")?.style.bottom);
document.querySelector(".stream-jump-pill").click();
check("T1: click re-pins + removes button", fol.pinned === true && !document.querySelector(".stream-jump-pill"));

// ---- TEST 2: content-height clamp must NOT unpin (the autoscroll killer) --
geom.st = 4900; // pinned at bottom of a long conversation
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
// Feed re-render shrinks then regrows content; browser clamps scrollTop.
geom.sh = 3000; geom.st = 2200; // clamped position, height changed
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
check("T2: height-change clamp does not detach pin", fol.pinned === true);
geom.sh = 6000; geom.st = 5200; // tokens arrive, chase keeps us at bottom
fol.chase();
check("T2: chase still glued after clamp", Math.abs(geom.st - geom.sh) <= 1);

// ---- TEST 3: reasoning blocks are MANUAL (collapsed until clicked) --------
const rb = msgMod.reasoningDetails({ reasoning: "step by step thoughts", live: false });
inner.append(rb);
check("T3: settled block collapsed by default", !rb.hasAttribute("open"));
rb.querySelector("summary").click();
check("T3: click opens block", rb.hasAttribute("open"));

const node = feedMod.streamingBubbleNode("", "live thinking ", "Thinking…");
inner.append(node);
const liveRb = node.querySelector(".reasoning-block");
check("T3: live streaming block ALSO collapsed by default", liveRb instanceof window.HTMLElement && !liveRb.hasAttribute("open"));

// Settled messageBubble path (what onAssistantMessage renders)
const bubble = msgMod.messageBubble({
  message: { id: "m1", role: "assistant", content: "Answer text", reasoning: "stored reasoning", reasoning_seconds: 3 },
});
inner.append(bubble);
const settled = bubble.querySelector(".reasoning-block");
check("T3: settled messageBubble block collapsed", !!settled && !settled.hasAttribute("open"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
