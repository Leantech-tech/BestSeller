const isSuporte = localStorage.getItem('araca_admin_usuario') === 'suporte';
const API_BASE = '';
const configs = {
    usuario: {
        api: 'usuarios-admin', titulo: 'Usuário Admin', tituloLista: 'Usuarios',
        idField: 'id',
        campos: [
            { name: 'nome', label: 'Nome', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'senha_hash', label: 'Senha (hash)' },
            { name: 'perfil', label: 'Perfil', type: 'select', options: [{ v: 'dono', t: 'Dono' }, { v: 'admin', t: 'Admin' }, { v: 'operador', t: 'Operador' }, { v: 'vendedor', t: 'Vendedor' }], default: 'operador' },
            { name: 'ativo', label: 'Ativo', type: 'checkbox', default: true }
        ],
        colunas: [
            { key: 'id', label: 'ID' }, { key: 'nome', label: 'Nome' }, { key: 'email', label: 'Email' },
            { key: 'perfil', label: 'Perfil' },
            { key: 'ativo', label: 'Status', badge: { true: 'Ativo', false: 'Inativo' } }
        ]
    },
    vendedor: {
        api: 'vendedores', titulo: 'Vendedor', tituloLista: 'Vendedores',
        idField: 'id',
        campos: [
            { name: 'nome', label: 'Nome', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'senha_hash', label: 'Senha (hash)' },
            { name: 'perfil', label: 'Perfil', type: 'select', options: [{ v: 'vendedor', t: 'Vendedor' }], default: 'vendedor' },
            { name: 'comissao_pct', label: 'Comissão %', type: 'text', mask: 'percentual', default: '0,00%' },
            { name: 'codigo_erp', label: 'Código ERP' },
            { name: 'ativo', label: 'Ativo', type: 'checkbox', default: true }
        ],
        colunas: [
            { key: 'id', label: 'ID' }, { key: 'nome', label: 'Nome' }, { key: 'email', label: 'Email' },
            { key: 'perfil', label: 'Perfil' }, { key: 'comissao_pct', label: 'Comissão %' },
            { key: 'ativo', label: 'Status', badge: { true: 'Ativo', false: 'Inativo' } }
        ]
    },
    cliente: {
        api: 'clientes', titulo: 'Cliente', tituloLista: 'Clientes',
        idField: 'id',
        campos: [
            { name: 'tipo_pessoa', label: 'Tipo Pessoa', type: 'select', options: [{ v: 'F', t: 'Física' }, { v: 'J', t: 'Jurídica' }], default: 'F' },
            { name: 'codigo_erp', label: 'Código ERP' },
            { name: 'nome', label: 'Nome', required: true },
            { name: 'nome_fantasia', label: 'Nome Fantasia' },
            { name: 'cpf_cnpj', label: 'CPF/CNPJ', mask: 'cpf_cnpj' },
            { name: 'rg_ie', label: 'RG/IE' },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'telefone', label: 'Telefone', mask: 'telefone' },
            { name: 'celular', label: 'Celular', mask: 'telefone' },
            { name: 'ativo', label: 'Ativo', type: 'checkbox', default: true }
        ],
        colunas: [
            { key: 'id', label: 'ID' }, { key: 'codigo_erp', label: 'Código ERP' }, { key: 'nome', label: 'Nome' }, { key: 'email', label: 'Email' },
            { key: 'cpf_cnpj', label: 'CPF/CNPJ' }, { key: 'telefone', label: 'Telefone' },
            { key: 'ativo', label: 'Status', badge: { true: 'Ativo', false: 'Inativo' } }
        ]
    }
};

let dados = {}; let paginas = {}; const porPagina = 10; let entidadeAtual = null; let itemExcluir = null;

function $(id) { return document.getElementById(id); }

$('menuToggle')?.addEventListener('click', () => $('sidebar').classList.toggle('open'));

