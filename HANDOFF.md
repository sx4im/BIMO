# BIMO — Chat Context Handoff (2026-08-26, ~10:15 PKT)

Paste this whole block as your first message in a new session.

---

## Project
BIMO — AI chat app at `~/Projects/bimo` (github.com/sx4im/BIMO), live at **bimo.qzz.io**.
Vanilla ESM SPA (`frontend/`, no framework) + FastAPI backend (`backend/`) + Supabase. Deployed on **Vercel** — there is NO Cloudflare in the path (verified via headers; no cf-ray). Backend tests: `cd backend && .venv/bin/python -m pytest tests/` (52 passing). Frontend has zero-dep node test files run with plain `node`.

## Iron rules of this repo
1. **Cache-busting**: every JS import carries `?v=N`. Any edit to a module requires bumping its version AND the full importer chain up to `index.html`. Current chain after last commit: index.html → `styles.css?v=96`, `main.js?v=117`; main.js → `pages/chat.js?v=102`, `version-guard.js?v=1`; chat.js → `composer.js?v=3`, `message-feed.js?v=13`; message-feed → `stream-renderer.js?v=7`, `scroll-follower.js?v=3`, `components/message.js?v=60`.
2. **`<meta name="bimo-build">` in index.html is a STATIC unix timestamp** — it must be manually bumped on each deploy or version-guard never triggers auto-reload. (It was NOT bumped today — known TODO.)
3. Dark theme is default. Exact Claude palette: page bg `#151515`, sidebar `#111111`, composer bar `#20201f` (token `--input-bar`), hover `#232323`, active `#343434`.
4. User wants terse replies, direct execution end-to-end ("yes push" = commit+push+verify+report), verification with real tool output, no patch-work fixes — root cause only.

## State
- Branch `main`, everything pushed through commit `a90f0a9` (fix(scroll): viewport-churn phantom gestures; feed reconciliation; PGRST303 retry; readme migrations). Working tree clean except untracked HANDOFF.md updates — check `git status`.
- All suites green before push (2026-08-26): scroll-follower regression 18/18, splitter OK, version-guard pass, backend 56/56.
- Live site verified serving bimo-build=1787718538 and `scroll-follower.js?v=4` (contains `_lastViewport`).

## Design decisions locked in today (user-confirmed)
- **Thought Process is MANUAL**: collapsed by default everywhere (streaming, settled, and history loads). User clicks the summary/arrow to expand. Implemented by making `reasoningDetails()`'s `open` param default false and removing ALL forced `open:true` from the three call paths (settled `messageBubble` path in message.js, streaming-bubble creation in message-feed.js `streamingBubbleNode`, and renderer's lazy `buildReasoning` factory).
- **ScrollFollower** (`frontend/js/chat/scroll-follower.js`): owns pin/free-scroll/jump-pill for the feed's whole life (NOT inside StreamingRenderer — that lifecycle bug was fixed earlier). PIN_THRESHOLD=140px. Detach ONLY on genuine user upward scroll; re-pin ONLY on arrival at bottom; **any scrollTop delta coinciding with a layout-dimension change (>1px) is ignored — BOTH scrollHeight AND clientHeight are watched** (`_lastViewport`, added in `a90f0a9`) because browser clamps from content re-renders AND viewport churn (soft keyboard, mobile URL bar, scroll-anchoring) masquerade as upward drags and killed autoscroll.
- **Mobile keyboard auto-open** in chat.js: on touch devices (pointer:coarse / maxTouchPoints>0) focus composer ~350ms after mount (Android); iOS needs gesture so first touchend/mousedown outside `.chat-stream` also focuses (tapping messages stays text-selection).
- **Version guard** (`frontend/js/version-guard.js`): boots with build id from meta tag, re-fetches "/" every 90s (no-store), location.reload() if served id > booted id AND tab visible AND no stream painting. Solves "stale SPA tab runs old code across deploys".
- Greeting placeholders (composer.js `greetingPlaceholder()`): NO dashes anywhere (user hates them).

## Bugs fixed today (chronological)
1. Scroll button only existed during generation → moved followership to MessageFeed-owned ScrollFollower (commit `7020f9b`).
2. Composer color didn't change despite token edit → root cause: dark-theme group selector forced `.composer-box { background: var(--canvas) }` overriding `--input-bar`. Removed `.composer-box` from that group (commit `316a28f`). Color NOW confirmed working by user.
3. Autoscroll died mid-response → clamp-vs-gesture fix above (commit `0e239a4`).
4. Stale-tab confusion led to version-guard (commit `67100a5`).
- DB probe confirmed reasoning IS persisted fine (rows carry up to ~14k chars; `add_message` returns full row incl. reasoning; SSE `assistant_message` carries it). Earlier "thought process hides after save" reports were the open:true/settle-rebuild interaction — superseded by manual-collapse policy.

## Known TODO / loose ends
1. ~~Bump bimo-build meta~~ — done twice today (1787714297 @ `02776b7`, 1787718538 @ `a90f0a9`); keep bumping per deploy.
2. ~~Adopt regression suite into repo~~ — done (`frontend/test-scroll-follower-regression.mjs`, jsdom devDep, `npm test`).
3. User should hard-refresh once (Ctrl+Shift+R / PWA reopen) to pick up build 1787718538; the guard now auto-reloads idle tabs within ~90s of the next deploy.
4. Concurrent-session note: a parallel workstream landed feed reconciliation + PGRST303 retry in `a90f0a9` (same commit — version chain interlocked).

## Verification commands
- `cd ~/Projects/bimo/backend && .venv/bin/python -m pytest tests/ -q`
- `node frontend/test-stream-splitter.mjs`
- `node frontend/test-version-guard.mjs`
- Live checks: `curl -s https://bimo.qzz.io/ | grep -o 'main.js?v=[0-9]*'`
- Supabase probes need: `cd backend && set -a && . ./.env && set +a` (never echo values)
