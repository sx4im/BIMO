import { el, clear } from "../utils.js?v=30";
import { thoughtOrb } from "./orb.js?v=3";
import { searchCard } from "./search-card.js?v=3";
import { icon, formatDocIcon } from "../icons.js?v=30";
import { avatar } from "./avatar.js?v=30";
import { renderMarkdown } from "./markdown.js?v=33";
import { openImageModal } from "./image-modal.js?v=30";

function stripExportDisclaimers(text) {
  if (!text) return "";
  return text
    // 1. Strip leading disclaimers like "I cannot generate or send actual .doc files..." or "Here is the content ready to copy..."
    .replace(/^(?:I\s+(?:cannot|can't)\s+(?:generate|export|create|provide|produce|download|send)\s+(?:a\s+)?(?:actual\s+)?(?:downloadable\s+)?(?:\.?(?:pdf|word|docx|doc|file|document))[^\n.]*\.(?:\s*However[^\n.]*\.)?|While\s+I\s+(?:cannot|can't)\s+(?:generate|export|create|provide|produce)[^\n.]*\.(?:\s*you\s+can[^\n.]*\.)?|Here(?:\s+is|\s+'s)\s+(?:a|the)?\s*(?:complete|ats-friendly)?\s*(?:ai|professional)?\s*(?:resume|document|template|content)[^\n:]*:\s*\n*)/gi, "")
    // 2. Strip trailing guide / instructions like "To create your .doc file: \n 1. Select all text..." and "Need adjustments? Tell me..."
    .replace(/(?:\n+---\s*\n+|\n+)\*{0,2}To\s+create\s+your\s+\.?doc(?:\s+file)?:\*{0,2}[\s\S]*$/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const LIST_OR_QUOTE_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)]|>|\|)\s*/;

function findTopLevelDocumentH1(text) {
  const lines = text.split("\n");
  let inCode = false;
  let fenceChar = "";
  let fenceLen = 0;
  let introParagraphs = 0;
  let inParagraph = false;
  let introLineCount = 0;
  let introCharCount = 0;
  let h1Heading = null;
  let h1Index = -1;
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check code fences
    const fenceMatch = line.match(FENCE_RE);
    if (!inCode && fenceMatch) {
      // Code fence before any H1 means this is code/technical explanation, not a standalone doc intro
      return null;
    }
    if (inCode && fenceMatch) {
      if (fenceMatch[1][0] === fenceChar && fenceMatch[1].length >= fenceLen) {
        inCode = false;
        fenceChar = "";
        fenceLen = 0;
      }
      offset += line.length + 1;
      continue;
    }
    if (inCode) {
      offset += line.length + 1;
      continue;
    }

    // Outside code: check for Markdown H1 title (# Title, not ## or ###)
    const h1Match = line.match(/^ {0,3}#\s+([^\n]+)/);
    if (h1Match) {
      // H1 title must be at document start: at most a single brief intro (<= 2 lines, <= 120 chars)
      if (introParagraphs > 1 || introLineCount > 2 || introCharCount > 120) {
        return null;
      }
      h1Heading = h1Match[1].replace(/[*_`#\r]/g, "").trim();
      h1Index = offset;
      break;
    }

    // Lower-level headings (##, ###, etc.), lists, blockquotes, or tables before H1
    // indicate a conversational answer with structure, not a document intro
    if (/^ {0,3}#{2,6}\s+/.test(line) || LIST_OR_QUOTE_RE.test(line)) {
      return null;
    }

    if (trimmedLine.length > 0) {
      introLineCount++;
      if (!inParagraph) {
        introParagraphs++;
        inParagraph = true;
      }
      introCharCount += trimmedLine.length;
      if (introParagraphs > 1 || introLineCount > 2 || introCharCount > 120) {
        return null;
      }
    } else {
      inParagraph = false;
    }

    offset += line.length + 1;
  }

  if (!h1Heading || h1Index < 0) {
    return null;
  }

  const introText = h1Index > 0 ? text.substring(0, h1Index).trim() : "";
  const docContent = text.substring(h1Index).trim();

  return {
    docTitle: h1Heading || "BMO AI Document",
    introText,
    docContent,
  };
}

export function extractDocumentArtifact(rawContent) {
  if (!rawContent || typeof rawContent !== "string") {
    return { isDoc: false, text: rawContent || "" };
  }

  const normalized = rawContent.replace(/\r\n/g, "\n");
  const cleaned = stripExportDisclaimers(normalized);
  const trimmed = cleaned.trim();

  // 1. Explicit document fence anywhere in the response: :::document ... ::: or ```document ... ```
  const fenceMatch = trimmed.match(/(?:^|\n):::document(?:\s+([^\n]+))?\n([\s\S]+?)\n:::/i)
    || trimmed.match(/(?:^|\n)```document(?:\s+([^\n]+))?\n([\s\S]+?)\n```/i);
  if (fenceMatch) {
    const matchIndex = trimmed.indexOf(fenceMatch[0]);
    const introText = matchIndex > 0 ? trimmed.substring(0, matchIndex).trim() : "";
    const title = (fenceMatch[1] || "").replace(/[*_`#]/g, "").trim() || "Document";
    const docContent = fenceMatch[2].trim();
    return {
      isDoc: true,
      introText,
      docTitle: title,
      docContent,
    };
  }

  // 2. Markdown H1 title at the start of a standalone document (line 1, or after a brief intro)
  const docH1 = findTopLevelDocumentH1(trimmed);
  if (!docH1) {
    return { isDoc: false, text: cleaned };
  }

  return {
    isDoc: true,
    introText: stripExportDisclaimers(docH1.introText),
    docTitle: docH1.docTitle || "BMO AI Document",
    docContent: docH1.docContent,
  };
}


export function docArtifactSkeletonCard(statusText = "Formatting and preparing document…") {
  const docIcon = el("div", {
    class: "doc-card-icon",
    html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
  });

  const titleShimmer = el("div", { class: "doc-card-skeleton-title" });
  const headerLeft = el("div", { class: "doc-card-header-left" }, [docIcon, titleShimmer]);

  const dlPlaceholder = el("div", {
    class: "doc-card-act-btn placeholder",
    html: `<span class="export-spinner sm"></span>`,
  });
  const headerRight = el("div", { class: "doc-card-header-right" }, [dlPlaceholder]);
  const header = el("div", { class: "doc-card-header" }, [headerLeft, headerRight]);

  const skeletonLines = el("div", { class: "doc-card-skeleton-body" }, [
    el("div", { class: "skeleton-line heading" }),
    el("div", { class: "skeleton-line sub" }),
    el("div", { class: "skeleton-line full" }),
    el("div", { class: "skeleton-line full" }),
    el("div", { class: "skeleton-line medium" }),
    el("div", { class: "skeleton-line short" }),
    el("div", { class: "skeleton-line full" }),
  ]);

  const fade = el("div", { class: "doc-card-fade" }, [
    el("span", { class: "doc-card-expand-hint", text: statusText }),
  ]);

  return el("div", { class: "doc-artifact-card skeleton" }, [header, skeletonLines, fade]);
}



export function docArtifactCard({
  title,
  markdown,
  onOpenDoc,
  onExportFormat,
}) {
  const cleanTitle = (title || "BMO AI Document").trim();

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

  const headerRight = el("div", { class: "doc-card-header-right" }, [dlWrap]);

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

export function reasoningDetails({ reasoning, durationText = "", live = false, hasAnswerText = false, open = false }) {
  const mark = el("span", { class: live ? "icon-pulse orb-slot" : "orb-slot" });
  // Composing orb replaces the brain glyph — animated while reasoning is
  // streaming in, frozen on its current frame once the turn completes.
  const orb = thoughtOrb(14);
  if (!live) orb.setAttribute("paused", "");
  mark.append(orb);
  const timer = el("span", {
    class: live ? "reasoning-timer" : "reasoning-duration",
    text: durationText,
  });
  const summary = el("summary", {}, [mark, " Thought Process ", timer]);
  const content = el("div", {
    class: "reasoning-content markdown-body",
    html: reasoning ? renderMarkdown(reasoning) : "",
  });
  if (reasoning) {
    content.dataset.src = content.innerHTML;
  }
  const block = el("details", { class: "reasoning-block", open: open ? "" : null }, [summary, content]);
  return block;
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
        // Manual by design: collapsed until the user clicks the summary.
        // (open defaults to false in reasoningDetails.)
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

  // Assistant replies get feedback (thumbs up/down) + regenerate.
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

    if (onRetryAssistant) {
      actionButtons.push(actBtn("refresh", "Retry", () => onRetryAssistant(message)));
    }
  }



  const bodyChildren = [];
  // The search that produced this answer, kept above it. Set on the live turn
  // only — replies loaded from history have no search to show.
  if (isAssistant && message.search) bodyChildren.push(searchCard(message.search));
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
