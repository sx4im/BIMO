import { el } from "../utils.js?v=30";
import { icon, formatDocIcon } from "../icons.js?v=30";
import { avatar } from "./avatar.js?v=30";
import { renderMarkdown } from "./markdown.js?v=30";
import { openImageModal } from "./image-modal.js?v=30";

function stripExportDisclaimers(text) {
  if (!text) return "";
  return text
    .replace(/(?:I\s+(?:cannot|can't)\s+(?:generate|export|create|provide|produce|download)\s+(?:a\s+)?(?:downloadable\s+)?(?:PDF|Word|DOCX|file|document)[^\n.]*\.(?:\s*However[^\n.]*\.)?|While\s+I\s+(?:cannot|can't)\s+(?:generate|export|create|provide|produce)[^\n.]*\.(?:\s*you\s+can[^\n.]*\.)?)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractDocumentArtifact(rawContent) {
  if (!rawContent || typeof rawContent !== "string") {
    return { isDoc: false, text: rawContent || "" };
  }

  const cleaned = stripExportDisclaimers(rawContent);
  const trimmed = cleaned.trim();

  // Look for structured document headers (H1 title or multiple sections)
  const h1Match = trimmed.match(/^(?:[\s\S]*?\n)?#\s+([^\n]+)/);
  const headings = trimmed.match(/#{1,3}\s+[^\n]+/g) || [];
  const hasMultipleSections = headings.length >= 2;
  const isStructuredDoc = Boolean(h1Match || (hasMultipleSections && trimmed.length > 200));

  if (!isStructuredDoc) {
    return { isDoc: false, text: cleaned };
  }

  if (h1Match) {
    const h1Index = trimmed.indexOf(h1Match[0]);
    const introText = h1Index > 0 ? stripExportDisclaimers(trimmed.substring(0, h1Index)) : "";
    const docContent = trimmed.substring(h1Index).trim();
    const title = h1Match[1].replace(/[*_`#]/g, "").trim();

    return {
      isDoc: true,
      introText,
      docTitle: title || "Bimo AI Document",
      docContent,
    };
  }

  const firstHeading = trimmed.match(/^##?\s+([^\n]+)/m);
  const title = firstHeading ? firstHeading[1].replace(/[*_`#]/g, "").trim() : "Bimo AI Document";

  return {
    isDoc: true,
    introText: "",
    docTitle: title,
    docContent: trimmed,
  };
}


export function docArtifactCard({
  title,
  markdown,
  onOpenDoc,
  onExportFormat,
}) {
  const cleanTitle = (title || "Bimo AI Document").trim();

  const docIcon = el("div", {
    class: "doc-card-icon",
    html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
  });

  const titleEl = el("span", { class: "doc-card-title-text", text: cleanTitle });

  const headerLeft = el("div", { class: "doc-card-header-left" }, [docIcon, titleEl]);

  // Download menu with colored document icons matching Manus
  const dlMenu = el("div", { class: "doc-card-dl-menu", role: "menu" }, [
    el("button", {
      type: "button",
      class: "doc-card-dl-item",
      onclick: (e) => {
        e.stopPropagation();
        dlMenu.classList.remove("open");
        onExportFormat?.("md");
      },
    }, [
      el("span", { class: "doc-fmt-icon", html: formatDocIcon("md", { width: 17, height: 21 }) }),
      el("span", { class: "doc-fmt-name", text: "Markdown" }),
    ]),
    el("button", {
      type: "button",
      class: "doc-card-dl-item",
      onclick: (e) => {
        e.stopPropagation();
        dlMenu.classList.remove("open");
        onExportFormat?.("pdf");
      },
    }, [
      el("span", { class: "doc-fmt-icon", html: formatDocIcon("pdf", { width: 17, height: 21 }) }),
      el("span", { class: "doc-fmt-name", text: "PDF" }),
    ]),
    el("button", {
      type: "button",
      class: "doc-card-dl-item",
      onclick: (e) => {
        e.stopPropagation();
        dlMenu.classList.remove("open");
        onExportFormat?.("docx");
      },
    }, [
      el("span", { class: "doc-fmt-icon", html: formatDocIcon("docx", { width: 17, height: 21 }) }),
      el("span", { class: "doc-fmt-name", text: "DOCX" }),
    ]),
  ]);


  const dlBtn = el("button", {
    type: "button",
    class: "doc-card-act-btn",
    title: "Download formats",
    "aria-label": "Download",
    onclick: (e) => {
      e.stopPropagation();
      dlMenu.classList.toggle("open");
      if (dlMenu.classList.contains("open")) {
        const closeMenu = (evt) => {
          if (!dlBtn.contains(evt.target)) {
            dlMenu.classList.remove("open");
            document.removeEventListener("click", closeMenu);
          }
        };
        setTimeout(() => document.addEventListener("click", closeMenu), 0);
      }
    },
    html: icon("download", { width: 14, height: 14 }),
  });

  const dlWrap = el("div", { class: "doc-card-dl-wrap" }, [dlBtn, dlMenu]);

  // More dots menu
  const moreBtn = el("button", {
    type: "button",
    class: "doc-card-act-btn",
    title: "Open full document view",
    "aria-label": "Open document",
    onclick: (e) => {
      e.stopPropagation();
      onOpenDoc?.({ title: cleanTitle, content: markdown });
    },
    html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
  });

  const headerRight = el("div", { class: "doc-card-header-right" }, [dlWrap, moreBtn]);

  const header = el("div", { class: "doc-card-header" }, [headerLeft, headerRight]);

  const preview = el("div", { class: "doc-card-preview-content markdown-body" });
  preview.innerHTML = renderMarkdown(markdown);

  const fade = el("div", { class: "doc-card-fade" }, [
    el("span", { class: "doc-card-expand-hint", text: "Click to open full document view" }),
  ]);

  const card = el("div", {
    class: "doc-artifact-card",
    role: "button",
    tabindex: "0",
    "aria-label": `Open document ${cleanTitle}`,
    onclick: (e) => {
      if (e.target.closest(".doc-card-header-right")) return;
      onOpenDoc?.({ title: cleanTitle, content: markdown });
    },
    onkeydown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpenDoc?.({ title: cleanTitle, content: markdown });
      }
    },
  }, [header, preview, fade]);


  return card;
}

export function reasoningDetails({ reasoning, durationText = "", live = false, hasAnswerText = false }) {
  const mark = el("span", {
    class: live ? "icon-pulse" : "",
    html: icon("brain", { width: 14, height: 14 }),
  });
  const timer = el("span", {
    class: live ? "reasoning-timer" : "reasoning-duration",
    text: durationText,
  });
  const summary = el("summary", {}, [mark, " Thought Process ", timer]);
  const html = `${renderMarkdown(reasoning)}${live && !hasAnswerText ? '<span class="cursor reasoning-cursor">▋</span>' : ""}`;
  const content = el("div", { class: "reasoning-content markdown-body", html });
  return el("details", { class: "reasoning-block" }, [summary, content]);
}

// Recent messages show a 12-hour clock time ("9:57 AM"); anything older than a
// day shows the date instead. Revealed on hover in the action row.
function formatStamp(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  if (Date.now() - d.getTime() >= 86_400_000) {
    const opts = d.getFullYear() === new Date().getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
    return d.toLocaleDateString([], opts);
  }
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function messageBubble({
  message,
  userName,
  userAvatarUrl,
  onEdit,
  onRetry,
  onFeedback,
  onRetryAssistant,
  onRenderQuiz,
  onExport,
  onOpenDoc,
  entering = false,
}) {
  const isAssistant = message.role === "assistant";

  let quizNode = null;
  if (isAssistant && message.quizData && onRenderQuiz) {
    quizNode = onRenderQuiz(message);
  }

  const hasImageAttachment = Array.isArray(message.attachments)
    && message.attachments.some((a) => (a.content_type || "").startsWith("image/"));

  let reasoningNode = null;
  let bubbleNodes = [];

  if (isAssistant) {
    if (message.reasoning && message.reasoning.trim()) {
      const dur = message.reasoning_seconds != null ? `· ${message.reasoning_seconds}s` : "";
      reasoningNode = reasoningDetails({
        reasoning: message.reasoning,
        durationText: dur,
      });
    }

    if (message.content) {
      const docArtifact = extractDocumentArtifact(message.content);
      if (docArtifact.isDoc) {
        if (docArtifact.introText) {
          bubbleNodes.push(el("div", {
            class: `bubble markdown-body${hasImageAttachment ? " caption" : ""}`,
            html: renderMarkdown(docArtifact.introText),
          }));
        }
        bubbleNodes.push(
          docArtifactCard({
            title: docArtifact.docTitle,
            markdown: docArtifact.docContent,
            onOpenDoc,
            onExportFormat: (fmt) => onExport?.({ message, format: fmt, title: docArtifact.docTitle, content: docArtifact.docContent }),
          })
        );
      } else {
        bubbleNodes.push(el("div", {
          class: `bubble markdown-body${hasImageAttachment ? " caption" : ""}`,
          html: renderMarkdown(message.content || ""),
        }));
      }
    }
  } else {
    bubbleNodes.push(el("div", { class: "bubble", text: message.content }));
  }


  // Attachments preview. User messages show the files they sent; assistant
  // messages show generated images (Iris). Image URLs are signed and may
  // expire, so fall back gracefully on load failure.
  let attachmentsPreview = null;
  if (Array.isArray(message.attachments) && message.attachments.length) {
    attachmentsPreview = el("div", { class: `message-attachments${isAssistant ? " generated" : ""}` });
    for (const a of message.attachments) {
      const isImage = (a.content_type || "").startsWith("image/");
      if (isImage && a.url) {
        const img = el("img", {
          src: a.url,
          alt: a.filename || "image",
          loading: "lazy",
          title: "Click to view",
          style: "cursor: zoom-in;",
          onclick: () => openImageModal(a.url, a.filename),
        });
        img.addEventListener("error", () => {
          img.style.opacity = "0.35";
          img.style.cursor = "default";
          img.onclick = null;
          img.title = "Image link expired";
        });
        if (isAssistant) {
          // Generated image: larger, with a download action beneath it.
          const dl = el("a", {
            class: "generated-download",
            href: a.url,
            download: a.filename || "bimo-image.png",
            target: "_blank",
            rel: "noopener noreferrer",
            html: `${icon("download", { width: 13, height: 13 })} <span>Download</span>`,
          });
          attachmentsPreview.append(el("figure", { class: "generated-image" }, [img, dl]));
        } else {
          attachmentsPreview.append(img);
        }
      } else if (a.filename && !isAssistant) {
        attachmentsPreview.append(el("span", { class: "file-chip", text: a.filename }));
      }
    }
  }

  // Icon-only action controls (no text labels). Retry + Edit are user-only.
  const ICON = 15;
  const actBtn = (name, title, onclick, { active = false } = {}) =>
    el("button", {
      type: "button",
      class: `msg-act${active ? " active" : ""}`,
      title,
      "aria-label": title,
      "aria-pressed": active ? "true" : "false",
      onclick,
      html: icon(name, { width: ICON, height: ICON }),
    });

  const copyBtn = actBtn("copy", "Copy", async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      copyBtn.innerHTML = icon("check", { width: ICON, height: ICON });
      setTimeout(() => { copyBtn.innerHTML = icon("copy", { width: ICON, height: ICON }); }, 1400);
    } catch { /* ignore */ }
  });

  // Timestamp shows under user prompts only (hover-revealed), then the icons.
  const actionButtons = [];
  if (!isAssistant) actionButtons.push(el("span", { class: "msg-time", text: formatStamp(message.created_at) }));
  if (!isAssistant && onRetry) actionButtons.push(actBtn("refresh", "Retry", () => onRetry(message)));
  if (!isAssistant && onEdit)  actionButtons.push(actBtn("pencil", "Edit", () => onEdit(message)));
  if (message.content) actionButtons.push(copyBtn);

  // Assistant replies get feedback (thumbs up/down) + export menu + regenerate.
  if (isAssistant) {
    const fb = message.feedback;
    const thumbUpActive = !!fb && fb.rating >= 4;
    const thumbDownActive = !!fb && fb.rating <= 2;
    if (onFeedback && message.content) {
      actionButtons.push(
        actBtn("thumbsUp", "Good response", () => onFeedback(message, "up"), { active: thumbUpActive }),
        actBtn("thumbsDown", "Bad response", () => onFeedback(message, "down"), { active: thumbDownActive }),
      );
    }

    if (onExport && message.content) {
      const exportBtn = actBtn("download", "Export response", (e) => {
        e.stopPropagation();
        const wrap = exportBtn.closest(".msg-export-wrap");
        const menu = wrap?.querySelector(".msg-export-menu");
        if (!menu) return;
        const isOpen = menu.classList.toggle("open");
        exportBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        if (isOpen) {
          const onOutsideClick = (evt) => {
            if (!wrap.contains(evt.target)) {
              menu.classList.remove("open");
              exportBtn.setAttribute("aria-expanded", "false");
              document.removeEventListener("click", onOutsideClick);
              document.removeEventListener("keydown", onKey);
            }
          };
          const onKey = (evt) => {
            if (evt.key === "Escape") {
              menu.classList.remove("open");
              exportBtn.setAttribute("aria-expanded", "false");
              exportBtn.focus();
              document.removeEventListener("click", onOutsideClick);
              document.removeEventListener("keydown", onKey);
            }
          };
          setTimeout(() => {
            document.addEventListener("click", onOutsideClick);
            document.addEventListener("keydown", onKey);
          }, 0);
        }
      });
      exportBtn.setAttribute("aria-haspopup", "true");
      exportBtn.setAttribute("aria-expanded", "false");

      const exportOptions = [
        { id: "all", label: "Export all formats", ext: ".md · .pdf · .docx", iconName: "download" },
        { id: "pdf", label: "PDF document", ext: ".pdf", badge: "PDF" },
        { id: "docx", label: "Word document", ext: ".docx", badge: "DOCX" },
        { id: "md", label: "Markdown source", ext: ".md", badge: "MD" },
      ];

      const menuItems = exportOptions.map((opt) =>
        el("button", {
          type: "button",
          class: "msg-export-item",
          onclick: (e) => {
            e.stopPropagation();
            const wrap = exportBtn.closest(".msg-export-wrap");
            const menu = wrap?.querySelector(".msg-export-menu");
            if (menu) menu.classList.remove("open");
            exportBtn.setAttribute("aria-expanded", "false");
            onExport({ message, format: opt.id });
          },
        }, [
          opt.badge
            ? el("span", { class: "export-item-badge", text: opt.badge })
            : el("span", { class: "menu-lead", html: icon(opt.iconName || "download", { width: 14, height: 14 }) }),
          el("div", { class: "menu-text" }, [
            el("span", { class: "menu-title", text: opt.label }),
            el("span", { class: "menu-sub", text: opt.ext }),
          ]),
        ])
      );

      const exportMenu = el("div", { class: "msg-export-menu", role: "menu" }, menuItems);
      const exportWrap = el("div", { class: "msg-export-wrap" }, [exportBtn, exportMenu]);
      actionButtons.push(exportWrap);
    }

    if (onRetryAssistant) {
      actionButtons.push(actBtn("refresh", "Retry", () => onRetryAssistant(message)));
    }
  }


  const bodyChildren = [];
  if (reasoningNode) bodyChildren.push(reasoningNode);
  if (bubbleNodes.length) bodyChildren.push(...bubbleNodes);
  if (quizNode) bodyChildren.push(quizNode);

  // Long user prompts collapse behind a "Show more" toggle (assistant replies
  // always render in full).
  if (!isAssistant && bubbleNodes[0] && (message.content || "").length > 260) {
    bubbleNodes[0].classList.add("clamped");
    const showMore = el("button", {
      type: "button", class: "show-more", text: "Show more",
      onclick: () => {
        const collapsed = bubbleNodes[0].classList.toggle("clamped");
        showMore.textContent = collapsed ? "Show more" : "Show less";
      },
    });
    bodyChildren.push(showMore);
  }

  if (attachmentsPreview) bodyChildren.push(attachmentsPreview);
  if (actionButtons.length) bodyChildren.push(el("div", { class: "actions" }, actionButtons));

  const body = el("div", { class: "body" }, bodyChildren);

  return el("article", {
    class: `message ${isAssistant ? "assistant" : "user"}${entering ? " entering" : ""}`,
  }, [body]);
}
