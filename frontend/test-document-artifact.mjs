// Unit tests for document artifact detection and parsing in BMO.
// Run with: node test-document-artifact.mjs
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.customElements = dom.window.customElements;

const { extractDocumentArtifact } = await import("./js/components/message.js");

let failures = 0;
function check(name, cond, extra = "") {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${name} ${extra}`);
  } else {
    console.log(`ok: ${name}`);
  }
}

// 1. Regression: bash comment inside code block from screenshot must NOT be a document
const screenshotSample = `This repository, ResultSeal, is a Python toolkit designed to prevent AI agents from misinterpreting or misusing tool results—especially in scenarios where empty, partial, or unverified outputs could lead to false conclusions or unsafe actions.

### Core Purpose
ResultSeal ensures observation integrity by enforcing declarative contracts on tool outputs.

### Usage Examples
#### CLI
\`\`\`bash
# Test a fixture (e.g., empty response -> blocked)
resultseal replay fixtures/empty-result.yaml

# Check a tool result against a contract (exit 0 = sealed, 1 = blocked)
resultseal check examples/mcp_result.json --contract examples/customer_contract.json
\`\`\`

#### Python API
\`\`\`python
from resultseal.contracts import load_contract_file
\`\`\`
`;

const res1 = extractDocumentArtifact(screenshotSample);
check("regression: bash comment inside code block is NOT a document", res1.isDoc === false, JSON.stringify(res1));

// 2. Regression: open code block during streaming must NOT be detected as document
const streamingCodeSample = `Here is how you use it:
\`\`\`bash
# Test a fixture (e.g., empty response -> blocked)
resultseal replay fixtures/empty-result.yaml`;

const res2 = extractDocumentArtifact(streamingCodeSample);
check("regression: open streaming code block with comment is NOT a document", res2.isDoc === false, JSON.stringify(res2));

// 3. Regression: Python comment in code block must NOT be a document
const pythonSample = `Here is the solution:
\`\`\`python
# Configuration setup
DEBUG = False
\`\`\`
`;

const res3 = extractDocumentArtifact(pythonSample);
check("regression: python comment in code block is NOT a document", res3.isDoc === false, JSON.stringify(res3));

// 4. Regression: mid-response H1 after conversational text must NOT turn the rest into a document
const midHeadingSample = `Here is an explanation of the topic.
It has multiple paragraphs explaining how things work.
We can break this down into several details.

# Summary of Findings
Here are the final thoughts.`;

const res4 = extractDocumentArtifact(midHeadingSample);
check("regression: mid-response H1 heading after paragraphs is NOT a document", res4.isDoc === false, JSON.stringify(res4));

// 5. Regression: H1 preceded by lower-level headings or code blocks is NOT a document
const precededByHeadingsSample = `### Introduction
Overview here.

# Main Document Title
Body here.`;

const res5 = extractDocumentArtifact(precededByHeadingsSample);
check("regression: H1 preceded by subheadings is NOT a document", res5.isDoc === false, JSON.stringify(res5));

// 6. Genuine document on line 1 MUST be detected
const genuineDocSample = `# AI Engineer Resume

## Professional Summary
Experienced AI engineer specializing in LLM systems.

## Experience
- Senior Engineer at TechCorp (2022 - Present)
`;

const res6 = extractDocumentArtifact(genuineDocSample);
check("genuine document on line 1 is detected", res6.isDoc === true && res6.docTitle === "AI Engineer Resume", JSON.stringify(res6));

// 7. Genuine document with brief 1-line intro MUST be detected
const genuineWithIntroSample = `Here is the drafted resume for you:

# John Doe Resume

## Summary
Experienced software engineer.`;

const res7 = extractDocumentArtifact(genuineWithIntroSample);
check("genuine document with brief intro is detected", res7.isDoc === true && res7.docTitle === "John Doe Resume" && res7.introText.includes("drafted resume"), JSON.stringify(res7));

// 8. Explicit :::document fence MUST be detected
const explicitFenceSample = `:::document Project Plan
# Project Plan
## Timeline
Q1 goals...
:::`;

const res8 = extractDocumentArtifact(explicitFenceSample);
check("explicit :::document fence is detected", res8.isDoc === true && res8.docTitle === "Project Plan", JSON.stringify(res8));

// 9. Explicit \`\`\`document fence MUST be detected
const explicitCodeFenceSample = `\`\`\`document Quarterly Report
# Quarterly Report
## Financials
Growth was 20%...
\`\`\``;

const res9 = extractDocumentArtifact(explicitCodeFenceSample);
check("explicit ```document fence is detected", res9.isDoc === true && res9.docTitle === "Quarterly Report", JSON.stringify(res9));

// 10. Leading export disclaimer stripped before genuine document MUST be detected
const disclaimerSample = `I cannot generate or download a .docx file directly. However, here is the document:

# Product Requirements Document

## Overview
Specifications...`;

const res10 = extractDocumentArtifact(disclaimerSample);
check("disclaimer stripped before genuine document is detected", res10.isDoc === true && res10.docTitle === "Product Requirements Document", JSON.stringify(res10));

// 11. Genuine document containing code blocks inside body MUST still be a document
const docWithCodeBodySample = `# Developer Guide

## Quickstart
Run this command:
\`\`\`bash
# Install package
npm install bmo-core
\`\`\`
`;

const res11 = extractDocumentArtifact(docWithCodeBodySample);
check("genuine document containing code block in body is detected", res11.isDoc === true && res11.docTitle === "Developer Guide" && res11.docContent.includes("npm install bmo-core"), JSON.stringify(res11));

// 12. 4-backtick code fence with # comment is NOT a document
const quadFenceSample = `\`\`\`\`markdown
# This is inside a 4-backtick fence
\`\`\`\``;

const res12 = extractDocumentArtifact(quadFenceSample);
check("4-backtick code fence with comment is NOT a document", res12.isDoc === false, JSON.stringify(res12));

// 13. Tilde fence ~~~ with # comment is NOT a document
const tildeFenceSample = `~~~bash
# This is a tilde fence comment
echo "hello"
~~~`;

const res13 = extractDocumentArtifact(tildeFenceSample);
check("tilde fence with comment is NOT a document", res13.isDoc === false, JSON.stringify(res13));

// 14. Document with markdown formatting in H1 title extracts clean title
const formattedTitleSample = `# **Senior AI Engineer Resume**

## Experience
Senior Architect`;

const res14 = extractDocumentArtifact(formattedTitleSample);
check("document with formatted title extracts clean title", res14.isDoc === true && res14.docTitle === "Senior AI Engineer Resume", JSON.stringify(res14));

// 15. Conversational list before heading is NOT a document
const listBeforeHeadingSample = `- Point 1
- Point 2

# Summary
Details`;

const res15 = extractDocumentArtifact(listBeforeHeadingSample);
check("list before heading is NOT a document", res15.isDoc === false, JSON.stringify(res15));

// 16. Conversational table before heading is NOT a document
const tableBeforeHeadingSample = `| A | B |
|---|---|
| 1 | 2 |

# Analysis
Details`;

const res16 = extractDocumentArtifact(tableBeforeHeadingSample);
check("table before heading is NOT a document", res16.isDoc === false, JSON.stringify(res16));

// 17. Image #4 regression: Resume with intro mentioning Markdown/PDF MUST be detected as document
const image4Sample = `Here’s a complete, polished AI Engineer Resume in Markdown format, ready to be converted into a professional PDF (via BMO’s document engine or any tool like MarkdowntoPDF).

# AI Engineer Resume

[Your Full Name] 📍 [City, Country] | 📧 [Your Professional Email] | 📞 [Phone Number] | 🔗 [LinkedIn/Portfolio] | 🌐 [GitHub]

## Professional Summary
AI Engineer with [X] years of experience in machine learning, deep learning, and AI systems architecture. Skilled in NLP, computer vision, and MLOps, with expertise in Python, TensorFlow/PyTorch, and cloud platforms (AWS/GCP). Passionate about building scalable AI solutions and optimizing algorithms for real-world applications. Strong background in data pipelines, model deployment, and collaborative AI development.

## Technical Skills
- Deep Learning: PyTorch, TensorFlow
`;

const res17 = extractDocumentArtifact(image4Sample);
check("Image #4 sample with natural intro paragraph is detected as document", res17.isDoc === true && res17.docTitle === "AI Engineer Resume", JSON.stringify(res17));

if (failures > 0) {
  console.error(`\n${failures} tests failed.`);
  process.exit(1);
} else {
  console.log("\nAll document artifact tests passed!");
  process.exit(0);
}
