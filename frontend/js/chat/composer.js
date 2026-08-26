/**
 * Composer component for Bimo chat.
 * Controls prompt textarea, file attachments, model/tools dropdowns,
 * voice recording bar, and submit/stop state.
 */

import { el, clear } from "../utils.js?v=20";
import { icon } from "../icons.js?v=48";
import { toast } from "../components/toast.js?v=57";
import { openImageModal } from "../components/image-modal.js?v=18";
import { blobToWav16kMono } from "../audio-wav.js?v=30";
import * as api from "../api.js?v=56";

export const REASONING_EFFORT_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
];

export const DEFAULT_AVAILABLE_MODELS = [
  { id: "thinking", label: "Stanza 2.5", description: "All-round help" },
  { id: "deep", label: "Nexos 3.0", description: "Deep reasoning", note: "This may take longer than usual." },
  { id: "image", label: "Iris 1.0", description: "Image generation", kind: "image" },
];

export function greetingPlaceholder() {
  const h = new Date().getHours();
  // Short, human, Claude-ish greetings — picked at random per time bucket.
  // No dashes anywhere: they read as clutter in a placeholder.
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  if (h >= 5 && h < 12) {
    return pick([
      "Coffee's on. What are we building?",
      "Morning! What's on your mind?",
      "Fresh day. What do you need?",
    ]);
  }
  if (h >= 12 && h < 17) {
    return pick([
      "Afternoon! What are we working on?",
      "Good afternoon. What do you need?",
      "Middle of the day, ask away.",
    ]);
  }
  if (h >= 17 && h < 21) {
    return pick([
      "Evening! What's on deck?",
      "Good evening. What shall we dig into?",
      "Winding down or digging in?",
    ]);
  }
  return pick([
    "Hey night owl. What keeps you up?",
    "Late shift? I'm up too.",
    "Quiet hours. Perfect for solving something.",
  ]);
}

export class Composer {
  constructor({
    onSubmit,
    onStop,
    onOpenVoiceAssistant,
    onModelChange,
    onToolsChange,
    getAuthToken,
  }) {
    this.onSubmit = onSubmit;
    this.onStop = onStop;
    this.onOpenVoiceAssistant = onOpenVoiceAssistant;
    this.onModelChange = onModelChange;
    this.onToolsChange = onToolsChange;
    this.getAuthToken = getAuthToken;

    this.pendingAttachments = [];
    this.uploadingFiles = [];
    this.availableModels = DEFAULT_AVAILABLE_MODELS;
    this.currentModel = "thinking";
    this.defaultModel = "thinking";
    this.reasoningEffort = localStorage.getItem("bimo-reasoning-effort") || "medium";
    this.searchEnabled = false;
    this.studyMode = false;
    this.isGenerating = false;
    this.isImageGenerating = false;
    this.isStudyGenerating = false;
    this.isRecording = false;


    // Menus open state
    this.modelDropdownOpen = false;
    this.effortDropdownOpen = false;

    // Voice recording state
    this.cancelRecording = false;
    this.recordTimerId = null;
    this.recordStartedAt = 0;
    this.waveAudioCtx = null;
    this.waveAnalyser = null;
    this.waveRafId = null;
    this.mediaRecorder = null;
    this.audioChunks = [];

    this._buildDOM();
    this._attachGlobalListeners();
  }

