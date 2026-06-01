
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

async function checkInactive() {
    try {
        const inactive = await pool.query('SELECT COUNT(*) FROM produtos WHERE ativo = false');
        console.log('INACTIVE_PRODUCTS:', inactive.rows[0].count);

        const total = await pool.query('SELECT COUNT(*) FROM produtos');
        console.log('TOTAL_PRODUCTS:', total.rows[0].count);

        const logs = await pool.query('SELECT COUNT(*) FROM log_integracao');
        console.log('LOG_ENTRIES:', logs.rows[0].count);

        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkInactive();
