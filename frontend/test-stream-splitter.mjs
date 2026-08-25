// Unit test for frontend/js/chat/stream-splitter.js — run with: node test-stream-splitter.mjs
import { splitStreamBlocks } from "/home/saim/Projects/bimo/frontend/js/chat/stream-splitter.js";

let failures = 0;
function check(name, cond, extra = "") {
  if (!cond) { failures++; console.error(`FAIL: ${name} ${extra}`); }
  else console.log(`ok: ${name}`);
}

// --- 1. Prefix stability across token-by-token growth -----------------
const doc = [
  "Intro paragraph here.",
  "",
  "```python",
  "def f(x):",
  "    return x + 1",
  "```",
  "",
  "## Heading",
  "",
  "- item one",
  "",
  "- item two",       // loose list — boundary cancelled
  "",
  "$$x^2 + y^2 = z^2$$",
  "",
  "Done.",
].join("\n");

const stripTrail = (s) => s.replace(/\n+$/g, "");
let prevClosed = "";
let stable = true;
for (let n = 1; n <= doc.length; n++) {
  const blocks = splitStreamBlocks(doc.slice(0, n));
  const closed = stripTrail(blocks.slice(0, -1).join("\n\n"));
  if (!(closed === prevClosed || closed.startsWith(prevClosed))) {
    stable = false;
    console.error("unstable at n =", n,
      "\nnow :", JSON.stringify(closed),
      "\nprev:", JSON.stringify(prevClosed));
    break;
  }
  prevClosed = closed;
}
check("prefix stability during token growth", stable);

// --- 2. Code fence stays glued while streaming inside it --------------
// (partial trailing line travels WITH the open construct in the tail)
const midCode = splitStreamBlocks("text before\n\n```js\nconst a = 1;\nconst b = ");
check("prose frozen before open fence", midCode.length === 2 && midCode[0] === "text before\n");
check("code block intact so far", midCode[1].startsWith("```js") && midCode[1].includes("const b = "));

// --- 3. Fence closing creates a new chunk for what follows ------------
const afterCode = splitStreamBlocks("text before\n\n```js\nconst a = 1;\n```\nafter text");
check("fence close ends chunk -> new chunk after", afterCode.length >= 3);
check("code block intact", afterCode[1] === "```js\nconst a = 1;\n```");
check("after-fence text separate", afterCode[afterCode.length - 1].includes("after text"));

// --- 4. $$ display math glued -----------------------------------------
const mathOpen = splitStreamBlocks("para one\n\n$$\nx = 1\ny = ");
check("$$ block not split while open", mathOpen[mathOpen.length - 1] === "$$\nx = 1\ny = ");

const mathClosed = splitStreamBlocks("para one\n\n$$\nx = 1\n$$\npara two");
check("closed $$ yields new chunk", mathClosed.length === 3);
check("math chunk whole", mathClosed[1] === "$$\nx = 1\n$$");

// --- 5. Empty / trivial ------------------------------------------------
check("empty string", JSON.stringify(splitStreamBlocks("")) === JSON.stringify([""]));
check("single line", JSON.stringify(splitStreamBlocks("hello")) === JSON.stringify(["hello"]));

// --- 6. Indented fence (CommonMark allows up to 3 spaces) --------------
const indented = splitStreamBlocks("a\n\n   ```\ncode\n   ```\nb");
check("indented fences respected", indented.length === 3 && indented[1].includes("code"));

// --- 7. ~~~ fences ------------------------------------------------------
const tildes = splitStreamBlocks("x\n\n~~~\nsnippet\n~~~\ny");
check("tilde fences respected", tildes.length === 3 && tildes[1] === "~~~\nsnippet\n~~~");

// --- 8. Loose list stays ONE chunk -------------------------------------
const loose = splitStreamBlocks("- item one\n\n- item two\n\n- item three");
check("loose list not torn apart", loose.length === 1);

// --- 9. Tight list + heading split normally ----------------------------
const mixed = splitStreamBlocks("para\n\n## Heading\n\nmore");
check("paragraph/heading split", mixed.length === 2 && mixed[0] === "para\n" && mixed[1] === "## Heading\n\nmore");

// --- 10. Blockquote container survives ----------------------------------
const quotes = splitStreamBlocks("> a\n\n> b");
check("blockquote container glued", quotes.length === 1);

process.exit(failures ? 1 : 0);
