
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

async function checkEmpresas() {
    try {
        const res = await pool.query(`
            SELECT id, slug, nome_fantasia, status
            FROM empresas
            ORDER BY id ASC
        `);
        console.log('EMPRESAS_JSON_START');
        console.log(JSON.stringify(res.rows, null, 2));
        console.log('EMPRESAS_JSON_END');

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkEmpresas();
