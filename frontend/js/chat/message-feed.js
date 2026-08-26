/**
 * Message feed component for Bimo chat.
 * Renders empty stream states, message bubbles, reasoning/thinking blocks,
 * streaming indicators, and auto-scrolls with smooth locked pinning.
 *
 * Streaming updates go through StreamingRenderer (stream-renderer.js):
 * tokens are batched per animation frame and only the open markdown block
 * is re-parsed — completed blocks freeze their DOM.
 *
 * Scroll-followership (pin-to-bottom / free scroll / jump button) is owned
 * by ScrollFollower (scroll-follower.js) for the feed's WHOLE lifetime —
 * it works while a response streams AND when the user just scrolls a long
 * finished conversation.
 */

import { el, clear } from "../utils.js?v=30";
import { icon } from "../icons.js?v=48";
import { searchOrb } from "../components/orb.js?v=1";
import { renderMarkdown, whenMarkdownReady } from "../components/markdown.js?v=31";
import { messageBubble, reasoningDetails, extractDocumentArtifact, docArtifactSkeletonCard } from "../components/message.js?v=61";
import { EXPORT_FORMATS, downloadBlob } from "../export.js?v=2";
import { StreamingRenderer } from "./stream-renderer.js?v=8";
import { stripStrayCursors } from "./caret.js?v=1";
import { ScrollFollower } from "./scroll-follower.js?v=5";

export function emptyStreamView({ incognito } = {}) {
  if (incognito) {
    const ghost = `
      <svg xmlns="http://www.w3.org/2000/svg" class="incognito-ghost" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 2.5a7.5 7.5 0 0 0-7.5 7.5v11.4c0 .55.66.8.98.38L8.2 18.4l2.9 3.05a1.05 1.05 0 0 0 1.8 0l2.9-3.05 2.72 3.38c.32.42.98.17.98-.38V10A7.5 7.5 0 0 0 12 2.5z"/>
        <g class="ghost-eyes">
          <circle class="ghost-eye" cx="9.2" cy="10.6" r="0.72" fill="currentColor" stroke="currentColor" stroke-width="0.62"/>
          <circle class="ghost-eye" cx="14.8" cy="10.6" r="0.72" fill="currentColor" stroke="currentColor" stroke-width="0.62"/>
        </g>
      </svg>`;
    return el("div", { class: "empty-stream incognito" }, [
      el("div", { class: "mark", html: ghost }),
      el("h2", { html: '<span class="accent">Incognito</span> chat' }),
      el("p", { text: "Messages here aren't saved to your history." }),
    ]);
  }
  return el("div", { class: "empty-stream" }, [
    el("div", { class: "mark", html: icon("spike", { width: 44, height: 44 }) }),
    el("h2", { text: "What can I do for you?" }),
  ]);
}

export function imageGeneratingNode() {
  const label = "Creating your image";
  return el("article", { class: "message assistant searching" }, [
    el("div", { class: "avatar bot", html: icon("spike", { width: 20, height: 20 }) }),
    el("div", { class: "body" }, [
      el("div", { class: "meta" }, [
        el("span", { class: "author", text: "Bimo" }),
        el("span", { text: "·" }),
        el("span", { class: "status-text", text: label }),
      ]),
      el("div", { class: "image-gen-placeholder" }, [
        el("div", { class: "image-gen-caption" }, [
          el("span", { html: icon("imageSparkles", { width: 15, height: 15 }) }),
          el("span", { text: `${label}…` }),
        ]),
      ]),
    ]),
  ]);
}

export function searchingBubbleNode() {
  return el("article", { class: "message assistant searching" }, [
    el("div", { class: "body" }, [
      el("div", { class: "bubble search-bubble" }, [
        el("span", { class: "orb-slot" }, [searchOrb(16)]),
        el("span", { class: "search-label", text: "Searching the web" }),
      ]),
    ]),
  ]);
}

export function streamingBubbleNode(text, reasoning = "", statusPhrase = "") {
  const bubble = el("div", { class: "bubble markdown-body streaming-bubble", "data-streaming": "true" });

  const bodyChildren = [
    el("div", { class: "meta" }, [
      el("span", { class: "status-text", text: statusPhrase || "Thinking…" }),
    ]),
  ];

  if (reasoning.trim()) {
    bodyChildren.push(reasoningDetails({
      reasoning,
      live: true,
      hasAnswerText: Boolean(text),
    }));
  }

  bodyChildren.push(bubble);

  const article = el("article", { class: "message assistant streaming" }, [
    el("div", { class: "body" }, bodyChildren),
  ]);

  // The incremental renderer owns everything inside the bubble from now on
  // (its constructor seeds it with the current content).
  const renderer = new StreamingRenderer(bubble);
  renderer.buildReasoning = (opts) => reasoningDetails(opts); // manual: collapsed until clicked
  bubble.__streamRenderer = renderer;
  article.__streamRenderer = renderer;

  if (text) {
    const docArtifact = extractDocumentArtifact(text);
    if (docArtifact.isDoc) {
      renderer.update(text, reasoning); // routes to the skeleton card
    } else {
      renderer.finish(text, reasoning);
      renderer.done = false; // the stream continues — allow further frames
    }
  }
  return article;
}

