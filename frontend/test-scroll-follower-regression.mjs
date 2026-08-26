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

// ---- TEST 4: VIEWPORT clamp must NOT unpin (keyboard/URL-bar dimension) ---
// Soft keyboards and mobile URL bars resize clientHeight, not scrollHeight.
// When clientHeight GROWS back (keyboard dismissed, bar re-expanded) the
// browser clamps scrollTop DOWNWARD with scrollHeight untouched — an event
// indistinguishable in the old guard from a genuine upward drag.
geom.ch = 400; geom.st = 5600; // pinned at bottom while the keyboard is open
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
geom.ch = 800; geom.st = 5200; // keyboard closed: viewport grew, browser clamped
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
check("T4: viewport-growth clamp does not detach pin", fol.pinned === true);
fol.chase();
check("T4: chase still glued after viewport clamp", Math.abs(geom.st - geom.sh) <= 1);

// ---- TEST 5: completion swap (streaming bubble -> settled message) --------
// onAssistantMessage rebuilds the feed over several frames: the streaming
// bubble is dropped (content SHRINKS), then the settled markdown lands and
// regrows. Each frame's clamp must stay ignored; the final chase re-glues.
geom.sh = 9000; geom.st = 8200; // pinned at bottom of the finished stream
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
geom.sh = 7000; geom.st = 6200; // frame A: bubble dropped, feed shrinks, clamp
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
check("T5: swap shrink clamp does not detach pin", fol.pinned === true);
geom.sh = 8500; geom.st = 7700; // frame B: settled message inserted, regrows
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
check("T5: regrow clamp does not detach pin", fol.pinned === true);
fol.chase();
check("T5: chase glued after completion swap", Math.abs(geom.st - geom.sh) <= 1);

// ---- TEST 6: anchoring nudge during viewport churn must NOT unpin ---------
// Scroll anchoring / reflow compensation can shift scrollTop UP by a few px
// with scrollHeight untouched while the viewport itself is resizing (soft
// keyboard, URL bar). The old guard saw a clean upward delta and detached.
geom.st = geom.sh - geom.ch; // pinned at bottom
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
geom.ch = 500; geom.st -= 40; // viewport shrinks AND scrollTop nudged up: noise
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
check("T6: anchoring nudge during viewport churn does not detach", fol.pinned === true);
fol.chase();
check("T6: chase re-glues after viewport settles", Math.abs(geom.st - geom.sh) <= 1);
// And the control: the SAME nudge with a STABLE viewport is still a gesture.
await raf();
geom.ch = 500; geom.st = geom.sh - geom.ch; // settle back to bottom, record
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
geom.st -= 200; // genuine upward drag — nothing about layout changed
scroller.dispatchEvent(new window.Event("scroll"));
await raf();
check("T6: real drag on stable viewport still detaches", fol.pinned === false);

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

// ---- TEST 7: MessageFeed.render() reconciles DOM preserving existing nodes -
const feed = new feedMod.MessageFeed({});
page.append(feed.element);
feed.mountScrollFollower();

const m1 = { id: "msg_1", role: "user", content: "Hello Bimo" };
const m2 = { id: "msg_2", role: "assistant", content: "Hello there!" };
feed.render({ messages: [m1] });

const initialM1Node = feed.streamInner.querySelector(".message.user");
check("T7: initial message node rendered", !!initialM1Node);

// Append second message
feed.render({ messages: [m1, m2], enteringId: "msg_2" });
const currentM1Node = feed.streamInner.querySelector(".message.user");
const m2Node = feed.streamInner.querySelector(".message.assistant");
check("T7: existing message node preserved across append", currentM1Node === initialM1Node);
check("T7: second message node appended", !!m2Node);
check("T7: total messages reconciled", feed.streamInner.querySelectorAll(".message").length === 2);
check("T7: entering animation only on new message", !currentM1Node.classList.contains("entering") && m2Node.classList.contains("entering"));

// ---- TEST 8: normal render update does not force-scroll a detached user -----
feed.follower.detach();
check("T8: follower is detached", feed.follower.pinned === false);
geom.sh = 6000;
geom.st = 1000; // user scrolled far up reading history

const m3 = { id: "msg_3", role: "user", content: "Follow-up question" };
feed.render({ messages: [m1, m2, m3] }); // normal update (initial = false)
await new Promise((r) => setTimeout(r, 50)); // let any potential timer tick

check("T8: detached user position not yanked on normal update", geom.st === 1000);
check("T8: follower remains detached after normal update", feed.follower.pinned === false);

// ---- TEST 9: initial load snap still works on first open (initial: true) ----
feed.follower.detach();
geom.sh = 8000;
geom.st = 1200;
feed.render({ messages: [m1, m2, m3], initial: true });
await new Promise((r) => setTimeout(r, 50)); // await 30ms initial-load snap

check("T9: initial load snap moves scroll to bottom", geom.st === 8000);
check("T9: initial load snap re-pins follower", feed.follower.pinned === true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

