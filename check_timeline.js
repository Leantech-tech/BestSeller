
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

async function checkTimeline() {
    try {
        const emps = await pool.query(`SELECT id, nome_fantasia, created_at FROM empresas`);
        console.log('EMPRESAS_TIMELINE:', JSON.stringify(emps.rows, null, 2));

        const users = await pool.query(`SELECT id, nome, email, created_at FROM empresa_usuarios`);
        console.log('USERS_TIMELINE:', JSON.stringify(users.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkTimeline();
