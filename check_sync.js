
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

async function checkSync() {
    try {
        const res = await pool.query(`
            SELECT p.id, p.nome, p.categoria_id, c.slug, c.nome as cat_nome
            FROM produtos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE p.empresa_id = 1
        `);
        console.log('PRODUCTS_WITH_CATS:', JSON.stringify(res.rows, null, 2));

        const cats = await pool.query(`
            SELECT id, slug, nome FROM categorias WHERE empresa_id = 1
        `);
        console.log('ALL_CATS:', JSON.stringify(cats.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkSync();
