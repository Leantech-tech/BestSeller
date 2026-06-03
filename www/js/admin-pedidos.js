const API_BASE = '';
let pedidosData = [];
let paginaAtual = 1;
const porPagina = 10;
let pedidoExcluirId = null;
let pedidoVisualizarId = null;
const isSuporte = localStorage.getItem('araca_admin_usuario') === 'suporte';

function $(id){return document.getElementById(id);}

$('menuToggle')?.addEventListener('click', ()=> $('sidebar').classList.toggle('open'));

function toast(msg, type='success'){
    const div=document.createElement('div'); div.className=`toast ${type}`;
    const icon=type==='success'?'fa-check-circle':type==='error'?'fa-times-circle':'fa-exclamation-circle';
    div.innerHTML=`<i class="fas ${icon}"></i><span class="toast-message">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    $('toastContainer').appendChild(div); setTimeout(()=>div.remove(),4000);
}

function formatarMoeda(v){ return parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

async function carregar(){
    try{
        const search = $('searchPedido').value;
        const status = $('filtroStatusPedido').value;
        let qs = '';
        if(search) qs += `search=${encodeURIComponent(search)}&`;
        if(status) qs += `status=${encodeURIComponent(status)}&`;
        const res = await fetch(`${API_BASE}/api/pedidos?${qs}`);
        if(!res.ok) throw new Error('Erro');
        pedidosData = await res.json();
        paginaAtual = 1;
        renderizar();
    }catch(err){ toast(err.message,'error'); }
}

function renderizar(){
    const tbody = $('tabelaPedidos').querySelector('tbody');
    const thead = $('tabelaPedidos').querySelector('thead tr');
    const total = pedidosData.length;
    const inicio = (paginaAtual-1)*porPagina;
    const fim = inicio+porPagina;
    const items = pedidosData.slice(inicio,fim);

    // Ajustar header para suporte
    if (isSuporte && !thead.querySelector('.th-empresa')) {
        const th = document.createElement('th');
        th.className = 'th-empresa';
        th.textContent = 'Empresa';
        thead.insertBefore(th, thead.children[thead.children.length - 1]);
    }
    const colCount = isSuporte ? 7 : 6;

    const statusCor = { pendente:'#f0ad4e', pago:'#5cb85c', em_separacao:'#5bc0de', enviado:'#337ab7', entregue:'#5cb85c', cancelado:'#d9534f' };

    tbody.innerHTML = items.length===0
        ? `<tr><td colspan="${colCount}" class="empty-state"><i class="fas fa-inbox"></i><h3>Nenhum pedido</h3></td></tr>`
        : items.map(p=>`<tr>
            <td><strong>${p.numero}</strong></td>
            <td>${p.cliente_nome||'-'}</td>
            <td>${formatarMoeda(p.total)}</td>
            <td><span class="badge" style="background:${statusCor[p.status]||'#666'}22;color:${statusCor[p.status]||'#666'};">${p.status_descricao||p.status}</span></td>
            <td>${p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-'}</td>
            ${isSuporte ? `<td>${p.empresa_nome || '-'}</td>` : ''}
            <td><div class="admin-table-actions">
                <button class="btn btn-primary btn-sm btn-icon" onclick="verPedido(${p.id})"><i class="fas fa-eye"></i></button>
                <button class="btn btn-danger btn-sm btn-icon" onclick="confirmarExclusao(${p.id})"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`).join('');

    $('infoPedidos').textContent = `Mostrando ${inicio+1}-${Math.min(fim,total)} de ${total}`;
    const totalPag = Math.ceil(total/porPagina)||1;
    let html='';
    html+=`<button onclick="mudarPag(${paginaAtual-1})" ${paginaAtual===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>`;
    for(let i=1;i<=totalPag;i++) html+=`<button class="${i===paginaAtual?'active':''}" onclick="mudarPag(${i})">${i}</button>`;
    html+=`<button onclick="mudarPag(${paginaAtual+1})" ${paginaAtual===totalPag?'disabled':''}><i class="fas fa-chevron-right"></i></button>`;
    $('btnsPedidos').innerHTML = html;
}

window.mudarPag = function(p){
    const total = Math.ceil(pedidosData.length/porPagina)||1;
    if(p<1||p>total) return; paginaAtual=p; renderizar();
};

window.verPedido = async function(id){
    pedidoVisualizarId = id;
    try{
        const res = await fetch(`${API_BASE}/api/pedidos/${id}`);
        if(!res.ok) throw new Error('Erro');
        const ped = await res.json();
        const statusCor = { pendente:'#f0ad4e', pago:'#5cb85c', em_separacao:'#5bc0de', enviado:'#337ab7', entregue:'#5cb85c', cancelado:'#d9534f' };
        let html = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div><strong>Número:</strong> ${ped.numero}</div>
                <div><strong>Data:</strong> ${ped.created_at ? new Date(ped.created_at).toLocaleString('pt-BR') : '-'}</div>
                <div><strong>Cliente:</strong> ${ped.cliente_nome||'-'}</div>
                <div><strong>Email:</strong> ${ped.cliente_email||'-'}</div>
                <div><strong>Status:</strong> <span class="badge" style="background:${statusCor[ped.status]||'#666'}22;color:${statusCor[ped.status]||'#666'};">${ped.status_descricao||ped.status}</span></div>
                <div><strong>Total:</strong> ${formatarMoeda(ped.total)}</div>
            </div>
            <h4 style="margin-bottom:0.5rem;">Itens</h4>
            <table class="admin-table-loja"><thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Subtotal</th></tr></thead><tbody>
        `;
        (ped.itens||[]).forEach(item=>{
            html += `<tr><td>${item.produto_nome}</td><td>${item.quantidade}</td><td>${formatarMoeda(item.preco_venda)}</td><td>${formatarMoeda(item.subtotal)}</td></tr>`;
        });
        html += `</tbody></table>`;
        $('modalPedidoBody').innerHTML = html;
        abrirModal('modalPedido');
    }catch(err){ toast(err.message,'error'); }
};

$('btnExcluirPedido').addEventListener('click', ()=>{
    fecharModal('modalPedido');
    confirmarExclusao(pedidoVisualizarId);
});

window.confirmarExclusao = function(id){
    pedidoExcluirId = id;
    abrirModal('modalConfirmar');
};

$('btnConfirmarExclusao').addEventListener('click', async ()=>{
    try{
        const res = await fetch(`${API_BASE}/api/pedidos/${pedidoExcluirId}`, {method:'DELETE'});
        const json = await res.json();
        if(!res.ok) throw new Error(json.error||'Erro');
        toast('Pedido excluído!'); fecharModal('modalConfirmar'); carregar();
    }catch(err){ toast(err.message,'error'); }
});

$('searchPedido').addEventListener('input', ()=>{ paginaAtual=1; carregar(); });
$('filtroStatusPedido').addEventListener('change', ()=>{ paginaAtual=1; carregar(); });

function abrirModal(id){ $(id).classList.add('active'); }
function fecharModal(id){ $(id).classList.remove('active'); }

carregar();
