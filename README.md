# 🍎 Orchard Sync

**Orchard Sync** is the bridge between the physical farming reality (Supabase DB) and the external brain (Oracle Framework / Markdown Logs). It operates on a "Low Code + Backend Scripts" philosophy to maintain simplicity and reliability.

## 🌟 Philosophy

- **Simple > Fancy**: No complex two-way syncs.
- **Append Only**: History is preserved.
- **Mobile First (Logic)**: Designed to work with mobile-ready database dashboards.

## 🛠️ Components

### 1. `sync.js` (The Chronicler)
Fetches daily activity logs from Supabase and appends them to structured Markdown files in the Oracle memory (`ψ/memory/logs/orchard/farming/`).

### 2. `remind.js` (The Sentinel)
Checks for pending tasks or upcoming due dates and sends notifications via Telegram/Slack.

### 3. `add.js` (The Inserter)
A simple CLI for quick data entry when full dashboard access is unnecessary.

## 🚀 Setup & Usage

1. **Clone & Install**
   ```bash
   git clone https://github.com/mojisejr/oracle-orchard-sync.git
   cd oracle-orchard-sync
   npm install
   ```

2. **Environment Setup**
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

3. **Run Scripts**
   ```bash
   # Manual Sync (Dry Run)
   node scripts/sync.js --dry-run
   
   # Check Reminders
   node scripts/remind.js
   ```

## 🏗️ Project Structure

```
projects/orchard-sync/
├── lib/           # Shared logic (DB client, Notifiers)
├── scripts/       # Executable agents
├── data/          # (Optional) Local temp data
└── package.json
```

---
*Maintained by the Oracle Framework*