export class MessageFeed {
  constructor({
    onEditMessage,
    onRetryMessage,
    onFeedback,
    onRetryAssistantMessage,
    onExport,
    onOpenDoc,
  }) {
    this.onEditMessage = onEditMessage;
    this.onRetryMessage = onRetryMessage;
    this.onFeedback = onFeedback;
    this.onRetryAssistantMessage = onRetryAssistantMessage;
    this.onExport = onExport;
    this.onOpenDoc = onOpenDoc;

    this.stream = el("div", { class: "chat-stream" });
    this.streamInner = el("div", { class: "inner" });
    this.stream.append(this.streamInner);

    // Track existing message DOM nodes across renders so unchanged bubbles
    // are never torn down or re-parsed.
    this._messageNodes = new Map();
    this._emptyNode = null;
    this._searchingNode = null;
    this._imageGeneratingNode = null;
    this._streamingNode = null;

    // Permanent scroll-followership for this feed's lifetime. The page mounts
    // it once its DOM is attached (see mountScrollFollower()).
    this.follower = new ScrollFollower(this.stream);
  }

  get element() {
    return this.stream;
  }

  /** Call once the feed's element is in the document (chat page mount). */
  mountScrollFollower() {
    if (!this.stream.isConnected) return;
    // Self-healing: if the stream element was swapped after construction,
    // rebuild the follower against the live one.
    if (this.follower.scroller !== this.stream) {
      this.follower.unmount();
      this.follower = new ScrollFollower(this.stream);
    }
    this.follower.mount();
  }

  /** Called by the chat page teardown. */
  unmountScrollFollower() {
    this.follower.unmount();
  }

  scrollToBottom() {
    this.follower.jumpToBottom();
  }

  // Live streaming update. Called per SSE token with the ACCUMULATED strings
  // (same contract as before); all DOM work is deferred + batched inside
  // StreamingRenderer, so this stays cheap even at high token rates.
  updateStreamingBubble(text, reasoning = "") {
    const bubble = this.streamInner.querySelector(".streaming-bubble[data-streaming='true']");
    if (!bubble) return false;
    let renderer = bubble.__streamRenderer || bubble.closest(".message.streaming")?.__streamRenderer;
    if (!renderer) {
      // Bubble existed without its renderer (e.g. restored mid-stream).
      renderer = new StreamingRenderer(bubble);
      renderer.buildReasoning = (opts) => reasoningDetails(opts); // manual: collapsed until clicked
      bubble.__streamRenderer = renderer;
    } else {
      renderer.done = false; // an explicit update means the stream is live
    }
    renderer.feed = this;
    return renderer.update(text, reasoning);
  }

  // Final synchronous paint when the turn completes: closes every block,
  // cancels pending frames and drops the caret — no flicker before the
  // settled message replaces the streaming bubble.
  finishStreamingBubble(text, reasoning = "") {
    const bubble = this.streamInner.querySelector(".streaming-bubble[data-streaming='true']");
    const renderer = bubble?.__streamRenderer || bubble?.closest(".message.streaming")?.__streamRenderer;
    if (renderer) {
      renderer.feed = this;
      renderer.done = false; // allow the finishing flush
      renderer.finish(text ?? "", reasoning);
      return true;
    }
    if (!bubble) return false;
    // Fallback: legacy bubble without a renderer (single caret policy — none).
    bubble.innerHTML = `<div class="stream-text">${stripStrayCursors(renderMarkdown(text || ""))}</div>`;
    return true;
  }

  setStreamingReasoningTimer(text) {
    this.streamInner
      .querySelectorAll(".message.streaming .reasoning-timer")
      .forEach((span) => { span.textContent = text; });
  }

  setStatusText(text) {
    const st = this.streamInner.querySelector(".message.streaming .status-text");
    if (st) st.textContent = text;
  }

