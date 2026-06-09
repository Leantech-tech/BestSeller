/**
 * admin-produtos.js - CRUD de Produtos
 */
const API_BASE = '';
let produtosData = [];
let paginaAtual = 1;
const porPagina = 10;
let produtoExcluirId = null;
const isSuporte = localStorage.getItem('araca_admin_usuario') === 'suporte';
let imagensProduto = []; // array de URLs das imagens

function $(id) { return document.getElementById(id); }

// Menu mobile
$('menuToggle')?.addEventListener('click', () => {
    $('sidebar').classList.toggle('open');
});

// Toast
function toast(message, type = 'success') {
    const container = $('toastContainer');
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-exclamation-circle';
    div.innerHTML = `<i class="fas ${icon}"></i><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

// Formatar moeda
function formatarMoeda(valor) {
    return parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Gerar imagem automaticamente em alta qualidade
function gerarImagemProduto(nome, categoriaId) {
    if (!nome) return '';
    const seed = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').substring(0, 20);
    return `https://picsum.photos/seed/${seed}/800/800`;
}

function getAuthHeaders() {
    const h = {};
    const isSuporte = localStorage.getItem('araca_admin_usuario') === 'suporte';
    if (isSuporte) {
        h['x-admin-perfil'] = 'suporte';
    } else {
        let empresaId = '1';
        try {
            const empresaRaw = localStorage.getItem('araca_empresa_logada');
            if (empresaRaw) {
                const empresa = JSON.parse(empresaRaw);
                if (empresa && empresa.id) empresaId = String(empresa.id);
            }
        } catch (e) {
            console.warn('[getAuthHeaders] Erro ao ler empresa do localStorage:', e.message);
        }
        h['x-empresa-id'] = empresaId;
    }
    return h;
}

// Carregar categorias no select
async function carregarCategoriasSelect() {
    try {
        const res = await fetch(`${API_BASE}/api/categorias`, { headers: getAuthHeaders() });
        const cats = await res.json();
        const selectProd = $('prodCategoriaId');
        const selectFiltro = $('filtroCategoria');
        const opts = cats.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
        selectProd.innerHTML = '<option value="">-- Selecione --</option>' + opts;
        const filtroAtual = selectFiltro.value;
        selectFiltro.innerHTML = '<option value="">Todas as categorias</option>' + opts;
        selectFiltro.value = filtroAtual;
    } catch (e) {}
}

// Carregar unidades de medida no select
async function carregarUnidadesSelect() {
    try {
        const res = await fetch(`${API_BASE}/api/unidades-medida`, { headers: getAuthHeaders() });
        const unidades = await res.json();
        const select = $('prodUnidadeId');
        const valAtual = select.value;
        const opts = unidades.map(u => `<option value="${u.id}">${u.codigo} - ${u.descricao}</option>`).join('');
        select.innerHTML = '<option value="">-- Selecione --</option>' + opts;
        select.value = valAtual;
    } catch (e) {}
}

// Upload múltiplo de imagens
$('prodImagemFile').addEventListener('change', async () => {
    const files = Array.from($('prodImagemFile').files);
    if (files.length === 0) return;
    for (const file of files) {
        try {
            const fd = new FormData();
            fd.append('imagem', file);
            const upRes = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: fd });
            const upJson = await upRes.json();
            if (upRes.ok && upJson.url) {
                imagensProduto.push(upJson.url);
            }
        } catch (e) {
            console.warn('Erro upload imagem:', e);
        }
    }
    $('prodImagemFile').value = '';
    renderizarGaleriaImagens();
});

function renderizarGaleriaImagens() {
    const container = $('prodImagensGaleria');
    if (!container) return;
    container.innerHTML = imagensProduto.map((url, idx) => `
        <div style="position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:2px solid ${idx===0?'#22c55e':'var(--cor-borda)'};">
            <img src="${url}" style="width:100%;height:100%;object-fit:cover;">
            ${idx===0?'<span style="position:absolute;top:2px;left:2px;background:#22c55e;color:#fff;font-size:10px;padding:1px 4px;border-radius:4px;">Principal</span>':''}
            <button type="button" onclick="removerImagemProduto(${idx})" style="position:absolute;top:2px;right:2px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&times;</button>
        </div>
    `).join('');
    $('prodImagens').value = JSON.stringify(imagensProduto);
}

window.removerImagemProduto = function(idx) {
    imagensProduto.splice(idx, 1);
    renderizarGaleriaImagens();
};

// Auto-gerar imagem ao sair do campo nome (somente se não houver imagens)
$('prodNome').addEventListener('blur', () => {
    if (imagensProduto.length === 0 && $('prodNome').value) {
        const url = gerarImagemProduto($('prodNome').value, $('prodCategoriaId').value);
        imagensProduto.push(url);
        renderizarGaleriaImagens();
    }
});

