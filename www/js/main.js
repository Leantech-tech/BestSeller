const API_BASE = '';
let carrosselIndex = 0;
let carrosselInterval;
let categoriaAtiva = 'todos';
let categoriasData = [];
let produtosData = [];
let filtrosCarrossel = (function() {
    try {
        const saved = localStorage.getItem('araca_filtros_carrossel');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
        return new Set();
    }
})();
let slidesAtuais = [];

function iniciarCarrossel() {
    carrosselInterval = setInterval(() => {
        if (slidesAtuais.length > 1) {
            irParaSlide((carrosselIndex + 1) % slidesAtuais.length);
        }
    }, 5000);
}

function irParaSlide(index) {
    carrosselIndex = index;
    const inner = document.querySelector('.carrossel-inner');
    if (inner) {
        inner.style.transform = `translateX(-${index * 100}%)`;
    }
    document.querySelectorAll('.indicador').forEach((ind, i) => {
        ind.classList.toggle('ativo', i === index);
    });
}

async function carregarDadosLoja() {
    try {
        // Buscar categorias
        const resCat = await fetch(`${API_BASE}/api/loja/categorias`);
        if (resCat.ok) categoriasData = await resCat.json();
    } catch (e) {
        console.warn('Falha ao carregar categorias da API, usando fallback', e);
        categoriasData = window.categorias || [];
    }

    try {
        // Buscar produtos
        const params = new URLSearchParams(window.location.search);
        const busca = params.get('busca');
        const url = `${API_BASE}/api/loja/produtos${busca ? '?busca=' + encodeURIComponent(busca) : ''}`;
        const resProd = await fetch(url);
        if (resProd.ok) produtosData = await resProd.json();
    } catch (e) {
        console.warn('Falha ao carregar produtos da API, usando fallback', e);
        produtosData = window.produtos || [];
    }

    renderizarCategorias();
    renderizarProdutos();
    atualizarCarrossel();
}

function renderizarCategorias() {
    const lista = document.querySelector('.categoria-lista');
    if (!lista) return;

    lista.innerHTML = categoriasData.map(cat => `
        <li class="categoria-item">
            <button class="categoria-link ${cat.id === categoriaAtiva || cat.slug === categoriaAtiva ? 'ativo' : ''}" onclick="selecionarCategoria('${cat.slug || cat.id}')">
                <i class="${cat.icone || 'fas fa-tag'} categoria-icone"></i>
                <span>${cat.nome}</span>
            </button>
        </li>
    `).join('');
}

function selecionarCategoria(id) {
    categoriaAtiva = id;
    renderizarCategorias();
    renderizarProdutos();
}

function toggleFiltro(checkbox) {
    const valor = checkbox.value;
    if (checkbox.checked) {
        filtrosCarrossel.add(valor);
    } else {
        filtrosCarrossel.delete(valor);
    }
    try {
        localStorage.setItem('araca_filtros_carrossel', JSON.stringify([...filtrosCarrossel]));
    } catch (e) {
        console.warn('Erro ao salvar filtros no localStorage:', e);
    }
    atualizarCarrossel();
}

function atualizarCarrossel() {
    const inner = document.querySelector('.carrossel-inner');
    const indicadores = document.querySelector('.carrossel-indicadores');
    if (!inner || !indicadores) return;

    let novosSlides = [];

    if (filtrosCarrossel.size > 0 && produtosData.length > 0) {
        // Filtra produtos baseado nos checkboxes
        const produtosFiltrados = produtosData.filter(p => {
            if (filtrosCarrossel.has('destaque') && p.destaque) return true;
            if (filtrosCarrossel.has('lancamento') && p.lancamento) return true;
            if (filtrosCarrossel.has('mais_vendido') && p.mais_vendido) return true;
            return false;
        });

        novosSlides = produtosFiltrados.map(p => ({
            imagem: p.imagem || 'images/placeholder.svg',
            titulo: p.nome,
            subtitulo: formatarPreco(parseFloat(p.preco)),
            produtoId: p.id
        }));
    }

    // Se não há filtros ou nenhum produto corresponde, usa os slides padrão (banners)
    if (novosSlides.length === 0) {
        novosSlides = window.slides || [];
    }

    slidesAtuais = novosSlides;

    inner.innerHTML = slidesAtuais.map(slide => `
        <div class="carrossel-slide ${slide.produtoId ? 'carrossel-slide-produto' : ''}" ${slide.produtoId ? `onclick="verProduto(${slide.produtoId})" style="cursor:pointer;"` : ''}>
            <img src="${slide.imagem}" alt="${slide.titulo}">
            <div class="carrossel-conteudo">
                <h2>${slide.titulo}</h2>
                <p>${slide.subtitulo}</p>
            </div>
        </div>
    `).join('');

    indicadores.innerHTML = slidesAtuais.map((_, i) => `
        <button class="indicador ${i === 0 ? 'ativo' : ''}" onclick="irParaSlide(${i})"></button>
    `).join('');

    // Reinicia o carrossel
    carrosselIndex = 0;
    clearInterval(carrosselInterval);
    irParaSlide(0);
    if (slidesAtuais.length > 1) {
        iniciarCarrossel();
    }
}

