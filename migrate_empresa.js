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

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('=== Migrando empresa_id=1 para empresa_id=14 ===\n');

        // Disable FK checks temporarily and migrate each table independently
        // Note: PostgreSQL doesn't have global FK disable but we can use deferred constraints
        // Instead we'll migrate leaf tables first, then parent tables

        const steps = [
            // Leaf tables first (no downstream FKs referencing them in our migration)
            { sql: 'UPDATE itens_pedido SET empresa_id = 14 WHERE empresa_id = 1', table: 'itens_pedido' },
            { sql: 'UPDATE produto_precos SET empresa_id = 14 WHERE empresa_id = 1', table: 'produto_precos' },
            { sql: 'UPDATE produto_estoque SET empresa_id = 14 WHERE empresa_id = 1', table: 'produto_estoque' },
            { sql: 'UPDATE pedidos SET empresa_id = 14 WHERE empresa_id = 1', table: 'pedidos' },
            { sql: 'UPDATE clientes SET empresa_id = 14 WHERE empresa_id = 1', table: 'clientes' },
            { sql: 'UPDATE produtos SET empresa_id = 14 WHERE empresa_id = 1', table: 'produtos' },
            { sql: 'UPDATE categorias SET empresa_id = 14 WHERE empresa_id = 1', table: 'categorias' },
            { sql: 'UPDATE banners SET empresa_id = 14 WHERE empresa_id = 1', table: 'banners' },
            { sql: 'UPDATE formas_pagamento SET empresa_id = 14 WHERE empresa_id = 1', table: 'formas_pagamento' },
            { sql: 'UPDATE tabelas_preco SET empresa_id = 14 WHERE empresa_id = 1', table: 'tabelas_preco' },
            { sql: 'UPDATE depositos SET empresa_id = 14 WHERE empresa_id = 1', table: 'depositos' },
            { sql: 'UPDATE transportadoras SET empresa_id = 14 WHERE empresa_id = 1', table: 'transportadoras' },
            { sql: 'UPDATE fornecedores SET empresa_id = 14 WHERE empresa_id = 1', table: 'fornecedores' },
            { sql: 'UPDATE condicoes_pagamento SET empresa_id = 14 WHERE empresa_id = 1', table: 'condicoes_pagamento' },
            { sql: 'UPDATE status_pedido_cfg SET empresa_id = 14 WHERE empresa_id = 1', table: 'status_pedido_cfg' },
        ];

        for (const step of steps) {
            try {
                const r = await client.query(step.sql);
                if (r.rowCount > 0) console.log(`  [OK] ${step.table}: ${r.rowCount} registros`);
            } catch (e) {
                console.warn(`  [SKIP] ${step.table}: ${e.message}`);
            }
        }

        console.log('\n=== Verificando resultado ===');
        const r = await client.query('SELECT empresa_id, COUNT(*) as total FROM produtos GROUP BY empresa_id ORDER BY empresa_id');
        console.log('Produtos por empresa:', JSON.stringify(r.rows));

        const c = await client.query('SELECT empresa_id, COUNT(*) as total FROM categorias GROUP BY empresa_id ORDER BY empresa_id');
        console.log('Categorias por empresa:', JSON.stringify(c.rows));

    } catch (err) {
        console.error('ERRO:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
