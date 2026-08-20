/**
 * Message feed component for Bimo chat.
 * Renders empty stream states, message bubbles, reasoning/thinking blocks,
 * streaming indicators, and auto-scrolls with smooth locked pinning.
 */

import { el, clear } from "../utils.js?v=20";
import { icon } from "../icons.js?v=48";
import { renderMarkdown, whenMarkdownReady } from "../components/markdown.js?v=20";
import { messageBubble, reasoningDetails } from "../components/message.js?v=54";
import { EXPORT_FORMATS, downloadBlob } from "../export.js?v=1";

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
        el("span", { class: "icon-pulse", html: icon("globe", { width: 15, height: 15 }) }),
        el("span", { class: "search-label", text: "Searching the web" }),
      ]),
    ]),
  ]);
}

export function streamingBubbleNode(text, reasoning = "", statusPhrase = "") {
  const bubble = el("div", { class: "bubble markdown-body streaming-bubble", "data-streaming": "true" });
  if (text) {
    bubble.innerHTML = `<div class="stream-text">${renderMarkdown(text)}</div><span class="cursor">▋</span>`;
  } else {
    bubble.innerHTML = '<span class="cursor">▋</span>';
  }

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

  return el("article", { class: "message assistant streaming" }, [
    el("div", { class: "body" }, bodyChildren),
  ]);
}

export function exportCardNode({
  exportSession,
  onDownload,
  onRetryFormat,
}) {
  const { title, formats } = exportSession;
  const docTitle = (title || "").trim() || "Bimo AI response";

  const isAnyLoading = Object.values(formats).some((f) => f.status === "loading");
  const isAllReady = Object.values(formats).every((f) => f.status === "ready");
  const hasErrors = Object.values(formats).some((f) => f.status === "error");

  // Status Badge in card header
  let statusBadgeText = "Ready for download";
  let statusBadgeClass = "ready";
  let statusIcon = icon("check", { width: 13, height: 13 });

  if (isAnyLoading) {
    statusBadgeText = "Preparing files…";
    statusBadgeClass = "loading";
    statusIcon = `<span class="export-spinner"></span>`;
  } else if (hasErrors && !isAllReady) {
    statusBadgeText = "Partial export";
    statusBadgeClass = "error";
    statusIcon = icon("alert", { width: 13, height: 13 });
  }

  const cardHeader = el("div", { class: "export-card-header" }, [
    el("div", { class: "export-doc-icon", html: icon("fileText", { width: 22, height: 22 }) }),
    el("div", { class: "export-doc-info" }, [
      el("h3", { class: "export-doc-title", text: docTitle }),
      el("div", { class: "export-doc-meta", text: "AI-generated document · Markdown source" }),
    ]),
    el("div", { class: `export-status-badge ${statusBadgeClass}` }, [
      el("span", { class: "status-icon", html: statusIcon }),
      el("span", { class: "status-label", text: statusBadgeText }),
    ]),
  ]);

  // In-flight progress status tracker
  const statusItems = [
    {
      id: "md",
      label: formats.md?.status === "ready" ? "Markdown document prepared" : formats.md?.status === "error" ? "Markdown export failed" : "Preparing Markdown document…",
      status: formats.md?.status || "loading",
    },
    {
      id: "pdf",
      label: formats.pdf?.status === "ready" ? "PDF document ready" : formats.pdf?.status === "error" ? "PDF creation failed" : "Creating PDF document…",
      status: formats.pdf?.status || "loading",
    },
    {
      id: "docx",
      label: formats.docx?.status === "ready" ? "Word document ready" : formats.docx?.status === "error" ? "Word document creation failed" : "Creating Word document…",
      status: formats.docx?.status || "loading",
    },
  ];

  const progressSection = el(
    "div",
    { class: `export-progress-tracker${isAnyLoading ? " active" : ""}` },
    statusItems.map((item) => {
      let stateIcon = `<span class="export-spinner"></span>`;
      if (item.status === "ready") {
        stateIcon = icon("check", { width: 13, height: 13 });
      } else if (item.status === "error") {
        stateIcon = icon("alert", { width: 13, height: 13 });
      }
      return el("div", { class: `export-progress-row ${item.status}` }, [
        el("span", { class: "progress-icon", html: stateIcon }),
        el("span", { class: "progress-text", text: item.label }),
      ]);
    })
  );

  // Format Download Options Grid
  const formatCards = Object.keys(EXPORT_FORMATS).map((fmtKey) => {
    const meta = EXPORT_FORMATS[fmtKey];
    const fmtState = formats[fmtKey] || { status: "loading", blob: null, error: null };

    let actionBtn;
    if (fmtState.status === "loading") {
      actionBtn = el("button", {
        type: "button",
        class: "export-dl-btn loading",
        disabled: true,
        "aria-label": `Preparing ${meta.label}`,
      }, [
        el("span", { class: "export-spinner sm" }),
        el("span", { text: "Preparing…" }),
      ]);
    } else if (fmtState.status === "error") {
      actionBtn = el("button", {
        type: "button",
        class: "export-dl-btn retry",
        title: fmtState.error || "Retry export",
        "aria-label": `Retry ${meta.label}`,
        onclick: () => onRetryFormat?.({ exportSession, format: fmtKey }),
      }, [
        el("span", { html: icon("refresh", { width: 13, height: 13 }) }),
        el("span", { text: "Retry" }),
      ]);
    } else {
      actionBtn = el("button", {
        type: "button",
        class: "export-dl-btn ready",
        "aria-label": `Download ${meta.label} (${meta.ext})`,
        onclick: () => onDownload?.({ exportSession, format: fmtKey }),
      }, [
        el("span", { html: icon("download", { width: 13, height: 13 }) }),
        el("span", { text: `Download ${meta.ext}` }),
      ]);
    }

    return el("div", { class: `export-format-chip ${fmtState.status}` }, [
      el("div", { class: "format-head" }, [
        el("span", { class: "format-badge", text: meta.badge }),
        el("div", { class: "format-details" }, [
          el("span", { class: "format-name", text: meta.label }),
          el("span", { class: "format-ext", text: meta.ext }),
        ]),
      ]),
      actionBtn,
    ]);
  });

  const formatsGrid = el("div", { class: "export-formats-grid" }, formatCards);

  // Download All Ready button if multiple are ready
  const readyFormats = Object.keys(formats).filter((k) => formats[k]?.status === "ready");
  let downloadAllBtn = null;
  if (readyFormats.length >= 2) {
    downloadAllBtn = el("button", {
      type: "button",
      class: "export-download-all-btn",
      onclick: () => {
        for (const fmtKey of readyFormats) {
          onDownload?.({ exportSession, format: fmtKey });
        }
      },
    }, [
      el("span", { html: icon("download", { width: 14, height: 14 }) }),
      el("span", { text: `Download all ready files (${readyFormats.length})` }),
    ]);
  }

  const cardChildren = [cardHeader, progressSection, formatsGrid];
  if (downloadAllBtn) cardChildren.push(downloadAllBtn);

  const card = el("div", { class: "export-download-card" }, cardChildren);

  return el("article", { class: "message assistant export-turn", "data-export-id": exportSession.id }, [
    el("div", { class: "body" }, [card]),
  ]);
}

