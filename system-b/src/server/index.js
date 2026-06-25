require('../config/logger');

const app = require('./app');
const config = require('./config');
const initDatabase = require('../database/init');

initDatabase()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`[${config.instanceId}] System A listening on port ${config.port}`);
    });
  })
  .catch((err) => {
    console.error('[server] Database init failed:', err.message);
    process.exit(1);
  });