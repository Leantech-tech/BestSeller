require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3000;
const { AsyncLocalStorage } = require('async_hooks');
const empresaStore = new AsyncLocalStorage();

app.use(cors());
app.use(express.json());

// Middleware para identificar empresa pelo header
app.use((req, res, next) => {
    if (isSuporte(req)) {
        return empresaStore.run(null, next);
    }
    // Só exige header em rotas da API; arquivos estáticos (html, css, js, imagens) passam livre
    if (!req.path.startsWith('/api/')) {
        return empresaStore.run(1, next);
    }
    // Login e health são públicos
    if (req.path === '/api/login' || req.path === '/api/health') {
        return empresaStore.run(1, next);
    }
    const raw = req.headers['x-empresa-id'];
    if (!raw) {
        return res.status(403).json({ error: 'Header x-empresa-id obrigatório' });
    }
    const id = parseInt(raw, 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Header x-empresa-id inválido' });
    }
    empresaStore.run(id, next);
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
const UPLOAD_DIR = path.join(__dirname, 'images', 'uploads');
if (!require('fs').existsSync(UPLOAD_DIR)) {
    require('fs').mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max

app.post('/api/upload', upload.single('imagem'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    try {
        const ext = path.extname(req.file.originalname) || '.jpg';
        let empresaId = req.body.empresa_id || req.query.empresa_id;
        if (!isSuporte(req)) {
            empresaId = getEmpresaId(req);
        }
        if (!empresaId) empresaId = '1';
        const tipo = req.body.tipo || req.query.tipo || 'produtos';
        const prefixo = `empresa-${empresaId}/${tipo}/`;
        const key = prefixo + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
        const uploadPromise = s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype || 'image/jpeg',
            ACL: 'public-read'
        }));
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout S3')), 1000));
        await Promise.race([uploadPromise, timeoutPromise]);
        const url = `https://s3ecommerce.leantechautomacao.com.br/${S3_BUCKET}/${key}`;
        res.json({ url });
    } catch (err) {
        console.error('Erro S3 (usando fallback local):', err.message);
        // Fallback: salvar localmente
        try {
            const ext = path.extname(req.file.originalname) || '.jpg';
            const filename = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
            const filepath = path.join(UPLOAD_DIR, filename);
            require('fs').writeFileSync(filepath, req.file.buffer);
            const url = `/images/uploads/${filename}`;
            res.json({ url });
        } catch (localErr) {
            console.error('Erro fallback local:', localErr);
            res.status(500).json({ error: 'Erro ao enviar imagem' });
        }
    }
});

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: false
});

// ============================================================
// HELPERS
// ============================================================

function sendError(res, err, status = 500) {
    console.error(err);
    res.status(status).json({ error: err.message || err });
}

async function query(sql, params = []) {
    const empresaId = empresaStore.getStore();

    // Se empresaId for null (Suporte), não faz substituição automática
    if (empresaId === null) {
        return pool.query(sql, params);
    }

    const eid = empresaId || 1;

    // Verificar se a query contem empresa_id = 1 (WHERE, SET, etc.)
    if (/\bempresa_id\s*=\s*1\b/.test(sql)) {
        // Substituir empresa_id = 1 por placeholder
        let newSql = sql.replace(/\bempresa_id\s*=\s*1\b/g, 'empresa_id = __EMPRESA_PLACEHOLDER__');
        // Reindexar placeholders existentes ($N -> $(N+1))
        newSql = newSql.replace(/\$(\d+)/g, (match, n) => `$${parseInt(n, 10) + 1}`);
        // Substituir placeholder por $1
        newSql = newSql.replace(/__EMPRESA_PLACEHOLDER__/g, '$1');
        const newParams = [eid, ...params];
        return pool.query(newSql, newParams);
    }
    // Verificar INSERT com empresa_id nas colunas e VALUES (1, ...)
    if (/INSERT\s+INTO\s+\w+.*\(.*empresa_id.*\)/i.test(sql) && /VALUES\s*\(\s*1\s*,/i.test(sql)) {
        let newSql = sql.replace(/(VALUES\s*\(\s*)1(\s*,)/i, '$1__EMPRESA_PLACEHOLDER__$2');
        // Reindexar placeholders existentes ($N -> $(N+1))
        newSql = newSql.replace(/\$(\d+)/g, (match, n) => `$${parseInt(n, 10) + 1}`);
        // Substituir placeholder por $1
        newSql = newSql.replace(/__EMPRESA_PLACEHOLDER__/g, '$1');
        const newParams = [eid, ...params];
        return pool.query(newSql, newParams);
    }
    return pool.query(sql, params);
}

// ============================================================
// HEALTH
// ============================================================
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT NOW()');
        res.json({ status: 'ok', db: 'connected' });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// LOJA (endpoints públicos do e-commerce)
// ============================================================

// Categorias da loja (apenas ativas)
app.get('/api/loja/categorias', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const result = await pool.query(
            `SELECT id, nome, slug, descricao, icone, cor, ordem
             FROM categorias
             WHERE empresa_id = $1 AND ativo = true
             ORDER BY ordem, nome`,
            [empresaId]
        );
        // Adicionar opção "Todos os Produtos" no início
        const todas = { id: 'todos', slug: 'todos', nome: 'Todos os Produtos', icone: 'fas fa-house' };
        res.json([todas, ...result.rows]);
    } catch (err) { sendError(res, err); }
});

// Produtos da loja (apenas ativos, com preço e estoque)
app.get('/api/loja/produtos', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { busca } = req.query;
        let sql = `
            SELECT p.id, p.nome, p.descricao, p.descricao_curta, p.imagem, p.codigo_interno as codigo,
                   p.destaque, p.lancamento, p.mais_vendido, p.garantia,
                   c.slug as categoria, c.nome as categoria_nome,
                   COALESCE(pp.preco, 0) as preco,
                   pp.preco_promocional as preco_antigo,
                   COALESCE(pe.saldo_fisico, 0) as estoque,
                   COALESCE((SELECT parcelas_max FROM formas_pagamento WHERE empresa_id = $1 AND ativo = true ORDER BY parcelas_max DESC LIMIT 1), 1) as parcelas
            FROM produtos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN produto_precos pp ON pp.produto_id = p.id AND pp.empresa_id = p.empresa_id AND pp.ativo = true
            LEFT JOIN produto_estoque pe ON pe.produto_id = p.id AND pe.empresa_id = p.empresa_id
            WHERE p.empresa_id = $1 AND p.ativo = true
        `;
        const params = [empresaId];
        if (busca) {
            sql += ` AND (p.nome ILIKE $2 OR p.codigo_interno ILIKE $2)`;
            params.push(`%${busca}%`);
        }
        sql += ' ORDER BY p.destaque DESC, p.id DESC';
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) { sendError(res, err); }
});

