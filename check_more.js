
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

async function checkMore() {
    try {
        console.log('--- Orders ---');
        const orders = await pool.query('SELECT id, numero, status, sync_erp_status, created_at FROM pedidos ORDER BY created_at DESC LIMIT 10');
        console.log(JSON.stringify(orders.rows, null, 2));

        console.log('--- Full Logs ---');
        const logs = await pool.query('SELECT * FROM log_integracao ORDER BY created_at DESC LIMIT 20');
        console.log(JSON.stringify(logs.rows, null, 2));

        console.log('--- Tables Info ---');
        const count = await pool.query("SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE relname IN ('produtos', 'pedidos', 'clientes', 'log_integracao')");
        console.log(JSON.stringify(count.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkMore();
