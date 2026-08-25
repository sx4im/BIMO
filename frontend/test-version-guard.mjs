// Zero-dependency tests for version-guard.js (run: node test-version-guard.mjs)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBuildId } from "./js/version-guard.js";

// 1. parses the meta tag format we emit
assert.equal(parseBuildId('<meta name="bimo-build" content="1787665800" />'), 1787665800);
// 2. single quotes
assert.equal(parseBuildId("<meta name='bimo-build' content='42'>"), 42);
// 3. absent tag -> null
assert.equal(parseBuildId("<html><head></head></html>"), null);
// 4. non-numeric -> null
assert.equal(parseBuildId('<meta name="bimo-build" content="abc">'), null);
// 5. the real index.html carries a numeric build id
const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
assert.equal(typeof parseBuildId(html), "number", "index.html must carry bimo-build meta");

console.log("version-guard tests: all pass");
