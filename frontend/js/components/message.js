import { el } from "../utils.js?v=30";
import { icon } from "../icons.js?v=30";
import { avatar } from "./avatar.js?v=30";
import { renderMarkdown } from "./markdown.js?v=30";
import { openImageModal } from "./image-modal.js?v=30";

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
  entering = false,
}) {
  const isAssistant = message.role === "assistant";


  let quizNode = null;
  if (isAssistant && message.quizData && onRenderQuiz) {
    quizNode = onRenderQuiz(message);
  }

  // Assistant replies render through marked + highlight.js for rich markdown +
  // code highlighting. User messages stay plain text (their content is not
  // trusted markdown).
  // A generated-image turn carries a short caption ("Here's your image.") above
  // the image; tag its bubble so the background only hugs the text instead of
  // stretching the full column width.
  const hasImageAttachment = Array.isArray(message.attachments)
    && message.attachments.some((a) => (a.content_type || "").startsWith("image/"));

  let reasoningNode = null;
  let bubbleContent = null;
  if (isAssistant) {
    if (message.reasoning && message.reasoning.trim()) {
      // Show the captured "thought for Ns" when we have it (live turns carry
      // reasoning_seconds); otherwise no timer text. NOT a `.reasoning-timer`
      // span — that class is driven live by the chat page and must never be
      // attached to a finished message, or a new turn's timer overwrites it.
      const dur = message.reasoning_seconds != null ? `· ${message.reasoning_seconds}s` : "";
      reasoningNode = reasoningDetails({
        reasoning: message.reasoning,
        durationText: dur,
      });
    }
    if (message.content) {
      bubbleContent = el("div", { class: `bubble markdown-body${hasImageAttachment ? " caption" : ""}`, html: renderMarkdown(message.content || "") });
    }
  } else {
    bubbleContent = el("div", { class: "bubble", text: message.content });
  }

  const bubble = bubbleContent;

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
  if (bubble) bodyChildren.push(bubble);
  if (quizNode) bodyChildren.push(quizNode);

  // Long user prompts collapse behind a "Show more" toggle (assistant replies
  // always render in full).
  if (!isAssistant && bubble && (message.content || "").length > 260) {
    bubble.classList.add("clamped");
    const showMore = el("button", {
      type: "button", class: "show-more", text: "Show more",
      onclick: () => {
        const collapsed = bubble.classList.toggle("clamped");
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