  _buildDOM() {
    // Model badge & dropdown
    this.modelBadgeLabel = el("span", { class: "model-label", text: "Stanza 2.5" });
    this.modelDropdown = el("div", { class: "model-dropdown", role: "listbox", "aria-label": "Select model" });
    this.modelBadge = el("button", {
      type: "button",
      class: "model-badge model-badge-button",
      title: "Choose mode",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
      onclick: () => this.modelDropdownOpen ? this.closeModelDropdown() : this.openModelDropdown(),
    }, [
      this.modelBadgeLabel,
      el("span", { class: "caret", html: icon("chevronDown", { width: 14, height: 14 }) }),
    ]);
    this.modelBadgeWrap = el("div", { class: "model-badge-wrap" }, [this.modelBadge]);

    // Effort badge & dropdown
    this.effortBadgeLabel = el("span", { class: "effort-label", text: REASONING_EFFORT_OPTIONS.find((o) => o.value === this.reasoningEffort)?.label || "Medium" });
    this.effortDropdown = el("div", { class: "effort-dropdown", role: "listbox", "aria-label": "Select reasoning effort" });
    this.effortBadge = el("button", {
      type: "button",
      class: "effort-badge",
      title: "Reasoning effort",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
      onclick: () => this.effortDropdownOpen ? this.closeEffortDropdown() : this.openEffortDropdown(),
    }, [
      this.effortBadgeLabel,
      el("span", { class: "caret", html: icon("chevronDown", { width: 12, height: 12 }) }),
    ]);
    this.effortBadgeWrap = el("div", { class: "effort-badge-wrap", style: "display:none" }, [this.effortBadge]);

    // Attachments & file inputs
    this.attachmentsBar = el("div", { class: "composer-attachments" });
    this.imageInput = el("input", {
      type: "file",
      accept: "image/*",
      multiple: true,
      style: "display:none",
      onchange: async (e) => {
        let files = [...(e.target.files || [])];
        e.target.value = "";
        if (files.length > 3) {
          toast("Max 3 images", { tone: "error" });
          files = files.slice(0, 3);
        }
        for (const file of files) await this.uploadAndAttach(file);
      },
    });

    this.documentInput = el("input", {
      type: "file",
      accept: ".pdf,.docx,.zip,.pptx,.xlsx",
      multiple: true,
      style: "display:none",
      onchange: async (e) => {
        let files = [...(e.target.files || [])];
        e.target.value = "";
        if (files.length > 3) {
          toast("Max 3 files", { tone: "error" });
          files = files.slice(0, 3);
        }
        for (const file of files) await this.uploadAndAttach(file);
      },
    });

    this.cameraInput = el("input", {
      type: "file",
      accept: "image/*",
      capture: "environment",
      style: "display:none",
      onchange: async (e) => {
        const files = [...(e.target.files || [])];
        e.target.value = "";
        for (const file of files) await this.uploadAndAttach(file);
      },
    });

    // Attachment menu (+)
    const ATTACH_ITEMS = [
      { ic: "image", label: "Image", desc: "Upload a photo or picture", open: () => this.imageInput.click() },
      { ic: "fileText", label: "File", desc: "PDF, .docx, .xlsx, .pptx, .zip", open: () => this.documentInput.click() },
      { ic: "camera", label: "Camera", desc: "Take a photo to attach", open: () => this.cameraInput.click() },
    ];
    this.attachmentMenu = el("div", { class: "attachment-menu", role: "menu" },
      ATTACH_ITEMS.map((it) =>
        el("button", {
          type: "button",
          class: "attachment-menu-item",
          role: "menuitem",
          onclick: () => { it.open(); this.toggleAttachMenu(false); },
        }, [
          el("span", { class: "menu-lead", html: icon(it.ic, { width: 18, height: 18 }) }),
          el("span", { class: "menu-text" }, [
            el("span", { class: "menu-title", text: it.label }),
            el("span", { class: "menu-sub", text: it.desc }),
          ]),
        ])
      )
    );
    this.attachBtn = el("button", {
      type: "button",
      class: "composer-attach",
      title: "Attach file",
      "aria-label": "Attach file",
      onclick: () => this.toggleAttachMenu(),
      html: icon("plus", { width: 16, height: 16 }),
    });
    this.attachWrap = el("div", { class: "composer-attach-wrap" }, [this.attachBtn, this.attachmentMenu]);

    // Tools menu (sliders)
    this.toolsMenu = el("div", { class: "tools-menu", role: "menu" });
    this.toolsBtn = el("button", {
      type: "button",
      class: "composer-tools-btn",
      title: "Tools",
      "aria-label": "Tools",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      onclick: () => this.toggleToolsMenu(),
      html: icon("sliders", { width: 18, height: 18 }),
    });
    this.toolsWrap = el("div", { class: "composer-tools-wrap" }, [this.toolsBtn, this.toolsMenu]);

    // Voice input button & recording bar
    this.voiceBtn = el("button", {
      type: "button",
      class: "composer-voice",
      title: "Voice input",
      "aria-label": "Start voice input",
      onclick: () => this.toggleVoiceRecording(),
      html: icon("mic", { width: 18, height: 18 }),
    });

    this.recTimer = el("span", { class: "rec-timer tabular", text: "0:00" });
    this.recWave = el("div", { class: "rec-wave", "aria-hidden": "true" });
    for (let i = 0; i < 28; i++) {
      this.recWave.append(el("span"));
    }
    this.waveBars = [...this.recWave.children];

    this.recCancelBtn = el("button", {
      type: "button",
      class: "rec-cancel",
      "aria-label": "Cancel recording",
      title: "Cancel",
      onclick: () => this.discardRecording(),
      html: icon("x", { width: 18, height: 18 }),
    });

    this.recConfirmBtn = el("button", {
      type: "button",
      class: "rec-confirm",
      "aria-label": "Confirm and transcribe",
      title: "Transcribe",
      onclick: () => this.confirmRecording(),
      html: icon("check", { width: 18, height: 18 }),
    });

    this.recSpinner = el("span", { class: "rec-spinner", "aria-hidden": "true", html: icon("loader", { width: 18, height: 18 }) });

    this.recordingBar = el("div", { class: "composer-recording", "aria-hidden": "true" }, [
      this.recCancelBtn,
      el("div", { class: "rec-body" }, [this.recWave, this.recTimer]),
      this.recConfirmBtn,
    ]);

    // Textarea & Action buttons
    this.textarea = el("textarea", {
      rows: 1,
      placeholder: greetingPlaceholder(),
      "aria-label": "Message",
      oninput: (e) => { this.autoSize(e.target); this.syncSendEnabled(); },
      onkeydown: (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendBtn.click();
        }
      },
      onpaste: (e) => {
        const items = [...(e.clipboardData?.items || [])];
        const imageFiles = items
          .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
          .map((it) => it.getAsFile())
          .filter(Boolean);
        if (!imageFiles.length) return;
        e.preventDefault();
        if (imageFiles.length > 3) {
          toast("Max 3 images", { tone: "error" });
          imageFiles.splice(3);
        }
        for (const file of imageFiles) this.uploadAndAttach(file);
      },
    });

