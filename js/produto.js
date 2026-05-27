let produtoAtual = null;
let quantidade = 1;
const API_BASE = '';

function getParametroUrl(param) {
    const params = new URLSearchParams(window.location.search);
    return params.get(param);
}

async function carregarProduto() {
    const id = parseInt(getParametroUrl('id'));
    if (!id) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/loja/produtos/${id}`);
        if (!res.ok) throw new Error('Produto não encontrado');
        const data = await res.json();
        produtoAtual = data.produto;
        produtoAtual.imagens = data.imagens || [];
        renderizarProduto(produtoAtual);
        renderizarRecomendados(data.relacionados);
    } catch (err) {
        console.error('ERRO ao carregar produto:', err);
        alert('Erro ao carregar produto: ' + err.message);
    }
}

function renderizarProduto(p) {
    try {
        document.title = `${p.nome} - TechShop`;

        const preco = parseFloat(p.preco) || 0;
        const precoAntigo = parseFloat(p.preco_antigo) || 0;
        const desconto = calcularDesconto(preco, precoAntigo);
        const parcela = preco / (p.parcelas || 1);
        const precoPix = preco * 0.9;

        const imgPrincipal = document.getElementById('produto-imagem-principal');
        if (imgPrincipal) {
            imgPrincipal.src = p.imagem || 'images/placeholder.svg';
            imgPrincipal.alt = p.nome;
        }
        const elNome = document.getElementById('produto-nome');
        if (elNome) elNome.textContent = p.nome;
        const elCodigo = document.getElementById('produto-codigo');
        if (elCodigo) elCodigo.textContent = `Cód.: ${p.codigo || p.codigo_interno || ''}`;
        const elPreco = document.getElementById('produto-preco');
        if (elPreco) elPreco.textContent = formatarPreco(preco);
        const elAvista = document.getElementById('produto-avista');
        if (elAvista) elAvista.textContent = `ou ${formatarPreco(precoPix)} à vista no PIX (10% de desconto)`;
        const elDescricao = document.getElementById('produto-descricao');
        if (elDescricao) elDescricao.textContent = p.descricao || '';

        const precoAntigoEl = document.getElementById('produto-preco-antigo');
        if (precoAntigoEl) {
            if (precoAntigo > preco) {
                precoAntigoEl.textContent = formatarPreco(precoAntigo);
                precoAntigoEl.style.display = 'inline';
            } else {
                precoAntigoEl.style.display = 'none';
            }
        }

        const descontoEl = document.getElementById('produto-desconto');
        if (descontoEl) {
            if (desconto > 0) {
                descontoEl.textContent = `-${desconto}%`;
                descontoEl.style.display = 'inline-flex';
            } else {
                descontoEl.style.display = 'none';
            }
        }

        // Parcelas
        const parcelasEl = document.getElementById('produto-parcelas');
        const parcela7El = document.getElementById('produto-parcela-7');
        let htmlParcelas = '';
        htmlParcelas += `<li class="destaque">💵 ${formatarPreco(precoPix)} no PIX (10% de desconto)</li>`;
        const parcelasMostrar = Math.min(p.parcelas || 1, 12);
        for (let i = 2; i <= parcelasMostrar; i++) {
            const valorParcela = preco / i;
            htmlParcelas += `<li>💳 ${i}x de ${formatarPreco(valorParcela)} sem juros</li>`;
        }
        if (parcelasEl) parcelasEl.innerHTML = htmlParcelas;
        if (parcela7El) {
            const parcela7 = preco / 7;
            parcela7El.textContent = formatarPreco(parcela7);
        }

        // Ficha Técnica
        const fichaEl = document.getElementById('produto-ficha-tecnica');
        const fichaGrid = document.getElementById('produto-ficha-grid');
        const fichaItens = [];
        const labelsUsados = new Set();

        // Parser da descricao_tecnica
        function parseDescricaoTecnica(texto) {
            if (!texto) return [];
            let t = texto.replace(/: :/g, '::').trim();
            const itens = [];
            if (t.includes('\n')) {
                const linhas = t.split(/\r?\n/);
                for (const linha of linhas) {
                    const m = linha.match(/^\s*(.+?)\s*::\s*(.+?)\s*$/);
                    if (m) {
                        itens.push({ label: m[1].trim(), valor: m[2].trim() });
                    }
                }
                return itens;
            }
            const partes = t.split('::');
            if (partes.length < 2) return [];
            let labelAtual = partes[0].trim();
            for (let i = 1; i < partes.length; i++) {
                const parte = partes[i];
                if (i === partes.length - 1) {
                    itens.push({ label: labelAtual, valor: parte.trim() });
                } else {
                    const match = parte.match(/(.+?)\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ0-9\s\(\)\/\-\.]+)/);
                    if (match) {
                        itens.push({ label: labelAtual, valor: match[1].trim() });
                        labelAtual = match[2].trim();
                    } else {
                        itens.push({ label: labelAtual, valor: parte.trim() });
                        labelAtual = '';
                    }
                }
            }
            return itens;
        }

        const parsed = parseDescricaoTecnica(p.descricao_tecnica);
        for (const item of parsed) {
            fichaItens.push(item);
            labelsUsados.add(item.label.toLowerCase());
        }

        if (p.garantia && !labelsUsados.has('garantia') && !labelsUsados.has('garantia (mês)')) {
            fichaItens.push({ label: 'Garantia', valor: `${p.garantia} meses` });
        }
        if (p.peso_bruto && !labelsUsados.has('peso bruto')) {
            fichaItens.push({ label: 'Peso Bruto', valor: `${p.peso_bruto} kg` });
        }
        if ((p.altura || p.largura || p.comprimento) && !labelsUsados.has('dimensões') && !labelsUsados.has('altura (cm)')) {
            const dim = [];
            if (p.altura) dim.push(`Altura: ${p.altura}cm`);
            if (p.largura) dim.push(`Largura: ${p.largura}cm`);
            if (p.comprimento) dim.push(`Comprimento: ${p.comprimento}cm`);
            fichaItens.push({ label: 'Dimensões', valor: dim.join(' | ') });
        }
        if (p.ncm && !labelsUsados.has('ncm')) {
            fichaItens.push({ label: 'NCM', valor: p.ncm });
        }
        if (p.codigo_barras && !labelsUsados.has('código de barras')) {
            fichaItens.push({ label: 'Código de Barras', valor: p.codigo_barras });
        }
        if (p.codigo_interno && !labelsUsados.has('código interno')) {
            fichaItens.push({ label: 'Código Interno', valor: p.codigo_interno });
        }
        if (p.categoria_nome && !labelsUsados.has('categoria')) {
            fichaItens.push({ label: 'Categoria', valor: p.categoria_nome });
        }

        // Remove duplicatas por label (mantém a primeira ocorrência)
        const fichaUnica = [];
        const labelsVistos = new Set();
        for (const item of fichaItens) {
            const key = item.label.toLowerCase().trim();
            if (!labelsVistos.has(key)) {
                labelsVistos.add(key);
                fichaUnica.push(item);
            }
        }

        if (fichaUnica.length > 0 && fichaGrid && fichaEl) {
            fichaGrid.innerHTML = fichaUnica.map(item => `
                <div class="produto-ficha-item">
                    <span class="produto-ficha-label">${item.label}</span>
                    <span class="produto-ficha-valor">${item.valor}</span>
                </div>
            `).join('');
            fichaEl.style.display = 'block';
        } else if (fichaEl) {
            fichaEl.style.display = 'none';
        }

        // Miniaturas
        const miniaturasEl = document.getElementById('produto-miniaturas');
        if (miniaturasEl) {
            const imagens = p.imagens && p.imagens.length > 0 ? p.imagens.map(img => img.url) : [p.imagem];
            while (imagens.length < 3) { imagens.push(imagens[imagens.length - 1] || 'images/placeholder.svg'); }
            miniaturasEl.innerHTML = imagens.slice(0, 3).map((url, idx) => `
                <img src="${url || 'images/placeholder.svg'}" class="miniatura ${idx === 0 ? 'ativa' : ''}" onclick="trocarImagem(this, '${url || 'images/placeholder.svg'}')" alt="${p.nome}">
            `).join('');
        }
    } catch (err) {
        console.error('ERRO em renderizarProduto:', err);
    }
}

function trocarImagem(el, src) {
    document.getElementById('produto-imagem-principal').src = src;
    document.querySelectorAll('.miniatura').forEach(m => m.classList.remove('ativa'));
    el.classList.add('ativa');
}

function initZoomPan() {
    const container = document.getElementById('produto-imagem-container');
    const img = document.getElementById('produto-imagem-principal');
    if (!container || !img) return;

    container.addEventListener('click', (e) => {
        const isZoom = container.classList.toggle('zoom-ativo');
        if (isZoom) {
            const rect = container.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            img.style.transformOrigin = `${x}% ${y}%`;
        } else {
            img.style.transformOrigin = 'center center';
        }
    });

    container.addEventListener('mousemove', (e) => {
        if (!container.classList.contains('zoom-ativo')) return;
        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
    });
}

function toggleParcelas() {
    const box = document.getElementById('produto-parcelas-box');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function alterarQtd(delta) {
    const input = document.getElementById('quantidade');
    let novaQtd = parseInt(input.value) + delta;
    if (novaQtd < 1) novaQtd = 1;
    if (novaQtd > 10) novaQtd = 10;
    input.value = novaQtd;
    quantidade = novaQtd;
}

function adicionarAoCarrinhoDetalhe() {
    if (produtoAtual) {
        carrinho.adicionar(produtoAtual, quantidade);
    }
}

function comprarAgora() {
    if (produtoAtual) {
        carrinho.adicionar(produtoAtual, quantidade);
        carrinho.toggle();
    }
}

function renderizarRecomendados(recomendados) {
    const grid = document.getElementById('recomendados-grid');
    if (!grid) return;

    if (!recomendados || recomendados.length === 0) {
        grid.innerHTML = '<p style="color: var(--cor-texto-muted); text-align: center;">Nenhum produto relacionado encontrado.</p>';
        return;
    }

    grid.innerHTML = recomendados.map(p => {
        const preco = parseFloat(p.preco) || 0;
        const precoAntigo = parseFloat(p.preco_antigo) || 0;
        return `
            <div class="card-produto" onclick="window.location.href='produto.html?id=${p.id}'">
                <div class="card-imagem-container">
                    <img src="${p.imagem || 'images/placeholder.svg'}" alt="${p.nome}" class="card-imagem" loading="lazy">
                </div>
                <div class="card-info">
                    <div class="card-nome">${p.nome}</div>
                    <div class="card-precos">
                        <div class="card-preco">${formatarPreco(preco)}</div>
                        ${precoAntigo > preco ? `<div class="card-preco-antigo">${formatarPreco(precoAntigo)}</div>` : ''}
                    </div>
                    <div class="card-parcela">${p.parcelas}x de ${formatarPreco(preco / p.parcelas)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderizarRecomendadosFallback() {
    if (!produtoAtual || !window.produtos) return;
    const recomendados = window.produtos
        .filter(p => p.categoria === produtoAtual.categoria && p.id !== produtoAtual.id)
        .slice(0, 5);
    renderizarRecomendados(recomendados);
}

function initBuscaProduto() {
    const input = document.querySelector('.busca-input');
    if (!input) return;

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const termo = input.value.trim();
            if (termo) {
                window.location.href = `index.html?busca=${encodeURIComponent(termo)}`;
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    carregarProduto();
    initBuscaProduto();
    initZoomPan();
    Mascaras.aplicar(document.getElementById('frete-input'), 'cep');

    document.querySelector('.btn-carrinho')?.addEventListener('click', () => carrinho.toggle());
    document.querySelector('.carrinho-fechar')?.addEventListener('click', () => carrinho.fechar());
    document.querySelector('.carrinho-overlay')?.addEventListener('click', () => carrinho.fechar());
});
