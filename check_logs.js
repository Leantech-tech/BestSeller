
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: false
});

async function checkIntegrationLogs() {
    try {
        const logs = await pool.query(`
            SELECT id, entidade, operacao, status, mensagem, created_at
            FROM log_integracao
            ORDER BY created_at DESC
            LIMIT 50
        `);
        console.log('INTEGRATION_LOGS_START');
        console.log(JSON.stringify(logs.rows, null, 2));
        console.log('INTEGRATION_LOGS_END');

        const errorStats = await pool.query(`
            SELECT entidade, status, COUNT(*)
            FROM log_integracao
            WHERE created_at > (CURRENT_TIMESTAMP - INTERVAL '7 days')
            GROUP BY entidade, status
        `);
        console.log('ERROR_STATS_START');
        console.log(JSON.stringify(errorStats.rows, null, 2));
        console.log('ERROR_STATS_END');

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkIntegrationLogs();
