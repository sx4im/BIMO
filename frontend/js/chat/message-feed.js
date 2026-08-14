/**
 * Message feed component for Bimo chat.
 * Renders empty stream states, message bubbles, reasoning/thinking blocks,
 * streaming indicators, and auto-scrolls with smooth locked pinning.
 */

import { el, clear } from "../utils.js?v=20";
import { icon } from "../icons.js?v=48";
import { renderMarkdown, whenMarkdownReady } from "../components/markdown.js?v=20";
import { messageBubble } from "../components/message.js?v=52";

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
    el("div", { class: "mark", html: icon("spike", { width: 84, height: 84 }) }),
    el("h2", { html: "Ask <span class=\"accent\">Bimo</span> anything." }),
    el("p", { text: "Fast, multimodal, and built to think." }),
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
        el("thinking-orb", { state: "searching", size: "22", style: "display:inline-block; vertical-align:middle; margin-right:2px;" }),
        el("span", { class: "search-label", text: "Searching the web" }),
      ]),
    ]),
  ]);
}

export function streamingBubbleNode(text, reasoning = "", statusPhrase = "Thinking…") {
  const bubble = el("div", { class: "bubble markdown-body streaming-bubble", "data-streaming": "true" });
  if (text) {
    bubble.innerHTML = `<div class="stream-text">${renderMarkdown(text)}</div><span class="cursor">▋</span>`;
  } else {
    bubble.innerHTML = '<span class="cursor">▋</span>';
  }

  const bodyChildren = [
    el("div", { class: "meta" }, [
      el("span", { class: "status-text", text: statusPhrase }),
    ]),
  ];

  if (reasoning.trim()) {
    bodyChildren.push(el("details", { class: "reasoning-block", open: true, html: `
      <summary><thinking-orb state="composing" size="22" speed="1.25" style="display:inline-block; vertical-align:middle; margin-right:2px; transform:translateY(-1px);"></thinking-orb> Thought Process <span class="reasoning-timer"></span></summary>
      <div class="reasoning-content markdown-body">${renderMarkdown(reasoning)}${text ? '' : '<span class="cursor reasoning-cursor">▋</span>'}</div>
    ` }));
  }

  bodyChildren.push(bubble);

  return el("article", { class: "message assistant streaming" }, [
    el("div", { class: "body" }, bodyChildren),
  ]);
}

export class MessageFeed {
  constructor({
    onEditMessage,
    onRetryMessage,
    onFeedback,
    onRetryAssistantMessage,
  }) {
    this.onEditMessage = onEditMessage;
    this.onRetryMessage = onRetryMessage;
    this.onFeedback = onFeedback;
    this.onRetryAssistantMessage = onRetryAssistantMessage;

    this.stream = el("div", { class: "chat-stream" });
    this.streamInner = el("div", { class: "inner" });
    this.stream.append(this.streamInner);
  }

  get element() {
    return this.stream;
  }

  scrollToBottom() {
    this.stream.scrollTop = this.stream.scrollHeight;
  }

  updateStreamingBubble(text, reasoning = "") {
    const bubble = this.streamInner.querySelector(".streaming-bubble[data-streaming='true']");
    if (!bubble) return false;

    const body = bubble.closest(".body");
    if (body) {
      let reasoningBlock = body.querySelector(".reasoning-block");
      if (reasoning.trim()) {
        if (reasoningBlock) {
          const contentDiv = reasoningBlock.querySelector(".reasoning-content");
          if (contentDiv) {
            contentDiv.innerHTML = `${renderMarkdown(reasoning)}${text ? '' : '<span class="cursor reasoning-cursor">▋</span>'}`;
          }
        } else {
          reasoningBlock = el("details", { class: "reasoning-block", open: true, html: `
            <summary><thinking-orb state="composing" size="22" speed="1.25" style="display:inline-block; vertical-align:middle; margin-right:2px; transform:translateY(-1px);"></thinking-orb> Thought Process <span class="reasoning-timer"></span></summary>
            <div class="reasoning-content markdown-body">${renderMarkdown(reasoning)}${text ? '' : '<span class="cursor reasoning-cursor">▋</span>'}</div>
          ` });
          body.insertBefore(reasoningBlock, bubble);
        }
      } else if (reasoningBlock) {
        reasoningBlock.remove();
      }
    }

    if (text) {
      bubble.innerHTML = `<div class="stream-text">${renderMarkdown(text)}</div><span class="cursor">▋</span>`;
    } else {
      bubble.innerHTML = '<span class="cursor">▋</span>';
    }
    this.scrollToBottom();
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

  collapseReasoningBlock() {
    const reasoningBlock = this.streamInner.querySelector(".message.streaming .reasoning-block");
    if (reasoningBlock) reasoningBlock.removeAttribute("open");
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
    statusPhrase = "Thinking…",
  }) {
    clear(this.streamInner);

    if (!messages.length && !generating && !searching && !imageGenerating) {
      this.streamInner.append(emptyStreamView({ incognito }));
      return;
    }

    for (const m of messages) {
      this.streamInner.append(
        messageBubble({
          message: m,
          userName: user?.name,
          userAvatarUrl: user?.avatar_url,
          onEdit: m.role === "user" ? this.onEditMessage : undefined,
          onRetry: m.role === "user" ? this.onRetryMessage : undefined,
          onFeedback: m.role === "assistant" ? this.onFeedback : undefined,
          onRetryAssistant: m.role === "assistant" ? this.onRetryAssistantMessage : undefined,
          entering: enteringId != null && m.id === enteringId,
        })
      );
    }

    if (searching) {
      this.streamInner.append(searchingBubbleNode());
    } else if (imageGenerating) {
      this.streamInner.append(imageGeneratingNode());
    } else if (generating) {
      this.streamInner.append(streamingBubbleNode(streamingText, streamingReasoning, statusPhrase));
    }

    setTimeout(() => this.scrollToBottom(), 30);
  }
}
