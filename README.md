# ⚡ Generator Store — Backend

Node.js / Express backend for the Generator Store Ethiopia single-page storefront.
The frontend (`public/index.html`) is **untouched** — the backend sits behind it as an API
and serves the HTML as a static file.

---

## Project Layout

```
generator-store/
├── backend/
│   ├── server.js            ← Express entry point
│   ├── db/
│   │   ├── database.js      ← sql.js wrapper (SQLite, no native build)
│   │   └── seed.js          ← one-time data population
│   ├── routes/
│   │   ├── products.js      ← GET/POST/PATCH/DELETE /api/products
│   │   ├── categories.js    ← GET/POST/PATCH /api/categories
│   │   └── orders.js        ← POST/GET /api/orders + stats + enquiries
│   └── middleware/
│       └── adminAuth.js     ← Bearer-token guard for admin routes
├── public/
│   └── index.html           ← your original HTML (served as-is)
├── data/                    ← created automatically; holds store.db
├── .env.example
├── .gitignore
└── package.json
```

---

## 1 — Prerequisites

| Tool | Minimum version | Check |
|------|-----------------|-------|
| Node.js | **18** | `node --version` |
| npm | 9+ | `npm --version` |

No database server is needed. SQLite runs in-process via [sql.js](https://sql.js.org) (pure WebAssembly — no native compilation).

---

## 2 — Local Setup (IDE)

### 2a. Clone / open the project

If you received this as a zip, extract it and open the folder in VS Code, WebStorm, or your preferred IDE.

### 2b. Install dependencies

```bash
npm install
```

### 2c. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your real values:

```env
PORT=3000
NODE_ENV=development

# Your WhatsApp business number (digits only, no + or spaces)
WA_NUMBER=251911234567
STORE_NAME=ጀነሬተር ስቶር
STORE_PHONE=+251911234567

# CHANGE THIS — used to protect /api/admin/* and /api/orders (GET) routes
ADMIN_SECRET=choose-a-long-random-string
```

### 2d. Seed the database

Populates all 12 products and 6 categories from the original store into SQLite.
Run this **once**; re-running it is safe (uses INSERT OR IGNORE).

```bash
npm run seed
```

You should see:
```
✅  Seeded 6 categories and 12 products.
```

### 2e. Start the development server

```bash
npm run dev
```

Open your browser at **http://localhost:3000** — you will see the storefront.

### 2f. Access the Admin Panel

Open your browser at **http://localhost:3000/admin** to access the administration panel.

- **Authentication Password**: Enter the `ADMIN_SECRET` defined in your `.env` file (Default is `change-me-before-deploy`).
- **Features**: 
  - View sales statistics and analytics.
  - Create and edit categories and products.
  - Set product discounts with original price (strikethrough display) and current price.
  - Add marketing descriptions / promotion copy in English and Amharic.
  - Manage and track customer orders, updating their lifecycle status.

To confirm the API is alive:

```
http://localhost:3000/api/health
http://localhost:3000/api/products
http://localhost:3000/api/categories
```

---

## 3 — API Reference

All API routes are under `/api`. JSON request/response.

### Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/products` | — | List all active products |
| GET | `/api/products?cat=Generators` | — | Filter by category id |
| GET | `/api/products?q=honda` | — | Full-text search |
| GET | `/api/products?inStock=1` | — | In-stock only |
| GET | `/api/products/:id` | — | Single product |
| POST | `/api/products` | Admin | Create product |
| PATCH | `/api/products/:id` | Admin | Update any field |
| DELETE | `/api/products/:id` | Admin | Soft-delete (sets active=0) |

### Categories

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/categories` | — | All categories ordered by sort_order |
| POST | `/api/categories` | Admin | Create category |
| PATCH | `/api/categories/:id` | Admin | Rename / reorder |

### Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/orders` | — | Log a cart order (call before opening WhatsApp) |
| POST | `/api/orders/enquiry` | — | Log an "ask us" tap |
| GET | `/api/orders` | Admin | List all orders (supports `?status=pending`) |
| GET | `/api/orders/stats` | Admin | Revenue, channel breakdown, top products |
| PATCH | `/api/orders/:id/status` | Admin | Update order status |

### Health

```
GET /api/health  →  { status: "ok", store: "...", env: "...", ts: "..." }
```

### Authentication (Admin)

Protected routes require:

```
Authorization: Bearer <ADMIN_SECRET>
```

Example (curl):

```bash
# List orders
curl -H "Authorization: Bearer your-secret" http://localhost:3000/api/orders

# Create a product
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret" \
  -d '{
    "name_am": "Honda 3KVA",
    "name_en": "Honda 3KVA",
    "cat_id": "Generators",
    "price": 28000,
    "in_stock": 1,
    "icon": "⚡",
    "desc_am": "ለቤት ተስማሚ",
    "desc_en": "Ideal for home use"
  }'

# Toggle stock
curl -X PATCH http://localhost:3000/api/products/4 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret" \
  -d '{"in_stock": 1}'
```

---

## 4 — Connecting the Frontend to the API (optional)

The frontend currently works standalone — products are hardcoded in the HTML's `PRODUCTS` array.
You can optionally make it API-driven by adding a few lines to `public/index.html`.

Locate the `// INIT` line near the bottom of the `<script>` and replace the hardcoded `PRODUCTS` + `CATEGORIES` arrays with a fetch:

```javascript
// Replace the static arrays with:
async function loadFromApi() {
  const [catRes, prodRes] = await Promise.all([
    fetch('/api/categories').then(r => r.json()),
    fetch('/api/products').then(r => r.json()),
  ]);

  // Rebuild CATEGORIES format
  CATEGORIES = [
    { id: 'all', am: 'ሁሉም', en: 'All' },
    ...catRes.data.map(c => ({ id: c.id, am: c.label_am, en: c.label_en })),
  ];

  // Rebuild PRODUCTS format
  PRODUCTS = prodRes.data.map(p => ({
    id: p.id, am: p.name_am, en: p.name_en,
    catId: p.cat_id, catAm: p.cat_id, catEn: p.cat_id,
    price: p.price, inStock: p.in_stock === 1,
    icon: p.icon, descAm: p.desc_am, descEn: p.desc_en,
  }));

  renderCats(); renderProducts(); renderFooterLinks();
}

loadFromApi(); // replaces: renderCats();renderProducts();renderFooterLinks();
```

To also log orders before opening WhatsApp, add before `window.open(...)` in `orderCartViaWA()`:

```javascript
await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channel: 'whatsapp',
    lang: currentLang,
    items: cart.map(x => ({ id: x.id, qty: x.qty })),
  }),
}).catch(() => {}); // silent — never block the WhatsApp link
```

---

## 5 — Deployment

### Option A — VPS / Linux server (recommended for Ethiopia)

1. **Upload the project** (rsync, scp, or git push):

```bash
rsync -avz --exclude node_modules --exclude data --exclude .env \
  ./generator-store/ user@your-server:/var/www/generator-store/
```

2. **On the server**, install dependencies and seed:

```bash
cd /var/www/generator-store
npm install --omit=dev
cp .env.example .env   # then nano .env and set real values
npm run seed
```

3. **Run with PM2** (process manager — keeps the app alive):

```bash
npm install -g pm2
pm2 start backend/server.js --name generator-store
pm2 save
pm2 startup        # follow the printed command to enable on reboot
```

4. **Nginx reverse proxy** (serves port 80/443, forwards to Node on 3000):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

5. **HTTPS with Let's Encrypt**:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

6. **Set `ALLOWED_ORIGINS`** in `.env` once you have a domain:

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Then `pm2 restart generator-store`.

---

### Option B — Railway / Render / Fly.io (zero-server PaaS)

These platforms auto-detect Node.js projects.

**Important**: sql.js stores the database as a local file. Most PaaS platforms have **ephemeral filesystems** — data is lost on redeploy. For persistent data on PaaS:

- Use **Railway** with a persistent volume (free tier available)
- Or swap the database layer for **Turso** (remote SQLite, free tier) — the `prepare()` and `transaction()` API in `database.js` would only need minor changes
- Or use **Railway + PostgreSQL** / **Supabase** and adapt the queries (all are standard SQL)

For a quick test deploy on Railway:

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

Set environment variables in the Railway dashboard under Variables.

---

### Option C — Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p data
EXPOSE 3000
CMD ["npm", "run", "seed", "&&", "node", "backend/server.js"]
```

Or with a shell entrypoint:

```bash
# entrypoint.sh
#!/bin/sh
npm run seed
exec node backend/server.js
```

---

## 6 — Environment Variables Summary

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | TCP port the server listens on |
| `NODE_ENV` | No | `development` | `production` enables combined log format |
| `WA_NUMBER` | Yes | `251911234567` | WhatsApp business number (digits only) |
| `STORE_NAME` | No | `ጀነሬተር ስቶር` | Shown in health endpoint |
| `STORE_PHONE` | No | — | For reference only |
| `ADMIN_SECRET` | Yes | `change-me-before-deploy` | Bearer token for admin routes |
| `ALLOWED_ORIGINS` | No | allow-all | Comma-separated list of allowed CORS origins |

---

## 7 — npm Scripts

| Script | Command | What it does |
|--------|---------|--------------|
| `npm start` | `node backend/server.js` | Production start |
| `npm run dev` | `nodemon backend/server.js` | Dev with auto-restart |
| `npm run seed` | `node backend/db/seed.js` | Populate DB (safe to re-run) |

---

## 8 — Database

- File: `data/store.db` (auto-created on first run)
- Engine: SQLite via [sql.js](https://sql.js.org) (WebAssembly, no native build)
- The `data/` folder is in `.gitignore` — never commit the database file

**Tables**: `categories`, `products`, `orders`, `order_items`, `enquiries`

To inspect the database locally:

```bash
# Install the sqlite3 CLI
sudo apt install sqlite3   # Ubuntu/Debian
brew install sqlite3       # macOS

sqlite3 data/store.db
.tables
SELECT * FROM products;
.quit
```

---

## 9 — Customising the Store

| What | Where |
|------|-------|
| WhatsApp number | `.env` → `WA_NUMBER`, and also update `WA_NUMBER` constant in `public/index.html` |
| Store name | `.env` → `STORE_NAME`, and update the Amharic/English text in `public/index.html` |
| Add a product | `POST /api/products` with admin token, or add a row in `backend/db/seed.js` and re-seed |
| Toggle stock | `PATCH /api/products/:id` with `{"in_stock": 0}` |
| Add a category | `POST /api/categories` with admin token |
| Product images | Set `image_url` on a product and use it in the frontend `.product-img-inner` background |

---

## 10 — Rate Limits

| Endpoint group | Limit |
|----------------|-------|
| All `/api/*` routes | 200 requests per 15 minutes per IP |
| `POST /api/orders` | 10 requests per minute per IP |

Adjust in `backend/server.js` under the `rateLimit` blocks.
