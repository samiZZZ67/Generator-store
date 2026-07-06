'use strict';
const { Router } = require('express');
const { getDb, prepare } = require('../db/database');
const adminAuth = require('../middleware/adminAuth');

const router = Router();

// Apply adminAuth to all routes in this file
router.use(adminAuth);

// Check authentication status
router.get('/auth', (req, res) => {
  res.json({ authenticated: true });
});

// GET all products including inactive ones
router.get('/products', async (req, res, next) => {
  try {
    const db = await getDb();
    const products = await prepare(db, `SELECT * FROM products ORDER BY cat_id, id`).all();
    res.json({ data: products });
  } catch (e) { next(e); }
});

// GET dashboard statistics
router.get('/stats', async (req, res, next) => {
  try {
    const db = await getDb();
    const stats = await prepare(db, `
      SELECT
        COUNT(*)                                           AS total_orders,
        COALESCE(SUM(total_etb), 0)                        AS total_revenue,
        COALESCE(SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN status='fulfilled' THEN 1 ELSE 0 END), 0) AS fulfilled,
        COALESCE(SUM(CASE WHEN channel='whatsapp' THEN 1 ELSE 0 END), 0) AS via_whatsapp,
        COALESCE(SUM(CASE WHEN channel='telegram' THEN 1 ELSE 0 END), 0) AS via_telegram,
        COALESCE(SUM(CASE WHEN channel='phone'    THEN 1 ELSE 0 END), 0) AS via_phone,
        COALESCE(SUM(CASE WHEN lang='am'          THEN 1 ELSE 0 END), 0) AS lang_am,
        COALESCE(SUM(CASE WHEN lang='en'          THEN 1 ELSE 0 END), 0) AS lang_en
      FROM orders
    `).get();

    const topProducts = await prepare(db, `
      SELECT p.name_en, SUM(oi.qty) AS units_sold, SUM(oi.qty * oi.unit_price) AS revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      GROUP BY oi.product_id, p.name_en
      ORDER BY units_sold DESC
      LIMIT 5
    `).all();

    res.json({ 
      data: { 
        total_orders: parseInt(stats.total_orders) || 0,
        total_revenue: parseInt(stats.total_revenue) || 0,
        pending: parseInt(stats.pending) || 0,
        fulfilled: parseInt(stats.fulfilled) || 0,
        via_whatsapp: parseInt(stats.via_whatsapp) || 0,
        via_telegram: parseInt(stats.via_telegram) || 0,
        via_phone: parseInt(stats.via_phone) || 0,
        lang_am: parseInt(stats.lang_am) || 0,
        lang_en: parseInt(stats.lang_en) || 0,
        top_products: topProducts.map(p => ({
          name_en: p.name_en,
          units_sold: parseInt(p.units_sold) || 0,
          revenue: parseInt(p.revenue) || 0
        }))
      } 
    });
  } catch (e) { next(e); }
});

module.exports = router;