// Produto individual da loja (por ID)
app.get('/api/loja/produtos/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const result = await pool.query(`
            SELECT p.id, p.nome, p.descricao, p.descricao_curta, p.descricao_tecnica, p.imagem,
                   p.codigo_interno as codigo, p.peso_bruto, p.altura, p.largura, p.comprimento,
                   p.destaque, p.lancamento, p.mais_vendido, p.garantia,
                   c.slug as categoria, c.nome as categoria_nome,
                   COALESCE(pp.preco, 0) as preco,
                   pp.preco_promocional as preco_antigo,
                   COALESCE(pe.saldo_fisico, 0) as estoque,
                   COALESCE((SELECT parcelas_max FROM formas_pagamento WHERE empresa_id = $1 AND ativo = true ORDER BY parcelas_max DESC LIMIT 1), 1) as parcelas
            FROM produtos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN produto_precos pp ON pp.produto_id = p.id AND pp.empresa_id = p.empresa_id AND pp.ativo = true
            LEFT JOIN produto_estoque pe ON pe.produto_id = p.id AND pe.empresa_id = p.empresa_id
            WHERE p.id = $2 AND p.empresa_id = $1 AND p.ativo = true
        `, [empresaId, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });

        const imagens = await pool.query(
            `SELECT id, url, url_thumb, ordem, principal FROM produto_imagens WHERE produto_id = $1 AND empresa_id = $2 ORDER BY ordem, id`,
            [req.params.id, empresaId]
        );

        const relacionados = await pool.query(
            `SELECT p.id, p.nome, p.imagem, COALESCE(pr.preco, 0) as preco, COALESCE(pr.preco_promocional, 0) as preco_antigo, 1 as parcelas
             FROM produtos p
             LEFT JOIN produto_precos pr ON pr.produto_id = p.id AND pr.empresa_id = p.empresa_id AND pr.ativo = true
             WHERE p.categoria_id = $1 AND p.id != $2 AND p.empresa_id = $3 AND p.ativo = true LIMIT 5`,
            [result.rows[0].categoria_id, req.params.id, empresaId]
        );

        res.json({ produto: result.rows[0], imagens: imagens.rows, relacionados: relacionados.rows });
    } catch (err) { sendError(res, err); }
});

app.get('/api/loja/produtos/:id/imagens', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const result = await pool.query(
            `SELECT id, url, url_thumb, ordem, principal FROM produto_imagens WHERE produto_id = $1 AND empresa_id = $2 ORDER BY ordem, id`,
            [req.params.id, empresaId]);
        res.json(result.rows);
    } catch (err) { sendError(err); }
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
        const result = await query('SELECT * FROM categorias WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Categoria não encontrada' });
        res.json(result.rows[0]);
    } catch (err) { sendError(res, err); }
});

app.post('/api/categorias', async (req, res) => {
    try {
        const { nome, slug, descricao, icone, cor, ordem, ativo, categoria_pai_id } = req.body;
        const empresaId = getEmpresaId(req);
        const slugNormalizado = (slug || nome || 'sem-nome').toLowerCase().trim().replace(/[^a-z0-9\-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

        const check = await query('SELECT 1 FROM categorias WHERE slug ILIKE $1 AND empresa_id = $2 LIMIT 1', [slugNormalizado, empresaId]);
        if (check.rows.length > 0) {
            return res.status(409).json({ error: 'Já existe uma categoria com este nome nesta empresa.' });
        }

        const result = await query(
            `INSERT INTO categorias (empresa_id, nome, slug, descricao, icone, cor, ordem, ativo, categoria_pai_id, nivel, caminho, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, NOW(), NOW()) RETURNING *`,
            [empresaId, nome, slugNormalizado, descricao || null, icone || null, cor || '#1a6fc4', ordem || 0, ativo !== false, categoria_pai_id || null, `/${slugNormalizado}`]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { sendError(res, err); }
});

app.put('/api/categorias/:id', async (req, res) => {
    try {
        const { nome, slug, descricao, icone, cor, ordem, ativo, categoria_pai_id } = req.body;
        const empresaId = getEmpresaId(req);
        const slugNormalizado = (slug || nome || 'sem-nome').toLowerCase().trim().replace(/[^a-z0-9\-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

        const check = await query('SELECT 1 FROM categorias WHERE slug ILIKE $1 AND empresa_id = $2 AND id != $3 LIMIT 1', [slugNormalizado, empresaId, req.params.id]);
        if (check.rows.length > 0) {
            return res.status(409).json({ error: 'Já existe uma categoria com este nome nesta empresa.' });
        }

        const result = await query(
            `UPDATE categorias SET nome=$1, slug=$2, descricao=$3, icone=$4, cor=$5, ordem=$6, ativo=$7, categoria_pai_id=$8, caminho=$9, updated_at=NOW()
             WHERE id=$10 AND empresa_id=$11 RETURNING *`,
            [nome, slugNormalizado, descricao || null, icone || null, cor || '#1a6fc4', ordem || 0, ativo !== false, categoria_pai_id || null, `/${slugNormalizado}`, req.params.id, empresaId]
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
        let idx = 1;
        if (isSuporte(req)) {
            sql = `SELECT p.*, c.nome as categoria_nome, e.nome_fantasia as empresa_nome,
                   COALESCE(pp.preco, 0) as preco, pp.preco_promocional as preco_antigo,
                   COALESCE(pe.saldo_fisico, 0) as estoque
                   FROM produtos p
                   LEFT JOIN categorias c ON c.id = p.categoria_id
                   LEFT JOIN empresas e ON e.id = p.empresa_id
                   LEFT JOIN produto_precos pp ON pp.produto_id = p.id AND pp.empresa_id = p.empresa_id AND pp.ativo = true
                   LEFT JOIN produto_estoque pe ON pe.produto_id = p.id AND pe.empresa_id = p.empresa_id
                   WHERE 1=1`;
        } else {
            sql = `SELECT p.*, c.nome as categoria_nome,
                   COALESCE(pp.preco, 0) as preco, pp.preco_promocional as preco_antigo,
                   COALESCE(pe.saldo_fisico, 0) as estoque
                   FROM produtos p
                   LEFT JOIN categorias c ON c.id = p.categoria_id
                   LEFT JOIN produto_precos pp ON pp.produto_id = p.id AND pp.empresa_id = p.empresa_id AND pp.ativo = true
                   LEFT JOIN produto_estoque pe ON pe.produto_id = p.id AND pe.empresa_id = p.empresa_id
                   WHERE p.empresa_id = $1`;
            params.push(getEmpresaId(req));
            idx++;
        }
        if (search) { sql += ` AND (p.nome ILIKE $${idx} OR p.codigo_interno ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
        if (categoria_id) { sql += ` AND p.categoria_id = $${idx}`; params.push(categoria_id); idx++; }
        sql += ' ORDER BY p.id DESC';
        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) { sendError(res, err); }
});

