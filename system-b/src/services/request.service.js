const pool = require('../database/db');

const createRequest = async (payload) => {
  const result = await pool.query(
    'INSERT INTO requests (payload, created_at) VALUES ($1, $2) RETURNING id',
    [payload, Date.now()]
  );
  return result.rows[0];
};

const getRequestCount = async () => {
  const result = await pool.query('SELECT COUNT(*) AS cnt FROM requests');
  // pg returns COUNT as a string — coerce it
  return { cnt: parseInt(result.rows[0].cnt, 10) };
};

module.exports = { createRequest, getRequestCount };