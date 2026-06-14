// ─────────────────────────────────────────────────────────────────────────────
// LIGHT ENDPOINTS  (complexity_score = 1)
//
// L1 — GET /api/users/:id
//   Single PK lookup on users. Uses users_pkey btree index.
//   Queries: 1  |  Transaction: none  |  Join: none
//
// L2 — GET /api/orders/:id
//   Single PK lookup on orders. Uses orders_pkey btree index.
//   Queries: 1  |  Transaction: none  |  Join: none
//
// Both are structurally identical in mechanism but operate on different tables.
// Under load this lets the ML model learn whether table size, index depth, or
// cached hot-set differences produce measurable latency deltas between L1 and L2.
// ─────────────────────────────────────────────────────────────────────────────

const router = require('express').Router();
const pool = require('../database/db');

// ── L1: GET /api/users/:id ────────────────────────────────────────────────────
router.get('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const { rows } = await pool.query(
      `SELECT id, name, email, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('[L1] GET /users/:id', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── L2: GET /api/orders/:id ───────────────────────────────────────────────────
router.get('/orders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const { rows } = await pool.query(
      `SELECT id, user_id, amount, status, created_at, updated_at
       FROM orders
       WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('[L2] GET /orders/:id', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;