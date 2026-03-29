# Pixance

**Your financial fairy 🧚**

A personal finance Telegram bot that logs cashflow via natural language and stores everything in Google Sheets.

---

## Features

- **Natural language input** — just message the bot like you're texting a friend
- **Bilingual** — auto-detects Indonesian and English per message
- **AI-powered advice** — monthly financial summary and spending analysis via Claude
- **Pocket management** — categorize money across accounts, wallets, or e-wallets
- **Google Sheets as dashboard** — your data lives in a spreadsheet you can see, edit, and export
- **No balance tracking** — cashflow-first: income, expenses, and transfers only

---

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- A Telegram bot token — create one via [@BotFather](https://t.me/BotFather)
- A [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) API key
- A Google Cloud project with Sheets API + service account (see [Google Sheets Setup](#google-sheets-setup) below)
- A public HTTPS URL — use [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) for local dev

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/your-username/pixance.git
cd pixance
bun install
cp .env.example .env
```

### 2. Environment variables

Fill in `.env`:

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | ✅ | Telegram bot token from @BotFather |
| `OWNER_CHAT_ID` | ✅ | Your Telegram user ID — get it from [@userinfobot](https://t.me/userinfobot) |
| `AI_GATEWAY_API_KEY` | ✅ | Vercel AI Gateway API key |
| `AI_MODEL` | — | Model to use (default: `anthropic/claude-sonnet-4-5`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ | Full service account JSON as a string (see below) |
| `SPREADSHEET_ID` | ✅ | Google Sheets ID from the URL (see below) |
| `WEBHOOK_URL` | ✅ | Public HTTPS URL Telegram will POST updates to |
| `PORT` | — | Server port (default: `3000`) |

> **`OWNER_CHAT_ID`** locks the bot to a single user. To find your ID, message [@userinfobot](https://t.me/userinfobot) — it replies with your numeric user ID.

### 3. Google Sheets setup

Two separate things to get. Here's exactly how.

---

#### Spreadsheet ID

The easy one. Create a new Google Sheet, then grab the ID from the URL:

```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       this is your SPREADSHEET_ID
```

Copy the string between `/d/` and `/edit`. That's it.

---

#### Google Service Account JSON

This is the bot's identity — how it authenticates to the Sheets API without a browser login.

**Step 1 — Create a Google Cloud project**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown (top left) → **New Project**
3. Name it anything, e.g. `finance-bot` → **Create**

**Step 2 — Enable the Sheets API**
1. With your project selected, go to **APIs & Services → Library**
2. Search "Google Sheets API" → click it → **Enable**

**Step 3 — Create a service account**
1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → Service Account**
3. Name it anything, e.g. `finance-bot-sa` → **Create and Continue**
4. Skip the optional role and user access steps → **Done**

**Step 4 — Generate the JSON key**
1. Click your new service account from the credentials list
2. Go to the **Keys** tab
3. **Add Key → Create new key → JSON → Create**
4. A `.json` file downloads automatically — this is your `GOOGLE_SERVICE_ACCOUNT_JSON`

The file looks like:
```json
{
  "type": "service_account",
  "project_id": "finance-bot-xxxxx",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "client_email": "finance-bot-sa@finance-bot-xxxxx.iam.gserviceaccount.com",
  "client_id": "...",
  ...
}
```

**Step 5 — Share the spreadsheet with the service account**

> This is the step people most often forget.

The service account is like a separate Google user — it needs explicit access to your sheet.

1. Open your Google Sheet
2. Click **Share** (top right)
3. Paste the `client_email` from the JSON file
4. Set permission to **Editor**
5. **Send** (ignore the "can't notify" warning if it appears)

**Step 6 — Put it in your `.env`**

The entire JSON content goes in as a single-line string:

```bash
# Option A — paste the whole JSON as a string (wrap in single quotes)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"..."}'

# Option B — on Railway/cloud platforms, paste the raw JSON directly into the env var field
# Most deployment platforms handle multiline values fine in their UI
```

---

#### Quick checklist

```
✅ Google Cloud project created
✅ Google Sheets API enabled
✅ Service account created
✅ JSON key downloaded
✅ Spreadsheet created
✅ Spreadsheet shared with service account email (Editor)
✅ SPREADSHEET_ID copied from URL
✅ GOOGLE_SERVICE_ACCOUNT_JSON set in .env
```

If the bot throws a **403 error** on first run, the missing share in Step 5 is almost always why.

---

### 4. Local development webhook

Telegram requires a public HTTPS URL to deliver updates. Use [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) — no account needed.

```bash
# Install (macOS)
brew install cloudflare/cloudflare/cloudflared

# Expose your local port
cloudflared tunnel --url http://localhost:3000
```

Copy the printed `*.trycloudflare.com` URL and set it as `WEBHOOK_URL` in `.env`.

> **Note:** The URL changes every time you run cloudflared. Update `WEBHOOK_URL` and restart the bot each dev session.

### 5. Run

```bash
bun dev    # with hot reload
bun start  # without hot reload
```

---

## Usage

### Slash commands

| Command | Description |
|---|---|
| `/start` | Show help and active pockets |
| `/report [lang]` | Monthly financial summary (`lang`: `id` or `en`) |
| `/history [lang]` | Last 10 transactions |
| `/pockets` | List active pockets |
| `/pockets all` | List all pockets including archived |
| `/addpocket <name>` | Create a new pocket |
| `/renamepocket <old> <new>` | Rename a pocket (use quotes for names with spaces) |
| `/archivepocket <name>` | Archive a pocket |
| `/restorepocket <name>` | Restore an archived pocket |
| `/delete <n>` | Delete the nth most recent transaction |
| `/advice [lang]` | AI-powered financial advice for the current month |

### Natural language

Just send a message — the bot figures out the rest:

```
kopi 25rb pake gopay          → expense: coffee, 25k, Gopay pocket
gajian 8jt ke BCA             → income: salary, 8M, BCA pocket
transfer BCA ke Gopay 1jt     → transfer: 1M from BCA to Gopay
gimana kondisi keuangan aku?  → triggers financial advisor (Indonesian)
how's my spending this month? → triggers financial advisor (English)
```

---

## Deployment

```bash
# Build and start
docker compose up -d --build

# Update after git pull
git pull && docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

---

## Development

```bash
bun test      # run tests
bun lint      # lint with Biome
bun format    # format with Biome
bun check     # lint + format + fix
```
