/**
 * Chat page controller for Bimo.
 * Coordinates the message feed, composer, stream handler, voice assistant, and image generation.
 */

import { el, clear } from "../utils.js?v=30";
import { icon } from "../icons.js?v=48";
import { getAuth } from "../auth.js?v=30";
import { navigate } from "../router.js?v=31";
import { mountAppShell } from "../app-shell.js?v=68";
import { toast } from "../components/toast.js?v=57";
import { whenMarkdownReady } from "../components/markdown.js?v=31";
import { openVoiceOverlay } from "../components/voice-overlay.js?v=43";
import { openDocViewerModal } from "../components/doc-modal.js?v=3";
import * as api from "../api.js?v=56";

import { Composer, DEFAULT_AVAILABLE_MODELS } from "../chat/composer.js?v=1";
import { MessageFeed } from "../chat/message-feed.js?v=6";
import { StreamHandler, getRandomPhrase } from "../chat/stream-handler.js?v=4";
import { STUDY_SYSTEM_PROMPT } from "../chat/study-mode.js?v=2";
import {
  detectExportIntent,
  buildCanonicalMarkdown,
  formatExportFilename,
  downloadBlob,
  buildClientDocxBlob,
  printDocumentToPdf,
} from "../export.js?v=2";



function uid(prefix = "tmp") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildSearchContext(answer, results, originalMessage) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const sources = results
    .map((r) => {
      const when = r.published_date ? ` (published ${r.published_date})` : "";
      return `[${r.title}](${r.url})${when}\n${r.content}`;
    })
    .join("\n\n");
  const now = new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
  const summary = answer ? `Most recent synthesized finding:\n${answer}\n\n` : "";
  return (
    `The current date and time is ${now} (today is ${today}). The web search ` +
    `results below are LIVE and authoritative — trust them over your own ` +
    `training data, which is out of date.\n\n` +
    `IMPORTANT for time-sensitive questions (live scores, prices, weather, ` +
    `breaking news): use ONLY the MOST RECENT figure available in the sources. ` +
    `If several sources disagree, prefer the one with the latest published ` +
    `date/timestamp, and ignore older snapshots. State the figure as the ` +
    `current value and, if useful, note how recent it is. Do not present an ` +
    `older cached number as the current one.\n\n` +
    `${summary}Sources (newer first where dated):\n${sources}\n\n` +
    `User question: ${originalMessage}`
  );
}

