/**
 * ScrollFollower — permanent scroll-followership for the chat stream.
 *
 * Owns the "am I pinned to the bottom?" state for the MessageFeed's whole
 * life (not just while a response streams):
 *
 *   - While PINNED, any content growth keeps the view glued to the bottom.
 *     The feed calls notifyContentAppended() after it adds messages.
 *   - The moment the user scrolls up beyond PIN_THRESHOLD, the pin detaches
 *     and the jump-to-latest BUTTON appears — whether or not a response is
 *     being generated. Scrolling back to the bottom (or tapping the button)
 *     re-attaches the pin and hides the button.
 *   - The button is anchored inside .chat-page, horizontally centred over
 *     the composer (message bar) and hovering just above it; its position
 *     is recomputed on resize so layout changes never strand it.
 *
 * This used to live inside StreamingRenderer, which made scroll-up support
 * exist only during generation — a lifecycle bug. Follow-ship belongs to the
 * feed; the renderer merely asks the follower to chase the bottom while it
 * paints tokens.
 */

const PIN_THRESHOLD = 140; // px above the bottom that still counts as "at the bottom"

export class ScrollFollower {
  /** @param {HTMLElement} scroller the .chat-stream element */
  constructor(scroller) {
    this.scroller = scroller;
    this.pinned = true;
    this.button = null;

    this._onScroll = () => {
      const el = this.scroller;
      if (!el) return;
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight <= PIN_THRESHOLD;
      if (!atBottom && this.pinned) this.detach();
      else if (atBottom && !this.pinned) this.attach();
    };

    // Keep the button centred over the composer across viewport changes.
    this._onResize = () => { if (this.button) this._position(); };
  }

  mount() {
    if (this._mounted) return;
    this._mounted = true;
    this.scroller.addEventListener("scroll", this._onScroll, { passive: true });
    window.addEventListener("resize", this._onResize);
  }

  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    this.scroller.removeEventListener("scroll", this._onScroll);
    window.removeEventListener("resize", this._onResize);
    this.removeButton();
  }

  attach() {
    this.pinned = true;
    this.removeButton();
    this.chase();
  }

  detach() {
    this.pinned = false;
    this._showButton();
  }

  /** Snap to the bottom (only when pinned). Called by painters. */
  chase() {
    if (!this.pinned) return;
    const el = this.scroller;
    if (el) el.scrollTop = el.scrollHeight;
  }

  /** Force-scroll to the bottom and re-pin (the button's action). */
  jumpToBottom() {
    const el = this.scroller;
    if (!el) return;
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight; // older browsers / test environments
    }
    this.attach();
  }

  /** The feed added settled messages / swapped the streaming bubble. */
  notifyContentAppended() {
    this.chase();
    if (this.button && !this.pinned) this._position(); // keep above composer
  }

  _page() {
    return this.scroller.closest(".chat-page");
  }

  _showButton() {
    if (this.button?.isConnected || !this._mounted) return;
    const page = this._page() || document.body; // page context preferred; body fallback
    const b = document.createElement("button");
    b.type = "button";
    b.className = "stream-jump-pill";
    b.setAttribute("aria-label", "Jump to latest");
    b.innerHTML =
      `<span class="pill-ic"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" ` +
      `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ` +
      `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
      `<path d="m6 9 6 6 6-6"/></svg></span>`;
    b.addEventListener("click", () => this.jumpToBottom());
    page.append(b);
    this.button = b;
    this._position();
  }

  /** Centre over the composer (message bar), hovering just above it. */
  _position() {
    const b = this.button;
    const page = this._page();
    if (!b || !page) return;
    const pr = page.getBoundingClientRect();
    const composer = page.querySelector(".composer");
    if (composer) {
      const cr = composer.getBoundingClientRect();
      b.style.left = `${Math.round(cr.left + cr.width / 2 - pr.left)}px`;
      b.style.bottom = `${Math.round(pr.bottom - cr.top) + 12}px`;
    } else {
      b.style.left = "50%";
      b.style.bottom = "150px";
    }
    b.style.transform = "translateX(-50%)";
  }

  removeButton() {
    this.button?.remove();
    this.button = null;
  }
}
