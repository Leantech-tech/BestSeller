/**
 * admin-categorias.js - CRUD de Categorias
 */
const API_BASE = '';
let categoriasData = [];
let paginaAtual = 1;
const porPagina = 10;
let categoriaExcluirId = null;

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

// Slugify
function slugify(text) {
    return text.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
        .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// ============================================================
// SELETOR DE ÍCONES
// ============================================================
const ICONES_DISPONIVEIS = [
    'fa-house','fa-home','fa-building','fa-store','fa-shop',
    'fa-bath','fa-shower','fa-toilet','fa-soap','fa-pump-soap',
    'fa-snowflake','fa-wind','fa-fan','fa-temperature-half','fa-fire',
    'fa-utensils','fa-bread-slice','fa-sink','fa-blender','fa-mug-hot',
    'fa-couch','fa-chair','fa-bed','fa-award','fa-flag',
    'fa-plug','fa-bolt','fa-lightbulb','fa-power-off','fa-network-wired',
    'fa-link','fa-chain','fa-screwdriver-wrench','fa-hammer','fa-wrench',
    'fa-tools','fa-toolbox','fa-screwdriver','fa-gavel','fa-ruler',
    'fa-paint-roller','fa-paintbrush','fa-spray-can','fa-fill-drip','fa-palette',
    'fa-layer-group','fa-cubes','fa-border-all','fa-table-cells','fa-th-large',
    'fa-door-open','fa-door-closed','fa-window-maximize','fa-archway','fa-align-justify',
    'fa-faucet','fa-droplet','fa-water','fa-ship','fa-wine-bottle',
    'fa-leaf','fa-seedling','fa-tree','fa-feather','fa-plant-wilt',
    'fa-industry','fa-hammer','fa-hard-hat','fa-user-tie','fa-ruler-combined',
    'fa-paw','fa-cat','fa-dog','fa-fish','fa-dove',
    'fa-car','fa-truck','fa-truck-fast','fa-truck-moving','fa-box',
    'fa-box-open','fa-boxes-stacked','fa-warehouse','fa-dolly','fa-cart-flatbed',
    'fa-tags','fa-tag','fa-barcode','fa-receipt','fa-file-invoice',
    'fa-users','fa-user','fa-user-group','fa-people-group','fa-person',
    'fa-image','fa-images','fa-photo-film','fa-camera','fa-video',
    'fa-gear','fa-gears','fa-sliders','fa-toggle-on','fa-toggle-off',
    'fa-chart-line','fa-chart-pie','fa-chart-bar','fa-chart-area','fa-chart-column',
    'fa-money-bill','fa-money-bill-wave','fa-credit-card','fa-wallet','fa-coins',
    'fa-calendar','fa-calendar-days','fa-clock','fa-hourglass','fa-stopwatch',
    'fa-bell','fa-bullhorn','fa-envelope','fa-paper-plane','fa-comment',
    'fa-heart','fa-star','fa-thumbs-up','fa-face-smile','fa-face-grin',
    'fa-circle-info','fa-circle-question','fa-circle-exclamation','fa-triangle-exclamation','fa-ban',
    'fa-check','fa-xmark','fa-plus','fa-minus','fa-trash',
    'fa-pen','fa-pen-to-square','fa-copy','fa-paste','fa-scissors',
    'fa-magnifying-glass','fa-filter','fa-sort','fa-ellipsis-h','fa-ellipsis-vertical',
    'fa-bars','fa-list','fa-table-list','fa-border-none','fa-grip-horizontal',
    'fa-cloud','fa-sun','fa-moon','fa-cloud-rain','fa-bolt',
    'fa-music','fa-volume-high','fa-microphone','fa-headphones','fa-radio',
    'fa-gamepad','fa-puzzle-piece','fa-chess','fa-dice','fa-trophy',
    'fa-medal','fa-crown','fa-gift','fa-cake-candles','fa-balloon',
    'fa-book','fa-book-open','fa-newspaper','fa-file-lines','fa-folder',
    'fa-lock','fa-unlock','fa-key','fa-shield-halved','fa-eye',
    'fa-motorcycle','fa-bicycle','fa-bus','fa-train','fa-plane',
    'fa-globe','fa-map','fa-location-dot','fa-road','fa-signs-post',
    'fa-mobile','fa-laptop','fa-desktop','fa-tablet','fa-print',
    'fa-wifi','fa-signal','fa-battery-full','fa-plug-circle-bolt','fa-solar-panel',
    'fa-shirt','fa-vest','fa-glasses','fa-mask','fa-socks',
    'fa-utensils','fa-burger','fa-pizza-slice','fa-ice-cream','fa-cookie',
    'fa-wine-glass','fa-beer-mug-empty','fa-martini-glass','fa-whiskey-glass','fa-champagne-glasses',
    'fa-apple-whole','fa-lemon','fa-carrot','fa-pepper-hot','fa-egg',
    'fa-dumbbell','fa-person-running','fa-person-swimming','fa-basketball','fa-futbol',
    'fa-spa','fa-mosque','fa-church','fa-torii-gate','fa-place-of-worship',
    'fa-graduation-cap','fa-school','fa-university','fa-chalkboard','fa-book-open-reader',
    'fa-hospital','fa-stethoscope','fa-pills','fa-syringe','fa-heart-pulse',
    'fa-baby','fa-baby-carriage','fa-person-pregnant','fa-hands-holding-child','fa-child',
    'fa-paw','fa-kiwi-bird','fa-horse','fa-cow','fa-piggy-bank',
    'fa-dragon','fa-ghost','fa-skull','fa-spider','fa-bacterium',
    'fa-flask','fa-atom','fa-microscope','fa-dna','fa-vial',
    'fa-rocket','fa-satellite','fa-user-astronaut','fa-shuttle-space','fa-meteor'
];

const isSuporte = localStorage.getItem('araca_admin_usuario') === 'suporte';
let iconeSelecionadoAtual = 'fas fa-tag';

function renderizarGridIcones(filtro = '') {
    const grid = $('gridIcones');
    const filtroLower = filtro.toLowerCase().trim();
    const icones = filtroLower
        ? ICONES_DISPONIVEIS.filter(i => i.toLowerCase().includes(filtroLower))
        : ICONES_DISPONIVEIS;

    grid.innerHTML = icones.map(icone => {
        const classe = 'fas ' + icone;
        const selecionado = classe === iconeSelecionadoAtual ? 'style="background:var(--cor-primaria);color:#fff;border-color:var(--cor-primaria);"' : '';
        return `<button type="button" class="btn-icon-item" onclick="selecionarIcone('${classe}')" title="${classe}" ${selecionado}>
            <i class="${classe}"></i>
        </button>`;
    }).join('');
}

window.abrirSeletorIcones = function() {
    iconeSelecionadoAtual = $('catIcone').value || 'fas fa-tag';
    $('buscaIcone').value = '';
    renderizarGridIcones();
    abrirModal('modalIcones');
};

window.filtrarIcones = function(texto) {
    renderizarGridIcones(texto);
};

window.selecionarIcone = function(classe) {
    iconeSelecionadoAtual = classe;
    $('catIcone').value = classe;
    $('previewIcone').className = classe;
    $('previewIconeNome').textContent = classe;
    fecharModal('modalIcones');
};

function atualizarPreviewIcone() {
    const classe = $('catIcone').value || 'fas fa-tag';
    $('previewIcone').className = classe;
    $('previewIconeNome').textContent = classe;
}

// Carregar categorias
async function carregarCategorias() {
    try {
        const search = $('searchCategoria').value;
        const res = await fetch(`${API_BASE}/api/categorias?${search ? 'search=' + encodeURIComponent(search) : ''}`);
        if (!res.ok) throw new Error('Erro ao carregar');
        categoriasData = await res.json();
        paginaAtual = 1;
        renderizarTabela();
    } catch (err) {
        toast(err.message, 'error');
    }
}

// Renderizar tabela
function renderizarTabela() {
    const tbody = $('tabelaCategorias').querySelector('tbody');
    const thead = $('tabelaCategorias').querySelector('thead tr');
    const total = categoriasData.length;
    const inicio = (paginaAtual - 1) * porPagina;
    const fim = inicio + porPagina;
    const paginaItems = categoriasData.slice(inicio, fim);

    // Ajustar header para suporte
    if (isSuporte && !thead.querySelector('.th-empresa')) {
        const th = document.createElement('th');
        th.className = 'th-empresa';
        th.textContent = 'Empresa';
        thead.insertBefore(th, thead.children[thead.children.length - 1]);
    }
    const colCount = isSuporte ? 9 : 8;

    tbody.innerHTML = paginaItems.length === 0
        ? `<tr><td colspan="${colCount}" class="empty-state"><i class="fas fa-inbox"></i><h3>Nenhuma categoria encontrada</h3></td></tr>`
        : paginaItems.map(c => `
            <tr>
                <td>${c.id}</td>
                <td><strong>${c.nome}</strong></td>
                <td>${c.slug}</td>
                <td><i class="${c.icone || 'fas fa-tag'}" style="color:${c.cor||'#1a6fc4'}"></i></td>
                <td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${c.cor||'#1a6fc4'};vertical-align:middle;margin-right:4px;"></span>${c.cor}</td>
                <td>${c.ordem}</td>
                <td>${c.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-danger">Inativo</span>'}</td>
                ${isSuporte ? `<td>${c.empresa_nome || '-'}</td>` : ''}
                <td>
                    <div class="admin-table-actions">
                        <button class="btn btn-warning btn-sm btn-icon" onclick="editarCategoria(${c.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm btn-icon" onclick="confirmarExclusao(${c.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

    $('infoPaginacaoCat').textContent = `Mostrando ${inicio + 1}-${Math.min(fim, total)} de ${total}`;
    renderizarPaginacao();
}

function renderizarPaginacao() {
    const totalPaginas = Math.ceil(categoriasData.length / porPagina) || 1;
    const container = $('botoesPaginacaoCat');
    let html = '';
    html += `<button onclick="mudarPagina(${paginaAtual - 1})" ${paginaAtual === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPaginas; i++) {
        html += `<button class="${i === paginaAtual ? 'active' : ''}" onclick="mudarPagina(${i})">${i}</button>`;
    }
    html += `<button onclick="mudarPagina(${paginaAtual + 1})" ${paginaAtual === totalPaginas ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
}

window.mudarPagina = function(p) {
    const total = Math.ceil(categoriasData.length / porPagina) || 1;
    if (p < 1 || p > total) return;
    paginaAtual = p;
    renderizarTabela();
};

// Popular select de categoria pai
async function popularSelectPai() {
    try {
        const res = await fetch(`${API_BASE}/api/categorias`);
        const cats = await res.json();
        const select = $('catPaiId');
        const valAtual = select.value;
        select.innerHTML = '<option value="">-- Nenhuma --</option>' + cats
            .filter(c => c.id != ($('catId').value || 0))
            .map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
        select.value = valAtual;
    } catch (e) {}
}

// Abrir modal nova
$('btnNovaCategoria').addEventListener('click', () => {
    $('formCategoria').reset();
    $('catId').value = '';
    $('catCor').value = '#1a6fc4';
    $('catAtivo').checked = true;
    $('catIcone').value = 'fas fa-tag';
    atualizarPreviewIcone();
    $('modalCategoriaTitulo').innerHTML = '<i class="fas fa-tag"></i> Nova Categoria';
    popularSelectPai();
    abrirModal('modalCategoria');
});

// Fechar modal
$('modalCategoriaClose').addEventListener('click', () => fecharModal('modalCategoria'));
$('btnCancelarCategoria').addEventListener('click', () => fecharModal('modalCategoria'));

// Gerar slug automaticamente
$('catNome').addEventListener('blur', () => {
    if (!$('catSlug').value) {
        $('catSlug').value = slugify($('catNome').value);
    }
});

// Salvar
$('btnSalvarCategoria').addEventListener('click', async () => {
    const nome = $('catNome').value.trim();
    const slug = $('catSlug').value.trim();
    if (!nome || !slug) {
        toast('Preencha os campos obrigatórios', 'error');
        return;
    }
    const dados = {
        id: $('catId').value || undefined,
        nome,
        slug,
        codigo_erp: $('catCodigoErp').value || null,
        descricao: $('catDescricao').value || null,
        icone: $('catIcone').value || null,
        cor: $('catCor').value,
        ordem: parseInt($('catOrdem').value) || 0,
        ativo: $('catAtivo').checked,
        categoria_pai_id: $('catPaiId').value || null
    };
    try {
        const url = `${API_BASE}/api/categorias${dados.id ? '/' + dados.id : ''}`;
        const res = await fetch(url, {
            method: dados.id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao salvar');
        toast(dados.id ? 'Categoria atualizada!' : 'Categoria criada!');
        fecharModal('modalCategoria');
        carregarCategorias();
    } catch (err) {
        toast(err.message, 'error');
    }
});

// Editar
window.editarCategoria = async function(id) {
    try {
        const res = await fetch(`${API_BASE}/api/categorias/${id}`);
        if (!res.ok) throw new Error('Erro ao carregar');
        const c = await res.json();
        $('catId').value = c.id;
        $('catNome').value = c.nome;
        $('catSlug').value = c.slug;
        $('catCodigoErp').value = c.codigo_erp || '';
        $('catIcone').value = c.icone || 'fas fa-tag';
        atualizarPreviewIcone();
        $('catCor').value = c.cor || '#1a6fc4';
        $('catOrdem').value = c.ordem;
        $('catAtivo').checked = c.ativo;
        $('catDescricao').value = c.descricao || '';
        await popularSelectPai();
        $('catPaiId').value = c.categoria_pai_id || '';
        $('modalCategoriaTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Categoria';
        abrirModal('modalCategoria');
    } catch (err) {
        toast(err.message, 'error');
    }
};

// Excluir
window.confirmarExclusao = function(id) {
    categoriaExcluirId = id;
    abrirModal('modalConfirmar');
};
$('btnCancelarExclusao').addEventListener('click', () => fecharModal('modalConfirmar'));
$('btnConfirmarExclusao').addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_BASE}/api/categorias/${categoriaExcluirId}`, { method: 'DELETE' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao excluir');
        toast('Categoria excluída!');
        fecharModal('modalConfirmar');
        carregarCategorias();
    } catch (err) {
        toast(err.message, 'error');
    }
});

// Busca
$('searchCategoria').addEventListener('input', () => {
    paginaAtual = 1;
    carregarCategorias();
});

// Modal helpers
function abrirModal(id) { $(id).classList.add('active'); }
function fecharModal(id) { $(id).classList.remove('active'); }

// Inicializar
carregarCategorias();
