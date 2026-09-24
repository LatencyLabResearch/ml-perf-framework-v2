// ─────────────────────────────────────────────────────────────────────────────
// HEAVY ENDPOINTS  (complexity_score = 3)
//
// H1 — GET /api/reports/user-orders
//   One JOIN query with 5 aggregations grouped by user.
//   Queries: 1 (complex)  |  Transaction: none  |  Join: users LEFT JOIN orders
//   Bottleneck: GROUP BY across idx_orders_user_id + multiple aggregate functions
//   Latency scales with data volume — good learnable signal for the ML model.
//
// H2 — GET /api/analytics/order-summary
//   Three parallel aggregation queries (Promise.all).
//   Queries: 3 (parallel)  |  Transaction: none  |  Join: none (single table)
//   Bottleneck: three concurrent pool connections + window function in query 2
//              + date-range scan in query 3
//   Distinct from H1: same "heavy" label but different parallelism profile.
//   Under pool pressure (many concurrent requests) Promise.all competes for
//   3 connections per request — creates measurable connection-queue latency.
// ─────────────────────────────────────────────────────────────────────────────

const router = require('express').Router();
const pool = require('../database/db');

// ── H1: GET /api/reports/user-orders ─────────────────────────────────────────
// JOIN users × orders, aggregate per user.
// Uses idx_orders_user_id for the join side; GROUP BY user PK.
router.get('/reports/user-orders', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        const { rows } = await pool.query(
            `SELECT
         u.id                                                      AS user_id,
         u.name,
         u.email,
         COUNT(o.id)                                              AS total_orders,
         COALESCE(SUM(o.amount),  0)::NUMERIC(12,2)              AS total_spent,
         COALESCE(AVG(o.amount),  0)::NUMERIC(12,2)              AS avg_order_value,
         COALESCE(MAX(o.amount),  0)::NUMERIC(12,2)              AS max_order_value,
         COUNT(o.id) FILTER (WHERE o.status = 'completed')       AS completed_orders,
         COUNT(o.id) FILTER (WHERE o.status = 'pending')         AS pending_orders,
         MAX(o.created_at)                                        AS last_order_at
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       GROUP BY u.id, u.name, u.email
       ORDER BY total_spent DESC
       LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        res.json({
            data: rows,
            count: rows.length,
            meta: { generated_at: new Date().toISOString() },
        });
    } catch (err) {
        console.error('[H1] GET /reports/user-orders', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── H2: GET /api/analytics/order-summary ─────────────────────────────────────
router.get('/analytics/order-summary', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH base AS (
        SELECT *
        FROM orders
      ),

      summary AS (
        SELECT
          COUNT(*) AS total_orders,
          COALESCE(SUM(amount), 0)::NUMERIC AS total_revenue,
          COALESCE(AVG(amount), 0)::NUMERIC AS avg_order_value,
          COALESCE(MIN(amount), 0)::NUMERIC AS min_order_value,
          COALESCE(MAX(amount), 0)::NUMERIC AS max_order_value
        FROM base
      ),

      status AS (
        SELECT
          status,
          COUNT(*) AS count,
          COALESCE(SUM(amount), 0)::NUMERIC AS revenue
        FROM base
        GROUP BY status
      ),

      daily AS (
        SELECT
          DATE_TRUNC('day', created_at)::DATE AS day,
          COUNT(*) AS orders,
          COALESCE(SUM(amount), 0)::NUMERIC AS revenue
        FROM base
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1
      )

      SELECT
        (SELECT row_to_json(summary) FROM summary) AS summary,
        (SELECT json_agg(status) FROM status) AS by_status,
        (SELECT json_agg(daily ORDER BY day DESC) FROM daily) AS daily_trend;
    `);

    res.json({
      data: result.rows[0],
      meta: { generated_at: new Date().toISOString() }
    });

  } catch (err) {
    console.error('[H2] GET /analytics/order-summary', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;