const express = require('express');

const lightRoutes = require('../routes/light');
const moderateRoutes = require('../routes/moderate');
const heavyRoutes = require('../routes/heavy');

const metricsCollector = require('../middleware/metricsCollector');
const requestLogger = require('../middleware/requestLogger');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(metricsCollector);   // MUST be first — populates req._metrics before any route runs
app.use(requestLogger);

// ── 6 endpoints, all under /api ───────────────────────────────────────────────
// Light    : GET  /api/users/:id
//            GET  /api/orders/:id
// Moderate : POST /api/orders
//            PATCH /api/orders/:id/status
// Heavy    : GET  /api/reports/user-orders
//            GET  /api/analytics/order-summary
app.use('/api', lightRoutes);
app.use('/api', moderateRoutes);
app.use('/api', heavyRoutes);

// Health check — no DB call, no metrics logging — clean signal for LB probes
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        instance: require('./config').instanceId,
        timestamp: new Date().toISOString(),
    });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = app;