function toast(msg, type = 'success') {
    const div = document.createElement('div'); div.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-exclamation-circle';
    div.innerHTML = `<i class="fas ${icon}"></i><span class="toast-message">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    $('toastContainer').appendChild(div); setTimeout(() => div.remove(), 4000);
}

$('tabsPessoas').addEventListener('click', e => {
    if (!e.target.classList.contains('tab-btn')) return;
    document.querySelectorAll('#tabsPessoas .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    e.target.classList.add('active');
    $(e.target.dataset.tab).classList.add('active');
});

async function carregar(entidade) {
    const cfg = configs[entidade];
    const searchEl = $(`search${cfg.tituloLista.replace(/s$/, '')}`);
    const search = searchEl ? searchEl.value : '';
    try {
        const url = `${API_BASE}/api/${cfg.api}?${search ? 'search=' + encodeURIComponent(search) : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Erro ao carregar');
        dados[entidade] = await res.json();
        paginas[entidade] = 1;
        renderizar(entidade);
    } catch (err) { toast(err.message, 'error'); }
}

function renderizar(entidade) {
    const cfg = configs[entidade];
    const tbody = $(`tabela${cfg.tituloLista}`).querySelector('tbody');
    const total = dados[entidade]?.length || 0;
    const inicio = (paginas[entidade] - 1) * porPagina;
    const fim = inicio + porPagina;
    const items = (dados[entidade] || []).slice(inicio, fim);

    tbody.innerHTML = items.length === 0
        ? `<tr><td colspan="${cfg.colunas.length + 1}" class="empty-state"><i class="fas fa-inbox"></i><h3>Nenhum registro</h3></td></tr>`
        : items.map(item => `<tr>${cfg.colunas.map(c => {
            let val = item[c.key];
            if (c.badge) val = `<span class="badge ${val === true || val === 't' ? 'badge-success' : 'badge-danger'}">${c.badge[val === true || val === 't' ? 'true' : 'false']}</span>`;
            else val = val || '-'; return `<td>${val}</td>`;
        }).join('')}<td><div class="admin-table-actions">
            <button class="btn btn-warning btn-sm btn-icon" onclick="editar('${entidade}',${item[cfg.idField]})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="confirmarExclusao('${entidade}',${item[cfg.idField]})"><i class="fas fa-trash"></i></button>
        </div></td></tr>`).join('');

    $(`info${cfg.tituloLista}`).textContent = `Mostrando ${inicio + 1}-${Math.min(fim, total)} de ${total}`;
    const totalPag = Math.ceil(total / porPagina) || 1;
    let html = '';
    html += `<button onclick="mudarPag('${entidade}',${paginas[entidade] - 1})" ${paginas[entidade] === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPag; i++) html += `<button class="${i === paginas[entidade] ? 'active' : ''}" onclick="mudarPag('${entidade}',${i})">${i}</button>`;
    html += `<button onclick="mudarPag('${entidade}',${paginas[entidade] + 1})" ${paginas[entidade] === totalPag ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    $(`btns${cfg.tituloLista}`).innerHTML = html;
}

window.mudarPag = function (entidade, p) {
    const total = Math.ceil((dados[entidade]?.length || 0) / porPagina) || 1;
    if (p < 1 || p > total) return; paginas[entidade] = p; renderizar(entidade);
};

function buildForm(cfg, item) {
    return `<input type="hidden" id="genId" value="${item ? item[cfg.idField] : ''}">` +
        cfg.campos.map(f => {
            const val = item ? (item[f.name] !== null ? item[f.name] : '') : (f.default !== undefined ? f.default : '');
            if (f.hidden) return `<input type="hidden" id="gen_${f.name}" value="${val}">`;
            if (f.type === 'checkbox') {
                return `<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="gen_${f.name}" ${val === true || val === 't' || val === 1 || val === '1' ? 'checked' : ''}> ${f.label}</label></div>`;
            }
            if (f.type === 'select') {
                return `<div class="form-group"><label>${f.label}${f.required ? ' <span class="required">*</span>' : ''}</label><select id="gen_${f.name}">${f.options.map(o => `<option value="${o.v}" ${val == o.v ? 'selected' : ''}>${o.t}</option>`).join('')}</select></div>`;
            }
            return `<div class="form-group"><label>${f.label}${f.required ? ' <span class="required">*</span>' : ''}</label><input type="${f.type || 'text'}" id="gen_${f.name}" value="${val}" ${f.step ? `step="${f.step}"` : ''} ${f.mask ? `data-mask="${f.mask}"` : ''}></div>`;
        }).join('');
}

window.abrirModalGenerico = function (entidade) {
    entidadeAtual = entidade;
    const cfg = configs[entidade];
    $('modalGenericoTitulo').innerHTML = `<i class="fas fa-plus"></i> Novo ${cfg.titulo}`;
    $('modalGenericoBody').innerHTML = `<form id="formGenerico">${buildForm(cfg, null)}</form>`;
    Mascaras.aplicarTudo();
    abrirModal('modalGenerico');
};

window.editar = async function (entidade, id) {
    entidadeAtual = entidade;
    const cfg = configs[entidade];
    try {
        const res = await fetch(`${API_BASE}/api/${cfg.api}/${id}`);
        if (!res.ok) throw new Error('Erro');
        const item = await res.json();
        $('modalGenericoTitulo').innerHTML = `<i class="fas fa-edit"></i> Editar ${cfg.titulo}`;
        $('modalGenericoBody').innerHTML = `<form id="formGenerico">${buildForm(cfg, item)}</form>`;
        Mascaras.aplicarTudo();
        abrirModal('modalGenerico');
    } catch (err) { toast(err.message, 'error'); }
};

$('btnSalvarGenerico').addEventListener('click', async () => {
    const cfg = configs[entidadeAtual];
    const dadosForm = {}; let valido = true;
    cfg.campos.forEach(f => {
        const el = $(`gen_${f.name}`);
        if (f.type === 'checkbox') dadosForm[f.name] = !!el.checked;
        else if (f.type === 'number') dadosForm[f.name] = parseFloat(el.value) || 0;
        else dadosForm[f.name] = el.value.trim() || null;
        if (f.required && (dadosForm[f.name] === null || dadosForm[f.name] === '')) valido = false;
    });
    if (!valido) { toast('Preencha os campos obrigatórios', 'error'); return; }
    const id = $('genId').value;
    try {
        const url = `${API_BASE}/api/${cfg.api}${id ? '/' + id : ''}`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosForm) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao salvar');
        toast(id ? 'Atualizado!' : 'Criado!');
        fecharModal('modalGenerico');
        carregar(entidadeAtual);
    } catch (err) { toast(err.message, 'error'); }
});

window.confirmarExclusao = function (entidade, id) {
    entidadeAtual = entidade; itemExcluir = id;
    abrirModal('modalConfirmar');
};

$('btnConfirmarExclusao').addEventListener('click', async () => {
    const cfg = configs[entidadeAtual];
    try {
        const res = await fetch(`${API_BASE}/api/${cfg.api}/${itemExcluir}`, { method: 'DELETE' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao excluir');
        toast('Excluído!'); fecharModal('modalConfirmar'); carregar(entidadeAtual);
    } catch (err) { toast(err.message, 'error'); }
});

function abrirModal(id) { $(id).classList.add('active'); }
function fecharModal(id) { $(id).classList.remove('active'); }

['usuario', 'vendedor', 'cliente'].forEach(ent => {
    const cfg = configs[ent];
    const input = $(`search${cfg.tituloLista.replace(/s$/, '')}`);
    if (input) input.addEventListener('input', () => { paginas[ent] = 1; carregar(ent); });
});

carregar('usuario'); carregar('vendedor'); carregar('cliente');