    this.sendBtn = el("button", {
      type: "submit",
      class: "send",
      "aria-label": "Send message",
      disabled: true,
      style: "display:none",
      html: icon("send", { width: 16, height: 16 }),
      onclick: (e) => {
        if (this.isGenerating) {
          e.preventDefault();
          this.onStop?.();
        }
      },
    });

    this.voiceAssistantBtn = el("button", {
      type: "button",
      class: "voice-assistant-btn",
      "aria-label": "Start voice assistant",
      title: "Voice assistant",
      html: icon("audioLines", { width: 20, height: 20 }),
      onclick: () => this.onOpenVoiceAssistant?.(),
    });

    this.composerToolbar = el("div", { class: "composer-toolbar" }, [
      el("div", { class: "composer-toolbar-left" }, [this.attachWrap, this.toolsWrap]),
      el("div", { class: "composer-toolbar-actions" }, [
        this.modelBadgeWrap,
        this.effortBadgeWrap,
        this.voiceBtn,
        this.voiceAssistantBtn,
        this.sendBtn,
      ]),
    ]);

    this.composerBox = el("div", { class: "composer-box glass" }, [this.textarea, this.composerToolbar]);

    this.composer = el("form", {
      class: "composer",
      onsubmit: async (e) => {
        e.preventDefault();
        if (this.isRecording || this.isGenerating || this.isImageGenerating || this.isStudyGenerating) return;
        const text = this.textarea.value.trim();
        if (this.isImageMode() && !text) {
          toast("Add a prompt", { tone: "error" });
          return;
        }
        if (!text && this.pendingAttachments.length === 0) return;
        this.textarea.value = "";
        this.autoSize(this.textarea);
        this.syncSendEnabled();
        this.onSubmit?.({
          text,
          attachments: this.pendingAttachments.slice(),
          model: this.currentModel,
          reasoningEffort: this.reasoningEffort,
          searchEnabled: this.searchEnabled,
          studyMode: this.studyMode,
        });
        this.pendingAttachments = [];
        this.renderAttachmentsBar();
      },
    }, [
      this.imageInput,
      this.documentInput,
      this.cameraInput,
      this.attachmentsBar,
      this.composerBox,
      this.recordingBar,
    ]);

