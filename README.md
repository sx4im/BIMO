<div align="center">

<h1><img src=".github/assets/bimo-logo.svg" alt="Bimo logo" width="70" align="absmiddle" /> Bimo</h1>

A streaming AI chat workspace and agent built on a plain JavaScript frontend and a Flask backend proxying NVIDIA inference and Supabase storage.

[![Live demo](https://img.shields.io/badge/Live_demo-bimo.qzz.io-d97757?style=flat-square)](https://bimo.qzz.io)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg?style=flat-square)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/sx4im/BIMO?style=flat-square)](https://github.com/sx4im/BIMO/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/sx4im/BIMO?style=flat-square)](https://github.com/sx4im/BIMO/network/members)
[![Issues](https://img.shields.io/github/issues/sx4im/BIMO?style=flat-square)](https://github.com/sx4im/BIMO/issues)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-gateway-000000?style=flat-square&logo=flask)](https://flask.palletsprojects.com/)

[Live demo](https://bimo.qzz.io) | [Report an issue](https://github.com/sx4im/BIMO/issues)

</div>

---

## What is Bimo

Bimo is a proprietary AI chat app and agent workspace. It streams responses token by token over Server-Sent Events, renders Markdown, code blocks, and math formulas as they arrive, and supports image generation, document parsing, and voice interaction.

The browser client uses HTML, CSS, and plain ES modules without build tools, frameworks, or bundlers. The backend is a Flask gateway that authenticates Supabase user tokens, enforces rate limits, and routes inference to NVIDIA endpoints.

## Explainer video

[![Watch Explainer Video](./.github/assets/video-thumbnail.png)](https://youtu.be/WJKiZpZar2E)

---

## Features

- **Passwordless authentication**: Sign in with Google through Supabase OAuth. Tokens are verified using ES256 JWTs against project JWKS keys.
- **Live streaming**: Responses stream using Server-Sent Events with inline Markdown, syntax-highlighted code blocks, and KaTeX rendering.
- **Model routing**: Switch between fast answers (Aeon 2.0), coding and math (Stanza 2.5), deep reasoning (Nexos 3.0), and image generation (Iris 1.0).
- **Document parsing**: Drop in PDF, DOCX, XLSX, PPTX, or ZIP files to extract text and analyze contents.
- **Vision processing**: Attach images to route prompts to a vision model.
- **Voice assistant**: Speech to text and text to speech powered by NVIDIA Riva.
- **Server cancellation**: Stopping a response halts generation on the server immediately using an internal stream registry.

## System architecture

```text
                     Google OAuth
  Browser  ───────────────────────────────>  Supabase Auth
     │  <───────────────  ES256 JWT  ──────────────┘
     │
     │   Authorization: Bearer <jwt>
     ▼
┌──────────────────────────────────────────────────────────┐
│                      Flask gateway                       │
│  • Verifies JWTs against Supabase JWKS                   │
│  • Enforces row-level security with service-role key     │
│  • Controls SSE token streams and cancellation           │
└──────────────────────────────────────────────────────────┘
     │                 │                      │
     ▼                 ▼                      ▼
 Supabase          Supabase            NVIDIA endpoints
 Postgres          Storage             • Chat (SSE)
 (RLS)             (Signed URLs)       • Vision & Images
                                       • Riva ASR & TTS
```

## Quick start

### Prerequisites
Python 3.11+, a Supabase account, and an NVIDIA API key.

### 1. Database setup
Run the SQL scripts in `backend/migrations/` in numerical order inside your Supabase project SQL editor.

### 2. Start the backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.main
```
Verify the server with `curl http://localhost:8000/health`.

### 3. Start the frontend
```bash
cd frontend
python -m http.server 5500
```
Open `http://localhost:5500` in your browser. Configure your Supabase URL and backend origin in Settings.

## Project structure

```text
BIMO/
├── backend/
│   ├── app/
│   │   ├── main.py                Flask gateway, streaming routes, model map
│   │   ├── auth.py                JWT and JWKS authentication verification
│   │   ├── store.py               Postgres and Storage data operations
│   │   ├── nvidia_client.py       Inference wrapper for OpenAI SDK and NIM
│   │   ├── riva_transcribe.py     Riva speech-to-text integration
│   │   ├── riva_tts.py            Riva text-to-speech integration
│   │   ├── document_processor.py  File parser for PDF, DOCX, XLSX, PPTX, ZIP
│   │   └── analytics.py           Usage metrics calculation
│   ├── migrations/                SQL schema and security policies
│   └── tests/                     Backend unit and API tests
├── frontend/
│   ├── index.html                 Single-page application markup
│   ├── css/styles.css             CSS tokens and component layout
│   └── js/                        Plain ES module components
├── render.yaml                    Render deployment configuration
└── vercel.json                    Vercel frontend configuration
```

## Security

1. **No direct database access**: Requests route through the Flask gateway, which checks identity before accessing data.
2. **Row level security**: Supabase Postgres rules restrict row access to the owning user ID.
3. **Server secrets**: Service role keys and NVIDIA API keys stay on the backend server.
4. **Token verification**: ES256 tokens validate against project JWKS keys on every request.

## Testing

Run tests with pytest:

```bash
cd backend
pytest -v
```

## License

This software is proprietary and confidential. Copyright (c) 2026 Saim Shafique. All rights reserved.
