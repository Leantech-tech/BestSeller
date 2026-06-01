
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

async function checkAll() {
    try {
        const stats = await pool.query(`
            SELECT empresa_id, ativo, COUNT(*) as total
            FROM produtos
            GROUP BY empresa_id, ativo
            ORDER BY empresa_id, ativo
        `);
        console.log('PRODUCT_STATS:', JSON.stringify(stats.rows, null, 2));

        const lastDeleted = await pool.query(`
            SELECT * FROM log_integracao 
            WHERE mensagem ILIKE '%error%' OR mensagem ILIKE '%falha%'
            ORDER BY created_at DESC LIMIT 10
        `);
        console.log('ERROR_LOGS:', JSON.stringify(lastDeleted.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkAll();