    this.composerWrap = el("div", { class: "composer-wrap" }, [this.composer]);
  }

  get element() {
    return this.composerWrap;
  }

  get dropdownElements() {
    return [this.modelDropdown, this.effortDropdown];
  }

  isImageMode() {
    return this.currentModel === "image";
  }

  autoSize(node) {
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }

  setText(text) {
    this.textarea.value = text || "";
    this.autoSize(this.textarea);
    this.syncSendEnabled();
  }

  focus() {
    this.textarea.focus();
  }

  positionAttachMenu() {
    const rect = this.attachBtn.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(215, window.innerWidth - margin * 2);
    let left = rect.left;
    const maxLeft = window.innerWidth - width - margin;
    if (left > maxLeft) left = Math.max(margin, maxLeft);
    const isPageEmpty = document.querySelector(".chat-page.is-empty") !== null;
    this.attachmentMenu.style.position = "fixed";
    if (isPageEmpty) {
      this.attachmentMenu.style.top = `${rect.bottom + margin}px`;
      this.attachmentMenu.style.bottom = "auto";
    } else {
      this.attachmentMenu.style.bottom = `${window.innerHeight - rect.top + margin}px`;
      this.attachmentMenu.style.top = "auto";
    }
    this.attachmentMenu.style.left = `${left}px`;
    this.attachmentMenu.style.right = "auto";
    this.attachmentMenu.style.width = `${width}px`;
    this.attachmentMenu.style.minWidth = "auto";
  }

  toggleAttachMenu(show) {
    const next = show ?? !this.attachmentMenu.classList.contains("open");
    if (next) {
      this.positionAttachMenu();
    }
    this.attachmentMenu.classList.toggle("open", next);
  }

  toggleToolsMenu(show) {
    const next = show ?? !this.toolsMenu.classList.contains("open");
    if (next) {
      this.renderToolsMenu();
      this.positionToolsMenu();
    }
    this.toolsMenu.classList.toggle("open", next);
    this.toolsBtn.setAttribute("aria-expanded", next ? "true" : "false");
  }

  renderToolsMenu() {
    clear(this.toolsMenu);
    const items = [
      { kind: "search", ic: "globe", label: "Web search", desc: "Answer using live results", active: this.searchEnabled && !this.isImageMode() && !this.studyMode },
      { kind: "generate", ic: "imageSparkles", label: "Create image", desc: "Generate an image with Iris", active: this.isImageMode() && !this.studyMode },
      { kind: "study", ic: "helpStudy", label: "Learning Mode", desc: "Test yourself with quizzes", active: this.studyMode },
    ];
    for (const it of items) {
      this.toolsMenu.append(
        el("button", {
          type: "button",
          class: `tools-menu-item${it.active ? " active" : ""}`,
          role: "menuitemradio",
          "aria-checked": it.active ? "true" : "false",
          onclick: () => { this.toggleToolsMenu(false); this.applyTool(it.kind); },
        }, [
          el("span", { class: "menu-lead", html: icon(it.ic, { width: 18, height: 18 }) }),
          el("span", { class: "menu-text" }, [
            el("span", { class: "menu-title", text: it.label }),
            el("span", { class: "menu-sub", text: it.desc }),
          ]),
          it.active ? el("span", { class: "menu-check", html: icon("check", { width: 16, height: 16 }) }) : null,
        ].filter(Boolean))
      );
    }
  }

  positionToolsMenu() {
    const rect = this.toolsBtn.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(215, window.innerWidth - margin * 2);
    let left = rect.left;
    const maxLeft = window.innerWidth - width - margin;
    if (left > maxLeft) left = Math.max(margin, maxLeft);
    const isPageEmpty = document.querySelector(".chat-page.is-empty") !== null;
    this.toolsMenu.style.position = "fixed";
    if (isPageEmpty) {
      this.toolsMenu.style.top = `${rect.bottom + margin}px`;
      this.toolsMenu.style.bottom = "auto";
    } else {
      this.toolsMenu.style.bottom = `${window.innerHeight - rect.top + margin}px`;
      this.toolsMenu.style.top = "auto";
    }
    this.toolsMenu.style.left = `${left}px`;
    this.toolsMenu.style.right = "auto";
    this.toolsMenu.style.width = `${width}px`;
    this.toolsMenu.style.minWidth = "auto";
  }

  applyTool(kind) {
    if (kind === "search") {
      this.searchEnabled = !this.searchEnabled;
      if (this.searchEnabled && this.isImageMode()) {
        this.currentModel = this.defaultModel || "thinking";
      }
      if (this.searchEnabled) toast("Web search on", { tone: "success", duration: 1500 });
      if (this.searchEnabled && this.studyMode) { this.studyMode = false; }
    } else if (kind === "generate") {
      this.currentModel = "image";
      this.searchEnabled = false;
      this.studyMode = false;
      toast("Image mode on", { tone: "success", duration: 1800 });
    } else if (kind === "study") {
      this.studyMode = !this.studyMode;
      if (this.studyMode) {
        this.currentModel = "thinking";
        this.searchEnabled = false;
        toast("Study mode on", { tone: "success", duration: 1800 });
      } else {
        toast("Study mode off", { duration: 1200 });
      }
    }
    this.updateComposerForMode();
    this.renderModelBadge();
    this.renderToolsMenu();
    this.syncSendEnabled();
    this.onToolsChange?.({ searchEnabled: this.searchEnabled, studyMode: this.studyMode, model: this.currentModel });
  }

  updateComposerForMode() {
    if (this.studyMode) {
      this.textarea.placeholder = "What topic do you want to study?";
    } else if (this.isImageMode()) {
      this.textarea.placeholder = "Describe an image to create…";
    } else {
      this.textarea.placeholder = greetingPlaceholder();
    }
  }

  renderModelDropdown() {
    clear(this.modelDropdown);
    for (const m of this.availableModels) {
      const active = this.currentModel === m.id;
      const isStanza = m.id === "thinking";
      const item = el("button", {
        type: "button",
        class: `model-dropdown-item${active ? " active" : ""}`,
        role: "option",
        "aria-selected": active ? "true" : "false",
        onclick: () => this.selectModelFromDropdown(m.id),
      }, [
        el("span", { class: "menu-text" }, [
          el("span", { class: "menu-title" }, [
            el("span", { text: m.label }),
            ...(isStanza ? [el("span", { class: "model-tag-new", text: "New" })] : []),
          ]),
          m.description ? el("span", { class: "menu-sub", text: m.description }) : null,
        ].filter(Boolean)),
        (active && !isStanza) ? el("span", { class: "menu-check", html: icon("check", { width: 16, height: 16 }) }) : null,
      ].filter(Boolean));
      this.modelDropdown.append(item);
    }
  }

  positionModelDropdown() {
    const rect = this.modelBadge.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(215, window.innerWidth - margin * 2);
    let left = rect.left;
    const maxLeft = window.innerWidth - width - margin;
    if (left > maxLeft) left = Math.max(margin, maxLeft);
    const isPageEmpty = document.querySelector(".chat-page.is-empty") !== null;
    if (isPageEmpty) {
      this.modelDropdown.style.top = `${rect.bottom + 8}px`;
      this.modelDropdown.style.bottom = "auto";
    } else {
      this.modelDropdown.style.bottom = `${window.innerHeight - rect.top + 8}px`;
      this.modelDropdown.style.top = "auto";
    }
    this.modelDropdown.style.left = `${left}px`;
    this.modelDropdown.style.right = "auto";
    this.modelDropdown.style.width = `${width}px`;
    this.modelDropdown.style.minWidth = "auto";
  }

  openModelDropdown() {
    if (this.isGenerating) return;
    this.modelDropdownOpen = true;
    this.renderModelDropdown();
    this.positionModelDropdown();
    this.modelDropdown.classList.add("open");
    this.modelBadge.setAttribute("aria-expanded", "true");
  }

  closeModelDropdown() {
    this.modelDropdownOpen = false;
    this.modelDropdown.classList.remove("open");
    this.modelBadge.setAttribute("aria-expanded", "false");
  }

  selectModelFromDropdown(picked) {
    this.closeModelDropdown();
    if (!picked) return;
    this.currentModel = picked;
    if (picked === "image") this.searchEnabled = false;
    this.renderModelBadge();
    this.renderToolsMenu();
    this.updateComposerForMode();
    this.syncSendEnabled();
    this.onModelChange?.(picked);
  }

  renderEffortDropdown() {
    clear(this.effortDropdown);
    for (const opt of REASONING_EFFORT_OPTIONS) {
      const active = opt.value === this.reasoningEffort;
      const item = el("button", {
        type: "button",
        class: `effort-dropdown-item${active ? " active" : ""}`,
        role: "option",
        "aria-selected": active ? "true" : "false",
        onclick: () => this.selectEffortFromDropdown(opt.value),
      }, [
        el("span", { class: "menu-text" }, [
          el("span", { class: "menu-title", text: opt.label }),
        ]),
        active ? el("span", { class: "menu-check", html: icon("check", { width: 16, height: 16 }) }) : null,
      ].filter(Boolean));
      this.effortDropdown.append(item);
    }
  }

  positionEffortDropdown() {
    const rect = this.effortBadge.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(180, window.innerWidth - margin * 2);
    let left = rect.left;
    const maxLeft = window.innerWidth - width - margin;
    if (left > maxLeft) left = Math.max(margin, maxLeft);
    const isPageEmpty = document.querySelector(".chat-page.is-empty") !== null;
    if (isPageEmpty) {
      this.effortDropdown.style.top = `${rect.bottom + 8}px`;
      this.effortDropdown.style.bottom = "auto";
    } else {
      this.effortDropdown.style.bottom = `${window.innerHeight - rect.top + 8}px`;
      this.effortDropdown.style.top = "auto";
    }
    this.effortDropdown.style.left = `${left}px`;
    this.effortDropdown.style.right = "auto";
    this.effortDropdown.style.width = `${width}px`;
    this.effortDropdown.style.minWidth = "auto";
  }

  openEffortDropdown() {
    if (this.isGenerating) return;
    this.effortDropdownOpen = true;
    this.renderEffortDropdown();
    this.positionEffortDropdown();
    this.effortDropdown.classList.add("open");
    this.effortBadge.setAttribute("aria-expanded", "true");
  }

  closeEffortDropdown() {
    this.effortDropdownOpen = false;
    this.effortDropdown.classList.remove("open");
    this.effortBadge.setAttribute("aria-expanded", "false");
  }

  selectEffortFromDropdown(value) {
    this.closeEffortDropdown();
    this.reasoningEffort = value;
    localStorage.setItem("bimo-reasoning-effort", value);
    const label = REASONING_EFFORT_OPTIONS.find((o) => o.value === value)?.label || value;
    this.effortBadgeLabel.textContent = label;
  }

  renderModelBadge(incognito = false) {
    if (incognito) {
      this.modelBadgeWrap.style.display = "none";
      this.effortBadgeWrap.style.display = "none";
      return;
    }
    this.modelBadgeWrap.style.display = "";
    const m = this.availableModels.find((x) => x.id === this.currentModel);
    this.modelBadgeLabel.textContent = m ? m.label : "Stanza 2.5";
    this.effortBadgeWrap.style.display = "none";
  }

  renderAttachmentsBar() {
    clear(this.attachmentsBar);
    for (const f of this.uploadingFiles) {
      this.attachmentsBar.append(
        el("div", { class: "composer-attachment-chip loading" }, [
          el("span", { class: "spinner", html: icon("loader", { width: 14, height: 14 }) }),
          el("span", { class: "name line-clamp-1", text: f.name }),
          el("button", {
            type: "button",
            class: "x",
            "aria-label": "Cancel upload",
            onclick: () => {
              this.uploadingFiles = this.uploadingFiles.filter((x) => x !== f);
              this.renderAttachmentsBar();
              this.syncSendEnabled();
            },
            html: icon("x", { width: 12, height: 12 }),
          }),
        ])
      );
    }

    for (const a of this.pendingAttachments) {
      const isImage = (a.content_type || "").startsWith("image/");
      const children = [];
      if (isImage && a.url) {
        children.push(el("img", {
          src: a.url,
          alt: a.filename || "attachment",
          title: "Click to view",
          style: "cursor: zoom-in;",
          onclick: () => openImageModal(a.url, a.filename),
        }));
      } else {
        children.push(el("span", { class: "ic", html: icon("fileText", { width: 14, height: 14 }) }));
      }
      children.push(el("span", { class: "name line-clamp-1", text: a.filename || "attachment" }));
      children.push(
        el("button", {
          type: "button",
          class: "x",
          "aria-label": "Remove attachment",
          onclick: () => {
            this.pendingAttachments = this.pendingAttachments.filter((x) => x !== a);
            this.renderAttachmentsBar();
            this.syncSendEnabled();
          },
          html: icon("x", { width: 12, height: 12 }),
        })
      );
      this.attachmentsBar.append(el("div", { class: "composer-attachment-chip" }, children));
    }
  }

  async uploadAndAttach(file) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast("Max file size is 50MB", { tone: "error" });
      return;
    }
    const token = this.getAuthToken();
    if (!token) return;

    this.uploadingFiles.push(file);
    this.renderAttachmentsBar();
    this.syncSendEnabled();

    try {
      const attachment = await api.uploadAttachment(token, file);
      this.pendingAttachments.push(attachment);
    } catch (err) {
      toast(err.message || "Upload failed", { tone: "error" });
    } finally {
      this.uploadingFiles = this.uploadingFiles.filter((x) => x !== file);
      this.renderAttachmentsBar();
      this.syncSendEnabled();
    }
  }

  syncSendEnabled() {
    if (this.isImageGenerating) {
      this.voiceAssistantBtn.style.display = "none";
      this.sendBtn.style.display = "";
      this.sendBtn.disabled = true;
      this.sendBtn.classList.remove("stopping");
      this.sendBtn.setAttribute("aria-label", "Generating image");
      this.sendBtn.title = "Generating image";
      this.sendBtn.innerHTML = `<span class="send-spin">${icon("loader", { width: 16, height: 16 })}</span>`;
      return;
    }
    if (this.isStudyGenerating) {
      this.voiceAssistantBtn.style.display = "none";
      this.sendBtn.style.display = "";
      this.sendBtn.disabled = true;
      this.sendBtn.classList.remove("stopping");
      this.sendBtn.setAttribute("aria-label", "Generating quiz");
      this.sendBtn.title = "Generating quiz";
      this.sendBtn.innerHTML = `<span class="send-spin">${icon("loader", { width: 16, height: 16 })}</span>`;
      return;
    }
    if (this.isGenerating) {
      this.voiceAssistantBtn.style.display = "none";
      this.sendBtn.style.display = "";
      this.sendBtn.disabled = false;
      this.sendBtn.classList.add("stopping");
      this.sendBtn.setAttribute("aria-label", "Stop generating");
      this.sendBtn.title = "Stop generating";
      this.sendBtn.innerHTML = icon("square", { width: 16, height: 16 });
      return;
    }
    this.sendBtn.classList.remove("stopping");
    const hasInput = Boolean(this.textarea.value.trim()) || this.pendingAttachments.length > 0;
    if (hasInput) {
      this.voiceAssistantBtn.style.display = "none";
      this.sendBtn.style.display = "";
      this.sendBtn.setAttribute("aria-label", "Send message");
      this.sendBtn.title = "Send message";
      this.sendBtn.innerHTML = icon("send", { width: 16, height: 16 });
      this.sendBtn.disabled = false;
    } else if (this.isImageMode()) {
      this.voiceAssistantBtn.style.display = "none";
      this.sendBtn.style.display = "";
      this.sendBtn.disabled = true;
      this.sendBtn.setAttribute("aria-label", "Send message");
      this.sendBtn.title = "Describe an image to create";
      this.sendBtn.innerHTML = icon("send", { width: 16, height: 16 });
    } else {
      this.sendBtn.style.display = "none";
      this.voiceAssistantBtn.style.display = "";
    }
  }

  // Voice recording methods
  showRecordingBar(on) {
    this.isRecording = on;
    this.composerBox.style.display = on ? "none" : "";
    this.recordingBar.classList.toggle("active", on);
    this.recordingBar.setAttribute("aria-hidden", on ? "false" : "true");
    this.voiceBtn.classList.toggle("recording", on);
    this.voiceBtn.setAttribute("aria-label", on ? "Stop voice input" : "Start voice input");
  }

  startRecordTimer() {
    this.recordStartedAt = Date.now();
    this.recTimer.textContent = "0:00";
    this.recordTimerId = setInterval(() => {
      const s = Math.floor((Date.now() - this.recordStartedAt) / 1000);
      this.recTimer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }, 250);
  }

  stopRecordTimer() {
    if (this.recordTimerId) { clearInterval(this.recordTimerId); this.recordTimerId = null; }
  }

  startWaveMeter(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx || !this.waveBars.length) return;
      this.waveAudioCtx = new AudioCtx();
      const source = this.waveAudioCtx.createMediaStreamSource(stream);
      this.waveAnalyser = this.waveAudioCtx.createAnalyser();
      this.waveAnalyser.fftSize = 512;
      this.waveAnalyser.smoothingTimeConstant = 0.6;
      source.connect(this.waveAnalyser);
      const data = new Uint8Array(this.waveAnalyser.fftSize);

      const n = this.waveBars.length;
      const levels = new Array(n).fill(0);
      const STEP_MS = 55;
      let lastStep = 0;

      const tick = (now) => {
        this.waveAnalyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        let level = Math.min(1, rms * 4.5);
        if (level < 0.06) level = 0;

        if (!lastStep) lastStep = now;
        if (now - lastStep >= STEP_MS) {
          lastStep = now;
          levels.push(level);
          levels.shift();
          for (let i = 0; i < n; i++) {
            const h = 8 + levels[i] * 92;
            this.waveBars[i].style.height = `${h}%`;
          }
        }
        this.waveRafId = requestAnimationFrame(tick);
      };
      this.waveRafId = requestAnimationFrame(tick);
    } catch {}
  }

  stopWaveMeter() {
    if (this.waveRafId) { cancelAnimationFrame(this.waveRafId); this.waveRafId = null; }
    this.waveAnalyser = null;
    if (this.waveAudioCtx) { try { this.waveAudioCtx.close(); } catch {} this.waveAudioCtx = null; }
    for (const b of this.waveBars) b.style.height = "";
  }

  setTranscribingUI(on) {
    this.recordingBar.classList.toggle("transcribing", on);
    if (on) {
      this.recConfirmBtn.replaceWith(this.recSpinner);
      this.recCancelBtn.disabled = true;
      this.recTimer.textContent = "Transcribing…";
    } else {
      this.recSpinner.replaceWith(this.recConfirmBtn);
      this.recCancelBtn.disabled = false;
    }
  }

  async toggleVoiceRecording() {
    if (this.isGenerating) return;
    if (this.isRecording) {
      this.confirmRecording();
    } else {
      await this.startVoiceRecording();
    }
  }

  discardRecording() {
    this.cancelRecording = true;
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    } else {
      this.stopRecordTimer();
      this.showRecordingBar(false);
      this.syncSendEnabled();
    }
  }

  confirmRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.cancelRecording = false;
      this.mediaRecorder.stop();
    }
  }

  async startVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast("Voice not supported", { tone: "error" });
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      toast("Mic denied", { tone: "error" });
      return;
    }
    this.cancelRecording = false;
    this.audioChunks = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
    this.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    this.mediaRecorder.addEventListener("dataavailable", (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    });
    this.mediaRecorder.addEventListener("stop", async () => {
      stream.getTracks().forEach((t) => t.stop());
      const recorder = this.mediaRecorder;
      this.mediaRecorder = null;
      this.stopRecordTimer();
      this.stopWaveMeter();

      if (this.cancelRecording || !this.audioChunks.length) {
        this.showRecordingBar(false);
        this.syncSendEnabled();
        return;
      }

      const recorded = new Blob(this.audioChunks, { type: recorder.mimeType || "audio/webm" });
      this.setTranscribingUI(true);
      const token = this.getAuthToken();
      try {
        let wav;
        try {
          wav = await blobToWav16kMono(recorded);
        } catch {
          wav = recorded;
        }
        const result = await api.transcribeAudio(token, wav);
        if (result.text) {
          const cur = this.textarea.value.trim();
          this.textarea.value = cur ? `${cur} ${result.text}` : result.text;
          this.autoSize(this.textarea);
          this.syncSendEnabled();
        }
      } catch (err) {
        toast(err.message || "Transcription failed", { tone: "error" });
      } finally {
        this.setTranscribingUI(false);
        this.showRecordingBar(false);
        this.syncSendEnabled();
        this.textarea.focus();
      }
    });
    this.mediaRecorder.start();
    this.showRecordingBar(true);
    this.startRecordTimer();
    this.startWaveMeter(stream);
  }

  _attachGlobalListeners() {
    this._onDocClick = (e) => {
      if (!this.attachWrap.contains(e.target)) this.toggleAttachMenu(false);
      if (!this.toolsWrap.contains(e.target)) this.toggleToolsMenu(false);
    };
    document.addEventListener("click", this._onDocClick);

    this._onPointerDown = (e) => {
      if (this.modelDropdownOpen && !this.modelBadge.contains(e.target) && !this.modelDropdown.contains(e.target)) {
        this.closeModelDropdown();
      }
      if (this.effortDropdownOpen && !this.effortBadge.contains(e.target) && !this.effortDropdown.contains(e.target)) {
        this.closeEffortDropdown();
      }
    };
    document.addEventListener("pointerdown", this._onPointerDown, true);
  }

  destroy() {
    this.stopRecordTimer();
    this.stopWaveMeter();
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try { this.mediaRecorder.stop(); } catch {}
    }
    document.removeEventListener("click", this._onDocClick);
    document.removeEventListener("pointerdown", this._onPointerDown, true);
  }
}
