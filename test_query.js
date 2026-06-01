
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

async function testQuery() {
    try {
        const empresaId = 14; // now testing empresa 14
        const sql = `
            SELECT p.id, p.nome, p.ativo,
                   c.slug as categoria, c.nome as categoria_nome,
                   pp.preco, pp.ativo as preco_ativo,
                   pe.saldo_fisico as estoque
            FROM produtos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN produto_precos pp ON pp.produto_id = p.id AND pp.empresa_id = p.empresa_id AND pp.ativo = true
            LEFT JOIN produto_estoque pe ON pe.produto_id = p.id AND pe.empresa_id = p.empresa_id
            WHERE p.empresa_id = $1 AND p.ativo = true
        `;
        const result = await pool.query(sql, [empresaId]);
        console.log('RESULTS_FOR_14:', JSON.stringify(result.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

testQuery();