function renderizarProdutos() {
    const grid = document.querySelector('.produtos-grid');
    const contador = document.querySelector('.produtos-contador');
    const titulo = document.querySelector('.produtos-header h1');
    if (!grid) return;

    let filtrados = produtosData;

    if (categoriaAtiva !== 'todos') {
        filtrados = filtrados.filter(p => p.categoria === categoriaAtiva);
    }



    if (titulo) {
        const cat = categoriasData.find(c => (c.slug || c.id) === categoriaAtiva);
        titulo.innerHTML = cat ? `${cat.nome} <span>(${filtrados.length})</span>` : `Produtos <span>(${filtrados.length})</span>`;
    }

    if (contador) {
        contador.textContent = `${filtrados.length} produto${filtrados.length !== 1 ? 's' : ''} encontrado${filtrados.length !== 1 ? 's' : ''}`;
    }

    if (filtrados.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--cor-texto-muted);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                <h3 style="margin-bottom: 0.5rem; color: var(--cor-texto);">Nenhum produto encontrado</h3>
                <p>Tente buscar por outro termo ou categoria</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtrados.map(p => {
        const desconto = calcularDesconto(p.preco, p.preco_antigo);
        const cat = categoriasData.find(c => (c.slug || c.id) === p.categoria);
        return `
            <div class="card-produto" onclick="verProduto(${p.id})">
                <div class="card-imagem-container">
                    <img src="${p.imagem || 'images/placeholder.svg'}" alt="${p.nome}" class="card-imagem" loading="lazy">
                </div>
                <div class="card-info">
                    <div class="card-categoria">${cat ? cat.nome : p.categoria}</div>
                    <div class="card-nome">${p.nome}</div>
                    <div class="card-precos">
                        <div class="card-preco">${formatarPreco(parseFloat(p.preco))}</div>
                        ${p.preco_antigo > p.preco ? `<div class="card-preco-antigo">${formatarPreco(parseFloat(p.preco_antigo))}</div>` : ''}
                    </div>
                    <div class="card-parcela">${p.parcelas}x de ${formatarPreco(parseFloat(p.preco) / p.parcelas)} sem juros</div>
                    <button class="card-btn" onclick="event.stopPropagation(); adicionarAoCarrinho(${p.id})">
                        Adicionar ao Carrinho
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function adicionarAoCarrinho(id) {
    const produto = produtosData.find(p => p.id == id);
    if (produto) {
        carrinho.adicionar(produto);
    }
}

function verProduto(id) {
    window.location.href = `produto.html?id=${id}`;
}

function atualizarLogoEmpresa() {
    try {
        const usuario = localStorage.getItem('araca_admin_usuario');
        if (usuario === 'suporte') return;
        const raw = localStorage.getItem('araca_empresa_logada');
        if (!raw) return;
        const empresa = JSON.parse(raw);
        if (!empresa) return;
        const logoContainers = document.querySelectorAll('.logo-brand-text');
        logoContainers.forEach(container => {
            if (empresa.logo_url) {
                container.innerHTML = `<img src="${empresa.logo_url}" alt="${empresa.nome_fantasia}" style="max-height:40px; max-width:140px; object-fit:contain; display:block;">`;
            } else {
                container.innerHTML = `<span class="logo-fallback-titulo">${empresa.nome_fantasia}</span>`;
            }
        });
        if (empresa.cor_primaria) {
            document.documentElement.style.setProperty('--cor-primaria', empresa.cor_primaria);
        }
        if (empresa.cor_secundaria) {
            document.documentElement.style.setProperty('--cor-secundaria', empresa.cor_secundaria);
        }
    } catch (e) {
        console.warn('Erro ao atualizar logo da empresa:', e);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('araca_empresa_logada')) {
        try {
            const res = await fetch(`${API_BASE}/api/loja/empresa-por-slug/leantech`);
            if (res.ok) {
                const empresa = await res.json();
                localStorage.setItem('araca_empresa_logada', JSON.stringify(empresa));
                atualizarLogoEmpresa();
            }
        } catch (e) {
            console.warn('Erro ao carregar empresa padrão:', e);
        }
    }
    initCarrossel();
    carregarDadosLoja();
});

function initCarrossel() {
    // Restaurar estado visual dos checkboxes
    document.querySelectorAll('.produtos-filtros input[type="checkbox"]').forEach(cb => {
        cb.checked = filtrosCarrossel.has(cb.value);
    });
    atualizarCarrossel();
}
