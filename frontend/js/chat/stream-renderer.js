/**
 * Incremental streaming renderer for Bimo's assistant bubbles.
 *
 * Replaces the token-loop's full `bubble.innerHTML = renderMarkdown(all)`
 * (O(n²) parse cost, total DOM churn, lost scroll/code-copy state) with:
 *
 *   1. rAF batching   — tokens mutate local strings only; all parsing and
 *                       DOM writes happen at most once per animation frame.
 *   2. Frozen blocks  — the accumulating text is cut into stable block
 *                       chunks (see stream-splitter.js). A chunk is parsed
 *                       exactly once when it closes; completed paragraphs,
 *                       lists, tables and code blocks are NEVER re-parsed
 *                       or re-created.
 *   3. Tail-only work — only the open tail chunk is re-parsed per frame,
 *                       and its HTML is diffed against the previous write
 *                       so idle frames cost nothing.
 *   4. Smooth reveal  — an eternal bottom-fade mask on the streaming text:
 *                       the newest line's last pixels are translucent and
 *                       solidify as the next content pushes up. Characters
 *                       glide in instead of popping per SSE chunk (the old
 *                       per-token "chunk pop"). The caret sits OUTSIDE the
 *                       masked wrap so it never fades.
 *   5. Free scrolling — auto-scroll happens ONLY while the user is at/near
 *                       the bottom. Scrolling up during generation detaches
 *                       the pin; a floating "↓ Latest" pill brings them
 *                       back. Mirrors Claude / ChatGPT behavior.
 *
 * Visual output matches the previous implementation: same bubble classes,
 * same reasoning block, same skeleton-card path for document artifacts.
 * When the turn settles, chat.js re-renders the canonical message from
 * stored text as before.
 */

import { renderMarkdown } from "../components/markdown.js?v=31";
import { extractDocumentArtifact, docArtifactSkeletonCard } from "../components/message.js?v=56";
import { splitStreamBlocks } from "./stream-splitter.js?v=1";
import { el, clear } from "../utils.js?v=30";

const CURSOR_HTML = '<span class="cursor">▋</span>';
const PIN_THRESHOLD = 140;   // px above the bottom that still counts as "at the bottom"
// Typewriter pacing: rendered text chases the arrived text each frame — a
// floor speed keeps slow drips flowing, proportional drain eats bursts fast,
// so output reads as one steady stream instead of per-chunk pops. Drain
// constant ≈ exponential catch-up with a ~130 ms time constant.
const TYPE_MIN_STEP = 2.0;   // chars/frame floor (~120 cps @60Hz)
const TYPE_DRAIN = 0.12;     // fraction of the remaining backlog consumed per frame

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

export class StreamingRenderer {
  /** @param {HTMLElement} bubble the `.streaming-bubble[data-streaming]` element */
  constructor(bubble) {
    this.bubble = bubble;

    // One container holds every block chunk; the caret sits beside it,
    // outside the masked wrap.
    this.blocksWrap = el("div", { class: "stream-blocks" });
    this.cursor = el("span");
    this.cursor.className = "cursor";
    this.cursor.textContent = "▋";
    clear(bubble);
    bubble.append(this.blocksWrap, this.cursor);

    this.blockEls = [];      // frozen <div> per closed chunk
    this.tailEl = null;      // open chunk (re-parsed per frame)
    this.tailSrc = null;     // last source written into tailEl
    this.reasoningEl = null;
    this.framePending = false;

    // Typewriter pacing state: how much of the ARRIVED text is rendered.
    // Rendered length only grows; the gap to arrived length shrinks each
    // frame, which produces the steady character-flow feel.
    this.renderedChars = 0;

    // Scroll pinning state.
    this.feed = null;        // owning MessageFeed (provides .element)
    this.pinned = true;      // user is "at the bottom" -> follow the stream
    this.jumpPill = null;
    this._hookedEl = null;

    this.done = false;
    this.skeletonShown = false;

    this._onScroll = () => {
      if (this.done) return;
      const scroller = this._scroller();
      if (!scroller) return;
      const atBottom =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= PIN_THRESHOLD;
      if (!atBottom && this.pinned) this._detachPin();
      else if (atBottom && !this.pinned) this._attachPin();
    };
  }

