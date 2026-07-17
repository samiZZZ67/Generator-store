'use strict';
const { Router } = require('express');
const { getDb, prepare } = require('../db/database');
const adminAuth = require('../middleware/adminAuth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../frontend/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Cloudinary if CLOUDINARY_URL is set
const useCloudinary = !!process.env.CLOUDINARY_URL;
if (useCloudinary) {
  cloudinary.config({ secure: true });
}

// Multer storage engine configuration. Use memory storage when Cloudinary is enabled.
const storage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    });

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed (jpeg, jpg, png, gif, webp)'));
  }
});

// Image upload route
router.post('/upload', adminAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    if (useCloudinary) {
      // Upload buffer to Cloudinary
      const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      cloudinary.uploader.upload(b64, { folder: 'generator-store' })
        .then(result => {
          res.json({ imageUrl: result.secure_url });
        })
        .catch(err => {
          console.error('Cloudinary upload error:', err);
          res.status(500).json({ error: 'Cloudinary upload failed' });
        });
      return;
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res, next) => {
  try {
    const db = await getDb();
    let sql = `SELECT * FROM products WHERE active = 1`;
    const params = {};

    if (req.query.cat && req.query.cat !== 'all') { 
      sql += ` AND cat_id = $cat`; 
      params.cat = req.query.cat; 
    }
    if (req.query.q) { 
      sql += ` AND (name_am LIKE $q OR name_en LIKE $q OR desc_am LIKE $q OR desc_en LIKE $q OR marketing_desc_am LIKE $q OR marketing_desc_en LIKE $q)`; 
      params.q = `%${req.query.q}%`; 
    }
    if (req.query.inStock === '1') {
      sql += ` AND in_stock = 1`;
    }
    sql += ` ORDER BY cat_id, id`;

    const products = await prepare(db, sql).all(params);
    res.json({ data: products });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = await getDb();
    const row = await prepare(db, `SELECT * FROM products WHERE id = $id AND active = 1`).get({ id: req.params.id });
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json({ data: row });
  } catch (e) { next(e); }
});

router.post('/', adminAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const { 
      name_am, name_en, cat_id, price, original_price, 
      marketing_desc_am = '', marketing_desc_en = '', 
      in_stock = 1, icon = '⚡', desc_am = '', desc_en = '', image_url,
      active = 1
    } = req.body;
    
    if (!name_am || !name_en || !cat_id || price == null) {
      return res.status(400).json({ error: 'name_am, name_en, cat_id, price are required' });
    }
    
    const catExists = await prepare(db, `SELECT 1 FROM categories WHERE id = $id`).get({ id: cat_id });
    if (!catExists) return res.status(400).json({ error: `Category '${cat_id}' not found` });

    const result = await prepare(db, `
      INSERT INTO products (
        name_am, name_en, cat_id, price, original_price, 
        marketing_desc_am, marketing_desc_en, 
        in_stock, icon, desc_am, desc_en, image_url, active
      ) VALUES (
        $name_am, $name_en, $cat_id, $price, $original_price, 
        $marketing_desc_am, $marketing_desc_en, 
        $in_stock, $icon, $desc_am, $desc_en, $image_url, $active
      )
    `).run({ 
      name_am, name_en, cat_id, price, original_price: original_price || null,
      marketing_desc_am, marketing_desc_en,
      in_stock, icon, desc_am, desc_en, image_url: image_url || null,
      active
    });

    const created = await prepare(db, `SELECT * FROM products WHERE id = $id`).get({ id: result.lastInsertRowid });
    res.status(201).json({ data: created });
  } catch (e) { next(e); }
});

router.patch('/:id', adminAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const existing = await prepare(db, `SELECT * FROM products WHERE id = $id`).get({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const allowed = [
      'name_am', 'name_en', 'cat_id', 'price', 'original_price', 
      'marketing_desc_am', 'marketing_desc_en',
      'in_stock', 'icon', 'desc_am', 'desc_en', 'image_url', 'active'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key] === '' ? null : req.body[key];
      }
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    updates.updated_at = new Date().toISOString();
    updates.id = req.params.id;
    const setClauses = Object.keys(updates).filter(k => k !== 'id').map(k => `${k} = $${k}`).join(', ');
    await prepare(db, `UPDATE products SET ${setClauses} WHERE id = $id`).run(updates);

    const updated = await prepare(db, `SELECT * FROM products WHERE id = $id`).get({ id: req.params.id });
    res.json({ data: updated });
  } catch (e) { next(e); }
});

router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const existing = await prepare(db, `SELECT 1 FROM products WHERE id = $id`).get({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    await prepare(db, `UPDATE products SET active = 0, updated_at = $ts WHERE id = $id`).run({ ts: new Date().toISOString(), id: req.params.id });
    res.json({ message: `Product ${req.params.id} deactivated` });
  } catch (e) { next(e); }
});

module.exports = router;