app.get('/api/produtos/:id', async (req, res) => {
    try {
        const result = await query(
            `SELECT p.*,
             COALESCE(pp.preco, 0) as preco, pp.preco_promocional as preco_antigo,
             COALESCE(pe.saldo_fisico, 0) as estoque
             FROM produtos p
             LEFT JOIN produto_precos pp ON pp.produto_id = p.id AND pp.empresa_id = p.empresa_id AND pp.ativo = true
             LEFT JOIN produto_estoque pe ON pe.produto_id = p.id AND pe.empresa_id = p.empresa_id
             WHERE p.id = $1 AND p.empresa_id = $2`,
            [req.params.id, getEmpresaId(req)]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
        const imagens = await query('SELECT id, url, url_thumb, ordem, principal FROM produto_imagens WHERE produto_id = $1 AND empresa_id = $2 ORDER BY ordem, id', [req.params.id, getEmpresaId(req)]);
        res.json({ ...result.rows[0], imagens: imagens.rows });
    } catch (err) { sendError(res, err); }
});

app.post('/api/produtos', async (req, res) => {
    try {
        const { codigo_interno, nome, nome_reduzido, descricao, descricao_curta, descricao_tecnica, categoria_id, unidade_id,
            peso_bruto, altura, largura, comprimento, ncm, preco, preco_antigo, estoque, imagem, garantia, destaque, lancamento, mais_vendido, ativo } = req.body;
        const empresaId = getEmpresaId(req);
        const urlAmigavel = nome ? '/produto/' + nome.toLowerCase().replace(/\s+/g, '-') : null;

        // Verificar duplicidade de codigo_interno
        if (codigo_interno) {
            const checkCod = await query('SELECT 1 FROM produtos WHERE codigo_interno = $1 AND empresa_id = $2 LIMIT 1', [codigo_interno, empresaId]);
            if (checkCod.rows.length > 0) {
                return res.status(409).json({ error: 'Já existe um produto com este código interno nesta empresa.' });
            }
        }

        // Verificar duplicidade de url_amigavel
        if (urlAmigavel) {
            const checkUrl = await query('SELECT 1 FROM produtos WHERE url_amigavel = $1 AND empresa_id = $2 LIMIT 1', [urlAmigavel, empresaId]);
            if (checkUrl.rows.length > 0) {
                return res.status(409).json({ error: 'Já existe um produto com este nome nesta empresa.' });
            }
        }

        const seed = (nome || 'produto').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
        const imagemGerada = imagem || `https://picsum.photos/seed/${seed}/800/800`;
        const result = await query(
            `INSERT INTO produtos (empresa_id, codigo_interno, nome, nome_reduzido, descricao, descricao_curta, descricao_tecnica,
             categoria_id, unidade_id, peso_bruto, altura, largura, comprimento, ncm, custo_reposicao, custo_medio, markup,
             controla_estoque, destaque, lancamento, mais_vendido, ativo, url_amigavel, cfop_venda, cst_icms, origem, imagem, garantia, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 0, 1.80, true, $15, $16, $17, $18, $19, '5102', '000', '0', $20, $21, NOW(), NOW()) RETURNING *`,
            [empresaId, codigo_interno, nome, nome_reduzido || null, descricao || null, descricao_curta || null, descricao_tecnica || null,
                categoria_id, unidade_id || null, peso_bruto || 0, altura || 0, largura || 0, comprimento || 0, ncm || null,
                destaque === true, lancamento === true, mais_vendido === true, ativo !== false,
                urlAmigavel, imagemGerada, garantia || null]
        );
        const produto = result.rows[0];
        await query(`INSERT INTO produto_precos (empresa_id, produto_id, tabela_id, preco, preco_promocional, ativo, updated_at)
             VALUES ($1, $2, 1, $3, $4, true, NOW()) ON CONFLICT (empresa_id, produto_id, tabela_id) DO UPDATE SET preco=$3, preco_promocional=$4, updated_at=NOW()`,
            [empresaId, produto.id, preco || 0, preco_antigo || null]);
        await query(`INSERT INTO produto_estoque (empresa_id, produto_id, deposito_id, saldo_fisico, saldo_reservado, updated_at)
             VALUES ($1, $2, 1, $3, 0, NOW()) ON CONFLICT (empresa_id, produto_id, deposito_id) DO UPDATE SET saldo_fisico=$3, updated_at=NOW()`,
            [empresaId, produto.id, estoque || 0]);
        // Salvar imagens adicionais
        const { imagens } = req.body;
        if (Array.isArray(imagens) && imagens.length > 0) {
            for (let i = 0; i < imagens.length; i++) {
                await query(
                    `INSERT INTO produto_imagens (empresa_id, produto_id, url, url_thumb, ordem, principal, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                    [empresaId, produto.id, imagens[i], null, i, i === 0]
                );
            }
        }
        res.status(201).json(produto);
    } catch (err) { sendError(res, err); }
});

app.put('/api/produtos/:id', async (req, res) => {
    try {
        const { codigo_interno, nome, nome_reduzido, descricao, descricao_curta, descricao_tecnica, categoria_id, unidade_id,
            peso_bruto, altura, largura, comprimento, ncm, preco, preco_antigo, estoque, imagem, garantia, destaque, lancamento, mais_vendido, ativo } = req.body;
        const empresaId = getEmpresaId(req);
        const urlAmigavel = nome ? '/produto/' + nome.toLowerCase().replace(/\s+/g, '-') : null;

        // Verificar duplicidade de codigo_interno
        if (codigo_interno) {
            const checkCod = await query('SELECT 1 FROM produtos WHERE codigo_interno = $1 AND empresa_id = $2 AND id != $3 LIMIT 1', [codigo_interno, empresaId, req.params.id]);
            if (checkCod.rows.length > 0) {
                return res.status(409).json({ error: 'Já existe um produto com este código interno nesta empresa.' });
            }
        }

        // Verificar duplicidade de url_amigavel
        if (urlAmigavel) {
            const checkUrl = await query('SELECT 1 FROM produtos WHERE url_amigavel = $1 AND empresa_id = $2 AND id != $3 LIMIT 1', [urlAmigavel, empresaId, req.params.id]);
            if (checkUrl.rows.length > 0) {
                return res.status(409).json({ error: 'Já existe um produto com este nome nesta empresa.' });
            }
        }

        const seed = (nome || 'produto').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
        const imagemGerada = imagem || `https://picsum.photos/seed/${seed}/800/800`;
        const result = await query(
            `UPDATE produtos SET codigo_interno=$1, nome=$2, nome_reduzido=$3, descricao=$4, descricao_curta=$5, descricao_tecnica=$6,
             categoria_id=$7, unidade_id=$8, peso_bruto=$9, altura=$10, largura=$11, comprimento=$12, ncm=$13,
             destaque=$14, lancamento=$15, mais_vendido=$16, ativo=$17, url_amigavel=$18, imagem=$19, garantia=$20, updated_at=NOW()
             WHERE id=$21 AND empresa_id=$22 RETURNING *`,
            [codigo_interno, nome, nome_reduzido || null, descricao || null, descricao_curta || null, descricao_tecnica || null,
                categoria_id, unidade_id || null, peso_bruto || 0, altura || 0, largura || 0, comprimento || 0, ncm || null,
                destaque === true, lancamento === true, mais_vendido === true, ativo !== false,
                urlAmigavel, imagemGerada, garantia || null, req.params.id, empresaId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
        const produto = result.rows[0];
        await query(`INSERT INTO produto_precos (empresa_id, produto_id, tabela_id, preco, preco_promocional, ativo, updated_at)
             VALUES ($1, $2, 1, $3, $4, true, NOW()) ON CONFLICT (empresa_id, produto_id, tabela_id) DO UPDATE SET preco=$3, preco_promocional=$4, updated_at=NOW()`,
            [empresaId, produto.id, preco || 0, preco_antigo || null]);
        await query(`INSERT INTO produto_estoque (empresa_id, produto_id, deposito_id, saldo_fisico, saldo_reservado, updated_at)
             VALUES ($1, $2, 1, $3, 0, NOW()) ON CONFLICT (empresa_id, produto_id, deposito_id) DO UPDATE SET saldo_fisico=$3, updated_at=NOW()`,
            [empresaId, produto.id, estoque || 0]);
        // Atualizar imagens
        const { imagens } = req.body;
        if (Array.isArray(imagens)) {
            await query('DELETE FROM produto_imagens WHERE produto_id = $1 AND empresa_id = $2', [produto.id, empresaId]);
            for (let i = 0; i < imagens.length; i++) {
                await query(
                    `INSERT INTO produto_imagens (empresa_id, produto_id, url, url_thumb, ordem, principal, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                    [empresaId, produto.id, imagens[i], null, i, i === 0]
                );
            }
        }
        res.json(produto);
    } catch (err) { sendError(res, err); }
});

app.delete('/api/produtos/:id', async (req, res) => {
    try {
        await query('DELETE FROM produtos WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
        if (search) { sql += ' AND nome ILIKE $1'; params.push(`%${search}%`); }
        sql += ' ORDER BY nome';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/marcas/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM marcas WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Marca não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/marcas', async (req, res) => {
    try {
        const { nome, codigo_erp, ativo } = req.body;
        const r = await query('INSERT INTO marcas (empresa_id, nome, codigo_erp, ativo, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
            [getEmpresaId(req), nome, codigo_erp || null, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/marcas/:id', async (req, res) => {
    try {
        const { nome, codigo_erp, ativo } = req.body;
        const r = await query('UPDATE marcas SET nome=$1, codigo_erp=$2, ativo=$3, updated_at=NOW() WHERE id=$4 AND empresa_id=$5 RETURNING *',
            [nome, codigo_erp || null, ativo !== false, req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Marca não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/marcas/:id', async (req, res) => {
    try {
        const p = await query('SELECT 1 FROM produtos WHERE marca_id = $1 AND empresa_id = $2 LIMIT 1', [req.params.id, getEmpresaId(req)]);
        if (p.rows.length) return res.status(400).json({ error: 'Existem produtos vinculados a esta marca.' });
        await query('DELETE FROM marcas WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
        if (search) { sql += ' AND (razao_social ILIKE $1 OR nome_fantasia ILIKE $1 OR cnpj_cpf ILIKE $1)'; params.push(`%${search}%`); }
        sql += ' ORDER BY razao_social';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/fornecedores/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM fornecedores WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Fornecedor não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/fornecedores', async (req, res) => {
    try {
        const { tipo_pessoa, razao_social, nome_fantasia, cnpj_cpf, ie_rg, telefone, email, ativo, codigo_erp } = req.body;
        const r = await query(
            `INSERT INTO fornecedores (empresa_id, codigo_erp, tipo_pessoa, razao_social, nome_fantasia, cnpj_cpf, ie_rg, telefone, email, ativo, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *`,
            [getEmpresaId(req), codigo_erp || null, tipo_pessoa || 'J', razao_social, nome_fantasia || null, cnpj_cpf || null, ie_rg || null, telefone || null, email || null, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/fornecedores/:id', async (req, res) => {
    try {
        const { tipo_pessoa, razao_social, nome_fantasia, cnpj_cpf, ie_rg, telefone, email, ativo, codigo_erp } = req.body;
        const r = await query(
            `UPDATE fornecedores SET codigo_erp=$1, tipo_pessoa=$2, razao_social=$3, nome_fantasia=$4, cnpj_cpf=$5, ie_rg=$6, telefone=$7, email=$8, ativo=$9, updated_at=NOW()
             WHERE id=$10 AND empresa_id=$11 RETURNING *`,
            [codigo_erp || null, tipo_pessoa || 'J', razao_social, nome_fantasia || null, cnpj_cpf || null, ie_rg || null, telefone || null, email || null, ativo !== false, req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Fornecedor não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/fornecedores/:id', async (req, res) => {
    try {
        await query('DELETE FROM fornecedores WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
        if (search) { sql += ' AND razao_social ILIKE $1'; params.push(`%${search}%`); }
        sql += ' ORDER BY razao_social';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/transportadoras/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM transportadoras WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Transportadora não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/transportadoras', async (req, res) => {
    try {
        const { razao_social, nome_fantasia, cnpj, ativo, codigo_erp } = req.body;
        const r = await query(
            'INSERT INTO transportadoras (empresa_id, codigo_erp, razao_social, nome_fantasia, cnpj, ativo, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
            [getEmpresaId(req), codigo_erp || null, razao_social, nome_fantasia || null, cnpj || null, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/transportadoras/:id', async (req, res) => {
    try {
        const { razao_social, nome_fantasia, cnpj, ativo, codigo_erp } = req.body;
        const r = await query(
            'UPDATE transportadoras SET codigo_erp=$1, razao_social=$2, nome_fantasia=$3, cnpj=$4, ativo=$5 WHERE id=$6 AND empresa_id=$7 RETURNING *',
            [codigo_erp || null, razao_social, nome_fantasia || null, cnpj || null, ativo !== false, req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Transportadora não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/transportadoras/:id', async (req, res) => {
    try {
        await query('DELETE FROM transportadoras WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
        if (search) { sql += ' AND descricao ILIKE $1'; params.push(`%${search}%`); }
        sql += ' ORDER BY descricao';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/depositos/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM depositos WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Depósito não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/depositos', async (req, res) => {
    try {
        const { descricao, endereco, padrao, ativo, codigo_erp } = req.body;
        const r = await query(
            'INSERT INTO depositos (empresa_id, codigo_erp, descricao, endereco, padrao, ativo, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
            [getEmpresaId(req), codigo_erp || null, descricao, endereco || null, padrao === true, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/depositos/:id', async (req, res) => {
    try {
        const { descricao, endereco, padrao, ativo, codigo_erp } = req.body;
        const r = await query(
            'UPDATE depositos SET codigo_erp=$1, descricao=$2, endereco=$3, padrao=$4, ativo=$5 WHERE id=$6 AND empresa_id=$7 RETURNING *',
            [codigo_erp || null, descricao, endereco || null, padrao === true, ativo !== false, req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Depósito não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/depositos/:id', async (req, res) => {
    try {
        await query('DELETE FROM depositos WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
        if (search) { sql += ' AND descricao ILIKE $1'; params.push(`%${search}%`); }
        sql += ' ORDER BY descricao';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/tabelas-preco/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM tabelas_preco WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Tabela não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/tabelas-preco', async (req, res) => {
    try {
        const { descricao, markup, padrao, ativo, codigo_erp } = req.body;
        const r = await query(
            'INSERT INTO tabelas_preco (empresa_id, codigo_erp, descricao, markup, padrao, ativo, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
            [getEmpresaId(req), codigo_erp || null, descricao, markup || null, padrao === true, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/tabelas-preco/:id', async (req, res) => {
    try {
        const { descricao, markup, padrao, ativo, codigo_erp } = req.body;
        const r = await query(
            'UPDATE tabelas_preco SET codigo_erp=$1, descricao=$2, markup=$3, padrao=$4, ativo=$5 WHERE id=$6 AND empresa_id=$7 RETURNING *',
            [codigo_erp || null, descricao, markup || null, padrao === true, ativo !== false, req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Tabela não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/tabelas-preco/:id', async (req, res) => {
    try {
        await query('DELETE FROM tabelas_preco WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
        if (search) { sql += ' AND descricao ILIKE $1'; params.push(`%${search}%`); }
        sql += ' ORDER BY descricao';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/formas-pagamento/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM formas_pagamento WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Forma não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/formas-pagamento', async (req, res) => {
    try {
        const { descricao, tipo, parcelas_max, taxa_operacao, usa_gateway, ativo, codigo_erp } = req.body;
        const r = await query(
            'INSERT INTO formas_pagamento (empresa_id, codigo_erp, descricao, tipo, parcelas_max, taxa_operacao, usa_gateway, ativo, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *',
            [getEmpresaId(req), codigo_erp || null, descricao, tipo || null, parcelas_max || 1, taxa_operacao || 0, usa_gateway === true, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/formas-pagamento/:id', async (req, res) => {
    try {
        const { descricao, tipo, parcelas_max, taxa_operacao, usa_gateway, ativo, codigo_erp } = req.body;
        const r = await query(
            'UPDATE formas_pagamento SET codigo_erp=$1, descricao=$2, tipo=$3, parcelas_max=$4, taxa_operacao=$5, usa_gateway=$6, ativo=$7 WHERE id=$8 AND empresa_id=$9 RETURNING *',
            [codigo_erp || null, descricao, tipo || null, parcelas_max || 1, taxa_operacao || 0, usa_gateway === true, ativo !== false, req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Forma não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/formas-pagamento/:id', async (req, res) => {
    try {
        await query('DELETE FROM formas_pagamento WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
        if (search) { sql += ' AND descricao ILIKE $1'; params.push(`%${search}%`); }
        sql += ' ORDER BY descricao';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/condicoes-pagamento/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM condicoes_pagamento WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Condição não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/condicoes-pagamento', async (req, res) => {
    try {
        const { descricao, parcelas, dias_parcelas, tipo, ativo, codigo_erp } = req.body;
        const r = await query(
            'INSERT INTO condicoes_pagamento (empresa_id, codigo_erp, descricao, parcelas, dias_parcelas, tipo, ativo, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
            [getEmpresaId(req), codigo_erp || null, descricao, parcelas || 1, dias_parcelas || [0], tipo || 'a_vista', ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/condicoes-pagamento/:id', async (req, res) => {
    try {
        const { descricao, parcelas, dias_parcelas, tipo, ativo, codigo_erp } = req.body;
        const r = await query(
            'UPDATE condicoes_pagamento SET codigo_erp=$1, descricao=$2, parcelas=$3, dias_parcelas=$4, tipo=$5, ativo=$6 WHERE id=$7 AND empresa_id=$8 RETURNING *',
            [codigo_erp || null, descricao, parcelas || 1, dias_parcelas || [0], tipo || 'a_vista', ativo !== false, req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Condição não encontrada' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/condicoes-pagamento/:id', async (req, res) => {
    try {
        await query('DELETE FROM condicoes_pagamento WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
            sql = 'SELECT s.*, e.nome_fantasia as empresa_nome FROM status_pedido_cfg s LEFT JOIN empresas e ON e.id = s.empresa_id ORDER BY s.ordem';
        } else {
            sql = 'SELECT * FROM status_pedido_cfg WHERE empresa_id = $1 ORDER BY ordem';
            params.push(getEmpresaId(req));
        }
        const r = await query(sql, params);
        res.json(r.rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/status-pedido/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM status_pedido_cfg WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Status não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/status-pedido', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { codigo, descricao, cor, icone, finaliza, cancela, envia_rp, ordem, ativo } = req.body;
        const r = await query(
            `INSERT INTO status_pedido_cfg (empresa_id, codigo, descricao, cor, icone, finaliza, cancela, envia_rp, ordem, ativo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [empresaId, codigo, descricao, cor || '#666666', icone || null, finaliza === true, cancela === true, envia_rp === true, ordem || 0, ativo !== false]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/status-pedido/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { codigo, descricao, cor, icone, finaliza, cancela, envia_rp, ordem, ativo } = req.body;
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
        await query('DELETE FROM status_pedido_cfg WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
        // Usar pool.query diretamente aqui para ignorar o automático de empresa_id
        const r = await pool.query(`
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
        if (search) { sql += ' AND (nome ILIKE $1 OR email ILIKE $1)'; params.push(`%${search}%`); }
        sql += ' ORDER BY nome';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/usuarios-admin/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM empresa_usuarios WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/usuarios-admin', async (req, res) => {
    try {
        const { empresa_id, nome, email, senha_hash, perfil, ativo } = req.body;
        // Se for administrador e não passar empresa_id, usa 1
        const eid = isSuporte(req) ? (empresa_id || 1) : getEmpresaId(req);

        const r = await query(
            'INSERT INTO empresa_usuarios (empresa_id, nome, email, senha_hash, perfil, ativo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *',
            [eid, nome, email, senha_hash || null, perfil || 'operador', (ativo === true || ativo === 'true' || ativo === 1)]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/usuarios-admin/:id', async (req, res) => {
    try {
        const { empresa_id, nome, email, senha_hash, perfil, ativo } = req.body;
        const eid = isSuporte(req) ? (empresa_id || 1) : getEmpresaId(req);

        const r = await query(
            'UPDATE empresa_usuarios SET nome=$1, email=$2, senha_hash=$3, perfil=$4, ativo=$5, updated_at=NOW() WHERE id=$6 AND empresa_id=$7 RETURNING *',
            [nome, email, senha_hash || null, perfil || 'operador', (ativo === true || ativo === 'true' || ativo === 1), req.params.id, eid]);
        if (!r.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/usuarios-admin/:id', async (req, res) => {
    try {
        if (isSuporte(req)) {
            await query('DELETE FROM empresa_usuarios WHERE id = $1', [req.params.id]);
        } else {
            await query('DELETE FROM empresa_usuarios WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        }
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
        if (search) { sql += ' AND (nome ILIKE $1 OR email ILIKE $1)'; params.push(`%${search}%`); }
        sql += ' ORDER BY nome';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/vendedores/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM usuarios WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Vendedor não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/vendedores', async (req, res) => {
    try {
        const { nome, email, senha_hash, perfil, comissao_pct, ativo, codigo_erp } = req.body;
        const r = await query(
            'INSERT INTO usuarios (empresa_id, codigo_erp, nome, email, senha_hash, perfil, comissao_pct, ativo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *',
            [getEmpresaId(req), codigo_erp || null, nome, email, senha_hash || null, perfil || 'vendedor', comissao_pct || 0, ativo === true || ativo === 'true']);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/vendedores/:id', async (req, res) => {
    try {
        const { nome, email, senha_hash, perfil, comissao_pct, ativo, codigo_erp } = req.body;
        const r = await query(
            'UPDATE usuarios SET codigo_erp=$1, nome=$2, email=$3, senha_hash=$4, perfil=$5, comissao_pct=$6, ativo=$7, updated_at=NOW() WHERE id=$8 AND empresa_id=$9 RETURNING *',
            [codigo_erp || null, nome, email, senha_hash || null, perfil || 'vendedor', comissao_pct || 0, ativo === true || ativo === 'true', req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Vendedor não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/vendedores/:id', async (req, res) => {
    try {
        await query('DELETE FROM usuarios WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
        if (search) { sql += ' AND (nome ILIKE $1 OR email ILIKE $1 OR cpf_cnpj ILIKE $1 OR codigo_erp ILIKE $1)'; params.push(`%${search}%`); }
        sql += ' ORDER BY nome';
        res.json((await query(sql, params)).rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/clientes/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/clientes', async (req, res) => {
    try {
        const { tipo_pessoa, nome, nome_fantasia, cpf_cnpj, rg_ie, email, telefone, celular, codigo_erp, ativo } = req.body;
        const r = await query(
            `INSERT INTO clientes (empresa_id, tipo_pessoa, nome, nome_fantasia, cpf_cnpj, rg_ie, email, telefone, celular, codigo_erp, ativo, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
            [getEmpresaId(req), tipo_pessoa || 'F', nome, nome_fantasia || null, cpf_cnpj || null, rg_ie || null, email, telefone || null, celular || null, codigo_erp || null, ativo === true || ativo === 'true']);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/clientes/:id', async (req, res) => {
    try {
        const { tipo_pessoa, nome, nome_fantasia, cpf_cnpj, rg_ie, email, telefone, celular, codigo_erp, ativo } = req.body;
        const r = await query(
            `UPDATE clientes SET tipo_pessoa=$1, nome=$2, nome_fantasia=$3, cpf_cnpj=$4, rg_ie=$5, email=$6, telefone=$7, celular=$8, codigo_erp=$9, ativo=$10, updated_at=NOW()
             WHERE id=$11 AND empresa_id=$12 RETURNING *`,
            [tipo_pessoa || 'F', nome, nome_fantasia || null, cpf_cnpj || null, rg_ie || null, email, telefone || null, celular || null, codigo_erp || null, ativo === true || ativo === 'true', req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/clientes/:id', async (req, res) => {
    try {
        await query('DELETE FROM clientes WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
            sql = 'SELECT b.*, e.nome_fantasia as empresa_nome FROM banners b LEFT JOIN empresas e ON e.id = b.empresa_id ORDER BY b.ordem';
        } else {
            sql = 'SELECT * FROM banners WHERE empresa_id = $1 ORDER BY ordem';
            params.push(getEmpresaId(req));
        }
        const r = await query(sql, params);
        res.json(r.rows);
    } catch (err) { sendError(res, err); }
});
app.get('/api/banners/:id', async (req, res) => {
    try {
        const r = await query('SELECT * FROM banners WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Banner não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/banners', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { imagem, imagem_mobile, titulo, subtitulo, link, ordem, ativo, data_inicio, data_fim } = req.body;
        const r = await query(
            `INSERT INTO banners (empresa_id, imagem, imagem_mobile, titulo, subtitulo, link, ordem, ativo, data_inicio, data_fim, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
            [empresaId, imagem, imagem_mobile || null, titulo, subtitulo || null, link || null, ordem || 0, ativo !== false, data_inicio || null, data_fim || null]);
        res.status(201).json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.put('/api/banners/:id', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { imagem, imagem_mobile, titulo, subtitulo, link, ordem, ativo, data_inicio, data_fim } = req.body;
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
        await query('DELETE FROM banners WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
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
        let idx = 1;
        if (isSuporte(req)) {
            sql = `
                SELECT p.*, c.nome as cliente_nome, c.email as cliente_email, fp.descricao as forma_pagamento_desc, e.nome_fantasia as empresa_nome
                FROM pedidos p
                LEFT JOIN clientes c ON c.id = p.cliente_id
                LEFT JOIN formas_pagamento fp ON fp.id = p.forma_pagamento_id
                LEFT JOIN empresas e ON e.id = p.empresa_id
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
            idx++;
        }
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
        const r = await query('SELECT * FROM pedidos WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Pedido não encontrado' });
        const pedido = r.rows[0];
        const itens = await query('SELECT * FROM itens_pedido WHERE pedido_id = $1 AND empresa_id = $2 ORDER BY sequencia', [req.params.id, getEmpresaId(req)]);
        res.json({ ...pedido, itens: itens.rows });
    } catch (err) { sendError(res, err); }
});
app.put('/api/pedidos/:id/status', async (req, res) => {
    try {
        const { status, obs_interna } = req.body;
        const r = await query(
            'UPDATE pedidos SET status=$1, obs_interna=$2, updated_at=NOW() WHERE id=$3 AND empresa_id=$4 RETURNING *',
            [status, obs_interna || null, req.params.id, getEmpresaId(req)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Pedido não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { sendError(res, err); }
});
app.post('/api/pedidos', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { cliente_id, forma_pagamento_id, obs, itens } = req.body;
        if (!itens || !Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({ error: 'Carrinho vazio' });
        }
        let clienteId = cliente_id;
        let enderecoId = null;
        if (!clienteId) {
            const rCliente = await query('SELECT id FROM clientes WHERE empresa_id = $1 LIMIT 1', [empresaId]);
            if (rCliente.rows.length) {
                clienteId = rCliente.rows[0].id;
            } else {
                const rNovo = await query(
                    `INSERT INTO clientes (empresa_id, tipo_pessoa, nome, email, ativo, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
                    [empresaId, 'F', 'Cliente Final', 'cliente@local.com', 1]
                );
                clienteId = rNovo.rows[0].id;
            }
        }
        // Buscar endereco padrao do cliente ou criar um
        const rEnd = await query('SELECT id FROM enderecos WHERE cliente_id = $1 AND empresa_id = $2 ORDER BY padrao DESC LIMIT 1', [clienteId, empresaId]);
        if (rEnd.rows.length) {
            enderecoId = rEnd.rows[0].id;
        } else {
            const rNovoEnd = await query(
                `INSERT INTO enderecos (empresa_id, cliente_id, apelido, cep, logradouro, numero, bairro, cidade, estado, padrao, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW()) RETURNING *`,
                [empresaId, clienteId, 'Principal', '00000-000', 'Não informado', '0', 'Não informado', 'Não informado', 'SP']
            );
            enderecoId = rNovoEnd.rows[0].id;
        }
        const numero = 'WEB-' + Math.floor(Date.now() / 1000);
        const subtotal = itens.reduce((s, item) => s + (item.quantidade * item.preco_unitario), 0);
        const total = subtotal;
        const rPedido = await query(
            `INSERT INTO pedidos (empresa_id, numero, cliente_id, endereco_id, forma_pagamento_id, status, obs_cliente, subtotal_produtos, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
            [empresaId, numero, clienteId, enderecoId, forma_pagamento_id || null, 'pendente', obs || null, subtotal]
        );
        const pedido = rPedido.rows[0];
        for (let i = 0; i < itens.length; i++) {
            const item = itens[i];
            // Buscar dados do produto para preencher codigo e unidade
            let produtoCodigo = '';
            let produtoUnidade = 'UN';
            if (item.produto_id) {
                const rProd = await query('SELECT codigo_interno, unidade_id FROM produtos WHERE id = $1 AND empresa_id = $2', [item.produto_id, empresaId]);
                if (rProd.rows.length) {
                    produtoCodigo = rProd.rows[0].codigo_interno || '';
                    if (rProd.rows[0].unidade_id) {
                        const rUnid = await query('SELECT codigo FROM unidades_medida WHERE id = $1', [rProd.rows[0].unidade_id]);
                        if (rUnid.rows.length) produtoUnidade = rUnid.rows[0].codigo || 'UN';
                    }
                }
            }
            const itemSubtotal = (item.quantidade || 0) * (item.preco_unitario || 0);
            await query(
                `INSERT INTO itens_pedido (empresa_id, pedido_id, sequencia, produto_id, produto_codigo, produto_nome, produto_unidade, quantidade, preco_venda, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
                [empresaId, pedido.id, i + 1, item.produto_id || null, produtoCodigo, item.nome, produtoUnidade, item.quantidade, item.preco_unitario]
            );
        }
        res.status(201).json(pedido);
    } catch (err) { sendError(res, err); }
});
app.delete('/api/pedidos/:id', async (req, res) => {
    try {
        await query('DELETE FROM itens_pedido WHERE pedido_id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        await query('DELETE FROM pedidos WHERE id = $1 AND empresa_id = $2', [req.params.id, getEmpresaId(req)]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

// ============================================================
// ESTATÍSTICAS
// ============================================================
app.get('/api/estatisticas', async (req, res) => {
    try {
        const eid = getEmpresaId(req);
        const isSup = isSuporte(req);

        const cat = await query(`SELECT COUNT(*) as total FROM categorias ${isSup ? '' : 'WHERE empresa_id = $1'}`, isSup ? [] : [eid]);
        const catAtivas = await query(`SELECT COUNT(*) as total FROM categorias ${isSup ? 'WHERE' : 'WHERE empresa_id = $1 AND'} ativo = true`, isSup ? [] : [eid]);
        const prod = await query(`SELECT COUNT(*) as total FROM produtos ${isSup ? '' : 'WHERE empresa_id = $1'}`, isSup ? [] : [eid]);
        const prodAtivos = await query(`SELECT COUNT(*) as total FROM produtos ${isSup ? 'WHERE' : 'WHERE empresa_id = $1 AND'} ativo = true`, isSup ? [] : [eid]);
        const prodDestaque = await query(`SELECT COUNT(*) as total FROM produtos ${isSup ? 'WHERE' : 'WHERE empresa_id = $1 AND'} destaque = true`, isSup ? [] : [eid]);
        const prodSemEstoque = await query(`
            SELECT COUNT(*) as total FROM produtos p
            ${isSup ? 'WHERE' : 'WHERE p.empresa_id = $1 AND'} p.controla_estoque = true
            AND NOT EXISTS (SELECT 1 FROM produto_estoque e WHERE e.produto_id = p.id AND e.saldo_fisico > 0)`, isSup ? [] : [eid]);
        const clientes = await query(`SELECT COUNT(*) as total FROM clientes ${isSup ? '' : 'WHERE empresa_id = $1'}`, isSup ? [] : [eid]);
        const pedidos = await query(`SELECT COUNT(*) as total FROM pedidos ${isSup ? '' : 'WHERE empresa_id = $1'}`, isSup ? [] : [eid]);
        const pedidosPendentes = await query(`SELECT COUNT(*) as total FROM pedidos ${isSup ? 'WHERE' : 'WHERE empresa_id = $1 AND'} status = 'pendente'`, isSup ? [] : [eid]);

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
// EMPRESAS
// ============================================================
app.get('/api/empresas', async (req, res) => {
    try {
        if (!isSuporte(req)) return res.status(403).json({ error: 'Acesso negado' });
        const result = await query(`SELECT id, razao_social, nome_fantasia, cnpj, email, telefone, cidade, estado, status, created_at FROM empresas ORDER BY id DESC`);
        res.json(result.rows);
    } catch (err) { sendError(res, err); }
});

app.get('/api/empresas/:id', async (req, res) => {
    try {
        if (!isSuporte(req)) return res.status(403).json({ error: 'Acesso negado' });
        const result = await query(`SELECT * FROM empresas WHERE id = $1`, [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Empresa não encontrada' });
        res.json(result.rows[0]);
    } catch (err) { sendError(res, err); }
});

function gerarSlug(texto) {
    if (!texto) return '';
    return texto.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
}

app.post('/api/empresas', async (req, res) => {
    try {
        if (!isSuporte(req)) return res.status(403).json({ error: 'Acesso negado' });
        const d = req.body;
        const slug = gerarSlug(d.nome_fantasia || d.razao_social);
        const result = await query(`
            INSERT INTO empresas (razao_social, nome_fantasia, slug, cnpj, ie, im, email, telefone, whatsapp, cep, logradouro, numero, complemento, bairro, cidade, estado, logo_url, cor_primaria, cor_secundaria, responsavel_nome, responsavel_email, responsavel_cpf, responsavel_telefone, status, trial, uuid)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, gen_random_uuid()) RETURNING id
        `, [
            d.razao_social, d.nome_fantasia, slug, d.cnpj, d.ie, d.im, d.email, d.telefone, d.whatsapp,
            d.cep, d.logradouro, d.numero, d.complemento, d.bairro, d.cidade, d.estado,
            d.logo_url, d.cor_primaria, d.cor_secundaria,
            d.responsavel_nome, d.responsavel_email, d.responsavel_cpf, d.responsavel_telefone,
            d.status || 'ativo', d.trial || false
        ]);
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) { sendError(res, err); }
});

app.put('/api/empresas/:id', async (req, res) => {
    try {
        if (!isSuporte(req)) return res.status(403).json({ error: 'Acesso negado' });
        const d = req.body;
        const slug = gerarSlug(d.nome_fantasia || d.razao_social);
        await query(`
            UPDATE empresas SET
                razao_social = $1, nome_fantasia = $2, slug = $3, cnpj = $4, ie = $5,
                im = $6, email = $7, telefone = $8, whatsapp = $9, cep = $10, logradouro = $11,
                numero = $12, complemento = $13, bairro = $14, cidade = $15, estado = $16,
                logo_url = $17, cor_primaria = $18, cor_secundaria = $19,
                responsavel_nome = $20, responsavel_email = $21, responsavel_cpf = $22, responsavel_telefone = $23,
                status = $24, trial = $25, updated_at = NOW()
            WHERE id = $26
        `, [
            d.razao_social, d.nome_fantasia, slug, d.cnpj, d.ie, d.im, d.email, d.telefone, d.whatsapp,
            d.cep, d.logradouro, d.numero, d.complemento, d.bairro, d.cidade, d.estado,
            d.logo_url, d.cor_primaria, d.cor_secundaria,
            d.responsavel_nome, d.responsavel_email, d.responsavel_cpf, d.responsavel_telefone,
            d.status || 'ativo', d.trial || false, req.params.id
        ]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});

app.delete('/api/empresas/:id', async (req, res) => {
    try {
        if (!isSuporte(req)) return res.status(403).json({ error: 'Acesso negado' });
        await query('DELETE FROM empresas WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { sendError(res, err); }
});



// ============================================================
// CONSULTA CEP (proxy ViaCEP)
// ============================================================
app.get('/api/cep/:cep', async (req, res) => {
    try {
        const cep = req.params.cep.replace(/\D/g, '');
        if (cep.length !== 8) {
            return res.status(400).json({ error: 'CEP inválido' });
        }
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao consultar CEP' });
    }
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Painel admin: http://localhost:${PORT}/admin.html`);
    console.log(`Loja: http://localhost:${PORT}/index.html`);
});
