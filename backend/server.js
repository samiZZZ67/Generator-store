'use strict';
require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const productsRouter   = require('./routes/products');
const categoriesRouter = require('./routes/categories');
const ordersRouter     = require('./routes/orders');
const adminRouter      = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,   // relax for the single-file frontend
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : true; // allow all in dev

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '64kb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 1000, // relaxed for admin operations
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute
  max: 20,
  message: { error: 'Too many orders from this IP, slow down.' },
});

app.use('/api', apiLimiter);
app.use('/api/orders', orderLimiter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/products',   productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/orders',     ordersRouter);
app.use('/api/admin',      adminRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status:  'ok',
    store:   process.env.STORE_NAME || 'Generator Store',
    waNumber: process.env.WA_NUMBER || '251911234567',
    phone:   process.env.STORE_PHONE || '+251911234567',
    env:     process.env.NODE_ENV || 'development',
    ts:      new Date().toISOString(),
  });
});

// ── Serve the static frontend ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// Admin route
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// Fallback: serve index.html for any unknown route (SPA-style)
app.get('*', (_req, res) => {
  const indexPath = path.join(__dirname, '../frontend/index.html');
  res.sendFile(indexPath, err => {
    if (err) res.status(404).json({ error: 'Not found' });
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n⚡  Generator Store API running on http://localhost:${PORT}`);
  console.log(`   Health:     GET  /api/health`);
  console.log(`   Products:   GET  /api/products`);
  console.log(`   Categories: GET  /api/categories`);
  console.log(`   Orders:     POST /api/orders\n`);
});

module.exports = app;   // for testing
