
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

async function checkCategories() {
    try {
        const cats = await pool.query(`
            SELECT id, nome, empresa_id, ativo 
            FROM categorias 
            ORDER BY id DESC
        `);
        console.log('CATEGORIES_JSON_START');
        console.log(JSON.stringify(cats.rows, null, 2));
        console.log('CATEGORIES_JSON_END');

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkCategories();
