require('dotenv').config();
const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3001;
const { AsyncLocalStorage } = require('async_hooks');
const empresaStore = new AsyncLocalStorage();

app.use(cors());
app.use(express.json());

// Middleware para identificar empresa pelo header
app.use((req, res, next) => {
    const raw = req.headers['x-empresa-id'] || '1';
    const id = parseInt(raw, 10);
    empresaStore.run(isNaN(id) ? 1 : id, next);
});

function isSuporte(req) {
    return req.headers['x-admin-perfil'] === 'suporte';
}

function getEmpresaId(req) {
    const raw = req.headers['x-empresa-id'] || '1';
    const id = parseInt(raw, 10);
    return isNaN(id) ? 1 : id;
}

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.use(express.static(path.join(__dirname)));

// ============================================================
// S3 / MINIO CONFIG
// ============================================================
const s3Client = new S3Client({
    endpoint: 'https://s3ecommerce.leantechautomacao.com.br',
    region: 'us-east-1',
    credentials: {
        accessKeyId: 'rustfsadmin',
        secretAccessKey: 'w0ql33a3h1iizixn2w9a'
    },
    forcePathStyle: true
});
const S3_BUCKET = 'ecommerce';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max

app.post('/api/upload', upload.single('imagem'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    try {
        const ext = path.extname(req.file.originalname) || '.jpg';
        const key = 'produtos/' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
        await s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype || 'image/jpeg'
        }));
        res.json({ url: `http://rustfs:9000/${S3_BUCKET}/${key}` });
    } catch (err) {
        console.error('Erro S3:', err);
        res.status(500).json({ error: 'Erro ao enviar imagem para o storage' });
    }
});

const db = new DatabaseSync(path.join(__dirname, 'database.sqlite'));

// ============================================================
// HELPERS
// ============================================================

function sendError(res, err, status = 500) {
    console.error(err);
    res.status(status).json({ error: err.message || err });
}

