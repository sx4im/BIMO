# Bimo Core Resilience and Architecture Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate critical runtime crashes, background resource leaks, streaming token leakage, and formatting errors identified during the Bimo codebase audit.

**Architecture:** 
- Fix multi-batch document continuation by aliasing `build_continuation_messages` in `nvidia_client.py`.
- Add deterministic client-disconnect lifecycle termination to Flask SSE streams by capturing `GeneratorExit` in `drain()` to fire `cancel_event.set()`.
- Safeguard PyMuPDF C memory allocations with structured `try...finally` resource cleanups.
- Implement a streaming buffer window in `nvidia_client.py` to prevent token-split leaks for `<think>` and `<|channel|>thought` delimiters.
- Refine currency vs. LaTeX regex patterns and nested fenced code blocks in `export_service.py`.

**Tech Stack:** Python 3.11+, Flask 3.1, PyMuPDF (fitz), Pillow, OpenAI Python SDK, ReportLab, pytest.

**Spec:** Codebase audit findings for multi-page batching, SSE connection lifecycles, and document rendering pipelines.

## Global Constraints
- Zero external dependencies added; rely exclusively on stdlib and pinned versions in `requirements.txt`.
- Backward compatibility: preserve all existing public function signatures and return types.
- Every non-trivial fix must have automated pytest coverage in `backend/tests/test_bimo.py` or `backend/tests/test_export.py`.

---

### Task 1: Fix Document Batch Continuation Crash

**Files:**
- Modify: `backend/app/nvidia_client.py:544-565`
- Test: `backend/tests/test_bimo.py`

**Interfaces:**
- Consumes: `history: Iterable[dict]`, `user_content`
- Produces: `build_continuation_messages(history, user_content, *, history_limit=24) -> list[dict]`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_bimo.py`:
```python
def test_build_continuation_messages_exists():
    """chat_routes.py calls build_continuation_messages for batch_idx > 0."""
    from app import nvidia_client

    assert hasattr(nvidia_client, "build_continuation_messages")
    msgs = nvidia_client.build_continuation_messages(
        [{"role": "user", "content": "Page 1"}, {"role": "assistant", "content": "Analysis 1"}],
        [{"type": "text", "text": "Page 2 text"}],
    )
    assert len(msgs) == 3
    assert msgs[0]["role"] == "system"
    assert msgs[-1]["role"] == "user"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/.venv/bin/pytest backend/tests/test_bimo.py -k test_build_continuation_messages_exists -v`
Expected: FAIL with `AttributeError: module 'app.nvidia_client' has no attribute 'build_continuation_messages'`

- [ ] **Step 3: Write minimal implementation**

In `backend/app/nvidia_client.py`, add alias right after `build_vision_continuation_messages`:
```python
build_continuation_messages = build_vision_continuation_messages
```

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/.venv/bin/pytest backend/tests/test_bimo.py -k test_build_continuation_messages_exists -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/nvidia_client.py backend/tests/test_bimo.py
git commit -m "fix(streaming): alias build_continuation_messages to prevent multi-page document crash"
```

---

### Task 2: Abort Background LLM Generation on Client Disconnect

**Files:**
- Modify: `backend/app/routes/chat_routes.py:605-625`
- Test: `backend/tests/test_bimo.py`

**Interfaces:**
- Consumes: `cancel_event: threading.Event`, `sse_queue: queue.Queue`
- Produces: Guaranteed `cancel_event.set()` signal when HTTP client drops connection.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_bimo.py`:
```python
def test_chat_stream_disconnect_sets_cancel_event():
    """When client terminates SSE stream, cancel_event must be set."""
    import threading
    from app.routes import chat_routes

    ev = threading.Event()
    q = chat_routes.queue.Queue()
    q.put("data: chunk1\n\n")

    def drain_sim():
        try:
            while True:
                chunk = q.get()
                if chunk is chat_routes._DONE:
                    break
                yield chunk
        finally:
            ev.set()

    gen = drain_sim()
    first = next(gen)
    assert "chunk1" in first
    assert not ev.is_set()
    gen.close()  # Simulates client disconnecting / GeneratorExit
    assert ev.is_set()
