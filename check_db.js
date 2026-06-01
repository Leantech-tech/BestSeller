
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

async function checkProducts() {
    try {
        const res = await pool.query(`
            SELECT p.id, p.nome, p.empresa_id, p.ativo, p.categoria_id,
                   pp.preco, pe.saldo_fisico
            FROM produtos p
            LEFT JOIN produto_precos pp ON pp.produto_id = p.id AND pp.empresa_id = p.empresa_id AND pp.ativo = true
            LEFT JOIN produto_estoque pe ON pe.produto_id = p.id AND pe.empresa_id = p.empresa_id
            ORDER BY p.id DESC
            LIMIT 20
        `);
        console.log('PRODUCTS_JSON_START');
        console.log(JSON.stringify(res.rows, null, 2));
        console.log('PRODUCTS_JSON_END');

        const counts = await pool.query(`
            SELECT empresa_id, ativo, COUNT(*) 
            FROM produtos 
            GROUP BY empresa_id, ativo
        `);
        console.log('COUNTS_JSON_START');
        console.log(JSON.stringify(counts.rows, null, 2));
        console.log('COUNTS_JSON_END');

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkProducts();
