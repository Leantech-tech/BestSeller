
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

async function checkDetails() {
    try {
        const res = await pool.query(`
            SELECT id, nome, created_at, updated_at
            FROM produtos
            WHERE empresa_id = 1
            ORDER BY id ASC
        `);
        console.log('PRODUCTS_DETAIL:', JSON.stringify(res.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkDetails();