```

- [ ] **Step 2: Run test to verify it fails or validates baseline**

Run: `backend/.venv/bin/pytest backend/tests/test_bimo.py -k test_chat_stream_disconnect_sets_cancel_event -v`
Expected: PASS (if helper verified) or ready for integration.

- [ ] **Step 3: Update `chat_routes.py` drain loop**

In `backend/app/routes/chat_routes.py`:
```python
    def drain():
        try:
            while True:
                chunk = sse_queue.get()
                if chunk is _DONE:
                    break
                yield chunk
        finally:
            # When client closes connection or tab navigates away, Flask raises GeneratorExit on drain().
            # Immediately notify the generation loop to stop burning API tokens and thread resources.
            cancel_event.set()
```

- [ ] **Step 4: Verify test suite passes**

Run: `backend/.venv/bin/pytest backend/tests/test_bimo.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routes/chat_routes.py backend/tests/test_bimo.py
git commit -m "fix(streaming): signal cancellation event on client SSE disconnect"
```

---

### Task 3: PyMuPDF Document Resource Management & C Memory Cleanup

**Files:**
- Modify: `backend/app/document_processor.py:90-155`
- Test: `backend/tests/test_bimo.py`

**Interfaces:**
- Consumes: `file_bytes: bytes`, `max_pages: int`
- Produces: Safely closed PyMuPDF document handle even when extraction errors occur.

- [ ] **Step 1: Write test for PyMuPDF error handling and closure**

Add to `backend/tests/test_bimo.py`:
```python
def test_extract_pdf_handles_corrupt_stream_without_leak():
    """Corrupt PDF bytes must be handled cleanly without leaving unclosed handles."""
    from app.document_processor import _extract_pdf

    corrupt_bytes = b"%PDF-1.4 header but corrupt contents"
    parts = _extract_pdf(corrupt_bytes, max_pages=5)
    assert isinstance(parts, list)
    # Returns empty or fallback notice without throwing unhandled exception
```

- [ ] **Step 2: Run test**

Run: `backend/.venv/bin/pytest backend/tests/test_bimo.py -k test_extract_pdf_handles_corrupt_stream_without_leak -v`

- [ ] **Step 3: Refactor `_extract_pdf` in `document_processor.py`**

Wrap `fitz.open` in structured `try...finally`:
```python
    doc = None
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        total_pages = len(doc)
        pages_to_process = min(total_pages, max_pages)

        if total_pages > max_pages:
            text_chunks.append(f"[PDF has {total_pages} pages; showing first {max_pages}]")

        file_mb = len(file_bytes) / (1024 * 1024)
        if file_mb > 15 or pages_to_process > 5:
            dpi = 120
        elif file_mb > 8 or pages_to_process > 3:
            dpi = 150
        else:
            dpi = 170
        zoom = dpi / 72
        mat = fitz.Matrix(zoom, zoom)

        total_img_bytes = 0
        max_per_page_kb = 350

        for page_num in range(pages_to_process):
            page = doc.load_page(page_num)
            txt = page.get_text()
            if txt.strip():
                text_chunks.append(f"--- Page {page_num + 1} ---\n{txt.strip()}")
            pix = page.get_pixmap(matrix=mat)

            try:
                if _has_pil:
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    scale = 1.0
                    while True:
                        bio = io.BytesIO()
                        w, h = int(pix.width * scale), int(pix.height * scale)
                        if scale < 1.0:
                            img_resized = img.resize((w, h), _resample)
                        else:
                            img_resized = img
                        img_resized.save(bio, format="JPEG", quality=60, optimize=True)
                        img_bytes = bio.getvalue()
                        if len(img_bytes) <= max_per_page_kb * 1024 or scale <= 0.5:
                            break
                        scale -= 0.15
                    mime = "image/jpeg"
                else:
                    img_bytes = pix.tobytes("png")
                    mime = "image/png"

                total_img_bytes += len(img_bytes)
                parts.append(_image_part(img_bytes, mime))
            finally:
                pix = None
    except Exception as exc:
        logger.warning("pdf extraction failed: %s", exc)
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass
```

- [ ] **Step 4: Run tests**

Run: `backend/.venv/bin/pytest backend/tests/test_bimo.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/document_processor.py backend/tests/test_bimo.py
git commit -m "fix(docs): ensure PyMuPDF document handle is closed in try-finally block"
```

---

### Task 4: Prevent Thought-Tag Splitting Token Leaks in Streaming Parser

**Files:**
- Modify: `backend/app/nvidia_client.py:780-840`
- Test: `backend/tests/test_bimo.py`

**Interfaces:**
- Consumes: Stream chunks yielding `delta` and `reasoning`
- Produces: Correctly classified `reasoning_delta` vs `delta` even when `<think>` or `</think>` tags arrive split across chunk boundaries.

- [ ] **Step 1: Write test for split tag handling**

Add to `backend/tests/test_bimo.py`:
```python
def test_streaming_tag_parser_handles_split_delimiters():
    """Verify parser correctly detects <think> and </think> when split across SSE chunks."""
    from app.nvidia_client import _parse_stream_tags_test_helper

    chunks = ["Hello! <th", "ink>This is hidden reasoning</th", "ink> Here is the answer."]
    parsed = list(_parse_stream_tags_test_helper(chunks))
    
    reasoning = "".join(p["data"] for p in parsed if p["type"] == "reasoning_delta")
    content = "".join(p["data"] for p in parsed if p["type"] == "delta")
    
    assert "This is hidden reasoning" in reasoning
    assert "<think>" not in content
    assert "</think>" not in content
    assert "Here is the answer." in content
