
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

async function checkTriggers() {
    try {
        console.log('--- Triggers ---');
        const triggers = await pool.query(`
            SELECT event_object_table, trigger_name, event_manipulation, 
                   action_statement, action_timing
            FROM information_schema.triggers
            WHERE event_object_schema = 'public'
        `);
        console.log(JSON.stringify(triggers.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkTriggers();
