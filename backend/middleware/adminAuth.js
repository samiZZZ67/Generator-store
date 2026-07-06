'use strict';
/**
 * adminAuth.js
 * Protects /api/admin/* routes with a shared secret.
 * Pass the secret as:  Authorization: Bearer <ADMIN_SECRET>
 */

function adminAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = adminAuth;
