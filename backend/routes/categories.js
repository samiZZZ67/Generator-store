'use strict';
const { Router } = require('express');
const { getDb, prepare } = require('../db/database');
const adminAuth = require('../middleware/adminAuth');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const db = await getDb();
    const categories = await prepare(db, `SELECT * FROM categories ORDER BY sort_order, id`).all();
    res.json({ data: categories });
  } catch (e) { next(e); }
});

router.post('/', adminAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const { id, label_am, label_en, sort_order = 99 } = req.body;
    if (!id || !label_am || !label_en) return res.status(400).json({ error: 'id, label_am, label_en are required' });
    try {
      await prepare(db, `INSERT INTO categories (id, label_am, label_en, sort_order) VALUES ($id, $label_am, $label_en, $sort_order)`).run({ id, label_am, label_en, sort_order });
      const created = await prepare(db, `SELECT * FROM categories WHERE id = $id`).get({ id });
      res.status(201).json({ data: created });
    } catch (e2) {
      if (e2.message.includes('UNIQUE') || e2.message.includes('unique')) return res.status(409).json({ error: 'Category id already exists' });
      throw e2;
    }
  } catch (e) { next(e); }
});

router.patch('/:id', adminAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const existing = await prepare(db, `SELECT * FROM categories WHERE id = $id`).get({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Category not found' });
    const { label_am, label_en, sort_order } = req.body;
    const upd = {};
    if (label_am !== undefined) upd.label_am = label_am;
    if (label_en !== undefined) upd.label_en = label_en;
    if (sort_order !== undefined) upd.sort_order = sort_order;
    if (!Object.keys(upd).length) return res.status(400).json({ error: 'Nothing to update' });
    upd.id = req.params.id;
    const setClauses = Object.keys(upd).filter(k => k !== 'id').map(k => `${k} = $${k}`).join(', ');
    await prepare(db, `UPDATE categories SET ${setClauses} WHERE id = $id`).run(upd);
    
    const updated = await prepare(db, `SELECT * FROM categories WHERE id = $id`).get({ id: req.params.id });
    res.json({ data: updated });
  } catch (e) { next(e); }
});

module.exports = router;
