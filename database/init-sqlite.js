const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('Banco anterior removido');
}

const db = new DatabaseSync(DB_PATH);
console.log('Banco criado em', DB_PATH);

const schema = fs.readFileSync(path.join(__dirname, 'schema-sqlite.sql'), 'utf8');

// Executa cada statement separadamente para melhor tratamento de erro
const statements = schema
    .replace(/--.*$/gm, '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

for (const stmt of statements) {
    try {
        db.exec(stmt + ';');
    } catch (err) {
        console.error('Erro ao executar:', stmt.substring(0, 80));
        console.error(err.message);
    }
}

console.log('Schema executado com sucesso');
db.close();
