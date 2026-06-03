const API_BASE = '';
const configs = {
    unidade: {
        api: 'unidades-medida', titulo: 'Unidade de Medida', tituloLista: 'Unidades',
        campos: [
            { name: 'codigo', label: 'Código', required: true },
            { name: 'descricao', label: 'Descrição', required: true },
            { name: 'permite_fracao', label: 'Permite Fração', type: 'checkbox', default: true },
            { name: 'ativo', label: 'Ativo', type: 'checkbox', default: true }
        ],
        colunas: [
            { key: 'id', label: 'ID' }, { key: 'codigo', label: 'Código' }, { key: 'descricao', label: 'Descrição' },
            { key: 'permite_fracao', label: 'Permite Fração', badge: { true: 'Sim', false: 'Não' } },
            { key: 'ativo', label: 'Status', badge: { true: 'Ativo', false: 'Inativo' } }
        ]
    },
    tabela: {
        api: 'tabelas-preco', titulo: 'Tabela de Preço', tituloLista: 'Tabelas',
        campos: [
            { name: 'descricao', label: 'Descrição', required: true },
            { name: 'markup', label: 'Markup', type: 'text', mask: 'percentual' },
            { name: 'codigo_erp', label: 'Código ERP' },
            { name: 'padrao', label: 'Padrão', type: 'checkbox' },
            { name: 'ativo', label: 'Ativo', type: 'checkbox', default: true }
        ],
        colunas: [
            { key: 'id', label: 'ID' }, { key: 'descricao', label: 'Descrição' }, { key: 'markup', label: 'Markup' },
            { key: 'padrao', label: 'Padrão', badge: { true: 'Sim', false: 'Não' } },
            { key: 'ativo', label: 'Status', badge: { true: 'Ativo', false: 'Inativo' } }
        ]
    },
    forma: {
        api: 'formas-pagamento', titulo: 'Forma de Pagamento', tituloLista: 'Formas',
        campos: [
            { name: 'descricao', label: 'Descrição', required: true },
            { name: 'tipo', label: 'Tipo', type: 'text' },
            { name: 'parcelas_max', label: 'Parcelas Máx', type: 'number', default: 1 },
            { name: 'taxa_operacao', label: 'Taxa Operação', type: 'text', mask: 'percentual', default: '0,00%' },
            { name: 'usa_gateway', label: 'Usa Gateway', type: 'checkbox' },
            { name: 'codigo_erp', label: 'Código ERP' },
            { name: 'ativo', label: 'Ativo', type: 'checkbox', default: true }
        ],
        colunas: [
            { key: 'id', label: 'ID' }, { key: 'descricao', label: 'Descrição' }, { key: 'tipo', label: 'Tipo' },
            { key: 'parcelas_max', label: 'Parcelas Máx' }, { key: 'taxa_operacao', label: 'Taxa' },
            { key: 'ativo', label: 'Status', badge: { true: 'Ativo', false: 'Inativo' } }
        ]
    },
    condicao: {
        api: 'condicoes-pagamento', titulo: 'Condição de Pagamento', tituloLista: 'Condicoes',
        campos: [
            { name: 'descricao', label: 'Descrição', required: true },
            { name: 'parcelas', label: 'Parcelas', type: 'number', default: 1 },
            { name: 'dias_parcelas', label: 'Dias Parcelas (ex: 0,30,60)', default: '0' },
            { name: 'tipo', label: 'Tipo', type: 'select', options: [{v:'a_vista',t:'À Vista'},{v:'parcelado',t:'Parcelado'}], default: 'a_vista' },
            { name: 'codigo_erp', label: 'Código ERP' },
            { name: 'ativo', label: 'Ativo', type: 'checkbox', default: true }
        ],
        colunas: [
            { key: 'id', label: 'ID' }, { key: 'descricao', label: 'Descrição' }, { key: 'parcelas', label: 'Parcelas' },
            { key: 'tipo', label: 'Tipo' }, { key: 'ativo', label: 'Status', badge: { true: 'Ativo', false: 'Inativo' } }
        ]
    },
    status: {
        api: 'status-pedido', titulo: 'Status de Pedido', tituloLista: 'Status',
        campos: [
            { name: 'codigo', label: 'Código', required: true },
            { name: 'descricao', label: 'Descrição', required: true },
            { name: 'cor', label: 'Cor', type: 'color', default: '#666666' },
            { name: 'icone', label: 'Ícone' },
            { name: 'ordem', label: 'Ordem', type: 'number', default: 0 },
            { name: 'finaliza', label: 'Finaliza', type: 'checkbox' },
            { name: 'cancela', label: 'Cancela', type: 'checkbox' },
            { name: 'envia_rp', label: 'Envia RP', type: 'checkbox' },
            { name: 'ativo', label: 'Ativo', type: 'checkbox', default: true }
        ],
        colunas: [
            { key: 'id', label: 'ID' }, { key: 'codigo', label: 'Código' }, { key: 'descricao', label: 'Descrição' },
            { key: 'cor', label: 'Cor', render: v=>`<span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${v};"></span> ${v}` },
            { key: 'ordem', label: 'Ordem' },
            { key: 'finaliza', label: 'Finaliza', badge: { true: 'Sim', false: 'Não' } },
            { key: 'cancela', label: 'Cancela', badge: { true: 'Sim', false: 'Não' } },
            { key: 'ativo', label: 'Status', badge: { true: 'Ativo', false: 'Inativo' } }
        ]
    }
};