  /**
   * Push new accumulated state. Strings only — safe to call per token.
   * @returns {boolean} true while the target bubble is still attached
   */
  update(text, reasoning = "") {
    const docArtifact = extractDocumentArtifact(text || "");
    if (docArtifact.isDoc) {
      // Document artifact: swap to the skeleton card, like before — but only
      // once, not on every token.
      if (this.framePending) {
        cancelAnimationFrame(this.framePending);
        this.framePending = false;
      }
      this.done = true;
      if (!this.skeletonShown) {
        this.skeletonShown = true;
        clear(this.bubble);
        this.bubble.append(docArtifactSkeletonCard("Formatting and preparing document…"));
        this.cursor.remove(); // old behaviour: no caret next to the skeleton
      }
      return true;
    }

    this.pendingText = text || "";
    this.pendingReasoning = reasoning || "";
    if (!this.framePending && !this.done) {
      // Reduced motion: no typewriter pacing — render everything as it lands.
      this.framePending = requestAnimationFrame(() =>
        prefersReducedMotion() ? this._flush() : this._tick()
      );
    }
    return true;
  }

  /** Final synchronous paint: close every chunk, drop caret + pill. */
  finish(text, reasoning = "") {
    if (this.framePending) {
      cancelAnimationFrame(this.framePending);
      this.framePending = false;
    }
    this.pendingText = text ?? this.pendingText ?? "";
    this.pendingReasoning = reasoning ?? this.pendingReasoning ?? "";
    // Flush at FULL length (it refuses to run once done), then latch done so
    // any straggler rAF/token after completion is ignored.
    this._flush(this.pendingText.length);
    this.done = true;

    this.cursor.remove();
    this._removeJumpPill();
    this._teardownScrollHook();
  }

  // -- internals ------------------------------------------------------------

  _scroller() {
    return this.feed?.element || this.bubble.closest(".chat-stream");
  }

  _attachPin() {
    this.pinned = true;
    this._removeJumpPill();
  }

  _detachPin() {
    this.pinned = false;
    this._showJumpPill();
  }

  _scrollIfPinned() {
    const scroller = this._scroller();
    if (!scroller || !this.pinned) return;
    scroller.scrollTop = scroller.scrollHeight;
  }

  _showJumpPill() {
    if (this.jumpPill?.isConnected) return;
    const pill = el(
      "button",
      { class: "stream-jump-pill", type: "button", "aria-label": "Jump to latest" },
      [el("span", { text: "↓ Latest" })]
    );
    pill.addEventListener("click", () => {
      const s = this._scroller();
      if (s) s.scrollTo({ top: s.scrollHeight, behavior: "smooth" });
      this._attachPin();
    });
    document.body.append(pill);
    this.jumpPill = pill;
  }

  _removeJumpPill() {
    this.jumpPill?.remove();
    this.jumpPill = null;
  }

  _ensureScrollHook() {
    const scroller = this._scroller();
    if (scroller && this._hookedEl !== scroller) {
      scroller.addEventListener("scroll", this._onScroll, { passive: true });
      this._hookedEl = scroller;
    }
  }

  _teardownScrollHook() {
    if (this._hookedEl) {
      this._hookedEl.removeEventListener("scroll", this._onScroll);
      this._hookedEl = null;
    }
  }

  /**
   * One animation frame of the typewriter loop: advance the rendered length
   * toward the arrived length (floor speed + proportional drain), paint, and
   * re-schedule while a backlog remains.
   */
  _tick() {
    this.framePending = false;
    if (this.done) return;
    if (!this.bubble.isConnected) return; // feed re-rendered — stop the loop
    const arrived = (this.pendingText ?? "").length;
    const gap = arrived - this.renderedChars;
    if (gap > 0) {
      // Steady drain: constant floor speed, plus proportional catch-up so a
      // big burst never lags far behind.
      const step = Math.max(TYPE_MIN_STEP, gap * TYPE_DRAIN);
      const target = Math.min(arrived, Math.floor(this.renderedChars + step));
      this._flush(target);
      if (!this.done && gap - step > 0.5) {
        // Backlog remains — keep the typewriter flowing without waiting for
        // the next network token.
        this.framePending = requestAnimationFrame(() => this._tick());
      }
    } else {
      this._flush(arrived);
    }
  }

