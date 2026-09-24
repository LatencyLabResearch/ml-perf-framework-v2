require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT, 10) || 3001,
    instanceId: process.env.INSTANCE_ID || 'instance-1',
    logDir: process.env.LOG_DIR || './logging/raw',
    env: process.env.NODE_ENV || 'development',
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        name: process.env.DB_NAME || 'system_a',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    },
};