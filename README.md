# Mis Finanzas 💸

Personal finance management app with an AI-powered transaction pipeline. Bank notification emails are automatically parsed, analyzed by Gemini, and registered into a Firebase database — no manual data entry.

![Stack](https://img.shields.io/badge/React_19-Vite-blue) ![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange) ![Gemini](https://img.shields.io/badge/AI-Gemini_Flash-green) ![Python](https://img.shields.io/badge/Python-3.12-blue)

---

## How It Works

```
Gmail (bank emails)
      ↓  [Gmail API + label filter]
Email Parser
      ↓  [BeautifulSoup]
Gemini (gemini-3.1-flash-lite)
      ↓  [Structured JSON extraction]
Firestore
      ↓
React Dashboard
```

A GitHub Actions workflow runs every ~10 minutes and processes any email tagged `Bancos/PendingBot` in Gmail:

1. **Fetches** emails via the Gmail API
2. **Parses** the raw HTML body with BeautifulSoup
3. **Sends** the text to Gemini, which extracts a structured transaction (type, amount, category, subcategory, context, date, ...) in a single call
4. **Writes** the result to Firestore
5. **Removes** the Gmail label and records the message ID in the `processed_gmail_ids` Firestore collection

The pipeline is fully serverless — it runs on GitHub Actions, so no local machine is needed.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS |
| Auth & DB | Firebase Auth + Firestore |
| AI / LLM | Google Gemini API (`gemini-3.1-flash-lite`) |
| Email pipeline | Python 3.12, Gmail API, BeautifulSoup |
| Automation | GitHub Actions (scheduled workflow, every ~10 min) |
| CI/CD | GitHub Actions (deploy to Firebase Hosting on merge to `main`) |

---

## Features

- **Automatic transaction import** from Gmail — zero manual entry
- **Multi-context view** — personal, business, and unified finance tracking
- **Budgets (Presupuestos)** — set and track spending limits by category
- **Insights** — spending patterns and cash flow overview
- **Serverless pipeline** — runs on GitHub Actions, no laptop required
- **Cross-run deduplication** — processed email IDs stored in Firestore

---

## Setup

> **Full step-by-step setup** (GitHub secrets, OAuth token, Firestore rules): see [`SETUP_CRON.md`](./SETUP_CRON.md)

### Frontend — quick start

**Prerequisites:** Node.js

```bash
npm install
npm run dev
```

### Email pipeline

The sync runs automatically on GitHub Actions; see [`SETUP_CRON.md`](./SETUP_CRON.md) for the one-time setup. To run it locally for testing:

```bash
pip install -r requirements.txt
# requires GEMINI_API_KEY and FIREBASE_ADMIN_SDK_JSON environment variables
python3 gmail_finanzas_sync.py
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
├── gmail_finanzas_sync.py    # AI pipeline (Gmail → Gemini → Firestore)
├── utils.py                  # Shared Firestore connection helper
├── bootstrap_token.py        # One-time: seed/refresh the Gmail OAuth token in Firestore
├── bot_finanzas_ejemplo.py   # Local CLI for manual transaction entry
├── requirements.txt          # Python dependencies
├── .github/workflows/        # gmail_sync.yml (sync cron) + deploy.yml (hosting)
└── SETUP_CRON.md             # Full pipeline setup and operations guide
```
