// ─────────────────────────────────────────────────────────────────────────────
// MODERATE ENDPOINTS  (complexity_score = 2)
//
// M1 — POST /api/orders
//   FK validation then INSERT inside one transaction.
//   Queries: 2  |  Transaction: BEGIN/COMMIT  |  Join: none
//   Bottleneck: write I/O + index update on orders_pkey + idx_orders_user_id
//
// M2 — PATCH /api/orders/:id/status
//   SELECT FOR UPDATE then conditional UPDATE inside one transaction.
//   Queries: 2  |  Transaction: BEGIN/COMMIT  |  Join: none
//   Bottleneck: row-level lock contention when many VUs target the same order IDs
//
// The key difference from the light tier is the explicit transaction and the
// write path. Under concurrent k6 load, M2 produces measurable lock-wait
// latency that M1 does not — two distinct moderate-tier latency signatures
// for the ML model to distinguish.
// ─────────────────────────────────────────────────────────────────────────────

const router = require('express').Router();
const pool = require('../database/db');

// Valid status transitions — state machine enforced at the DB layer
const TRANSITIONS = {
  pending: ['processing', 'cancelled'],
  processing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// ── M1: POST /api/orders ──────────────────────────────────────────────────────
router.post('/orders', async (req, res) => {
  const { user_id, amount } = req.body || {};

  const uid = parseInt(user_id, 10);
  if (!user_id || isNaN(uid) || uid < 1) {
    return res.status(400).json({ error: 'valid user_id (integer) is required' });
  }

  const amt = parseFloat(amount);
  if (amount === undefined || isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Query 1: verify the user exists before inserting (FK validation made explicit)
    const userCheck = await client.query(
      `SELECT id FROM users WHERE id = $1`,
      [uid]
    );
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Query 2: insert the order
    const { rows } = await client.query(
      `INSERT INTO orders (user_id, amount)
       VALUES ($1, $2)
       RETURNING id, user_id, amount, status, created_at, updated_at`,
      [uid, amt]
    );

    await client.query('COMMIT');
    res.status(201).json({ data: rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[M1] POST /orders', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── M2: PATCH /api/orders/:id/status ─────────────────────────────────────────
router.patch('/orders/:id/status', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }

  const VALID_STATUSES = Object.keys(TRANSITIONS);
  const { status } = req.body || {};
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Query 1: lock the row — this is the bottleneck under concurrent load.
    // When k6 sends many VUs targeting the same order ID, they queue here.
    const existing = await client.query(
      `SELECT id, status FROM orders WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const current = existing.rows[0].status;
    if (!TRANSITIONS[current].includes(status)) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        error: `Cannot transition from '${current}' to '${status}'`,
        allowed: TRANSITIONS[current],
      });
    }

    // Query 2: apply the update
    const { rows } = await client.query(
      `UPDATE orders SET status = $1 WHERE id = $2
       RETURNING id, user_id, amount, status, created_at, updated_at`,
      [status, id]
    );

    await client.query('COMMIT');
    res.json({ data: rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[M2] PATCH /orders/:id/status', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;