# Mis Finanzas 💸

Personal finance management app with an AI-powered transaction pipeline. Bank notification emails are automatically parsed, analyzed by a local LLM, and registered into a Firebase database — no manual data entry, no external AI APIs.

![Stack](https://img.shields.io/badge/React_19-Vite-blue) ![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange) ![Ollama](https://img.shields.io/badge/LLM-Ollama_local-green) ![Python](https://img.shields.io/badge/Python-3.14-blue)

---

## How It Works

```
Gmail (bank emails)
      ↓  [Gmail API + label filter]
Email Parser
      ↓  [BeautifulSoup]
Local LLM (Ollama)
      ↓  [Structured JSON extraction]
Firestore
      ↓
React Dashboard
```

A cron job runs every 2 minutes and processes any email tagged `Bancos/PendingBot` in Gmail:

1. **Fetches** emails via Gmail API
2. **Parses** the raw HTML body with BeautifulSoup
3. **Sends** the text to a local Ollama model (llama3, mistral-nemo, etc.) which extracts structured transaction data
4. **Writes** the result to Firestore
5. **Marks** the email as processed (stored in `processed_gmail_ids` Firestore collection for cross-device deduplication)

Everything runs locally — no transaction data is sent to external APIs.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS |
| Auth & DB | Firebase Auth + Firestore |
| AI / LLM | Ollama (local inference) |
| Email pipeline | Python 3.14, Gmail API, BeautifulSoup |
| Automation | macOS cron |
| CI/CD | GitHub Actions (deploy to Firebase Hosting on merge to `main`) |

---

## Features

- **Automatic transaction import** from Gmail — zero manual entry
- **Multi-context view** — personal, business, and unified finance tracking
- **Budgets (Presupuestos)** — set and track spending limits by category
- **Insights** — spending patterns and cash flow overview
- **Local AI** — LLM runs on your machine, your data never leaves
- **Cross-device deduplication** — processed email IDs stored in Firestore, not local files

---

## Setup

> **Full step-by-step setup** (cron config, credentials, first run): see [`SETUP_CRON.md`](./SETUP_CRON.md)

### Quick start

**Prerequisites:** Node.js, Python 3.14, [Ollama](https://ollama.ai) running locally with at least one model pulled (e.g. `ollama pull mistral-nemo`)

```bash
# 1. Install frontend dependencies
npm install

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Add credentials (not in repo — see SETUP_CRON.md)
# - credentials.json       → Google OAuth 2.0 (Gmail API)
# - firebase-adminsdk-*.json → Firebase service account

# 4. First run (authorizes Gmail and generates token.json)
python3 gmail_finanzas_sync.py --model mistral-nemo

# 5. Start the frontend
npm run dev
```

---

## CI/CD

Merging a PR into `main` automatically triggers a deploy to Firebase Hosting via GitHub Actions.

```
PR merged to main → GitHub Actions → Firebase Hosting deploy
```

All significant changes must go through a PR — no direct pushes to `main`.

---

## Project Structure

```
├── src/                      # React frontend
│   ├── components/           # Header, Sidebar, Transactions, Presupuestos, Insights
│   ├── context/              # AuthContext, FinanceContext
│   └── firebase.js           # Firebase config
├── gmail_finanzas_sync.py    # Main AI pipeline (Gmail → Ollama → Firestore)
├── utils.py                  # Shared Firebase connection utilities
├── bot_finanzas_ejemplo.py   # CLI tool for inspecting/reprocessing emails
├── requirements.txt          # Python dependencies
└── SETUP_CRON.md             # Full cron setup and operations guide
```