  render({
    messages = [],
    user = null,
    generating = false,
    searching = false,
    imageGenerating = false,
    streamingText = "",
    streamingReasoning = "",
    enteringId = null,
    incognito = false,
    statusPhrase = "",
    initial = false,
  }) {
    if (!messages.length && !generating && !searching && !imageGenerating) {
      for (const [, entry] of this._messageNodes) entry.element.remove();
      this._messageNodes.clear();
      if (this._searchingNode) { this._searchingNode.remove(); this._searchingNode = null; }
      if (this._imageGeneratingNode) { this._imageGeneratingNode.remove(); this._imageGeneratingNode = null; }
      if (this._streamingNode) { this._streamingNode.remove(); this._streamingNode = null; }
      if (!this._emptyNode || !this._emptyNode.isConnected) {
        this._emptyNode = emptyStreamView({ incognito });
        this.streamInner.append(this._emptyNode);
      }
      return;
    }

    if (this._emptyNode) {
      this._emptyNode.remove();
      this._emptyNode = null;
    }

    const currentMsgIds = new Set(messages.map((m) => m.id));

    // Remove obsolete message bubbles
    for (const [id, entry] of this._messageNodes) {
      if (!currentMsgIds.has(id)) {
        entry.element.remove();
        this._messageNodes.delete(id);
      }
    }

    // Reconcile message bubbles in order
    let prevNode = null;
    for (const m of messages) {
      let entry = this._messageNodes.get(m.id);
      if (entry && entry.message !== m) {
        // Message updated (e.g. feedback changed)
        const newNode = messageBubble({
          message: m,
          userName: user?.name,
          userAvatarUrl: user?.avatar_url,
          onEdit: m.role === "user" ? this.onEditMessage : undefined,
          onRetry: m.role === "user" ? this.onRetryMessage : undefined,
          onFeedback: m.role === "assistant" ? this.onFeedback : undefined,
          onRetryAssistant: m.role === "assistant" ? this.onRetryAssistantMessage : undefined,
          onExport: m.role === "assistant" ? this.onExport : undefined,
          onOpenDoc: m.role === "assistant" ? this.onOpenDoc : undefined,
          entering: enteringId != null && m.id === enteringId,
        });
        entry.element.replaceWith(newNode);
        entry = { element: newNode, message: m };
        this._messageNodes.set(m.id, entry);
      } else if (!entry) {
        // New message bubble
        const newNode = messageBubble({
          message: m,
          userName: user?.name,
          userAvatarUrl: user?.avatar_url,
          onEdit: m.role === "user" ? this.onEditMessage : undefined,
          onRetry: m.role === "user" ? this.onRetryMessage : undefined,
          onFeedback: m.role === "assistant" ? this.onFeedback : undefined,
          onRetryAssistant: m.role === "assistant" ? this.onRetryAssistantMessage : undefined,
          onExport: m.role === "assistant" ? this.onExport : undefined,
          onOpenDoc: m.role === "assistant" ? this.onOpenDoc : undefined,
          entering: enteringId != null && m.id === enteringId,
        });
        entry = { element: newNode, message: m };
        this._messageNodes.set(m.id, entry);
        if (prevNode) {
          prevNode.after(newNode);
        } else {
          this.streamInner.prepend(newNode);
        }
      } else {
        // Unchanged existing bubble — preserve position
        if (prevNode && prevNode.nextSibling !== entry.element) {
          prevNode.after(entry.element);
        } else if (!prevNode && this.streamInner.firstChild !== entry.element) {
          this.streamInner.prepend(entry.element);
        }
      }
      prevNode = entry.element;
    }

    // Trailing nodes (searching / image gen / live stream)
    if (searching) {
      if (!this._searchingNode || !this._searchingNode.isConnected) {
        this._searchingNode = searchingBubbleNode();
        this.streamInner.append(this._searchingNode);
      }
    } else if (this._searchingNode) {
      this._searchingNode.remove();
      this._searchingNode = null;
    }

    if (imageGenerating) {
      if (!this._imageGeneratingNode || !this._imageGeneratingNode.isConnected) {
        this._imageGeneratingNode = imageGeneratingNode();
        this.streamInner.append(this._imageGeneratingNode);
      }
    } else if (this._imageGeneratingNode) {
      this._imageGeneratingNode.remove();
      this._imageGeneratingNode = null;
    }

    if (generating) {
      if (!this._streamingNode || !this._streamingNode.isConnected) {
        this._streamingNode = streamingBubbleNode(streamingText, streamingReasoning, statusPhrase);
        this._streamingNode.__streamRenderer.feed = this;
        this.streamInner.append(this._streamingNode);
      }
    } else if (this._streamingNode) {
      this._streamingNode.remove();
      this._streamingNode = null;
    }

    // Growth-aware follow: pinned users stay glued; detached users keep their
    // place and their jump button (repositioned above the composer).
    this.follower.notifyContentAppended();
    if (initial) {
      setTimeout(() => this.scrollToBottom(), 30); // initial-load snap
    }
  }
}