export class MessageFeed {
  constructor({
    onEditMessage,
    onRetryMessage,
    onFeedback,
    onRetryAssistantMessage,
    onExport,
    onDownloadExport,
    onRetryExportFormat,
  }) {
    this.onEditMessage = onEditMessage;
    this.onRetryMessage = onRetryMessage;
    this.onFeedback = onFeedback;
    this.onRetryAssistantMessage = onRetryAssistantMessage;
    this.onExport = onExport;
    this.onDownloadExport = onDownloadExport;
    this.onRetryExportFormat = onRetryExportFormat;

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
            contentDiv.innerHTML = `${renderMarkdown(reasoning)}${text ? "" : '<span class="cursor reasoning-cursor">▋</span>'}`;
          }
        } else {
          reasoningBlock = reasoningDetails({
            reasoning,
            live: true,
            hasAnswerText: Boolean(text),
          });
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
    statusPhrase = "",
    exportSessions = [],
  }) {
    clear(this.streamInner);

    if (!messages.length && !generating && !searching && !imageGenerating && !exportSessions.length) {
      this.streamInner.append(emptyStreamView({ incognito }));
      return;
    }

    // Map export sessions by target message id
    const exportMap = new Map();
    const standaloneExports = [];
    for (const session of exportSessions) {
      if (session.targetMessageId) {
        if (!exportMap.has(session.targetMessageId)) exportMap.set(session.targetMessageId, []);
        exportMap.get(session.targetMessageId).push(session);
      } else {
        standaloneExports.push(session);
      }
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
          onExport: m.role === "assistant" ? this.onExport : undefined,
          entering: enteringId != null && m.id === enteringId,
        })
      );

      // If there are export sessions attached to this assistant message, render them directly after
      if (exportMap.has(m.id)) {
        for (const session of exportMap.get(m.id)) {
          this.streamInner.append(
            exportCardNode({
              exportSession: session,
              onDownload: this.onDownloadExport,
              onRetryFormat: this.onRetryExportFormat,
            })
          );
        }
      }
    }

    // Standalone export sessions (e.g. without specific message id or at the bottom)
    for (const session of standaloneExports) {
      this.streamInner.append(
        exportCardNode({
          exportSession: session,
          onDownload: this.onDownloadExport,
          onRetryFormat: this.onRetryExportFormat,
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
