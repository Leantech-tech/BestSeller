const API_BASE = '';
let bannersData = [];
let paginaAtual = 1;
const porPagina = 10;
let bannerExcluirId = null;
const isSuporte = localStorage.getItem('araca_admin_usuario') === 'suporte';

function $(id){return document.getElementById(id);}

$('menuToggle')?.addEventListener('click', ()=> $('sidebar').classList.toggle('open'));

function toast(msg, type='success'){
    const div=document.createElement('div'); div.className=`toast ${type}`;
    const icon=type==='success'?'fa-check-circle':type==='error'?'fa-times-circle':'fa-exclamation-circle';
    div.innerHTML=`<i class="fas ${icon}"></i><span class="toast-message">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    $('toastContainer').appendChild(div); setTimeout(()=>div.remove(),4000);
}

async function carregar(){
    try{
        const res = await fetch(`${API_BASE}/api/banners`);
        if(!res.ok) throw new Error('Erro');
        bannersData = await res.json();
        paginaAtual = 1;
        renderizar();
    }catch(err){ toast(err.message,'error'); }
}

function renderizar(){
    const tbody = $('tabelaBanners').querySelector('tbody');
    const thead = $('tabelaBanners').querySelector('thead tr');
    const total = bannersData.length;
    const inicio = (paginaAtual-1)*porPagina;
    const fim = inicio+porPagina;
    const items = bannersData.slice(inicio,fim);

    // Ajustar header para suporte
    if (isSuporte && !thead.querySelector('.th-empresa')) {
        const th = document.createElement('th');
        th.className = 'th-empresa';
        th.textContent = 'Empresa';
        thead.insertBefore(th, thead.children[thead.children.length - 1]);
    }
    const colCount = isSuporte ? 9 : 8;

    tbody.innerHTML = items.length===0
        ? `<tr><td colspan="${colCount}" class="empty-state"><i class="fas fa-inbox"></i><h3>Nenhum banner</h3></td></tr>`
        : items.map(b=>`<tr>
            <td>${b.id}</td>
            <td><img src="${b.imagem}" style="width:80px;height:40px;object-fit:cover;border-radius:4px;"></td>
            <td><strong>${b.titulo}</strong></td>
            <td>${b.subtitulo||'-'}</td>
            <td>${b.link||'-'}</td>
            <td>${b.ordem}</td>
            <td>${b.ativo?'<span class="badge badge-success">Ativo</span>':'<span class="badge badge-danger">Inativo</span>'}</td>
            ${isSuporte ? `<td>${b.empresa_nome || '-'}</td>` : ''}
            <td><div class="admin-table-actions">
                <button class="btn btn-warning btn-sm btn-icon" onclick="editar(${b.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm btn-icon" onclick="confirmarExclusao(${b.id})"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`).join('');

    $('infoBanners').textContent = `Mostrando ${inicio+1}-${Math.min(fim,total)} de ${total}`;
    const totalPag = Math.ceil(total/porPagina)||1;
    let html='';
    html+=`<button onclick="mudarPag(${paginaAtual-1})" ${paginaAtual===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>`;
    for(let i=1;i<=totalPag;i++) html+=`<button class="${i===paginaAtual?'active':''}" onclick="mudarPag(${i})">${i}</button>`;
    html+=`<button onclick="mudarPag(${paginaAtual+1})" ${paginaAtual===totalPag?'disabled':''}><i class="fas fa-chevron-right"></i></button>`;
    $('btnsBanners').innerHTML = html;
}

window.mudarPag = function(p){
    const total = Math.ceil(bannersData.length/porPagina)||1;
    if(p<1||p>total) return; paginaAtual=p; renderizar();
};

$('btnNovoBanner').addEventListener('click', ()=>{
    $('formBanner').reset();
    $('banId').value = '';
    $('banAtivo').checked = true;
    $('modalBannerTitulo').innerHTML = '<i class="fas fa-image"></i> Novo Banner';
    abrirModal('modalBanner');
});

$('modalBannerClose').addEventListener('click', ()=>fecharModal('modalBanner'));
$('btnCancelarBanner').addEventListener('click', ()=>fecharModal('modalBanner'));

$('btnSalvarBanner').addEventListener('click', async ()=>{
    const imagem = $('banImagem').value.trim();
    const titulo = $('banTitulo').value.trim();
    if(!imagem || !titulo){ toast('Preencha os campos obrigatórios','error'); return; }
    const dados = {
        id: $('banId').value || undefined,
        imagem, titulo,
        imagem_mobile: $('banImagemMobile').value || null,
        subtitulo: $('banSubtitulo').value || null,
        link: $('banLink').value || null,
        ordem: parseInt($('banOrdem').value)||0,
        ativo: $('banAtivo').checked,
        data_inicio: $('banDataInicio').value || null,
        data_fim: $('banDataFim').value || null
    };
    try{
        const url = `${API_BASE}/api/banners${dados.id?'/'+dados.id:''}`;
        const res = await fetch(url, { method: dados.id?'PUT':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(dados) });
        const json = await res.json();
        if(!res.ok) throw new Error(json.error||'Erro');
        toast(dados.id?'Atualizado!':'Criado!');
        fecharModal('modalBanner');
        carregar();
    }catch(err){ toast(err.message,'error'); }
});

window.editar = async function(id){
    try{
        const res = await fetch(`${API_BASE}/api/banners/${id}`);
        if(!res.ok) throw new Error('Erro');
        const b = await res.json();
        $('banId').value = b.id;
        $('banImagem').value = b.imagem;
        $('banImagemMobile').value = b.imagem_mobile||'';
        $('banTitulo').value = b.titulo;
        $('banSubtitulo').value = b.subtitulo||'';
        $('banLink').value = b.link||'';
        $('banOrdem').value = b.ordem;
        $('banAtivo').checked = b.ativo;
        $('banDataInicio').value = b.data_inicio ? b.data_inicio.split('T')[0] : '';
        $('banDataFim').value = b.data_fim ? b.data_fim.split('T')[0] : '';
        $('modalBannerTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Banner';
        abrirModal('modalBanner');
    }catch(err){ toast(err.message,'error'); }
};

window.confirmarExclusao = function(id){
    bannerExcluirId = id;
    abrirModal('modalConfirmar');
};

$('btnCancelarExclusao').addEventListener('click', ()=>fecharModal('modalConfirmar'));
$('btnConfirmarExclusao').addEventListener('click', async ()=>{
    try{
        const res = await fetch(`${API_BASE}/api/banners/${bannerExcluirId}`, {method:'DELETE'});
        const json = await res.json();
        if(!res.ok) throw new Error(json.error||'Erro');
        toast('Excluído!'); fecharModal('modalConfirmar'); carregar();
    }catch(err){ toast(err.message,'error'); }
});

function abrirModal(id){ $(id).classList.add('active'); }
function fecharModal(id){ $(id).classList.remove('active'); }

carregar();