function query(sql, params = []) {
    const empresaId = empresaStore.getStore() || 1;
    // Verificar se a query contem empresa_id = 1 (WHERE, SET, etc.)
    if (/\bempresa_id\s*=\s*1\b/.test(sql)) {
        // Substituir empresa_id = 1 por placeholder
        sql = sql.replace(/\bempresa_id\s*=\s*1\b/g, 'empresa_id = __EMPRESA_PLACEHOLDER__');
        // Reindexar placeholders existentes ($N -> $(N+1))
        sql = sql.replace(/\$(\d+)/g, (match, n) => `$${parseInt(n, 10) + 1}`);
        // Substituir placeholder por $1
        sql = sql.replace(/__EMPRESA_PLACEHOLDER__/g, '$1');
        params = [empresaId, ...params];
    }
    // Verificar INSERT com empresa_id nas colunas e VALUES (1, ...)
    else if (/INSERT\s+INTO\s+\w+.*\(.*empresa_id.*\)/i.test(sql) && /VALUES\s*\(\s*1\s*,/i.test(sql)) {
        sql = sql.replace(/(VALUES\s*\(\s*)1(\s*,)/i, '$1__EMPRESA_PLACEHOLDER__$2');
        // Reindexar placeholders existentes ($N -> $(N+1))
        sql = sql.replace(/\$(\d+)/g, (match, n) => `$${parseInt(n, 10) + 1}`);
        // Substituir placeholder por $1
        sql = sql.replace(/__EMPRESA_PLACEHOLDER__/g, '$1');
        params = [empresaId, ...params];
    }

    // Convert ILIKE to case-insensitive LIKE for SQLite
    sql = sql.replace(/\b(\w+(?:\.\w+)?)\s+ILIKE\s+(\$\d+)/gi, 'LOWER($1) LIKE LOWER($2)');
    // Convert boolean literals
    sql = sql.replace(/ = true\b/g, ' = 1').replace(/ = false\b/g, ' = 0');
    // Convert NOW() to SQLite datetime
    sql = sql.replace(/\bNOW\(\)/g, "datetime('now')");

    const isSelect = /^\s*SELECT/i.test(sql);
    const hasReturning = /RETURNING/i.test(sql);

    // Convert array params to named params for $N placeholders
    let bindParams;
    if (Array.isArray(params) && params.length > 0) {
        bindParams = {};
        params.forEach((val, idx) => {
            let v = val;
            if (v === true) v = 1;
            if (v === false) v = 0;
            if (v === undefined) v = null;
            bindParams['$' + (idx + 1)] = v;
        });
    } else {
        bindParams = params || {};
    }


    if (isSelect || hasReturning) {
        const rows = db.prepare(sql).all(bindParams);
        return { rows: rows || [], rowCount: rows ? rows.length : 0 };
    } else {
        const result = db.prepare(sql).run(bindParams);
        return { rowCount: result.changes, rows: [] };
    }
}

// ============================================================
// HEALTH
// ============================================================
app.get('/api/health', async (req, res) => {
    try {
        db.prepare("SELECT datetime('now')").get();
        res.json({ status: 'ok', db: 'connected' });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// CATEGORIAS
// ============================================================
app.get('/api/categorias', async (req, res) => {
    try {
        const { search } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT c.*, e.nome_fantasia as empresa_nome FROM categorias c LEFT JOIN empresas e ON e.id = c.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT * FROM categorias WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        if (search) {
            const idx = params.length + 1;
            sql += ` AND (nome ILIKE $${idx} OR slug ILIKE $${idx})`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY ordem, nome';
        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) { sendError(res, err); }
});

app.get('/api/categorias/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM categorias WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM categorias WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const result = await query(sql, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Categoria não encontrada' });
        res.json(result.rows[0]);
    } catch (err) { sendError(res, err); }
});

app.post('/api/categorias', async (req, res) => {
    try {
        const { nome, slug, descricao, icone, cor, ordem, ativo, categoria_pai_id, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const result = await query(
            `INSERT INTO categorias (empresa_id, nome, slug, descricao, icone, cor, ordem, ativo, categoria_pai_id, nivel, caminho, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, NOW(), NOW()) RETURNING *`,
            [empresaId, nome, slug, descricao || null, icone || null, cor || '#1a6fc4', ordem || 0, ativo !== false, categoria_pai_id || null, `/${slug}`]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { sendError(res, err); }
});

app.put('/api/categorias/:id', async (req, res) => {
    try {
        const { nome, slug, descricao, icone, cor, ordem, ativo, categoria_pai_id, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const result = await query(
            `UPDATE categorias SET nome=$1, slug=$2, descricao=$3, icone=$4, cor=$5, ordem=$6, ativo=$7, categoria_pai_id=$8, caminho=$9, updated_at=NOW()
             WHERE id=$10 AND empresa_id=$11 RETURNING *`,
            [nome, slug, descricao || null, icone || null, cor || '#1a6fc4', ordem || 0, ativo !== false, categoria_pai_id || null, `/${slug}`, req.params.id, empresaId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Categoria não encontrada' });
        res.json(result.rows[0]);
    } catch (err) { sendError(res, err); }
});

app.delete('/api/categorias/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const prod = await query('SELECT 1 FROM produtos WHERE categoria_id = $1 AND empresa_id = $2 LIMIT 1', [req.params.id, empresaId]);
        if (prod.rows.length > 0) return res.status(400).json({ error: 'Existem produtos vinculados a esta categoria.' });
        const sub = await query('SELECT 1 FROM categorias WHERE categoria_pai_id = $1 AND empresa_id = $2 LIMIT 1', [req.params.id, empresaId]);
        if (sub.rows.length > 0) return res.status(400).json({ error: 'Existem subcategorias vinculadas.' });
        await query('DELETE FROM categorias WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// PRODUTOS
// ============================================================
app.get('/api/produtos', async (req, res) => {
    try {
        const { search, categoria_id } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = `SELECT p.*, c.nome as categoria_nome, e.nome_fantasia as empresa_nome FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id LEFT JOIN empresas e ON e.id = p.empresa_id WHERE 1=1`;
        } else {
            sql = `SELECT p.*, c.nome as categoria_nome FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id WHERE p.empresa_id = $1`;
            params.push(getEmpresaId(req));
        }
        let idx = params.length + 1;
        if (search) { sql += ` AND (p.nome ILIKE $${idx} OR p.codigo_interno ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
        if (categoria_id) { sql += ` AND p.categoria_id = $${idx}`; params.push(categoria_id); idx++; }
        sql += ' ORDER BY p.id DESC';
        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) { sendError(res, err); }
});

app.get('/api/produtos/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM produtos WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM produtos WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const result = await query(sql, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
        const imagens = await query('SELECT id, imagem as url, imagem as url_thumb, ordem, principal FROM produto_imagens WHERE produto_id = $1 AND empresa_id = $2 ORDER BY ordem, id', [req.params.id, getEmpresaId(req)]);
        res.json({ ...result.rows[0], imagens: imagens.rows });
    } catch (err) { sendError(res, err); }
});

app.post('/api/produtos', async (req, res) => {
    try {
        const { codigo_interno, nome, nome_reduzido, descricao, descricao_curta, descricao_tecnica, categoria_id, unidade_id,
                peso_bruto, altura, largura, comprimento, ncm, preco, preco_antigo, estoque, imagem, garantia, destaque, lancamento, mais_vendido, ativo, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const imagemGerada = imagem || `https://source.unsplash.com/400x400/?${encodeURIComponent(nome.split(' ').slice(0,3).join(','))}`;
        const result = await query(
            `INSERT INTO produtos (empresa_id, codigo_interno, nome, nome_reduzido, descricao, descricao_curta, descricao_tecnica,
             categoria_id, unidade_id, peso_bruto, altura, largura, comprimento, ncm, custo_reposicao, custo_medio, markup,
             controla_estoque, destaque, lancamento, mais_vendido, ativo, url_amigavel, cfop_venda, cst_icms, origem, imagem, garantia, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 0, 1.80, true, $15, $16, $17, $18, $19, '5102', '000', '0', $20, $21, NOW(), NOW()) RETURNING *`,
            [empresaId, codigo_interno, nome, nome_reduzido || null, descricao || null, descricao_curta || null, descricao_tecnica || null,
             categoria_id, unidade_id || null, peso_bruto || 0, altura || 0, largura || 0, comprimento || 0, ncm || null,
             destaque === true, lancamento === true, mais_vendido === true, ativo !== false,
             nome ? '/produto/' + nome.toLowerCase().replace(/\s+/g, '-') : null, imagemGerada, garantia || null]
        );
        const produto = result.rows[0];
        await query(`INSERT INTO produto_precos (empresa_id, produto_id, tabela_id, preco, preco_promocional, ativo, updated_at)
             VALUES ($1, $2, $3, $4, $5, true, NOW()) ON CONFLICT (empresa_id, produto_id, tabela_id) DO UPDATE SET preco=$4, preco_promocional=$5, updated_at=NOW()`,
            [empresaId, produto.id, 1, preco || 0, preco_antigo || null]);
        await query(`INSERT INTO produto_estoque (empresa_id, produto_id, deposito_id, saldo_fisico, saldo_reservado, updated_at)
             VALUES ($1, $2, $3, $4, 0, NOW()) ON CONFLICT (empresa_id, produto_id, deposito_id) DO UPDATE SET saldo_fisico=$4, updated_at=NOW()`,
            [empresaId, produto.id, 1, estoque || 0]);
        const { imagens } = req.body;
        if (Array.isArray(imagens) && imagens.length > 0) {
            for (let i = 0; i < imagens.length; i++) {
                await query(
                    `INSERT INTO produto_imagens (empresa_id, produto_id, imagem, ordem, principal, created_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [empresaId, produto.id, imagens[i], i, i === 0]
                );
            }
        }
        res.status(201).json(produto);
    } catch (err) { sendError(res, err); }
});

app.put('/api/produtos/:id', async (req, res) => {
    try {
        const { codigo_interno, nome, nome_reduzido, descricao, descricao_curta, descricao_tecnica, categoria_id, unidade_id,
                peso_bruto, altura, largura, comprimento, ncm, preco, preco_antigo, estoque, imagem, garantia, destaque, lancamento, mais_vendido, ativo, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const imagemGerada = imagem || `https://source.unsplash.com/400x400/?${encodeURIComponent(nome.split(' ').slice(0,3).join(','))}`;
        const result = await query(
            `UPDATE produtos SET codigo_interno=$1, nome=$2, nome_reduzido=$3, descricao=$4, descricao_curta=$5, descricao_tecnica=$6,
             categoria_id=$7, unidade_id=$8, peso_bruto=$9, altura=$10, largura=$11, comprimento=$12, ncm=$13,
             destaque=$14, lancamento=$15, mais_vendido=$16, ativo=$17, url_amigavel=$18, imagem=$19, garantia=$20, updated_at=NOW()
             WHERE id=$21 AND empresa_id=$22 RETURNING *`,
            [codigo_interno, nome, nome_reduzido || null, descricao || null, descricao_curta || null, descricao_tecnica || null,
             categoria_id, unidade_id || null, peso_bruto || 0, altura || 0, largura || 0, comprimento || 0, ncm || null,
             destaque === true, lancamento === true, mais_vendido === true, ativo !== false,
             nome ? '/produto/' + nome.toLowerCase().replace(/\s+/g, '-') : null, imagemGerada, garantia || null, req.params.id, empresaId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
        const produto = result.rows[0];
        await query(`INSERT INTO produto_precos (empresa_id, produto_id, tabela_id, preco, preco_promocional, ativo, updated_at)
             VALUES ($1, $2, $3, $4, $5, true, NOW()) ON CONFLICT (empresa_id, produto_id, tabela_id) DO UPDATE SET preco=$4, preco_promocional=$5, updated_at=NOW()`,
            [empresaId, produto.id, 1, preco || 0, preco_antigo || null]);
        await query(`INSERT INTO produto_estoque (empresa_id, produto_id, deposito_id, saldo_fisico, saldo_reservado, updated_at)
             VALUES ($1, $2, $3, $4, 0, NOW()) ON CONFLICT (empresa_id, produto_id, deposito_id) DO UPDATE SET saldo_fisico=$4, updated_at=NOW()`,
            [empresaId, produto.id, 1, estoque || 0]);
        const { imagens } = req.body;
        if (Array.isArray(imagens)) {
            await query('DELETE FROM produto_imagens WHERE produto_id = $1 AND empresa_id = $2', [produto.id, empresaId]);
            for (let i = 0; i < imagens.length; i++) {
                await query(
                    `INSERT INTO produto_imagens (empresa_id, produto_id, imagem, ordem, principal, created_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [empresaId, produto.id, imagens[i], i, i === 0]
                );
            }
        }
        res.json(produto);
    } catch (err) { sendError(res, err); }
});

app.delete('/api/produtos/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM produtos WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// MARCAS
// ============================================================
app.get('/api/marcas', async (req, res) => {
    try {
        const { search } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT m.*, e.nome_fantasia as empresa_nome FROM marcas m LEFT JOIN empresas e ON e.id = m.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT * FROM marcas WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        if (search) {
            const idx = params.length + 1;
            sql += ` AND nome ILIKE $${idx}`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY nome';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/marcas/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM marcas WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM marcas WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Marca não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/marcas', async (req, res) => {
    try {
        const { nome, codigo_erp, ativo, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query('INSERT INTO marcas (empresa_id, nome, codigo_erp, ativo, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
            [empresaId, nome, codigo_erp || null, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/marcas/:id', async (req, res) => {
    try {
        const { nome, codigo_erp, ativo, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query('UPDATE marcas SET nome=$1, codigo_erp=$2, ativo=$3, updated_at=NOW() WHERE id=$4 AND empresa_id=$5 RETURNING *',
            [nome, codigo_erp || null, ativo !== false, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Marca não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/marcas/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const p = await query('SELECT 1 FROM produtos WHERE marca_id = $1 AND empresa_id = $2 LIMIT 1', [req.params.id, empresaId]);
        if (p.rows.length) return res.status(400).json({ error: 'Existem produtos vinculados a esta marca.' });
        await query('DELETE FROM marcas WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// FORNECEDORES
// ============================================================
app.get('/api/fornecedores', async (req, res) => {
    try {
        const { search } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT f.*, e.nome_fantasia as empresa_nome FROM fornecedores f LEFT JOIN empresas e ON e.id = f.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT * FROM fornecedores WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        if (search) {
            const idx = params.length + 1;
            sql += ` AND (razao_social ILIKE $${idx} OR nome_fantasia ILIKE $${idx} OR cnpj_cpf ILIKE $${idx})`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY razao_social';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/fornecedores/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM fornecedores WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM fornecedores WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Fornecedor não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/fornecedores', async (req, res) => {
    try {
        const { tipo_pessoa, razao_social, nome_fantasia, cnpj_cpf, ie_rg, telefone, email, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            `INSERT INTO fornecedores (empresa_id, codigo_erp, tipo_pessoa, razao_social, nome_fantasia, cnpj_cpf, ie_rg, telefone, email, ativo, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *`,
            [empresaId, codigo_erp || null, tipo_pessoa || 'J', razao_social, nome_fantasia || null, cnpj_cpf || null, ie_rg || null, telefone || null, email || null, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/fornecedores/:id', async (req, res) => {
    try {
        const { tipo_pessoa, razao_social, nome_fantasia, cnpj_cpf, ie_rg, telefone, email, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            `UPDATE fornecedores SET codigo_erp=$1, tipo_pessoa=$2, razao_social=$3, nome_fantasia=$4, cnpj_cpf=$5, ie_rg=$6, telefone=$7, email=$8, ativo=$9, updated_at=NOW()
             WHERE id=$10 AND empresa_id=$11 RETURNING *`,
            [codigo_erp || null, tipo_pessoa || 'J', razao_social, nome_fantasia || null, cnpj_cpf || null, ie_rg || null, telefone || null, email || null, ativo !== false, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Fornecedor não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/fornecedores/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM fornecedores WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// TRANSPORTADORAS
// ============================================================
app.get('/api/transportadoras', async (req, res) => {
    try {
        const { search } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT t.*, e.nome_fantasia as empresa_nome FROM transportadoras t LEFT JOIN empresas e ON e.id = t.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT * FROM transportadoras WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        if (search) {
            const idx = params.length + 1;
            sql += ` AND razao_social ILIKE $${idx}`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY razao_social';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/transportadoras/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM transportadoras WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM transportadoras WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Transportadora não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/transportadoras', async (req, res) => {
    try {
        const { razao_social, nome_fantasia, cnpj, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'INSERT INTO transportadoras (empresa_id, codigo_erp, razao_social, nome_fantasia, cnpj, ativo, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
            [empresaId, codigo_erp || null, razao_social, nome_fantasia || null, cnpj || null, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/transportadoras/:id', async (req, res) => {
    try {
        const { razao_social, nome_fantasia, cnpj, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'UPDATE transportadoras SET codigo_erp=$1, razao_social=$2, nome_fantasia=$3, cnpj=$4, ativo=$5 WHERE id=$6 AND empresa_id=$7 RETURNING *',
            [codigo_erp || null, razao_social, nome_fantasia || null, cnpj || null, ativo !== false, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Transportadora não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/transportadoras/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM transportadoras WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// DEPÓSITOS
// ============================================================
app.get('/api/depositos', async (req, res) => {
    try {
        const { search } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT d.*, e.nome_fantasia as empresa_nome FROM depositos d LEFT JOIN empresas e ON e.id = d.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT * FROM depositos WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        if (search) {
            const idx = params.length + 1;
            sql += ` AND descricao ILIKE $${idx}`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY descricao';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/depositos/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM depositos WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM depositos WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Depósito não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/depositos', async (req, res) => {
    try {
        const { descricao, endereco, padrao, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'INSERT INTO depositos (empresa_id, codigo_erp, descricao, endereco, padrao, ativo, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
            [empresaId, codigo_erp || null, descricao, endereco || null, padrao === true, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/depositos/:id', async (req, res) => {
    try {
        const { descricao, endereco, padrao, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'UPDATE depositos SET codigo_erp=$1, descricao=$2, endereco=$3, padrao=$4, ativo=$5 WHERE id=$6 AND empresa_id=$7 RETURNING *',
            [codigo_erp || null, descricao, endereco || null, padrao === true, ativo !== false, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Depósito não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/depositos/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM depositos WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// UNIDADES DE MEDIDA
// ============================================================
app.get('/api/unidades-medida', async (req, res) => {
    try {
        const { search } = req.query;
        let sql = 'SELECT * FROM unidades_medida';
        const params = [];
        if (search) { sql += ' WHERE codigo ILIKE $1 OR descricao ILIKE $1'; params.push(`%${search}%`); }
        sql += ' ORDER BY codigo';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/unidades-medida/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM unidades_medida WHERE id = $1', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Unidade não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/unidades-medida', async (req, res) => {
    try {
        const { codigo, descricao, permite_fracao, ativo } = req.body;
        const r = await query(
            'INSERT INTO unidades_medida (codigo, descricao, permite_fracao, ativo, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
            [codigo, descricao, permite_fracao !== false, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/unidades-medida/:id', async (req, res) => {
    try {
        const { codigo, descricao, permite_fracao, ativo } = req.body;
        const r = await query(
            'UPDATE unidades_medida SET codigo=$1, descricao=$2, permite_fracao=$3, ativo=$4 WHERE id=$5 RETURNING *',
            [codigo, descricao, permite_fracao !== false, ativo !== false, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Unidade não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/unidades-medida/:id', async (req, res) => {
    try {
        await query('DELETE FROM unidades_medida WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// TABELAS DE PREÇO
// ============================================================
app.get('/api/tabelas-preco', async (req, res) => {
    try {
        const { search } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT t.*, e.nome_fantasia as empresa_nome FROM tabelas_preco t LEFT JOIN empresas e ON e.id = t.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT * FROM tabelas_preco WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        if (search) {
            const idx = params.length + 1;
            sql += ` AND descricao ILIKE $${idx}`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY descricao';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/tabelas-preco/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM tabelas_preco WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM tabelas_preco WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Tabela não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/tabelas-preco', async (req, res) => {
    try {
        const { descricao, markup, padrao, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'INSERT INTO tabelas_preco (empresa_id, codigo_erp, descricao, markup, padrao, ativo, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
            [empresaId, codigo_erp || null, descricao, markup || null, padrao === true, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/tabelas-preco/:id', async (req, res) => {
    try {
        const { descricao, markup, padrao, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'UPDATE tabelas_preco SET codigo_erp=$1, descricao=$2, markup=$3, padrao=$4, ativo=$5 WHERE id=$6 AND empresa_id=$7 RETURNING *',
            [codigo_erp || null, descricao, markup || null, padrao === true, ativo !== false, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Tabela não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/tabelas-preco/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM tabelas_preco WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// FORMAS DE PAGAMENTO
// ============================================================
app.get('/api/formas-pagamento', async (req, res) => {
    try {
        const { search } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT f.*, e.nome_fantasia as empresa_nome FROM formas_pagamento f LEFT JOIN empresas e ON e.id = f.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT * FROM formas_pagamento WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        if (search) {
            const idx = params.length + 1;
            sql += ` AND descricao ILIKE $${idx}`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY descricao';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/formas-pagamento/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM formas_pagamento WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM formas_pagamento WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Forma não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/formas-pagamento', async (req, res) => {
    try {
        const { descricao, tipo, parcelas_max, taxa_operacao, usa_gateway, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'INSERT INTO formas_pagamento (empresa_id, codigo_erp, descricao, tipo, parcelas_max, taxa_operacao, usa_gateway, ativo, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *',
            [empresaId, codigo_erp || null, descricao, tipo || null, parcelas_max || 1, taxa_operacao || 0, usa_gateway === true, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/formas-pagamento/:id', async (req, res) => {
    try {
        const { descricao, tipo, parcelas_max, taxa_operacao, usa_gateway, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'UPDATE formas_pagamento SET codigo_erp=$1, descricao=$2, tipo=$3, parcelas_max=$4, taxa_operacao=$5, usa_gateway=$6, ativo=$7 WHERE id=$8 AND empresa_id=$9 RETURNING *',
            [codigo_erp || null, descricao, tipo || null, parcelas_max || 1, taxa_operacao || 0, usa_gateway === true, ativo !== false, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Forma não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/formas-pagamento/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM formas_pagamento WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// CONDIÇÕES DE PAGAMENTO
// ============================================================
app.get('/api/condicoes-pagamento', async (req, res) => {
    try {
        const { search } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT c.*, e.nome_fantasia as empresa_nome FROM condicoes_pagamento c LEFT JOIN empresas e ON e.id = c.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT * FROM condicoes_pagamento WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        if (search) {
            const idx = params.length + 1;
            sql += ` AND descricao ILIKE $${idx}`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY descricao';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/condicoes-pagamento/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM condicoes_pagamento WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM condicoes_pagamento WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Condição não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/condicoes-pagamento', async (req, res) => {
    try {
        const { descricao, parcelas, dias_parcelas, tipo, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'INSERT INTO condicoes_pagamento (empresa_id, codigo_erp, descricao, parcelas, dias_parcelas, tipo, ativo, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
            [empresaId, codigo_erp || null, descricao, parcelas || 1, dias_parcelas || [0], tipo || 'a_vista', ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/condicoes-pagamento/:id', async (req, res) => {
    try {
        const { descricao, parcelas, dias_parcelas, tipo, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'UPDATE condicoes_pagamento SET codigo_erp=$1, descricao=$2, parcelas=$3, dias_parcelas=$4, tipo=$5, ativo=$6 WHERE id=$7 AND empresa_id=$8 RETURNING *',
            [codigo_erp || null, descricao, parcelas || 1, dias_parcelas || [0], tipo || 'a_vista', ativo !== false, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Condição não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/condicoes-pagamento/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM condicoes_pagamento WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// STATUS DE PEDIDO
// ============================================================
app.get('/api/status-pedido', async (req, res) => {
    try {
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT s.*, e.nome_fantasia as empresa_nome FROM status_pedido_cfg s LEFT JOIN empresas e ON e.id = s.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT * FROM status_pedido_cfg WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        sql += ' ORDER BY ordem';
        const r = await query(sql, params);
        res.json(r.rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/status-pedido/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM status_pedido_cfg WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM status_pedido_cfg WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Status não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/status-pedido', async (req, res) => {
    try {
        const { codigo, descricao, cor, icone, finaliza, cancela, envia_rp, ordem, ativo, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            `INSERT INTO status_pedido_cfg (empresa_id, codigo, descricao, cor, icone, finaliza, cancela, envia_rp, ordem, ativo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [empresaId, codigo, descricao, cor || '#666666', icone || null, finaliza === true, cancela === true, envia_rp === true, ordem || 0, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/status-pedido/:id', async (req, res) => {
    try {
        const { codigo, descricao, cor, icone, finaliza, cancela, envia_rp, ordem, ativo, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            `UPDATE status_pedido_cfg SET codigo=$1, descricao=$2, cor=$3, icone=$4, finaliza=$5, cancela=$6, envia_rp=$7, ordem=$8, ativo=$9
             WHERE id=$10 AND empresa_id=$11 RETURNING *`,
            [codigo, descricao, cor || '#666666', icone || null, finaliza === true, cancela === true, envia_rp === true, ordem || 0, ativo !== false, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Status não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/status-pedido/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM status_pedido_cfg WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// LOGIN
// ============================================================
app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) return res.status(400).json({ error: 'Preencha e-mail e senha' });
        const r = await query(`
            SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.empresa_id,
                   e.nome_fantasia, e.razao_social, e.logo_url, e.cor_primaria, e.cor_secundaria, e.slug
            FROM empresa_usuarios u
            LEFT JOIN empresas e ON e.id = u.empresa_id
            WHERE u.email = $1 AND u.senha_hash = $2 AND u.ativo = true
        `, [email, senha]);
        if (!r.rows.length) return res.status(401).json({ error: 'E-mail ou senha incorretos' });
        res.json({ success: true, usuario: r.rows[0] });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// USUÁRIOS ADMIN (empresa_usuarios)
// ============================================================
app.get('/api/usuarios-admin', async (req, res) => {
    try {
        const { search } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.ultimo_acesso, u.created_at, e.nome_fantasia as empresa_nome FROM empresa_usuarios u LEFT JOIN empresas e ON e.id = u.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT id, nome, email, perfil, ativo, ultimo_acesso, created_at FROM empresa_usuarios WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        if (search) {
            const idx = params.length + 1;
            sql += ` AND (nome ILIKE $${idx} OR email ILIKE $${idx})`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY nome';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/usuarios-admin/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM empresa_usuarios WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM empresa_usuarios WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/usuarios-admin', async (req, res) => {
    try {
        const { nome, email, senha_hash, perfil, ativo, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'INSERT INTO empresa_usuarios (empresa_id, nome, email, senha_hash, perfil, ativo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *',
            [empresaId, nome, email, senha_hash || null, perfil || 'operador', ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/usuarios-admin/:id', async (req, res) => {
    try {
        const { nome, email, senha_hash, perfil, ativo, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'UPDATE empresa_usuarios SET nome=$1, email=$2, senha_hash=$3, perfil=$4, ativo=$5, updated_at=NOW() WHERE id=$6 AND empresa_id=$7 RETURNING *',
            [nome, email, senha_hash || null, perfil || 'operador', ativo !== false, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/usuarios-admin/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM empresa_usuarios WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// VENDEDORES (usuarios)
// ============================================================
app.get('/api/vendedores', async (req, res) => {
    try {
        const { search } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT u.id, u.nome, u.email, u.perfil, u.comissao_pct, u.ativo, u.created_at, e.nome_fantasia as empresa_nome FROM usuarios u LEFT JOIN empresas e ON e.id = u.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT id, nome, email, perfil, comissao_pct, ativo, created_at FROM usuarios WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        if (search) {
            const idx = params.length + 1;
            sql += ` AND (nome ILIKE $${idx} OR email ILIKE $${idx})`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY nome';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/vendedores/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM usuarios WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM usuarios WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Vendedor não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/vendedores', async (req, res) => {
    try {
        const { nome, email, senha_hash, perfil, comissao_pct, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'INSERT INTO usuarios (empresa_id, codigo_erp, nome, email, senha_hash, perfil, comissao_pct, ativo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *',
            [empresaId, codigo_erp || null, nome, email, senha_hash || null, perfil || 'vendedor', comissao_pct || 0, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/vendedores/:id', async (req, res) => {
    try {
        const { nome, email, senha_hash, perfil, comissao_pct, ativo, codigo_erp, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            'UPDATE usuarios SET codigo_erp=$1, nome=$2, email=$3, senha_hash=$4, perfil=$5, comissao_pct=$6, ativo=$7, updated_at=NOW() WHERE id=$8 AND empresa_id=$9 RETURNING *',
            [codigo_erp || null, nome, email, senha_hash || null, perfil || 'vendedor', comissao_pct || 0, ativo !== false, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Vendedor não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/vendedores/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM usuarios WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// CLIENTES
// ============================================================
app.get('/api/clientes', async (req, res) => {
    try {
        const { search } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT c.id, c.nome, c.email, c.cpf_cnpj, c.telefone, c.celular, c.codigo_erp, c.ativo, c.created_at, e.nome_fantasia as empresa_nome FROM clientes c LEFT JOIN empresas e ON e.id = c.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT id, nome, email, cpf_cnpj, telefone, celular, codigo_erp, ativo, created_at FROM clientes WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        if (search) {
            const idx = params.length + 1;
            sql += ` AND (nome ILIKE $${idx} OR email ILIKE $${idx} OR cpf_cnpj ILIKE $${idx} OR codigo_erp ILIKE $${idx})`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY nome';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/clientes/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM clientes WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/clientes', async (req, res) => {
    try {
        const { tipo_pessoa, nome, nome_fantasia, cpf_cnpj, rg_ie, email, telefone, celular, codigo_erp, ativo, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            `INSERT INTO clientes (empresa_id, tipo_pessoa, nome, nome_fantasia, cpf_cnpj, rg_ie, email, telefone, celular, codigo_erp, ativo, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
            [empresaId, tipo_pessoa || 'F', nome, nome_fantasia || null, cpf_cnpj || null, rg_ie || null, email, telefone || null, celular || null, codigo_erp || null, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/clientes/:id', async (req, res) => {
    try {
        const { tipo_pessoa, nome, nome_fantasia, cpf_cnpj, rg_ie, email, telefone, celular, codigo_erp, ativo, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            `UPDATE clientes SET tipo_pessoa=$1, nome=$2, nome_fantasia=$3, cpf_cnpj=$4, rg_ie=$5, email=$6, telefone=$7, celular=$8, codigo_erp=$9, ativo=$10, updated_at=NOW()
             WHERE id=$11 AND empresa_id=$12 RETURNING *`,
            [tipo_pessoa || 'F', nome, nome_fantasia || null, cpf_cnpj || null, rg_ie || null, email, telefone || null, celular || null, codigo_erp || null, ativo !== false, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/clientes/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM clientes WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// BANNERS
// ============================================================
app.get('/api/banners', async (req, res) => {
    try {
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = 'SELECT b.*, e.nome_fantasia as empresa_nome FROM banners b LEFT JOIN empresas e ON e.id = b.empresa_id WHERE 1=1';
        } else {
            sql = 'SELECT * FROM banners WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        sql += ' ORDER BY ordem';
        const r = await query(sql, params);
        res.json(r.rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/banners/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM banners WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM banners WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Banner não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/banners', async (req, res) => {
    try {
        const { imagem, imagem_mobile, titulo, subtitulo, link, ordem, ativo, data_inicio, data_fim, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            `INSERT INTO banners (empresa_id, imagem, imagem_mobile, titulo, subtitulo, link, ordem, ativo, data_inicio, data_fim, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
            [empresaId, imagem, imagem_mobile || null, titulo, subtitulo || null, link || null, ordem || 0, ativo !== false, data_inicio || null, data_fim || null]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/banners/:id', async (req, res) => {
    try {
        const { imagem, imagem_mobile, titulo, subtitulo, link, ordem, ativo, data_inicio, data_fim, empresa_id } = req.body;
        const empresaId = isSuporte(req) && empresa_id ? parseInt(empresa_id, 10) : getEmpresaId(req);
        const r = await query(
            `UPDATE banners SET imagem=$1, imagem_mobile=$2, titulo=$3, subtitulo=$4, link=$5, ordem=$6, ativo=$7, data_inicio=$8, data_fim=$9
             WHERE id=$10 AND empresa_id=$11 RETURNING *`,
            [imagem, imagem_mobile || null, titulo, subtitulo || null, link || null, ordem || 0, ativo !== false, data_inicio || null, data_fim || null, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Banner não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/banners/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM banners WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// PEDIDOS
// ============================================================
app.get('/api/pedidos', async (req, res) => {
    try {
        const { search, status } = req.query;
        let sql;
        const params = [];
        if (isSuporte(req)) {
            sql = `
                SELECT p.*, c.nome as cliente_nome, c.email as cliente_email, fp.descricao as forma_pagamento_desc
                FROM pedidos p
                LEFT JOIN clientes c ON c.id = p.cliente_id
                LEFT JOIN formas_pagamento fp ON fp.id = p.forma_pagamento_id
                WHERE 1=1
            `;
        } else {
            sql = `
                SELECT p.*, c.nome as cliente_nome, c.email as cliente_email, fp.descricao as forma_pagamento_desc
                FROM pedidos p
                LEFT JOIN clientes c ON c.id = p.cliente_id
                LEFT JOIN formas_pagamento fp ON fp.id = p.forma_pagamento_id
                WHERE p.empresa_id = $1
            `;
            params.push(getEmpresaId(req));
        }
        let idx = params.length + 1;
        if (search) {
            sql += ` AND (p.numero ILIKE $${idx} OR c.nome ILIKE $${idx})`;
            params.push(`%${search}%`);
            idx++;
        }
        if (status) {
            sql += ` AND p.status = $${idx}`;
            params.push(status);
            idx++;
        }
        sql += ' ORDER BY p.created_at DESC';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/pedidos/:id', async (req, res) => {
    try {
        let sql; let params;
        if (isSuporte(req)) {
            sql = 'SELECT * FROM pedidos WHERE id = $1';
            params = [req.params.id];
        } else {
            sql = 'SELECT * FROM pedidos WHERE id = $1 AND empresa_id = $2';
            params = [req.params.id, getEmpresaId(req)];
        }
        const r = await query(sql, params);
        if (!r.rows.length) return res.status(404).json({ error: 'Pedido não encontrado' });
        const pedido = r.rows[0];
        const itens = await query('SELECT * FROM itens_pedido WHERE pedido_id = $1 ORDER BY sequencia', [req.params.id]);
        res.json({ ...pedido, itens: itens.rows });
    } catch (err) { sendError(res, err); }
});
app.put('/api/pedidos/:id/status', async (req, res) => {
    try {
        const { status, obs_interna } = req.body;
        const empresaId = getEmpresaId(req);
        const r = await query(
            'UPDATE pedidos SET status=$1, obs_interna=$2, updated_at=NOW() WHERE id=$3 AND empresa_id=$4 RETURNING *',
            [status, obs_interna || null, req.params.id, empresaId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Pedido não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/pedidos/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        await query('DELETE FROM itens_pedido WHERE pedido_id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        await query('DELETE FROM pedidos WHERE id = $1 AND empresa_id = $2', [req.params.id, empresaId]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// ESTATÍSTICAS
// ============================================================
app.get('/api/estatisticas', async (req, res) => {
    try {
        let whereEmpresa;
        const params = [];
        if (isSuporte(req)) {
            whereEmpresa = 'WHERE 1=1';
        } else {
            whereEmpresa = 'WHERE empresa_id = $1';
            params.push(getEmpresaId(req));
        }
        const cat = await query(`SELECT COUNT(*) as total FROM categorias ${whereEmpresa}`, params);
        const catAtivas = await query(`SELECT COUNT(*) as total FROM categorias ${whereEmpresa} AND ativo = true`, params);
        const prod = await query(`SELECT COUNT(*) as total FROM produtos ${whereEmpresa}`, params);
        const prodAtivos = await query(`SELECT COUNT(*) as total FROM produtos ${whereEmpresa} AND ativo = true`, params);
        const prodDestaque = await query(`SELECT COUNT(*) as total FROM produtos ${whereEmpresa} AND destaque = true`, params);
        const prodSemEstoque = await query(`
            SELECT COUNT(*) as total FROM produtos p
            ${whereEmpresa} AND p.controla_estoque = true
            AND NOT EXISTS (SELECT 1 FROM produto_estoque e WHERE e.produto_id = p.id AND e.saldo_fisico > 0)`, params);
        const clientes = await query(`SELECT COUNT(*) as total FROM clientes ${whereEmpresa}`, params);
        const pedidos = await query(`SELECT COUNT(*) as total FROM pedidos ${whereEmpresa}`, params);
        const pedidosPendentes = await query(`SELECT COUNT(*) as total FROM pedidos ${whereEmpresa} AND status = 'pendente'`, params);
        res.json({
            totalCategorias: parseInt(cat.rows[0].total),
            categoriasAtivas: parseInt(catAtivas.rows[0].total),
            totalProdutos: parseInt(prod.rows[0].total),
            produtosAtivos: parseInt(prodAtivos.rows[0].total),
            produtosDestaque: parseInt(prodDestaque.rows[0].total),
            produtosSemEstoque: parseInt(prodSemEstoque.rows[0].total),
            totalClientes: parseInt(clientes.rows[0].total),
            totalPedidos: parseInt(pedidos.rows[0].total),
            pedidosPendentes: parseInt(pedidosPendentes.rows[0].total)
        });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// LOJA (público)
// ============================================================
app.get('/api/loja/categorias', async (req, res) => {
    try {
        const result = await query(`SELECT id, slug, nome, descricao, icone, cor, ordem FROM categorias WHERE empresa_id = 1 AND ativo = true ORDER BY ordem, nome`);
        const todos = { id: 'todos', slug: 'todos', nome: 'Todos os Produtos', icone: 'fas fa-house', cor: '#1a6fc4', ordem: 0 };
        res.json([todos, ...result.rows]);
    } catch (err) { sendError(res, err); }
});

app.get('/api/loja/produtos', async (req, res) => {
    try {
        const { categoria, busca } = req.query;
        let sql = `
            SELECT p.id, p.codigo_interno as codigo, p.nome, p.descricao, p.imagem, p.destaque, p.lancamento, p.mais_vendido,
                c.slug as categoria, c.nome as categoria_nome, c.icone as categoria_icone,
                COALESCE(pr.preco, 0) as preco, COALESCE(pr.preco_promocional, 0) as preco_antigo,
                COALESCE(e.saldo_fisico, 0) as estoque, 1 as parcelas
            FROM produtos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN produto_precos pr ON pr.produto_id = p.id AND pr.tabela_id = 1
            LEFT JOIN produto_estoque e ON e.produto_id = p.id AND e.deposito_id = 1
            WHERE p.empresa_id = 1 AND p.ativo = true`;
        const params = [];
        let idx = 1;
        if (categoria && categoria !== 'todos') { sql += ` AND c.slug = $${idx}`; params.push(categoria); idx++; }
        if (busca) { sql += ` AND (p.nome ILIKE $${idx} OR p.codigo_interno ILIKE $${idx})`; params.push(`%${busca}%`); idx++; }
        sql += ' ORDER BY p.destaque DESC, p.id DESC';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});

app.get('/api/loja/produtos/:id', async (req, res) => {
    try {
        const prodResult = await query(
            `SELECT p.id, p.codigo_interno as codigo, p.nome, p.descricao, p.descricao_curta, p.descricao_tecnica, p.imagem,
                p.peso_bruto, p.altura, p.largura, p.comprimento, p.ncm, p.destaque, p.lancamento, p.mais_vendido,
                c.slug as categoria, c.nome as categoria_nome,
                COALESCE(pr.preco, 0) as preco, COALESCE(pr.preco_promocional, 0) as preco_antigo,
                COALESCE(e.saldo_fisico, 0) as estoque, 1 as parcelas
            FROM produtos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN produto_precos pr ON pr.produto_id = p.id AND pr.tabela_id = 1
            LEFT JOIN produto_estoque e ON e.produto_id = p.id AND e.deposito_id = 1
            WHERE p.id = $1 AND p.empresa_id = 1`, [req.params.id]);
        if (!prodResult.rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
        const relResult = await query(
            `SELECT p.id, p.nome, p.imagem, COALESCE(pr.preco, 0) as preco, COALESCE(pr.preco_promocional, 0) as preco_antigo, 1 as parcelas
            FROM produtos p
            LEFT JOIN produto_precos pr ON pr.produto_id = p.id AND pr.tabela_id = 1
            WHERE p.categoria_id = (SELECT categoria_id FROM produtos WHERE id = $1) AND p.id != $1 AND p.empresa_id = 1 AND p.ativo = true LIMIT 5`,
            [req.params.id]);
        res.json({ produto: prodResult.rows[0], relacionados: relResult.rows });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Painel admin: http://localhost:${PORT}/admin.html`);
    console.log(`Loja: http://localhost:${PORT}/index.html`);
});
