
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

async function checkSchemas() {
    try {
        const schemas = await pool.query(`
            SELECT schema_name 
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
        `);
        console.log('SCHEMAS:', JSON.stringify(schemas.rows, null, 2));

        const tables = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name = 'produtos'
        `);
        console.log('PRODUTOS_TABLES:', JSON.stringify(tables.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkSchemas();
