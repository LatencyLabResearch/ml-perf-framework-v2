const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'research',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',

    // Pool sizing: 3 instances × 10 connections = 30 max
    // Stay well under PostgreSQL's default max_connections (100)
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Fail fast on startup if the DB is unreachable
pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;