# 📊 Tabularium

A dynamic synchronization tool for automatically syncing data from Google Sheets into PostgreSQL tables — with smart table inference, conflict-safe updates, and flexible scheduling.

---

## 🚀 Features

- 🔁 One-click manual sync or automated cron-based sync
- 🧠 Smart PostgreSQL table creation from Google Sheet headers
- 🛡️ Safe insert-only sync (no data deletion, no overwrite)
- 🆔 Prevents column conflicts (`id` becomes `id_from_sheet`)
- ⏱️ Custom sync intervals per configuration (e.g. `5m`, `1h`, `1d`)
- 🧩 Clean EJS-based web UI for managing your syncs
- 🌐 Google Sheet access using service account credentials

---

## 📂 Project Structure

```

src/
├── app.js              # Main Express server
├── routes/
│   └── sync-router.js  # All routes for configuration and sync
├── db/
│   └── index.js        # PostgreSQL connection pool
├── lib/
│   └── google-sheet.js # Sheet data fetch logic
├── jobs/
│   └── scheduler.js    # Cron job handler
└── views/
└── index.ejs       # Sync management UI

````

---

## 🧑‍💻 Installation

```bash
git clone https://github.com/liu-purnomo/tabularium.git
cd tabularium
npm install
````

---

## ⚙️ Configuration

Create a `.env` file:

```env
DATABASE_URL=postgres://user:password@localhost:5432/yourdb
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PORT=3000
```

> ⚠️ Use double quotes around the `GOOGLE_PRIVATE_KEY` to handle newline characters properly.

---

## 🧪 Run the App

```bash
npm run dev
```

Then open your browser at [http://localhost:3000](http://localhost:3000)

---

## 📝 How It Works

1. You register a new sync config via the web UI.
2. Tabularium reads the first row of your sheet to infer the table structure.
3. If the table doesn’t exist, it is created dynamically.
4. Data is inserted based on content difference (auto-sync only inserts new records).
5. Cron job runs every minute and syncs according to each interval (`5m`, `1h`, etc.)

---

## 🛠️ Commands

```bash
npm run dev        # Start in dev mode
npm start          # Start in production mode
npm run migrate    # (Optional) DB bootstrap logic
```

---

## 📌 Notes

* Sheet headers will be converted to `snake_case`.
* If a column is named `id`, it is renamed to `id_from_sheet`.
* All columns are stored as `TEXT` for maximum compatibility.
* Sheet data is expected in tabular form with a clear header row.

---

## 🔐 Security

* Only valid table names are allowed (`[a-zA-Z_][a-zA-Z0-9_]*`)
* Sync is locked during operation using `is_syncing` flag
* No destructive operations are performed

---

## 📖 License

[MIT](LICENSE)

---

## 💬 Feedback

Found a bug or have a feature idea?
Submit an issue at [https://github.com/liu-purnomo/tabularium/issues](https://github.com/liu-purnomo/tabularium/issues)

---

Made with ☕ by [liupurnomo.com](https://liupurnomo.com)
