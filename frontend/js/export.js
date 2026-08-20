/**
 * Export module for Bimo AI assistant responses.
 *
 * Coordinates canonical Markdown construction, format definitions, export intent
 * detection in chat prompts, filename sanitization, and browser Blob downloads.
 */

export const EXPORT_FORMATS = {
  md: {
    id: "md",
    label: "Markdown",
    ext: ".md",
    mime: "text/markdown; charset=utf-8",
    badge: "MD",
    icon: "fileText",
    description: "Raw Markdown source document",
  },
  pdf: {
    id: "pdf",
    label: "PDF",
    ext: ".pdf",
    mime: "application/pdf",
    badge: "PDF",
    icon: "fileText",
    description: "Formatted, text-based PDF document",
  },
  docx: {
    id: "docx",
    label: "Word (DOCX)",
    ext: ".docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    badge: "DOCX",
    icon: "fileText",
    description: "Editable Microsoft Word document",
  },
};

/**
 * Detect whether a user prompt contains an export request.
 *
 * Distinguishes between:
 * 1. `exportOnly`: user ONLY wants to export the previous response (e.g. "I need this as a PDF", "Export this response").
 * 2. `composite`: user is asking a question AND requesting an export (e.g. "Explain photosynthesis and give me a PDF").
 */
export function detectExportIntent(rawPrompt) {
  const text = (rawPrompt || "").trim();
  if (!text) {
    return { isExport: false, exportOnly: false, formats: ["md", "pdf", "docx"], cleanPrompt: text };
  }

  const lower = text.toLowerCase().replace(/\s+/g, " ");

  // Formats detected in prompt
  const detectedFormats = [];
  if (/\b(pdf|adobe|\.pdf)\b/.test(lower)) detectedFormats.push("pdf");
  if (/\b(docx?|word(?:\s+doc(?:ument)?)?|\.docx?)\b/.test(lower)) detectedFormats.push("docx");
  if (/\b(markdown|md(?:\s+file)?|\.md)\b/.test(lower)) detectedFormats.push("md");

  // Fallback to all formats if generic "export", "download", or "all formats"
  const formats = detectedFormats.length > 0 ? detectedFormats : ["md", "pdf", "docx"];

  // Patterns that indicate an EXPORT-ONLY turn referencing previous message
  const exportOnlyPatterns = [
    /^(?:please\s+)?(?:export|download|save|give me|i need|can i (?:get|have)|provide|make|generate)(?:\s+(?:all|this|the|that|it|previous|last|latest|completed))?\s*(?:response|message|answer|chat|conversation|text|file|document|doc)?\s*(?:as|in|to|into|for)?\s*(?:a|an)?\s*(?:pdf|word|docx|doc|markdown|md|all formats|files|documents)?(?:\s+(?:format|file|doc|document|version))?[.!?]*$/i,
    /^(?:i\s+need\s+this\s+(?:as|in)\s+(?:a\s+)?(?:pdf|word(?:\s+document)?|docx|markdown|md)(?:[,\s]+and\s+(?:word(?:\s+document)?|docx|pdf|markdown|md))?)[.!?]*$/i,
    /^(?:i\s+need\s+this\s+in\s+pdf[,\s]+markdown[,\s]+(?:and\s+)?word(?:\s+format)?)[.!?]*$/i,
    /^(?:export|download)\s+(?:this|the|that|it|last|previous|latest|completed)?\s*(?:response|message|answer|chat|conversation)?[.!?]*$/i,
    /^(?:give\s+me|send\s+me|get\s+me)\s+(?:a\s+)?(?:pdf|word\s+doc(?:ument)?|docx|markdown|md)(?:\s+file|\s+document|\s+version)?[.!?]*$/i,
    /^(?:download\s+this\s+as\s+markdown|give\s+me\s+a\s+word\s+document|i\s+need\s+this\s+as\s+a\s+pdf)[.!?]*$/i,
    /^(?:pdf|docx|word\s+document|markdown|md)\s*(?:please|export|download)?[.!?]*$/i,
  ];

  const isExportOnly = exportOnlyPatterns.some((pattern) => pattern.test(lower));

  // Check if it's a composite export request (e.g. "Explain photosynthesis and give me a PDF")
  const compositeKeywords = [
    /\b(?:and|also|plus)?\s*(?:give|send|provide|make|export|download|save|generate)\s*(?:me\s+)?(?:it\s+|this\s+)?(?:as\s+|in\s+)?(?:a\s+)?(?:pdf|word|docx|markdown|md)(?:\s+format|\s+file|\s+doc)?\b/i,
    /\b(?:in|as)\s+(?:pdf|word|docx|markdown|md)\s+(?:format|file|document)\b/i,
    /\b(?:give me|need)\s+(?:a\s+)?(?:pdf|word document|docx|markdown)\b/i,
  ];

  const isComposite = compositeKeywords.some((kw) => kw.test(lower));

  const isExport = isExportOnly || isComposite;

  // Clean prompt for model if composite (optional strip of trailing export clause)
  let cleanPrompt = text;
  if (isComposite && !isExportOnly) {
    cleanPrompt = text
      .replace(/,\s*(?:and\s+)?(?:please\s+)?(?:give me|provide|make|export|download|save|generate|send)\s+(?:me\s+)?(?:a\s+)?(?:pdf|word\s+doc(?:ument)?|docx|markdown|md)(?:\s+format|\s+file)?[.!?]*$/i, "")
      .trim() || text;
  }

  return {
    isExport,
    exportOnly: isExportOnly,
    formats,
    cleanPrompt,
  };
}

/**
 * Builds the standardized canonical Markdown document from message content and metadata.
 */
export function buildCanonicalMarkdown({ title, content, date } = {}) {
  const cleanTitle = (title || "").trim() || "Bimo AI response";
  const d = date instanceof Date ? date : new Date();
  const dateStr = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const body = (content || "").trim();
  const startsWithH1 = body.startsWith(`# ${cleanTitle}`);

  const headerParts = [];
  if (!startsWithH1) {
    headerParts.push(`# ${cleanTitle}\n`);
  }
  headerParts.push(`*Generated on ${dateStr} · Created with Bimo*\n`);
  headerParts.push("---\n");

  return `${headerParts.join("\n")}\n${body}\n`;
}

/**
 * Produces a sanitized, safe filename for browser download.
 */
export function formatExportFilename(title, ext = "md") {
  const cleanExt = (ext || "md").replace(/^\./, "").toLowerCase();
  const rawTitle = (title || "").trim() || "bimo-ai-response";

  const slug = rawTitle
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "bimo-ai-response";

  return `${slug}.${cleanExt}`;
}

/**
 * Triggers a browser file download using URL.createObjectURL and a temporary anchor tag.
 */
export function downloadBlob(blob, filename) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.position = "fixed";
  a.style.left = "-9999px";
  a.href = url;
  a.download = filename || "bimo-export";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  }, 2000);
}