let dados = {}; let paginas = {}; const porPagina = 10; let entidadeAtual = null; let itemExcluir = null;
function $(id){return document.getElementById(id);}

$('menuToggle')?.addEventListener('click', ()=> $('sidebar').classList.toggle('open'));

function toast(msg, type='success'){
    const div=document.createElement('div'); div.className=`toast ${type}`;
    const icon=type==='success'?'fa-check-circle':type==='error'?'fa-times-circle':'fa-exclamation-circle';
    div.innerHTML=`<i class="fas ${icon}"></i><span class="toast-message">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    $('toastContainer').appendChild(div); setTimeout(()=>div.remove(),4000);
}

$('tabsConfig').addEventListener('click', e=>{
    if(!e.target.classList.contains('tab-btn')) return;
    document.querySelectorAll('#tabsConfig .tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    e.target.classList.add('active');
    $(e.target.dataset.tab).classList.add('active');
});

async function carregar(entidade){
    const cfg = configs[entidade];
    const searchEl = $(`search${cfg.tituloLista.replace(/s$/,'')}`);
    const search = searchEl ? searchEl.value : '';
    try{
        const url = `${API_BASE}/api/${cfg.api}?${search?'search='+encodeURIComponent(search):''}`;
        const res = await fetch(url);
        if(!res.ok) throw new Error('Erro ao carregar');
        dados[entidade] = await res.json();
        paginas[entidade] = 1;
        renderizar(entidade);
    }catch(err){ toast(err.message,'error'); }
}

function renderizar(entidade){
    const cfg = configs[entidade];
    const tbody = $(`tabela${cfg.tituloLista}`).querySelector('tbody');
    const total = dados[entidade]?.length || 0;
    const inicio = (paginas[entidade]-1)*porPagina;
    const fim = inicio+porPagina;
    const items = (dados[entidade]||[]).slice(inicio,fim);

    tbody.innerHTML = items.length===0
        ? `<tr><td colspan="${cfg.colunas.length+1}" class="empty-state"><i class="fas fa-inbox"></i><h3>Nenhum registro</h3></td></tr>`
        : items.map(item=>`<tr>${cfg.colunas.map(c=>{
            let val = item[c.key];
            if(c.badge) val = `<span class="badge ${val===true||val==='t'?'badge-success':'badge-danger'}">${c.badge[val===true||val==='t'?'true':'false']}</span>`;
            else if(c.render) val = c.render(val);
            else val = val||'-'; return `<td>${val}</td>`;
        }).join('')}<td><div class="admin-table-actions">
            <button class="btn btn-warning btn-sm btn-icon" onclick="editar('${entidade}',${item[cfg.idField]})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="confirmarExclusao('${entidade}',${item[cfg.idField]})"><i class="fas fa-trash"></i></button>
        </div></td></tr>`).join('');

    $(`info${cfg.tituloLista}`).textContent = `Mostrando ${inicio+1}-${Math.min(fim,total)} de ${total}`;
    const totalPag = Math.ceil(total/porPagina)||1;
    let html='';
    html+=`<button onclick="mudarPag('${entidade}',${paginas[entidade]-1})" ${paginas[entidade]===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>`;
    for(let i=1;i<=totalPag;i++) html+=`<button class="${i===paginas[entidade]?'active':''}" onclick="mudarPag('${entidade}',${i})">${i}</button>`;
    html+=`<button onclick="mudarPag('${entidade}',${paginas[entidade]+1})" ${paginas[entidade]===totalPag?'disabled':''}><i class="fas fa-chevron-right"></i></button>`;
    $(`btns${cfg.tituloLista}`).innerHTML = html;
}

window.mudarPag = function(entidade, p){
    const total = Math.ceil((dados[entidade]?.length||0)/porPagina)||1;
    if(p<1||p>total) return; paginas[entidade]=p; renderizar(entidade);
};

function buildForm(cfg, item){
    return `<input type="hidden" id="genId" value="${item?item[cfg.idField]:''}">` +
        cfg.campos.map(f=>{
            const val = item? (item[f.name]!==null?item[f.name]:''): (f.default!==undefined?f.default:'');
            if(f.type==='checkbox'){
                return `<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="gen_${f.name}" ${val===true||val==='t'?'checked':''}> ${f.label}</label></div>`;
            }
            if(f.type==='select'){
                return `<div class="form-group"><label>${f.label}${f.required?' <span class="required">*</span>':''}</label><select id="gen_${f.name}">${f.options.map(o=>`<option value="${o.v}" ${val==o.v?'selected':''}>${o.t}</option>`).join('')}</select></div>`;
            }
            return `<div class="form-group"><label>${f.label}${f.required?' <span class="required">*</span>':''}</label><input type="${f.type||'text'}" id="gen_${f.name}" value="${val}" ${f.step?`step="${f.step}"`:''} ${f.mask?`data-mask="${f.mask}"`:''}></div>`;
        }).join('');
}

window.abrirModalGenerico = function(entidade){
    entidadeAtual = entidade;
    const cfg = configs[entidade];
    $('modalGenericoTitulo').innerHTML = `<i class="fas fa-plus"></i> Nova ${cfg.titulo}`;
    $('modalGenericoBody').innerHTML = `<form id="formGenerico">${buildForm(cfg, null)}</form>`;
    Mascaras.aplicarTudo();
    abrirModal('modalGenerico');
};

window.editar = async function(entidade, id){
    entidadeAtual = entidade;
    const cfg = configs[entidade];
    try{
        const res = await fetch(`${API_BASE}/api/${cfg.api}/${id}`);
        if(!res.ok) throw new Error('Erro');
        const item = await res.json();
        $('modalGenericoTitulo').innerHTML = `<i class="fas fa-edit"></i> Editar ${cfg.titulo}`;
        $('modalGenericoBody').innerHTML = `<form id="formGenerico">${buildForm(cfg, item)}</form>`;
        Mascaras.aplicarTudo();
        abrirModal('modalGenerico');
    }catch(err){ toast(err.message,'error'); }
};

$('btnSalvarGenerico').addEventListener('click', async ()=>{
    const cfg = configs[entidadeAtual];
    const dadosForm = {}; let valido = true;
    cfg.campos.forEach(f=>{
        const el = $(`gen_${f.name}`);
        if(f.type==='checkbox') dadosForm[f.name] = el.checked;
        else if(f.type==='number') dadosForm[f.name] = parseFloat(el.value) || (f.name==='markup'?null:0);
        else if(f.mask==='percentual') {
            const v = el.value.replace(/[^0-9,]/g, '').replace(',', '.');
            dadosForm[f.name] = parseFloat(v) || 0;
        }
        else dadosForm[f.name] = el.value.trim() || null;
        if(f.required && !dadosForm[f.name]) valido = false;
    });
    if(!valido){ toast('Preencha os campos obrigatórios','error'); return; }
    // Converter dias_parcelas para array se for string
    if(dadosForm.dias_parcelas && typeof dadosForm.dias_parcelas === 'string'){
        dadosForm.dias_parcelas = dadosForm.dias_parcelas.split(',').map(v=>parseInt(v.trim())).filter(v=>!isNaN(v));
    }
    const id = $('genId').value;
    try{
        const url = `${API_BASE}/api/${cfg.api}${id?'/'+id:''}`;
        const res = await fetch(url, { method: id?'PUT':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(dadosForm) });
        const json = await res.json();
        if(!res.ok) throw new Error(json.error||'Erro ao salvar');
        toast(id?'Atualizado!':'Criado!');
        fecharModal('modalGenerico');
        carregar(entidadeAtual);
    }catch(err){ toast(err.message,'error'); }
});

window.confirmarExclusao = function(entidade, id){
    entidadeAtual = entidade; itemExcluir = id;
    abrirModal('modalConfirmar');
};

$('btnConfirmarExclusao').addEventListener('click', async ()=>{
    const cfg = configs[entidadeAtual];
    try{
        const res = await fetch(`${API_BASE}/api/${cfg.api}/${itemExcluir}`, {method:'DELETE'});
        const json = await res.json();
        if(!res.ok) throw new Error(json.error||'Erro ao excluir');
        toast('Excluído!'); fecharModal('modalConfirmar'); carregar(entidadeAtual);
    }catch(err){ toast(err.message,'error'); }
});

function abrirModal(id){ $(id).classList.add('active'); }
function fecharModal(id){ $(id).classList.remove('active'); }

['unidade','tabela','forma','condicao','status'].forEach(ent=>{
    const cfg = configs[ent];
    const input = $(`search${cfg.tituloLista.replace(/s$/,'')}`);
    if(input) input.addEventListener('input', ()=>{ paginas[ent]=1; carregar(ent); });
});

carregar('unidade'); carregar('tabela'); carregar('forma'); carregar('condicao'); carregar('status');
