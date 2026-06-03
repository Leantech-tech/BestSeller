/**
 * admin.js - Dashboard
 */
const API_BASE = '';

function $(id) { return document.getElementById(id); }

// Menu mobile
$('menuToggle')?.addEventListener('click', () => {
    $('sidebar').classList.toggle('open');
});
document.addEventListener('click', (e) => {
    const sb = $('sidebar');
    if (window.innerWidth <= 1024 && sb?.classList.contains('open')) {
        if (!sb.contains(e.target) && e.target !== $('menuToggle')) {
            sb.classList.remove('open');
        }
    }
});

// Estatísticas
async function carregarEstatisticas() {
    try {
        const res = await fetch(`${API_BASE}/api/estatisticas`);
        if (!res.ok) throw new Error('Erro ao carregar estatísticas');
        const stats = await res.json();
        $('statCategorias').textContent = stats.totalCategorias;
        $('statProdutos').textContent = stats.totalProdutos;
        $('statDestaque').textContent = stats.produtosDestaque;
        $('statSemEstoque').textContent = stats.produtosSemEstoque;
        // Adicionar cards extras dinamicamente se existirem
        const cards = document.querySelector('.admin-cards-loja');
        if (stats.totalClientes !== undefined && !document.getElementById('statClientes')) {
            cards.innerHTML += `
                <div class="admin-card-loja">
                    <div class="admin-card-loja-icon purple"><i class="fas fa-users"></i></div>
                    <h3 id="statClientes">${stats.totalClientes}</h3>
                    <p>Clientes</p>
                </div>
                <div class="admin-card-loja">
                    <div class="admin-card-loja-icon teal"><i class="fas fa-shopping-cart"></i></div>
                    <h3 id="statPedidos">${stats.totalPedidos}</h3>
                    <p>Pedidos</p>
                </div>
            `;
        }
    } catch (err) {
        console.error(err);
    }
}

carregarEstatisticas();
