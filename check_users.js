
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

async function checkUsers() {
    try {
        console.log('--- EMPRESAS ---');
        const empresas = await pool.query('SELECT id, slug, nome_fantasia FROM empresas');
        console.log(JSON.stringify(empresas.rows, null, 2));

        console.log('\n--- USUARIOS ADMIN ---');
        const users = await pool.query('SELECT id, nome, email, empresa_id FROM empresa_usuarios');
        console.log(JSON.stringify(users.rows, null, 2));

        console.log('\n--- PRODUTOS POR EMPRESA ---');
        const counts = await pool.query('SELECT empresa_id, COUNT(*) FROM produtos GROUP BY empresa_id');
        console.log(JSON.stringify(counts.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkUsers();
