# ⚡ Generator Store — Deployment Guide

This repository contains the Generator Store Ethiopia backend and storefront.
The backend is an Express app in `backend/` and serves the static frontend from `frontend/`.

---

## Project Layout

```
./
├── backend/
│   ├── server.js            ← Express entry point
│   ├── db/
│   │   ├── database.js      ← sql.js wrapper + DB helper
│   │   └── seed.js          ← seed data loader
│   ├── routes/
│   │   ├── admin.js
│   │   ├── categories.js
│   │   ├── orders.js
│   │   └── products.js
│   └── middleware/
│       └── adminAuth.js     ← Bearer token guard for admin routes
├── data/                    ← local SQLite database storage
├── frontend/                ← static storefront + admin UI
├── .env.example             ← example environment variables
├── package.json            ← scripts and dependencies
├── render.yaml             ← Render.com deployment config
└── README.md
```

---

## 1 — Requirements

- Node.js **18+**
- npm **9+**

The app runs with local SQLite (`data/store.db`) by default, or with Postgres if `DATABASE_URL` is set.

---

## 2 — Local Setup

### 2.1 Install dependencies

```powershell
npm install
```

### 2.2 Create `.env`

```powershell
copy .env.example .env
```

Edit `.env` and set your values:

```env
PORT=3000
NODE_ENV=development
WA_NUMBER=251911234567
STORE_NAME=ጀነሬተር ስቶር
STORE_PHONE=+251911234567
ADMIN_SECRET=your-long-secret
DATABASE_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_IDS=
ALLOWED_ORIGINS=
```

### 2.3 Seed the database

```powershell
npm run seed
```

### 2.4 Start locally

Development:

```powershell
npm run dev
```

Production:

```powershell
npm start
```

Open:

- `http://localhost:3000` — storefront
- `http://localhost:3000/admin` — admin panel

---

## 3 — API Reference

### Products

- `GET /api/products`
- `GET /api/products?cat=<categoryId>`
- `GET /api/products?q=<query>`
- `GET /api/products?inStock=1`
- `GET /api/products/:id`
- `POST /api/products` *(admin only)*
- `PATCH /api/products/:id` *(admin only)*
- `DELETE /api/products/:id` *(admin only)*

### Categories

- `GET /api/categories`
- `POST /api/categories` *(admin only)*
- `PATCH /api/categories/:id` *(admin only)*

### Orders

- `POST /api/orders`
- `POST /api/orders/enquiry`
- `GET /api/orders` *(admin only)*
- `GET /api/orders/stats` *(admin only)*
- `PATCH /api/orders/:id/status` *(admin only)*

### Health

- `GET /api/health`

### Admin authentication

Protected routes require:

```
Authorization: Bearer <ADMIN_SECRET>
```

Example:

```bash
curl -H "Authorization: Bearer your-secret" http://localhost:3000/api/orders
```

---

## 4 — Deploying

### Option A — Render.com

This app is ready to deploy as a single Node web service.
The backend serves the storefront directly from `frontend/`, so you do not need a separate frontend service.

1. Push the repo to GitHub.
2. Connect the repository to Render.
3. Use the existing `render.yaml` configuration.
4. Set these environment variables in Render:

- `NODE_ENV=production`
- `PORT=3000`
- `WA_NUMBER=251911234567`
- `STORE_NAME=ጀነሬተር ስቶር`
- `STORE_PHONE=+251911234567`
- `ADMIN_SECRET=<your-secret>`
- `TELEGRAM_BOT_TOKEN=<bot-token>`
- `TELEGRAM_CHAT_IDS=<chat-id1,chat-id2>`
- `ALLOWED_ORIGINS=` *(optional — leave blank to allow all origins)*

Render will run:

```bash
npm install
npm start
```

Because the frontend and API are served together from one Node process, the storefront loads immediately and avoids a Render intro placeholder.

If `DATABASE_URL` is unset, the app uses local SQLite in `data/store.db`.

### Option B — VPS / Ubuntu

1. Install Node.js 18+ and npm.
2. Clone the repo.
3. Install dependencies:

```bash
npm install
```

4. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

5. Edit `.env`.
6. Seed the database:

```bash
npm run seed
```

7. Start the app:

```bash
npm start
```

Use a process manager such as `pm2` or `systemd`.

### Option C — Docker

Use a Dockerfile like this:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t generator-store .
docker run -d -p 3000:3000 \
  -e NODE_ENV=production \
  -e ADMIN_SECRET="<your-secret>" \
  -e WA_NUMBER="251911234567" \
  -e STORE_PHONE="+251911234567" \
  -e STORE_NAME="ጀነሬተር ስቶር" \
  generator-store
```

---

## 5 — Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (default `3000`) |
| `NODE_ENV` | No | `development` or `production` |
| `WA_NUMBER` | Yes | WhatsApp number |
| `STORE_NAME` | No | Store name |
| `STORE_PHONE` | No | Store phone number |
| `ADMIN_SECRET` | Yes | Bearer token for admin routes |
| `DATABASE_URL` | No | Optional Postgres connection string |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token |
| `TELEGRAM_CHAT_IDS` | No | Telegram chat IDs (comma-separated) |
| `ALLOWED_ORIGINS` | No | Allowed CORS origins |

If `DATABASE_URL` is empty, the app uses local SQLite in `data/store.db`.

---

## 6 — Useful Commands

```bash
npm install      # install dependencies
npm run dev      # dev server with nodemon
npm start        # start production server
npm run seed     # seed initial data
```

---

## 7 — Notes

- Do not deploy with `ADMIN_SECRET=tarik@2501`.
- Do not commit `.env` with real credentials.
- Use HTTPS and restrict `ALLOWED_ORIGINS` in production.
