/**
 * SSE Stream handler for Bimo chat completions.
 * Manages token assembly, reasoning timer, background buffering, status phrases, and stream cancellation.
 */

import * as api from "../api.js?v=56";

export const ROTATING_PHRASES = [
  "Extrapolating…",
  "Adjudicating…",
  "Disambiguating…",
  "Triangulating…",
  "Ruminating…",
  "Elucidating…",
  "Deliberating…",
  "Contextualizing…",
  "Operationalizing…",
  "Instantiating…",
  "Substantiating…",
  "Corroborating…",
  "Reconciling…",
  "Interpolating…",
  "Delineating…",
  "Disaggregating…",
  "Recalibrating…",
  "Abstracting…",
  "Generalizing…",
  "Rationalizing…",
  "Codifying…",
  "Demystifying…",
  "Excavating…",
  "Marshaling…",
  "Orchestrating…",
  "Harmonizing…",
  "Reconfiguring…",
  "Problematizing…",
  "Metabolizing…",
  "Extemporizing…",
];

let _lastPhraseIndex = -1;
export function getRandomPhrase() {
  let i = 0;
  do {
    i = Math.floor(Math.random() * ROTATING_PHRASES.length);
  } while (i === _lastPhraseIndex && ROTATING_PHRASES.length > 1);
  _lastPhraseIndex = i;
  return ROTATING_PHRASES[i];
}

export function formatElapsedSeconds(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export class StreamHandler {
  constructor({
    getAuthToken,
    onConversation,
    onUserMessage,
    onToken,
    onReasoningToken,
    onComplete,
    onAssistantMessage,
    onError,
    onStatusChange,
  }) {
    this.getAuthToken = getAuthToken;
    this.onConversation = onConversation || (() => {});
    this.onUserMessage = onUserMessage || (() => {});
    this.onToken = onToken || (() => {});
    this.onReasoningToken = onReasoningToken || (() => {});
    this.onComplete = onComplete || (() => {});
    this.onAssistantMessage = onAssistantMessage || (() => {});
    this.onError = onError || (() => {});
    this.onStatusChange = onStatusChange || (() => {});

    this.controller = null;
    this.currentStreamId = null;
    this.rotateInterval = null;
    this.reasoningInterval = null;
    this.reasoningStartTime = null;
    this.lastReasoningSeconds = null;
    this.streamingText = "";
    this.streamingReasoning = "";
    this.hiddenBuffer = [];
    this.currentPhrase = "";
  }

  get isStreaming() {
    return Boolean(this.controller && !this.controller.signal.aborted);
  }

  startReasoningTimer(onTick) {
    if (this.reasoningInterval) return;
    this.reasoningStartTime = Date.now();
    this.reasoningInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - this.reasoningStartTime) / 1000);
      if (onTick) onTick(elapsed);
    }, 1000);
  }

  stopReasoningTimer() {
    if (this.reasoningInterval) {
      clearInterval(this.reasoningInterval);
      this.reasoningInterval = null;
    }
    if (this.reasoningStartTime) {
      this.lastReasoningSeconds = Math.round((Date.now() - this.reasoningStartTime) / 1000);
    }
    this.reasoningStartTime = null;
  }

  startStatusRotation(onRotate) {
    this.stopStatusRotation();
    const tick = () => {
      this.currentPhrase = getRandomPhrase();
      if (onRotate) onRotate(this.currentPhrase);
    };
    tick();
    this.rotateInterval = setInterval(tick, 3000);
  }

  stopStatusRotation() {
    if (this.rotateInterval) {
      clearInterval(this.rotateInterval);
      this.rotateInterval = null;
    }
  }

  cancel() {
    const token = this.getAuthToken();
    if (this.currentStreamId && token) {
      api.cancelChat(token, this.currentStreamId).catch(() => {});
    }
    if (this.controller) {
      this.controller.abort();
    }
    this.cleanup();
  }

  cleanup() {
    this.stopStatusRotation();
    this.stopReasoningTimer();
    this.controller = null;
    this.currentStreamId = null;
    this.hiddenBuffer = [];
    this.streamingText = "";
    this.streamingReasoning = "";
  }

  async executeStream({
    payload,
    streamId,
    onDeltaVoice,
  }) {
    this.cleanup();
    this.controller = new AbortController();
    this.currentStreamId = streamId;
    this.streamingText = "";
    this.streamingReasoning = "";
    this.lastReasoningSeconds = null;

    const token = this.getAuthToken();
    if (!token) throw new Error("Not authenticated");

    this.startStatusRotation((phrase) => {
      this.onStatusChange({ phrase });
    });

    try {
      await api.streamChat(
        token,
        { ...payload, stream_id: streamId },
        {
          signal: this.controller.signal,
          onConversation: (convo) => this.onConversation(convo),
          onUserMessage: (msg) => this.onUserMessage(msg),
          onReasoningToken: ({ delta }) => {
            this.streamingReasoning += delta;
            this.startReasoningTimer((elapsed) => {
              this.onStatusChange({ reasoningElapsed: elapsed });
            });
            if (document.hidden) {
              this.hiddenBuffer.push({ type: "reasoning", delta });
            }
            this.onReasoningToken({
              delta,
              streamingText: this.streamingText,
              streamingReasoning: this.streamingReasoning,
            });
          },
          onToken: ({ delta }) => {
            this.streamingText += delta;
            if (onDeltaVoice) {
              try { onDeltaVoice(this.streamingText); } catch {}
            }
            if (this.reasoningInterval) {
              this.stopReasoningTimer();
              this.onStatusChange({ reasoningElapsed: this.lastReasoningSeconds, reasoningDone: true });
            }
            if (document.hidden) {
              this.hiddenBuffer.push({ type: "content", delta });
            }
            this.onToken({
              delta,
              streamingText: this.streamingText,
              streamingReasoning: this.streamingReasoning,
            });
          },
          onComplete: () => {
            this.stopStatusRotation();
            this.onComplete();
          },
          onAssistantMessage: (msg) => {
            if (this.lastReasoningSeconds != null) {
              msg.reasoning_seconds = this.lastReasoningSeconds;
            }
            if (!msg.reasoning && this.streamingReasoning) {
              msg.reasoning = this.streamingReasoning;
            }
            this.cleanup();
            this.onAssistantMessage(msg);
          },
          onError: (err) => {
            this.cleanup();
            this.onError(err);
          },
        }
      );
    } finally {
      this.cleanup();
    }
  }
}
