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
// Three parallel queries submitted concurrently via Promise.all.
// Each touches the full orders table in a different way.
router.get('/analytics/order-summary', async (req, res) => {
    try {
        const [summaryResult, statusResult, trendResult] = await Promise.all([

            // Q1: overall totals — one pass over orders
            pool.query(`
        SELECT
          COUNT(*)                          AS total_orders,
          COALESCE(SUM(amount),  0)::NUMERIC AS total_revenue,
          COALESCE(AVG(amount),  0)::NUMERIC AS avg_order_value,
          COALESCE(MIN(amount),  0)::NUMERIC AS min_order_value,
          COALESCE(MAX(amount),  0)::NUMERIC AS max_order_value
        FROM orders
      `),

            // Q2: per-status breakdown with window function for percentage share
            pool.query(`
        SELECT
          status,
          COUNT(*)                          AS count,
          COALESCE(SUM(amount), 0)::NUMERIC AS revenue,
          ROUND(
            COUNT(*) * 100.0
            / NULLIF(SUM(COUNT(*)) OVER (), 0), 2
          )                                 AS pct_of_total
        FROM orders
        GROUP BY status
        ORDER BY count DESC
      `),

            // Q3: daily order counts and revenue for the last 30 days
            // Uses idx_orders_created_at for the date range filter
            pool.query(`
        SELECT
          DATE_TRUNC('day', created_at)::DATE AS day,
          COUNT(*)                             AS orders,
          COALESCE(SUM(amount), 0)::NUMERIC    AS revenue
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY 1 DESC
      `),
        ]);

        res.json({
            data: {
                summary: summaryResult.rows[0],
                by_status: statusResult.rows,
                daily_trend: trendResult.rows,
            },
            meta: { generated_at: new Date().toISOString() },
        });
    } catch (err) {
        console.error('[H2] GET /analytics/order-summary', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;