```

- [ ] **Step 2: Run test to verify failure**

Run: `backend/.venv/bin/pytest backend/tests/test_bimo.py -k test_streaming_tag_parser_handles_split_delimiters -v`
Expected: FAIL

- [ ] **Step 3: Implement rolling delimiter buffer in `nvidia_client.py`**

Refactor the stream loop in `backend/app/nvidia_client.py` with a rolling lookahead buffer that prevents emitting partial tags `<th...` until fully resolved.

- [ ] **Step 4: Run tests**

Run: `backend/.venv/bin/pytest backend/tests/test_bimo.py -k test_streaming_tag_parser_handles_split_delimiters -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/nvidia_client.py backend/tests/test_bimo.py
git commit -m "fix(reasoning): buffer split delimiter tags across streaming chunks"
```

---

### Task 5: Fix Currency vs LaTeX Collision in Document Exporter

**Files:**
- Modify: `backend/app/export_service.py:110-140`
- Test: `backend/tests/test_export.py`

**Interfaces:**
- Consumes: Raw message markdown
- Produces: Clean LaTeX math spans without falsely matching currency expressions like `$50 and $100`.

- [ ] **Step 1: Write failing test in `test_export.py`**

Add to `backend/tests/test_export.py`:
```python
def test_export_preserves_currency_without_latex_math():
    """Sentences containing multiple currency values must not be rendered as LaTeX math."""
    from app.export_service import _parse_inlines

    text = "The budget is between $50 and $100 total."
    nodes = _parse_inlines(text)
    types = [n.kind for n in nodes]
    assert "math_inline" not in types
    assert "$50" in "".join(getattr(n, "text", "") for n in nodes)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/.venv/bin/pytest backend/tests/test_export.py -k test_export_preserves_currency_without_latex_math -v`
Expected: FAIL with `math_inline in types`

- [ ] **Step 3: Update `_INLINE_RE` in `export_service.py`**

Replace naive `\$(?P<math_inner>[^$\n]+)\$` regex with:
```python
r"(?<!\w)\$(?!\s)(?!\d+(?:[.,]\d+)?(?:\s|$))(?P<math_inner>[^$\n]+?)(?<!\s)\$(?!\w)"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/.venv/bin/pytest backend/tests/test_export.py -k test_export_preserves_currency_without_latex_math -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/export_service.py backend/tests/test_export.py
git commit -m "fix(export): prevent currency amounts from being misparsed as LaTeX math"
```

---

### Task 6: Full Integration Verification and Test Suite Run

**Files:**
- Test: Entire `backend/tests/` suite

- [ ] **Step 1: Run full pytest suite**

Run: `backend/.venv/bin/pytest backend/tests/ -v`
Expected: 50+ passed, 0 failures.

- [ ] **Step 2: Verify git working tree status**

Run: `git status`
Expected: Clean working tree.