  /**
   * One animation frame of work. targetChars = how much of the arrived text
   * to render up to: during streaming it is the typewriter-paced length
   * (steady flow), at finish() it is the full length (everything lands).
   */
  _flush(targetChars = Infinity) {
    this.framePending = false;
    if (this.done) return;
    if (!this.bubble.isConnected) return; // feed re-rendered; drop stale writes

    const text = (this.pendingText ?? "").slice(0, Math.max(0, targetChars));
    const reasoning = this.pendingReasoning ?? "";

    this._updateReasoning(reasoning, Boolean(text));

    if (!text) {
      // No answer tokens yet: nothing but the caret shows.
      if (this.tailSrc !== "") {
        this.tailEl?.remove();
        this.tailEl = null;
        this.tailSrc = "";
      }
      this.renderedChars = 0;
      return;
    }

    const blocks = splitStreamBlocks(text);

    // Freeze every newly-closed chunk (parse once, never again).
    for (let i = this.blockEls.length; i < blocks.length - 1; i++) {
      const div = el("div", { class: "stream-block" });
      div.innerHTML = renderMarkdown(blocks[i]);
      this.blocksWrap.append(div);
      this.blockEls.push(div);
      this.tailEl = null;
      this.tailSrc = null;
    }
    while (this.blockEls.length > blocks.length - 1) {
      this.blockEls.pop()?.remove();
    }

    // Re-parse only the open tail, and only when it actually changed.
    if (!this.tailEl) {
      this.tailEl = el("div", { class: "stream-block stream-tail" });
      this.blocksWrap.append(this.tailEl);
      this.tailSrc = null;
    }
    if (!this.cursor.isConnected) {
      this.blocksWrap.insertAdjacentElement("afterend", this.cursor);
    }
    const tailSrc = blocks[blocks.length - 1] ?? "";
    if (tailSrc !== this.tailSrc) {
      this.tailEl.innerHTML = `${renderMarkdown(tailSrc)}${CURSOR_HTML}`;
      this.tailSrc = tailSrc;
    }
    this.renderedChars = text.length;

    this._ensureScrollHook();
    this._scrollIfPinned();
  }

  _updateReasoning(reasoning, hasAnswerText) {
    if (!reasoning.trim()) {
      if (this.reasoningEl) {
        this.reasoningEl.remove();
        this.reasoningEl = null;
      }
      return;
    }
    const body = this.bubble.closest(".body");
    if (!body) return;
    const html =
      `${renderMarkdown(reasoning)}` +
      `${hasAnswerText ? "" : '<span class="cursor reasoning-cursor">▋</span>'}`;
    let block = this.reasoningEl && this.reasoningEl.isConnected ? this.reasoningEl : null;
    if (!block) {
      block = body.querySelector(".reasoning-block") || null;
    }
    if (block) {
      const content = block.querySelector(".reasoning-content");
      if (content && content.dataset.src !== html) {
        content.innerHTML = html;
        content.dataset.src = html;
      }
    } else {
      // Build through MessageFeed's factory lazily to avoid a cycle: reuse
      // the injected builder if present, else inline a minimal details node.
      if (typeof this.buildReasoning === "function") {
        block = this.buildReasoning({ reasoning, live: true, hasAnswerText });
        body.insertBefore(block, this.bubble);
      } else {
        block = el("details", { class: "reasoning-block" }, [
          el("summary", {}, ["Thought Process"]),
          el("div", { class: "reasoning-content markdown-body", html }),
        ]);
        body.insertBefore(block, this.bubble);
      }
    }
    this.reasoningEl = block;
  }
}
