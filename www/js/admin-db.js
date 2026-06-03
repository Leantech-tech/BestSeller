/**
 * admin-db.js
 * Simulação de banco de dados usando LocalStorage
 * Estrutura compatível com schema.sql (PostgreSQL)
 */

const DB_KEYS = {
    categorias: 'admin_categorias',
    produtos: 'admin_produtos',
    config: 'admin_config'
};

const EMPRESA_ID = 1; // Empresa demo fixa

// ============================================================
// UTILITÁRIOS
// ============================================================

function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

function slugify(text) {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function now() {
    return new Date().toISOString();
}

function getStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Erro ao ler localStorage:', e);
        return null;
    }
}

function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('Erro ao salvar localStorage:', e);
        return false;
    }
}

// ============================================================
// CATEGORIAS
// ============================================================

function getCategorias() {
    const data = getStorage(DB_KEYS.categorias);
    if (!data) {
        // Inicializa com dados do dados.js convertidos
        const inicial = window.categorias ? window.categorias.map((c, idx) => ({
            id: c.id === 'todos' ? 0 : (idx + 1),
            empresa_id: EMPRESA_ID,
            codigo_erp: null,
            slug: c.id,
            nome: c.nome,
            descricao: null,
            icone: c.icone || null,
            cor: '#1a6fc4',
            categoria_pai_id: null,
            ordem: idx,
            nivel: 0,
            caminho: `/${c.id}`,
            ativo: true,
            created_at: now(),
            updated_at: now()
        })) : [];
        setStorage(DB_KEYS.categorias, inicial);
        return inicial;
    }
    return data;
}

function getCategoriaById(id) {
    return getCategorias().find(c => c.id == id);
}

function saveCategoria(categoria) {
    const categorias = getCategorias();
    const idx = categorias.findIndex(c => c.id == categoria.id);
    const dados = {
        ...categoria,
        empresa_id: EMPRESA_ID,
        updated_at: now()
    };
    if (idx >= 0) {
        categorias[idx] = { ...categorias[idx], ...dados };
    } else {
        dados.id = generateId();
        dados.created_at = now();
        categorias.push(dados);
    }
    setStorage(DB_KEYS.categorias, categorias);
    return dados;
}

function deleteCategoria(id) {
    let categorias = getCategorias();
    // Não permite excluir se houver produtos vinculados
    const produtos = getProdutos();
    if (produtos.some(p => p.categoria_id == id)) {
        return { success: false, message: 'Não é possível excluir: existem produtos vinculados a esta categoria.' };
    }
    // Não permite excluir se houver subcategorias
    if (categorias.some(c => c.categoria_pai_id == id)) {
        return { success: false, message: 'Não é possível excluir: existem subcategorias vinculadas.' };
    }
    categorias = categorias.filter(c => c.id != id);
    setStorage(DB_KEYS.categorias, categorias);
    return { success: true };
}

function getCategoriasAtivas() {
    return getCategorias().filter(c => c.ativo !== false);
}

function getCategoriasOptions() {
    return getCategoriasAtivas().map(c => ({
        value: c.id,
        text: c.nome
    }));
}

// ============================================================
// PRODUTOS
// ============================================================

function getProdutos() {
    const data = getStorage(DB_KEYS.produtos);
    if (!data) {
        // Inicializa com dados do dados.js convertidos
        const inicial = window.produtos ? window.produtos.map(p => ({
            id: p.id,
            empresa_id: EMPRESA_ID,
            codigo_erp: null,
            codigo_interno: p.codigo || `PROD-${String(p.id).padStart(3,'0')}`,
            codigo_barras: null,
            nome: p.nome,
            nome_reduzido: null,
            descricao: p.descricao || null,
            descricao_curta: null,
            descricao_tecnica: null,
            categoria_id: (() => {
                const cat = getCategorias().find(c => c.slug === p.categoria);
                return cat ? cat.id : 0;
            })(),
            marca_id: null,
            fornecedor_id: null,
            unidade_id: null,
            peso_liquido: 0,
            peso_bruto: p.peso_bruto || 0,
            altura: p.altura || 0,
            largura: p.largura || 0,
            comprimento: p.comprimento || 0,
            cubagem: 0,
            ncm: p.ncm || null,
            cest: null,
            origem: '0',
            cfop_venda: '5102',
            cst_icms: '000',
            aliquota_icms: 0,
            aliquota_ipi: 0,
            aliquota_pis: 0,
            aliquota_cofins: 0,
            custo_reposicao: 0,
            custo_medio: 0,
            markup: 1.80,
            controla_estoque: true,
            controla_lote: false,
            permite_venda_sem_estoque: false,
            destaque: p.destaque || false,
            lancamento: false,
            mais_vendido: false,
            seo_title: null,
            seo_description: null,
            seo_keywords: null,
            url_amigavel: null,
            sync_erp_id: null,
            sync_erp_status: 'ok',
            sync_erp_ultima: null,
            ativo: true,
            preco: p.preco || 0,
            preco_antigo: p.precoAntigo || null,
            estoque: p.estoque || 0,
            imagem: p.imagem || null,
            parcelas: p.parcelas || 1,
            created_at: now(),
            updated_at: now()
        })) : [];
        setStorage(DB_KEYS.produtos, inicial);
        return inicial;
    }
    return data;
}

function getProdutoById(id) {
    return getProdutos().find(p => p.id == id);
}

function saveProduto(produto) {
    const produtos = getProdutos();
    const idx = produtos.findIndex(p => p.id == produto.id);
    const dados = {
        ...produto,
        empresa_id: EMPRESA_ID,
        updated_at: now()
    };
    if (idx >= 0) {
        produtos[idx] = { ...produtos[idx], ...dados };
    } else {
        dados.id = generateId();
        dados.created_at = now();
        produtos.push(dados);
    }
    setStorage(DB_KEYS.produtos, produtos);
    return dados;
}

function deleteProduto(id) {
    let produtos = getProdutos();
    produtos = produtos.filter(p => p.id != id);
    setStorage(DB_KEYS.produtos, produtos);
    return { success: true };
}

function getProdutosAtivos() {
    return getProdutos().filter(p => p.ativo !== false);
}

// ============================================================
// ESTATÍSTICAS
// ============================================================

function getEstatisticas() {
    const categorias = getCategorias();
    const produtos = getProdutos();
    return {
        totalCategorias: categorias.length,
        categoriasAtivas: categorias.filter(c => c.ativo).length,
        totalProdutos: produtos.length,
        produtosAtivos: produtos.filter(p => p.ativo).length,
        produtosDestaque: produtos.filter(p => p.destaque).length,
        produtosSemEstoque: produtos.filter(p => p.controla_estoque && (p.estoque || 0) <= 0).length
    };
}

// ============================================================
// RESET
// ============================================================

function resetDatabase() {
    localStorage.removeItem(DB_KEYS.categorias);
    localStorage.removeItem(DB_KEYS.produtos);
    getCategorias(); // reinicializa
    getProdutos();   // reinicializa
}

// ============================================================
// EXPORTS (global)
// ============================================================

window.AdminDB = {
    getCategorias,
    getCategoriaById,
    saveCategoria,
    deleteCategoria,
    getCategoriasAtivas,
    getCategoriasOptions,
    getProdutos,
    getProdutoById,
    saveProduto,
    deleteProduto,
    getProdutosAtivos,
    getEstatisticas,
    resetDatabase,
    slugify,
    generateId
};
