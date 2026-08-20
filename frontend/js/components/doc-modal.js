/**
 * Full-screen / popup Document Viewer Modal for Bimo.
 * Renders formatted document content with download dropdown, copy action, and full reader view.
 */

import { el } from "../utils.js?v=20";
import { icon, formatDocIcon } from "../icons.js?v=48";
import { renderMarkdown } from "./markdown.js?v=20";
import { toast } from "./toast.js?v=20";

export function openDocViewerModal({
  title,
  content,
  onDownloadFormat,
}) {
  const cleanTitle = (title || "Bimo AI Document").trim();

  // Create Backdrop & Dialog
  const backdrop = el("div", { class: "doc-modal-backdrop", role: "dialog", "aria-modal": "true", "aria-label": cleanTitle });

  // Header Left: Icon + Title + Meta
  const docIcon = el("div", {
    class: "doc-modal-icon",
    html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
  });

  const headerInfo = el("div", { class: "doc-modal-header-info" }, [
    el("h2", { class: "doc-modal-title", text: cleanTitle }),
    el("div", { class: "doc-modal-meta", text: "AI-generated document · Markdown source · Ready to export" }),
  ]);

  const headerLeft = el("div", { class: "doc-modal-header-left" }, [docIcon, headerInfo]);

  // Copy Action
  const copyBtn = el("button", {
    type: "button",
    class: "doc-modal-action-btn",
    title: "Copy document markdown",
    "aria-label": "Copy document",
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(content);
        toast("Copied to clipboard", { tone: "success" });
      } catch {
        toast("Failed to copy", { tone: "error" });
      }
    },
  }, [
    el("span", { html: icon("copy", { width: 15, height: 15 }) }),
    el("span", { text: "Copy" }),
  ]);

  // Download Dropdown Action
  const dlMenu = el("div", { class: "doc-modal-dl-menu", role: "menu" }, [
    el("button", {
      type: "button",
      class: "doc-modal-dl-item",
      onclick: (e) => {
        e.stopPropagation();
        dlMenu.classList.remove("open");
        onDownloadFormat?.("md");
      },
    }, [
      el("span", { class: "doc-fmt-icon", html: formatDocIcon("md", { width: 17, height: 21 }) }),
      el("span", { class: "doc-fmt-name", text: "Markdown" }),
    ]),
    el("button", {
      type: "button",
      class: "doc-modal-dl-item",
      onclick: (e) => {
        e.stopPropagation();
        dlMenu.classList.remove("open");
        onDownloadFormat?.("pdf");
      },
    }, [
      el("span", { class: "doc-fmt-icon", html: formatDocIcon("pdf", { width: 17, height: 21 }) }),
      el("span", { class: "doc-fmt-name", text: "PDF" }),
    ]),
    el("button", {
      type: "button",
      class: "doc-modal-dl-item",
      onclick: (e) => {
        e.stopPropagation();
        dlMenu.classList.remove("open");
        onDownloadFormat?.("docx");
      },
    }, [
      el("span", { class: "doc-fmt-icon", html: formatDocIcon("docx", { width: 17, height: 21 }) }),
      el("span", { class: "doc-fmt-name", text: "DOCX" }),
    ]),
  ]);


  const dlWrap = el("div", { class: "doc-modal-dl-wrap" }, [
    el("button", {
      type: "button",
      class: "doc-modal-action-btn primary",
      title: "Download document",
      "aria-label": "Download formats",
      onclick: (e) => {
        e.stopPropagation();
        dlMenu.classList.toggle("open");
      },
    }, [
      el("span", { html: icon("download", { width: 15, height: 15 }) }),
      el("span", { text: "Download" }),
      el("span", { class: "arrow-icon", html: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>` }),
    ]),
    dlMenu,
  ]);

  // Close Action
  const closeBtn = el("button", {
    type: "button",
    class: "doc-modal-close-btn",
    title: "Close (Esc)",
    "aria-label": "Close",
    onclick: () => close(),
  }, [
    el("span", { html: icon("x", { width: 18, height: 18 }) }),
  ]);

  const headerRight = el("div", { class: "doc-modal-header-right" }, [copyBtn, dlWrap, closeBtn]);

  const header = el("div", { class: "doc-modal-header" }, [headerLeft, headerRight]);

  // Modal Paper / Body
  const paper = el("div", { class: "doc-modal-paper" });
  paper.innerHTML = renderMarkdown(content);

  const body = el("div", { class: "doc-modal-body" }, [paper]);

  const dialog = el("div", { class: "doc-modal-dialog" }, [header, body]);
  backdrop.append(dialog);

  function close() {
    backdrop.classList.add("closing");
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("click", onDocClick);
    setTimeout(() => {
      backdrop.remove();
    }, 180);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      close();
    }
  }

  function onDocClick(e) {
    if (e.target === backdrop) {
      close();
    } else if (!dlWrap.contains(e.target)) {
      dlMenu.classList.remove("open");
    }
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("click", onDocClick);

  document.body.appendChild(backdrop);
  setTimeout(() => backdrop.classList.add("visible"), 10);

  return { close };
}
