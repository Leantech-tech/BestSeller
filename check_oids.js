
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

async function checkTableCreation() {
    try {
        console.log('--- Table OIDs ---');
        const oids = await pool.query(`
            SELECT relname, oid, relfilenode, relatime 
            FROM pg_class 
            WHERE relname IN ('produtos', 'pedidos')
        `);
        console.log(JSON.stringify(oids.rows, null, 2));

        // Let's also check if there are other databases on this server
        const dbs = await pool.query('SELECT datname FROM pg_database WHERE datistemplate = false');
        console.log('--- Databases ---');
        console.log(JSON.stringify(dbs.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkTableCreation();
