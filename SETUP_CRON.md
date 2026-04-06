# Gmail → Firebase Sync — Cron Setup

This cron job runs `gmail_finanzas_sync.py` every 2 minutes to automatically import bank transactions from Gmail into Firebase, using a **local LLM (Ollama)** to parse unstructured email content into structured financial data — no external AI API required.

---

## How it works

1. Polls Gmail for emails labeled as bank transactions
2. Passes the raw email body to a local Ollama model
3. The model extracts: amount, merchant, date, transaction type
4. Saves the structured record to Firestore
5. Marks the Gmail message ID as processed (deduplication)

---

## Prerequisites

- **Python 3.14** via Homebrew (`/opt/homebrew/bin/python3`)
- **Ollama** running locally with a model (e.g. `mistral-nemo`, `llama3`)
- A **Google Cloud project** with the Gmail API enabled
- A **Firebase project** with Firestore enabled

---

## Setup (new machine)

### 1. Install Python 3.14

```bash
brew install python@3.14
/opt/homebrew/bin/python3 --version   # should show Python 3.14.x
```

### 2. Clone the repository

```bash
git clone <repo-url> ~/Documents/Finanzas
cd ~/Documents/Finanzas
```

### 3. Install dependencies

```bash
/opt/homebrew/bin/pip3 install -r requirements.txt
```

### 4. Add secret files

Two files are required but not committed (listed in `.gitignore`):

| File | Where to get it |
|------|----------------|
| `credentials.json` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (Desktop App, Gmail API enabled) → Download JSON |
| `firebase-adminsdk-*.json` | Firebase Console → Project Settings → Service Accounts → Generate new private key |

Place both files in the project root (`~/Documents/Finanzas/`).

### 5. First run — authorize Gmail access

Run the script manually once to complete the OAuth flow:

```bash
cd ~/Documents/Finanzas
/opt/homebrew/bin/python3 gmail_finanzas_sync.py --model mistral-nemo
```

A browser window will open for Gmail authorization. This generates `token.json` locally — subsequent runs (including the cron) use this token silently.

---

## Install the cron job

1. Open the crontab editor:
   ```bash
   crontab -e
   ```

2. Add this line (replace `YOUR_USERNAME`):
   ```
   */2 * * * * cd /Users/YOUR_USERNAME/Documents/Finanzas && /opt/homebrew/bin/python3 gmail_finanzas_sync.py --model mistral-nemo >> /Users/YOUR_USERNAME/Documents/Finanzas/cron_sync.log 2>&1
   ```

3. Save and close (`:wq` in vim, `Ctrl+X` in nano).

4. Verify it was registered:
   ```bash
   crontab -l
   ```

---

## Deduplication

Each processed Gmail message ID is recorded in a Firestore collection:

```
processed_gmail_ids/{message_id}
  └── processed_at: "2026-03-03T20:21:49.737014"  (ISO UTC)
```

This makes the sync stateless across machines — if you run the cron from multiple devices, each message is only imported once.

---

## Debugging

### View logs in real time

```bash
tail -f ~/Documents/Finanzas/cron_sync.log
```

### Inspect processed messages

```bash
/opt/homebrew/bin/python3 bot_finanzas_ejemplo.py processed           # last 10 (default)
/opt/homebrew/bin/python3 bot_finanzas_ejemplo.py processed --limit 5
```

### Re-process a message

```bash
/opt/homebrew/bin/python3 bot_finanzas_ejemplo.py unprocess 19b7fad473750518
```

Removes the Firestore record so the next cron run picks it up again.

---

## Notes

- **`--model` flag**: swap the Ollama model as needed. Tested with `mistral-nemo`, `llama3`, `gemma2`.
- **Lock file**: the script creates `gmail_sync.lock` on start and removes it on exit. If a previous run is still active, the new instance exits immediately — no duplicate writes.
- **macOS permissions**: if the cron silently fails, check System Settings → Privacy & Security → Full Disk Access and add `/usr/sbin/cron`.
- **Dependabot**: configured in `.github/dependabot.yml` to check `requirements.txt` for updates every Monday and open PRs automatically.

---

## Remove the cron job

```bash
crontab -e
# Delete the line, save and close
```

To remove all cron jobs at once:

```bash
crontab -r
```