// Carregar produtos
async function carregarProdutos() {
    try {
        const search = $('searchProduto').value;
        const cat = $('filtroCategoria').value;
        let qs = '';
        if (search) qs += `search=${encodeURIComponent(search)}&`;
        if (cat) qs += `categoria_id=${encodeURIComponent(cat)}&`;
        const res = await fetch(`${API_BASE}/api/produtos?${qs}`);
        if (!res.ok) throw new Error('Erro ao carregar');
        produtosData = await res.json();
        paginaAtual = 1;
        renderizarTabela();
    } catch (err) {
        toast(err.message, 'error');
    }
}

// Renderizar tabela
function renderizarTabela() {
    const tbody = $('tabelaProdutos').querySelector('tbody');
    const thead = $('tabelaProdutos').querySelector('thead tr');
    const total = produtosData.length;
    const inicio = (paginaAtual - 1) * porPagina;
    const fim = inicio + porPagina;
    const paginaItems = produtosData.slice(inicio, fim);

    // Ajustar header para suporte
    if (isSuporte && !thead.querySelector('.th-empresa')) {
        const th = document.createElement('th');
        th.className = 'th-empresa';
        th.textContent = 'Empresa';
        thead.insertBefore(th, thead.children[thead.children.length - 1]);
    }
    const colCount = isSuporte ? 9 : 8;

    tbody.innerHTML = paginaItems.length === 0
        ? `<tr><td colspan="${colCount}" class="empty-state"><i class="fas fa-inbox"></i><h3>Nenhum produto encontrado</h3></td></tr>`
        : paginaItems.map(p => `
            <tr>
                <td>${p.id}</td>
                <td><code>${p.codigo_interno}</code></td>
                <td><strong>${p.nome}</strong></td>
                <td>${p.categoria_nome || '-'}</td>
                <td>${formatarMoeda(p.preco)}</td>
                <td>${parseFloat(p.estoque || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
                <td>${p.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-danger">Inativo</span>'}</td>
                ${isSuporte ? `<td>${p.empresa_nome || '-'}</td>` : ''}
                <td>
                    <div class="admin-table-actions">
                        <button class="btn btn-warning btn-sm btn-icon" onclick="editarProduto(${p.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm btn-icon" onclick="confirmarExclusao(${p.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

    $('infoPaginacaoProd').textContent = `Mostrando ${inicio + 1}-${Math.min(fim, total)} de ${total}`;
    renderizarPaginacao();
}

function renderizarPaginacao() {
    const totalPaginas = Math.ceil(produtosData.length / porPagina) || 1;
    const container = $('botoesPaginacaoProd');
    let html = '';
    html += `<button onclick="mudarPagina(${paginaAtual - 1})" ${paginaAtual === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPaginas; i++) {
        html += `<button class="${i === paginaAtual ? 'active' : ''}" onclick="mudarPagina(${i})">${i}</button>`;
    }
    html += `<button onclick="mudarPagina(${paginaAtual + 1})" ${paginaAtual === totalPaginas ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
}

window.mudarPagina = function(p) {
    const total = Math.ceil(produtosData.length / porPagina) || 1;
    if (p < 1 || p > total) return;
    paginaAtual = p;
    renderizarTabela();
};

// Abrir modal novo
$('btnNovoProduto').addEventListener('click', async () => {
    $('formProduto').reset();
    $('prodId').value = '';
    $('prodAtivo').checked = true;
    imagensProduto = [];
    renderizarGaleriaImagens();
    $('modalProdutoTitulo').innerHTML = '<i class="fas fa-box"></i> Novo Produto';
    await carregarCategoriasSelect();
    await carregarUnidadesSelect();
    Mascaras.aplicarTudo();
    abrirModal('modalProduto');
});

// Fechar modal
$('modalProdutoClose').addEventListener('click', () => fecharModal('modalProduto'));
$('btnCancelarProduto').addEventListener('click', () => fecharModal('modalProduto'));

// Salvar
$('btnSalvarProduto').addEventListener('click', async () => {
    const codigo_interno = $('prodCodigoInterno').value.trim();
    const nome = $('prodNome').value.trim();
    const categoria_id = $('prodCategoriaId').value;
    const preco = parseFloat(Mascaras.desformatarMoeda($('prodPreco').value)) || 0;
    if (!codigo_interno || !nome || !categoria_id) {
        toast('Preencha os campos obrigatórios', 'error');
        return;
    }

    const dados = {
        id: $('prodId').value || undefined,
        codigo_interno,
        nome,
        nome_reduzido: $('prodNomeReduzido').value || null,
        descricao: $('prodDescricao').value || null,
        descricao_curta: $('prodDescricaoCurta').value || null,
        descricao_tecnica: $('prodDescricaoTecnica').value || null,
        categoria_id: parseInt(categoria_id),
        unidade_id: $('prodUnidadeId').value || null,
        peso_bruto: parseFloat($('prodPesoBruto').value) || 0,
        altura: parseFloat($('prodAltura').value) || 0,
        largura: parseFloat($('prodLargura').value) || 0,
        comprimento: parseFloat($('prodComprimento').value) || 0,
        ncm: $('prodNcm').value || null,
        preco,
        preco_antigo: parseFloat(Mascaras.desformatarMoeda($('prodPrecoAntigo').value)) || null,
        estoque: parseInt($('prodEstoque').value) || 0,
        imagem: imagensProduto.length > 0 ? imagensProduto[0] : null,
        imagens: imagensProduto,
        garantia: parseInt($('prodGarantia').value) || null,
        destaque: $('prodDestaque').checked,
        lancamento: $('prodLancamento').checked,
        mais_vendido: $('prodMaisVendido').checked,
        ativo: $('prodAtivo').checked
    };
    try {
        const url = `${API_BASE}/api/produtos${dados.id ? '/' + dados.id : ''}`;
        const res = await fetch(url, {
            method: dados.id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao salvar');
        toast(dados.id ? 'Produto atualizado!' : 'Produto criado!');
        fecharModal('modalProduto');
        carregarProdutos();
    } catch (err) {
        toast(err.message, 'error');
    }
});

// Editar
window.editarProduto = async function(id) {
    try {
        const res = await fetch(`${API_BASE}/api/produtos/${id}`);
        if (!res.ok) throw new Error('Erro ao carregar');
        const p = await res.json();
        $('prodId').value = p.id;
        $('prodCodigoInterno').value = p.codigo_interno;
        $('prodCodigoErp').value = p.codigo_erp || '';
        $('prodCodigoBarras').value = p.codigo_barras || '';
        $('prodNome').value = p.nome;
        $('prodNomeReduzido').value = p.nome_reduzido || '';
        $('prodDescricao').value = p.descricao || '';
        $('prodDescricaoCurta').value = p.descricao_curta || '';
        $('prodDescricaoTecnica').value = p.descricao_tecnica || '';
        imagensProduto = (p.imagens || []).map(img => img.url || img.imagem || img).filter(Boolean);
        if (imagensProduto.length === 0 && p.imagem) imagensProduto = [p.imagem];
        renderizarGaleriaImagens();
        $('prodGarantia').value = p.garantia || 0;
        $('prodPesoBruto').value = p.peso_bruto || 0;
        $('prodAltura').value = p.altura || 0;
        $('prodLargura').value = p.largura || 0;
        $('prodComprimento').value = p.comprimento || 0;
        $('prodNcm').value = p.ncm || '';
        $('prodPreco').value = p.preco || 0;
        $('prodPrecoAntigo').value = p.preco_antigo || '';
        $('prodEstoque').value = parseFloat(p.estoque || 0);
        $('prodDestaque').checked = p.destaque;
        $('prodLancamento').checked = p.lancamento;
        $('prodMaisVendido').checked = p.mais_vendido;
        $('prodAtivo').checked = p.ativo;
        await carregarCategoriasSelect();
        await carregarUnidadesSelect();
        $('prodCategoriaId').value = p.categoria_id || '';
        $('prodUnidadeId').value = p.unidade_id || '';
        $('modalProdutoTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Produto';
        Mascaras.aplicarTudo();
        abrirModal('modalProduto');
    } catch (err) {
        toast(err.message, 'error');
    }
};

// Excluir
window.confirmarExclusao = function(id) {
    produtoExcluirId = id;
    abrirModal('modalConfirmar');
};
$('btnCancelarExclusao').addEventListener('click', () => fecharModal('modalConfirmar'));
$('btnConfirmarExclusao').addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_BASE}/api/produtos/${produtoExcluirId}`, { method: 'DELETE' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao excluir');
        toast('Produto excluído!');
        fecharModal('modalConfirmar');
        carregarProdutos();
    } catch (err) {
        toast(err.message, 'error');
    }
});

// Busca e filtro
$('searchProduto').addEventListener('input', () => { paginaAtual = 1; carregarProdutos(); });
$('filtroCategoria').addEventListener('change', () => { paginaAtual = 1; carregarProdutos(); });

// Modal helpers
function abrirModal(id) { $(id).classList.add('active'); }
function fecharModal(id) { $(id).classList.remove('active'); }

// Inicializar
carregarCategoriasSelect().then(() => carregarProdutos());