export async function renderChat({ id, incognito }) {
  const { auth } = getAuth();
  if (!auth) {
    navigate("#/", { replace: true });
    return;
  }
  const shell = await mountAppShell();
  shell.setActiveConversation(id || null);

  const host = shell.content;
  clear(host);

  // State
  let conversation = null;
  let messages = [];
  let loading = false;
  let availableModels = DEFAULT_AVAILABLE_MODELS;
  let defaultModel = "fast";


  let enteringId = null;
  let searching = false;
  let imageGenerating = false;
  let imagePollTimer = null;
  let voiceHandle = null;
  let unmounted = false;
  let reconciling = false;

  const page = el("div", { class: `chat-page${incognito ? " incognito-mode" : ""}` });

  // Topbar
  const incognitoBtn = el("button", {
    type: "button",
    class: `chat-topbar-incognito${incognito ? " active" : ""}`,
    title: incognito ? "Exit incognito" : "Incognito chat",
    "aria-label": incognito ? "Exit incognito" : "Start incognito",
    "aria-pressed": incognito ? "true" : "false",
    onclick: () => {
      navigate(incognito ? "#/app/chat" : "#/app/chat/incognito");
    },
    html: icon(incognito ? "x" : "incognito", { width: 26, height: 24 }),
  });

  const header = el("header", { class: "chat-topbar" }, [
    el("div", { class: "inner" }, [
      el("div", { class: "chat-topbar-actions" }, [incognitoBtn]),
    ]),
  ]);

  async function handleDirectDownload({ title, content, format }) {
    if (!content || !format) return;
    const docTitle = (title || conversation?.title || "Bimo AI Document").trim();
    const filename = formatExportFilename(docTitle, format);

    if (format === "md") {
      const canonical = buildCanonicalMarkdown({
        title: docTitle,
        content,
        date: new Date(),
      });
      const blob = new Blob([canonical], { type: "text/markdown;charset=utf-8" });
      downloadBlob(blob, filename);
      toast("Your document is ready", { tone: "success" });
      return;
    }

    try {
      const blob = await api.exportDocument(auth.token, {
        title: docTitle,
        markdown: content,
        format,
      });
      downloadBlob(blob, filename);
      toast("Your document is ready", { tone: "success" });
    } catch (err) {
      console.warn("Backend export failed, using instant client export:", err);
      if (format === "docx") {
        const htmlContent = renderMarkdown(content);
        const docxBlob = buildClientDocxBlob({ title: docTitle, htmlContent });
        downloadBlob(docxBlob, filename);
        toast("Your document is ready", { tone: "success" });
      } else if (format === "pdf") {
        const htmlContent = renderMarkdown(content);
        printDocumentToPdf({ title: docTitle, htmlContent });
        toast("Your document is ready", { tone: "success" });
      } else {
        toast(err.message || `Failed to download ${format.toUpperCase()}`, { tone: "error" });
      }
    }
  }




  // Message Feed
  const messageFeed = new MessageFeed({
    onEditMessage: (message) => editMessage(message),
    onRetryMessage: (message) => retryMessage(message),
    onFeedback: (message, sentiment) => handleMessageFeedback(message, sentiment),
    onRetryAssistantMessage: (assistantMsg) => retryAssistantMessage(assistantMsg),
    onOpenDoc: ({ title, content }) => {
      openDocViewerModal({
        title,
        content,
        onDownloadFormat: (fmt) => handleDirectDownload({ title, content, format: fmt }),
      });
    },
    onExport: ({ message, format, title, content }) => {
      handleDirectDownload({
        title: title || conversation?.title,
        content: content || message?.content,
        format: format === "all" ? "pdf" : format,
      });
    },
  });



  // Stream Handler
  const streamHandler = new StreamHandler({
    getAuthToken: () => auth.token,
    onConversation: (convo) => {
      conversation = convo;
      const cid = convo?.id ? String(convo.id) : "";
      const isRealId = cid && !cid.startsWith("pending_") && !cid.startsWith("incognito_");
      if (!incognito && !id && isRealId) {
        id = convo.id;
        history.replaceState(null, "", `#/app/chat/${id}`);
        shell.setActiveConversation(id);
        loadConversations();
      }
      composer.renderModelBadge(incognito);
    },

    onUserMessage: (m) => {
      const mid = m?.id ? String(m.id) : "";
      if (mid.startsWith("msg_pending_")) return;
      messages = messages.filter((x) => !String(x.id).startsWith("tmp_"));
      messages.push(m);
      renderUI();
    },
    onToken: ({ delta, streamingText, streamingReasoning }) => {
      if (!document.hidden) {
        messageFeed.updateStreamingBubble(streamingText, streamingReasoning);
      }
    },
    onReasoningToken: ({ delta, streamingText, streamingReasoning }) => {
      if (!document.hidden) {
        messageFeed.updateStreamingBubble(streamingText, streamingReasoning);
      }
    },
    onStatusChange: ({ phrase, reasoningElapsed, reasoningDone }) => {
      if (phrase) messageFeed.setStatusText(phrase);
      if (reasoningElapsed != null) {
        messageFeed.setStreamingReasoningTimer(`· ${reasoningElapsed}s`);
      }
      if (reasoningDone) {
        messageFeed.collapseReasoningBlock();
      }
    },
    onComplete: () => {
      messageFeed.setStatusText("Done");
    },
    onAssistantMessage: (m) => {
      messages.push(m);
      enteringId = m.id;
      composer.isGenerating = false;
      composer.syncSendEnabled();
      renderUI();
      loadConversations();
    },
    onError: (err) => {
      toast(err.message || "Couldn't connect", { tone: "error" });
      composer.isGenerating = false;
      composer.syncSendEnabled();
      renderUI();
    },
  });


  // Composer
  const composer = new Composer({
    onSubmit: (turn) => handleComposerSubmit(turn),
    onStop: () => streamHandler.cancel(),
    onOpenVoiceAssistant: () => openVoiceMode(),
    onModelChange: async (model) => {
      conversation = { ...(conversation || {}), model };

      if (!id) return;
      try {
        const updated = await api.updateConversation(auth.token, id, { model });
        conversation = updated || conversation;
      } catch (err) {
        toast(err.message || "Couldn't switch model", { tone: "error" });
      }
    },
    onToolsChange: ({ searchEnabled, studyMode, model }) => {
      if (id && conversation && model !== conversation.model) {
        api.updateConversation(auth.token, id, { model }).catch(() => {});
      }
    },
    getAuthToken: () => auth.token,
  });

  page.append(header, messageFeed.element, composer.element, ...composer.dropdownElements);
  host.append(page);

  shell.setIncognitoActive?.(Boolean(incognito));

  function renderUI() {
    clear(messageFeed.streamInner);

    if (loading) {
      messageFeed.stream.style.display = "none";
      composer.element.style.display = "none";
      header.style.display = "none";
      if (!page.querySelector(".blade-spinner")) {
        page.append(
          el("div", { class: "blade-spinner center" }, [
            el("div", { class: "spinner-blade" }),
            el("div", { class: "spinner-blade" }),
            el("div", { class: "spinner-blade" }),
            el("div", { class: "spinner-blade" }),
            el("div", { class: "spinner-blade" }),
            el("div", { class: "spinner-blade" }),
            el("div", { class: "spinner-blade" }),
            el("div", { class: "spinner-blade" }),
            el("div", { class: "spinner-blade" }),
            el("div", { class: "spinner-blade" }),
            el("div", { class: "spinner-blade" }),
            el("div", { class: "spinner-blade" }),
          ])
        );
      }
      return;
    }

    messageFeed.stream.style.display = "";
    composer.element.style.display = "";
    header.style.display = "";
    const spinner = page.querySelector(".blade-spinner");
    if (spinner) spinner.remove();

    messageFeed.render({
      messages,
      user: auth.user,
      generating: composer.isGenerating,
      searching,
      imageGenerating,
      streamingText: streamHandler.streamingText,
      streamingReasoning: streamHandler.streamingReasoning,
      statusPhrase: streamHandler.currentPhrase,
      enteringId,
      incognito,
    });
    enteringId = null;
  }

  async function loadConversations() {
    try {
      const list = await api.listConversations(auth.token);
      shell.setConversations(list);
    } catch {
      /* non-blocking sidebar sync */
    }
  }

  async function loadModels() {
    try {
      const data = await api.listModels(auth.token);
      if (Array.isArray(data?.models)) {
        availableModels = data.models;
        defaultModel = data.default || defaultModel;
        composer.availableModels = availableModels;
        composer.defaultModel = defaultModel;
        if (!conversation?.model) {
          composer.currentModel = defaultModel;
        }
      }
    } catch (err) {
      console.warn("Could not load model catalog", err);
    } finally {
      composer.renderModelBadge(incognito);
      composer.renderModelDropdown();
    }
  }

  async function loadMessages() {
    if (incognito || !id) {
      messages = [];
      return;
    }
    try {
      const data = await api.getMessages(auth.token, id);
      conversation = data?.conversation || null;
      messages = Array.isArray(data?.messages) ? data.messages : [];
      if (conversation?.model) {
        composer.currentModel = conversation.model;
      }
      if (lastMessageIsPendingImagePrompt()) {
        pollForImageResult();
      }
    } catch (err) {
      if (err?.status === 404) {
        toast("Conversation not found", { tone: "error" });
        navigate("#/app/chat", { replace: true });
        return;
      }
      throw err;
    }
  }

  async function handleComposerSubmit(turn) {
    const { text, attachments, model, reasoningEffort, searchEnabled, studyMode } = turn;

    if (model === "image") {
      await sendImageMessage(text, attachments);
      return;
    }

    // Detect export intent on completed turn
    const exportIntent = detectExportIntent(text);
    if (exportIntent.exportOnly && !attachments.length) {
      const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.content?.trim());
      if (!latestAssistant) {
        toast("There is no completed response to export yet", { tone: "error" });
        return;
      }
      handleDirectDownload({
        title: conversation?.title,
        content: latestAssistant.content,
        format: exportIntent.formats[0] || "pdf",
      });
      return;
    }


    const optimisticUser = {
      id: uid(),
      role: "user",
      content: text,
      attachments: attachments.length ? attachments : null,
      created_at: new Date().toISOString(),
      conversation_id: id || "pending",
    };
    messages.push(optimisticUser);
    enteringId = optimisticUser.id;
    streamHandler.streamingText = "";
    streamHandler.streamingReasoning = "";
    streamHandler.currentPhrase = getRandomPhrase();

    composer.isGenerating = true;
    composer.syncSendEnabled();
    renderUI();

    const streamId = uid("stream");
    let llmMessage = text;

    if (searchEnabled && text) {
      searching = true;
      renderUI();
      try {
        const res = await api.searchWeb(auth.token, text);
        const results = res?.results || [];
        if (res?.answer || results.length) {
          llmMessage = buildSearchContext(res.answer, results, text);
        }
      } catch (err) {
        console.warn("web search failed:", err.message);
      } finally {
        searching = false;
      }
    }

    renderUI();

    try {
      await streamHandler.executeStream({
        payload: {
          message: text,
          augmented_message: llmMessage !== text ? llmMessage : undefined,
          conversation_id: (!incognito && id) ? id : undefined,
          attachments,
          model: model || conversation?.model || defaultModel,
          system_prompt: studyMode ? STUDY_SYSTEM_PROMPT : (conversation?.system_prompt || undefined),
          reasoning_effort: (model || conversation?.model) === "deep" ? reasoningEffort : undefined,
          incognito,
        },
        streamId,
      });
    } catch (err) {
      if (err?.name !== "AbortError") {
        messages = messages.filter((x) => x.id !== optimisticUser.id);
        toast(err.message || "Couldn't connect", { tone: "error" });
      }
    } finally {
      composer.isGenerating = false;
      composer.syncSendEnabled();
      renderUI();
      loadConversations();
    }
  }

  async function sendImageMessage(text, attachments = []) {
    const optimisticUser = {
      id: uid(),
      role: "user",
      content: text,
      attachments: attachments.length ? attachments : null,
      created_at: new Date().toISOString(),
      conversation_id: id || "pending",
    };
    messages.push(optimisticUser);
    imageGenerating = true;
    composer.isImageGenerating = true;
    composer.syncSendEnabled();
    renderUI();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await api.generateImage(auth.token, {
        prompt: text,
        conversation_id: id || undefined,
        attachments,
      }, controller.signal);

      if (res?.conversation) {
        conversation = res.conversation;
        if (!id) {
          id = conversation.id;
          history.replaceState(null, "", `#/app/chat/${id}`);
          shell.setActiveConversation(id);
        }
        composer.renderModelBadge(incognito);
      }
      messages = messages.filter((x) => x.id !== optimisticUser.id);
      messages.push(res?.user_message || optimisticUser);
      if (res?.assistant_message) messages.push(res.assistant_message);
    } catch (err) {
      messages = messages.filter((x) => x.id !== optimisticUser.id);
      toast(err.message || "Couldn't create image.", { tone: "error" });
    } finally {
      clearTimeout(timeoutId);
      imageGenerating = false;
      composer.isImageGenerating = false;
      composer.syncSendEnabled();
      renderUI();
      loadConversations();
    }
  }

  function lastMessageIsPendingImagePrompt() {
    if (composer.currentModel !== "image" || !messages.length) return false;
    const last = messages[messages.length - 1];
    if (last.role !== "user") return false;
    const age = Date.now() - new Date(last.created_at).getTime();
    return age >= 0 && age < 3 * 60 * 1000;
  }

  function pollForImageResult() {
    if (!id || imagePollTimer || unmounted) return;
    imageGenerating = true;
    composer.isImageGenerating = true;
    composer.syncSendEnabled();
    renderUI();

    const started = Date.now();
    imagePollTimer = setInterval(async () => {
      if (Date.now() - started > 120000) {
        clearInterval(imagePollTimer);
        imagePollTimer = null;
        imageGenerating = false;
        composer.isImageGenerating = false;
        composer.syncSendEnabled();
        renderUI();
        return;
      }
      try {
        const data = await api.getMessages(auth.token, id);
        const msgs = Array.isArray(data?.messages) ? data.messages : [];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") {
          clearInterval(imagePollTimer);
          imagePollTimer = null;
          conversation = data.conversation || conversation;
          messages = msgs;
          imageGenerating = false;
          composer.isImageGenerating = false;
          composer.renderModelBadge(incognito);
          composer.syncSendEnabled();
          renderUI();
          loadConversations();
        }
      } catch {}
    }, 3000);
  }

  function editMessage(message) {
    if (streamHandler.isStreaming || imageGenerating) return;
    const idx = messages.findIndex((x) => x.id === message.id);
    if (idx === -1) return;
    messages = messages.slice(0, idx);
    composer.setText(message.content);
    renderUI();
    composer.focus();
  }

  function retryMessage(message) {
    if (streamHandler.isStreaming || imageGenerating) return;
    const idx = messages.findIndex((x) => x.id === message.id);
    if (idx === -1) return;
    messages = messages.slice(0, idx);
    renderUI();
    if (composer.isImageMode()) {
      sendImageMessage(message.content);
    } else {
      handleComposerSubmit({
        text: message.content,
        attachments: [],
        model: composer.currentModel,
        reasoningEffort: composer.reasoningEffort,
        searchEnabled: composer.searchEnabled,
        studyMode: composer.studyMode,
      });
    }
  }

  function retryAssistantMessage(assistantMsg) {
    if (streamHandler.isStreaming || imageGenerating) return;
    const idx = messages.findIndex((x) => x.id === assistantMsg.id);
    if (idx === -1) return;
    let userIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") { userIdx = i; break; }
    }
    if (userIdx === -1) return;
    const userMsg = messages[userIdx];
    messages = messages.slice(0, userIdx);
    renderUI();
    if (composer.isImageMode()) {
      sendImageMessage(userMsg.content, userMsg.attachments || []);
    } else {
      handleComposerSubmit({
        text: userMsg.content,
        attachments: userMsg.attachments || [],
        model: composer.currentModel,
        reasoningEffort: composer.reasoningEffort,
        searchEnabled: composer.searchEnabled,
        studyMode: composer.studyMode,
      });
    }
  }

  async function handleMessageFeedback(message, sentiment) {
    const payload = sentiment === "up"
      ? { message_id: message.id, rating: 5, correctness: "correct", length: "ideal" }
      : { message_id: message.id, rating: 1, correctness: "incorrect", length: "ideal" };
    try {
      const feedback = await api.submitFeedback(auth.token, payload);
      const idx = messages.findIndex((m) => m.id === message.id);
      if (idx !== -1) {
        messages[idx] = { ...messages[idx], feedback: feedback || payload };
        renderUI();
      }
      toast("Thanks!", { tone: "success" });
    } catch (err) {
      toast(err.message || "Couldn't send feedback", { tone: "error" });
    }
  }

  function resetToNewConversation() {
    id = null;
    conversation = null;
    messages = [];
    history.replaceState(null, "", "#/app/chat");
    shell.setActiveConversation(null);
    composer.renderModelBadge(incognito);
    renderUI();
  }



  function openVoiceMode() {
    if (voiceHandle || streamHandler.isStreaming) return;
    resetToNewConversation();
    voiceHandle = openVoiceOverlay({
      token: auth.token,
      sendTurn: async (text, opts) => {
        await handleComposerSubmit({
          text,
          attachments: [],
          model: composer.currentModel,
          reasoningEffort: composer.reasoningEffort,
          searchEnabled: composer.searchEnabled,
          studyMode: composer.studyMode,
        });
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "assistant") return messages[i].content || "";
        }
        return "";
      },
      onClose: () => {
        voiceHandle = null;
        loadConversations();
      },
    });
  }

  const onVisibilityChange = async () => {
    if (document.hidden) return;
    if (streamHandler.isStreaming && streamHandler.hiddenBuffer.length) {
      streamHandler.hiddenBuffer = [];
      messageFeed.updateStreamingBubble(streamHandler.streamingText, streamHandler.streamingReasoning);
    }
    if (streamHandler.isStreaming && id && streamHandler.controller?.signal.aborted) {
      if (reconciling || !id) return;
      reconciling = true;
      try {
        const data = await api.getMessages(auth.token, id);
        const serverMsgs = Array.isArray(data?.messages) ? data.messages : null;
        if (serverMsgs && serverMsgs.length) {
          const lastServer = serverMsgs[serverMsgs.length - 1];
          if (lastServer.role === "assistant") {
            conversation = data.conversation || conversation;
            messages = serverMsgs;
            streamHandler.cleanup();
            composer.isGenerating = false;
            composer.syncSendEnabled();
            renderUI();
          }
        }
      } finally {
        reconciling = false;
      }
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  // Initial load
  loading = true;
  renderUI();

  Promise.all([loadModels(), loadMessages()]).then(() => {
    if (unmounted) return;
    loading = false;
    renderUI();
  }).catch((err) => {
    if (unmounted) return;
    loading = false;
    renderUI();
    toast(err.message || "Failed to load chat", { tone: "error" });
  });

  whenMarkdownReady(() => { if (!unmounted) renderUI(); });

  return () => {
    unmounted = true;
    if (imagePollTimer) { clearInterval(imagePollTimer); imagePollTimer = null; }
    streamHandler.cancel();
    composer.destroy();
    if (voiceHandle) { try { voiceHandle.close(); } catch {} voiceHandle = null; }
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
