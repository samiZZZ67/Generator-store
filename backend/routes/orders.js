'use strict';
const { Router } = require('express');
const { getDb, prepare, transaction, isPostgres } = require('../db/database');
const adminAuth = require('../middleware/adminAuth');
const { v4: uuidv4 } = require('uuid');
const { sendTelegramNotification } = require('../services/telegram');

const router = Router();

// Stats must be registered BEFORE /:id routes
router.get('/stats', adminAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const stats = await prepare(db, `
      SELECT
        COUNT(*)                                           AS total_orders,
        COALESCE(SUM(total_etb), 0)                        AS total_revenue,
        SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='fulfilled' THEN 1 ELSE 0 END) AS fulfilled,
        SUM(CASE WHEN channel='whatsapp' THEN 1 ELSE 0 END) AS via_whatsapp,
        SUM(CASE WHEN channel='phone'    THEN 1 ELSE 0 END) AS via_phone,
        SUM(CASE WHEN lang='am'          THEN 1 ELSE 0 END) AS lang_am,
        SUM(CASE WHEN lang='en'          THEN 1 ELSE 0 END) AS lang_en
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

    res.json({ data: { ...stats, top_products: topProducts } });
  } catch (e) { next(e); }
});

router.post('/enquiry', async (req, res, next) => {
  try {
    const db = await getDb();
    const { lang = 'am', message } = req.body;
    await prepare(db, `INSERT INTO enquiries (lang, message) VALUES ($lang, $message)`).run({ lang, message: message || null });
    res.status(201).json({ message: 'Enquiry logged' });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const db = await getDb();
    const { channel = 'whatsapp', lang = 'am', items = [], note, customer_wa } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array is required' });

    // Fetch all products in one query
    const ids = items.map(i => i.id);
    const placeholders = ids.map((_, i) => `$id${i}`).join(',');
    const paramObj = {};
    ids.forEach((id, i) => paramObj[`id${i}`] = id);
    
    const products = await prepare(db, `SELECT * FROM products WHERE id IN (${placeholders}) AND active = 1`).all(paramObj);
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    for (const item of items) {
      if (!productMap[item.id]) return res.status(400).json({ error: `Product id ${item.id} not found` });
    }

    const id = uuidv4();
    // Calculate total price using discounted prices if they exist
    const total_etb = items.reduce((sum, item) => sum + productMap[item.id].price * item.qty, 0);

    const orderData = { id, channel, lang, customer_wa: customer_wa || null, note: note || null, total_etb };

    if (isPostgres()) {
      const client = await db.connect();
      try {
        await client.query("BEGIN;");
        await prepare(client, `INSERT INTO orders (id, channel, lang, customer_wa, note, total_etb) VALUES ($id, $channel, $lang, $customer_wa, $note, $total_etb)`)
          .run(orderData);

        for (const item of items) {
          await prepare(client, `INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES ($order_id, $product_id, $qty, $unit_price)`)
            .run({ order_id: id, product_id: item.id, qty: item.qty, unit_price: productMap[item.id].price });
        }
        await client.query("COMMIT;");
      } catch (err) {
        await client.query("ROLLBACK;");
        throw err;
      } finally {
        client.release();
      }
    } else {
      const runSql = transaction(db, () => {
        prepare(db, `INSERT INTO orders (id, channel, lang, customer_wa, note, total_etb) VALUES ($id, $channel, $lang, $customer_wa, $note, $total_etb)`)
          .run(orderData);

        for (const item of items) {
          prepare(db, `INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES ($order_id, $product_id, $qty, $unit_price)`)
            .run({ order_id: id, product_id: item.id, qty: item.qty, unit_price: productMap[item.id].price });
        }
      });
      runSql();
    }

    // Prepare rich information for Telegram notification
    const orderItemsRich = items.map(item => {
      const prod = productMap[item.id];
      return {
        product_id: item.id,
        name_en: prod.name_en,
        name_am: prod.name_am,
        qty: item.qty,
        unit_price: prod.price,
        original_price: prod.original_price,
        marketing_desc_en: prod.marketing_desc_en,
        marketing_desc_am: prod.marketing_desc_am
      };
    });

    // Send Telegram Notification asynchronously (don't block response)
    sendTelegramNotification(orderData, orderItemsRich).catch(err => {
      console.error("Error sending Telegram notification:", err);
    });

    res.status(201).json({ data: { order_id: id, total_etb, item_count: items.reduce((s, i) => s + i.qty, 0) } });
  } catch (e) { next(e); }
});

router.get('/', adminAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const { status, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT * FROM orders`;
    const params = {};
    if (status) { 
      sql += ` WHERE status = $status`; 
      params.status = status; 
    }
    sql += ` ORDER BY created_at DESC LIMIT $limit OFFSET $offset`;
    params.limit = parseInt(limit);
    params.offset = parseInt(offset);

    const orders = await prepare(db, sql).all(params);
    const result = [];
    for (const o of orders) {
      const items = await prepare(db, `
        SELECT oi.*, p.name_am, p.name_en, p.icon, p.original_price, p.marketing_desc_am, p.marketing_desc_en 
        FROM order_items oi 
        JOIN products p ON p.id = oi.product_id 
        WHERE oi.order_id = $order_id
      `).all({ order_id: o.id });
      result.push({ ...o, items });
    }
    res.json({ data: result, count: result.length });
  } catch (e) { next(e); }
});

router.patch('/:id/status', adminAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const valid = ['pending', 'confirmed', 'fulfilled', 'cancelled'];
    if (!valid.includes(req.body.status)) return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    const existing = await prepare(db, `SELECT 1 FROM orders WHERE id = $id`).get({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    await prepare(db, `UPDATE orders SET status = $status, updated_at = $ts WHERE id = $id`).run({ status: req.body.status, ts: new Date().toISOString(), id: req.params.id });
    res.json({ message: `Order ${req.params.id} → ${req.body.status}` });
  } catch (e) { next(e); }
});

module.exports = router;
