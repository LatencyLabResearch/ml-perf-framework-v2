const pool = require('./db');

async function initDatabase() {
  const instanceId = process.env.INSTANCE_ID || 'unknown';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── users ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL       PRIMARY KEY,
        name       VARCHAR(120) NOT NULL,
        email      VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // ── orders ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id         SERIAL         PRIMARY KEY,
        user_id    INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount     NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
        status     VARCHAR(20)    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','completed','cancelled')),
        created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      );
    `);

    // ── indexes ───────────────────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_user_id    ON orders(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);`);

    // ── updated_at trigger ────────────────────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;
    `);

    for (const [tbl, trg] of [
      ['users', 'trg_users_updated_at'],
      ['orders', 'trg_orders_updated_at'],
    ]) {
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = '${trg}') THEN
            CREATE TRIGGER ${trg}
              BEFORE UPDATE ON ${tbl}
              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
          END IF;
        END $$;
      `);
    }

    // ── seed (idempotent) ─────────────────────────────────────────────────────
    const { rows } = await client.query(`SELECT COUNT(*) AS cnt FROM users`);

    if (parseInt(rows[0].cnt, 10) === 0) {
      await client.query(`
        INSERT INTO users (name, email) VALUES
          ('Alice Martin',   'alice@example.com'),
          ('Bob Chen',       'bob@example.com'),
          ('Carol White',    'carol@example.com'),
          ('David Kim',      'david@example.com'),
          ('Eve Johnson',    'eve@example.com'),
          ('Frank Brown',    'frank@example.com'),
          ('Grace Lee',      'grace@example.com'),
          ('Henry Wilson',   'henry@example.com'),
          ('Iris Davis',     'iris@example.com'),
          ('James Taylor',   'james@example.com'),
          ('Karen Anderson', 'karen@example.com'),
          ('Leo Thomas',     'leo@example.com'),
          ('Mia Jackson',    'mia@example.com'),
          ('Noah White',     'noah@example.com'),
          ('Olivia Harris',  'olivia@example.com'),
          ('Paul Martinez',  'paul@example.com'),
          ('Quinn Robinson', 'quinn@example.com'),
          ('Rachel Clark',   'rachel@example.com'),
          ('Sam Rodriguez',  'sam@example.com'),
          ('Tina Lewis',     'tina@example.com')
        ON CONFLICT (email) DO NOTHING;
      `);

      await client.query(`
        INSERT INTO orders (user_id, amount, status)
        SELECT
          (random() * 19 + 1)::int,
          ROUND((random() * 990 + 10)::numeric, 2),
          (ARRAY['pending','processing','completed','cancelled'])[floor(random()*4+1)::int]
        FROM generate_series(1, 200);
      `);

      console.log(`[${instanceId}] Seed: 20 users, 200 orders`);
    }

    await client.query('COMMIT');
    console.log(`[${instanceId}] Database ready`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[${instanceId}] Init failed:`, err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

module.exports = initDatabase;