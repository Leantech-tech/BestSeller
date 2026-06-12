class Carrinho {
    constructor() {
        this.itens = JSON.parse(localStorage.getItem('carrinho')) || [];
        this.atualizarUI();
    }

    salvar() {
        localStorage.setItem('carrinho', JSON.stringify(this.itens));
        this.atualizarUI();
        this.renderizarPagina();
    }

    adicionar(produto, quantidade = 1) {
        const existente = this.itens.find(item => item.id === produto.id);
        if (existente) {
            existente.quantidade += quantidade;
        } else {
            this.itens.push({
                id: produto.id,
                nome: produto.nome,
                preco: produto.preco,
                imagem: produto.imagem,
                quantidade: quantidade
            });
        }
        this.salvar();
        this.mostrarToast(`${produto.nome} adicionado ao carrinho!`);
    }

    remover(id) {
        this.itens = this.itens.filter(item => item.id !== id);
        this.salvar();
    }

    alterarQuantidade(id, delta) {
        const item = this.itens.find(item => item.id === id);
        if (item) {
            item.quantidade += delta;
            if (item.quantidade <= 0) {
                this.remover(id);
            } else {
                this.salvar();
            }
        }
    }

    getTotal() {
        return this.itens.reduce((total, item) => total + (item.preco * item.quantidade), 0);
    }

    getQuantidadeTotal() {
        return this.itens.reduce((total, item) => total + item.quantidade, 0);
    }

    limpar() {
        this.itens = [];
        localStorage.removeItem('carrinho');
        this.atualizarUI();
        this.renderizarPagina();
    }

    atualizarUI() {
        const contador = document.querySelector('.carrinho-contador');
        if (contador) {
            const qtd = this.getQuantidadeTotal();
            contador.textContent = qtd;
            contador.style.display = qtd > 0 ? 'flex' : 'none';
        }
        this.renderizarDrawer();
    }

    renderizarDrawer() {
        const container = document.querySelector('.carrinho-itens');
        if (!container) return;

        if (this.itens.length === 0) {
            container.innerHTML = `
                <div class="carrinho-vazio">
                    <div class="carrinho-vazio-icon">🛒</div>
                    <p>Seu carrinho está vazio</p>
                    <p style="font-size: 0.85rem; margin-top: 0.5rem;">Adicione produtos para começar a comprar</p>
                </div>
            `;
        } else {
            container.innerHTML = this.itens.map(item => `
                <div class="carrinho-item">
                    <img src="${item.imagem}" alt="${item.nome}" class="carrinho-item-imagem">
                    <div class="carrinho-item-info">
                        <div class="carrinho-item-nome">${item.nome}</div>
                        <div class="carrinho-item-preco">${this.formatarPreco(item.preco * item.quantidade)}</div>
                        <div class="carrinho-item-acoes">
                            <button class="carrinho-item-qtd-btn" onclick="carrinho.alterarQuantidade(${item.id}, -1)">−</button>
                            <span style="font-size: 0.9rem; min-width: 20px; text-align: center;">${item.quantidade}</span>
                            <button class="carrinho-item-qtd-btn" onclick="carrinho.alterarQuantidade(${item.id}, 1)">+</button>
                            <button class="carrinho-item-remover" onclick="carrinho.remover(${item.id})">Remover</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        const totalEl = document.querySelector('.carrinho-total-valor');
        if (totalEl) {
            totalEl.textContent = this.formatarPreco(this.getTotal());
        }
    }

    formatarPreco(valor) {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    mostrarToast(mensagem) {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast toast-sucesso';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<span>✅</span> ${mensagem}`;
        toast.classList.add('visivel');
        setTimeout(() => toast.classList.remove('visivel'), 2500);
    }

    toggle() {
        const drawer = document.querySelector('.carrinho-drawer');
        const overlay = document.querySelector('.carrinho-overlay');
        if (drawer && overlay) {
            drawer.classList.toggle('aberto');
            overlay.classList.toggle('ativo');
        }
    }

    fechar() {
        const drawer = document.querySelector('.carrinho-drawer');
        const overlay = document.querySelector('.carrinho-overlay');
        if (drawer && overlay) {
            drawer.classList.remove('aberto');
            overlay.classList.remove('ativo');
        }
    }

    renderizarPagina() {
        const container = document.getElementById('carrinho-pagina-itens');
        if (!container) return;

        if (this.itens.length === 0) {
            container.innerHTML = `
                <div class="carrinho-pagina-vazio">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">🛒</div>
                    <h2>Seu carrinho está vazio</h2>
                    <p>Adicione produtos para começar a comprar</p>
                    <a href="index.html" class="carrinho-finalizar" style="display: inline-block; text-decoration: none; margin-top: 1.5rem;">Ir para a Loja</a>
                </div>
            `;
        } else {
            container.innerHTML = this.itens.map(item => `
                <div class="carrinho-pagina-item">
                    <img src="${item.imagem}" alt="${item.nome}" class="carrinho-pagina-item-imagem">
                    <div class="carrinho-pagina-item-info">
                        <div class="carrinho-pagina-item-nome">${item.nome}</div>
                        <div class="carrinho-pagina-item-preco-unit">Unitário: ${this.formatarPreco(item.preco)}</div>
                    </div>
                    <div class="carrinho-pagina-item-qtd">
                        <button class="carrinho-item-qtd-btn" onclick="carrinho.alterarQuantidade(${item.id}, -1)">−</button>
                        <span>${item.quantidade}</span>
                        <button class="carrinho-item-qtd-btn" onclick="carrinho.alterarQuantidade(${item.id}, 1)">+</button>
                    </div>
                    <div class="carrinho-pagina-item-subtotal">
                        ${this.formatarPreco(item.preco * item.quantidade)}
                    </div>
                    <button class="carrinho-item-remover" onclick="carrinho.remover(${item.id})" style="margin-left: 0;">Remover</button>
                </div>
            `).join('');
        }

        const subtotalEl = document.getElementById('resumo-subtotal');
        const totalEl = document.getElementById('resumo-total');
        if (subtotalEl) subtotalEl.textContent = this.formatarPreco(this.getTotal());
        if (totalEl) totalEl.textContent = this.formatarPreco(this.getTotal());
    }
}

const carrinho = new Carrinho();

// ============================================================
// MODAL DE CHECKOUT / FINALIZAR COMPRA
// ============================================================

function criarModalCheckout() {
    if (document.getElementById('modalCheckout')) return;

    const overlay = document.createElement('div');
    overlay.id = 'modalCheckout';
    overlay.className = 'modal-checkout-overlay';
    overlay.innerHTML = `
        <div class="modal-checkout">
            <div class="modal-checkout-header">
                <h3><i class="fab fa-whatsapp" style="color:#25d366;"></i> Finalizar Compra</h3>
                <button class="modal-checkout-close" onclick="fecharModalCheckout()">&times;</button>
            </div>
            <div class="modal-checkout-body">
                <div class="checkout-resumo">
                    <h4>Resumo do Pedido</h4>
                    <div id="checkout-itens"></div>
                    <div class="checkout-total" id="checkout-total"></div>
                </div>
                <div class="checkout-pagamento">
                    <h4>Forma de Pagamento</h4>
                    <div id="checkout-formas-pagamento" class="checkout-formas-lista">
                        <p style="color:var(--cor-texto-muted);">Carregando...</p>
                    </div>
                    <div id="checkout-parcelas-container" style="margin-top: 1.25rem; display: none;">
                        <label for="checkout-parcelas" style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.4rem; color: var(--cor-texto);">Selecione o parcelamento:</label>
                        <select id="checkout-parcelas" style="width: 100%; padding: 0.6rem; border: 1px solid var(--slate-300); border-radius: 8px; font-size: 0.95rem; background-color: white; color: var(--slate-800);"></select>
                    </div>
                </div>
            </div>
            <div class="modal-checkout-footer">
                <button class="btn-checkout-cancelar" onclick="fecharModalCheckout()">Cancelar</button>
                <button class="btn-checkout-whatsapp" id="btnEnviarWhatsApp" onclick="enviarPedidoWhatsApp()" disabled>
                    <i class="fab fa-whatsapp"></i> Enviar Pedido
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function abrirModalCheckout() {
    criarModalCheckout();
    const overlay = document.getElementById('modalCheckout');
    overlay.classList.add('active');
    renderizarCheckoutResumo();
    carregarFormasPagamento();
}

function fecharModalCheckout() {
    const overlay = document.getElementById('modalCheckout');
    if (overlay) overlay.classList.remove('active');
}

function renderizarCheckoutResumo() {
    const container = document.getElementById('checkout-itens');
    const totalEl = document.getElementById('checkout-total');
    if (!container || !totalEl) return;

    if (carrinho.itens.length === 0) {
        container.innerHTML = '<p>Carrinho vazio</p>';
        totalEl.textContent = '';
        return;
    }

    container.innerHTML = carrinho.itens.map(item => `
        <div class="checkout-item">
            <span class="checkout-item-nome">${item.nome}</span>
            <span class="checkout-item-qtd">${item.quantidade}x</span>
            <span class="checkout-item-preco">${carrinho.formatarPreco(item.preco * item.quantidade)}</span>
        </div>
    `).join('');

    totalEl.innerHTML = `<strong>Total:</strong> ${carrinho.formatarPreco(carrinho.getTotal())}`;
}

let formaPagamentoSelecionada = null;

async function carregarFormasPagamento() {
    const container = document.getElementById('checkout-formas-pagamento');
    if (!container) return;

    try {
        const res = await fetch('/api/formas-pagamento');
        const formas = await res.json();
        const ativas = formas.filter(f => f.ativo);

        if (ativas.length === 0) {
            container.innerHTML = '<p style="color:var(--cor-texto-muted);">Nenhuma forma de pagamento disponível.</p>';
            return;
        }

        container.innerHTML = ativas.map((f, idx) => `
            <label class="checkout-forma-item ${idx === 0 ? 'selecionada' : ''}" data-id="${f.id}" data-descricao="${f.descricao}" data-parcelas-max="${f.parcelas_max || 1}" onclick="selecionarFormaPagamento(this)">
                <input type="radio" name="forma_pagamento" value="${f.id}" ${idx === 0 ? 'checked' : ''}>
                <span class="checkout-forma-icone">${iconePagamento(f.tipo)}</span>
                <span class="checkout-forma-texto">${f.descricao}</span>
            </label>
        `).join('');

        // Seleciona a primeira por padrão
        const primeira = container.querySelector('.checkout-forma-item');
        if (primeira) selecionarFormaPagamento(primeira);

    } catch (e) {
        container.innerHTML = '<p style="color:#ef4444;">Erro ao carregar formas de pagamento.</p>';
    }
}

function iconePagamento(tipo) {
    const map = {
        'pix': '<i class="fas fa-qrcode"></i>',
        'cartao_credito': '<i class="fas fa-credit-card"></i>',
        'cartao_debito': '<i class="fas fa-credit-card"></i>',
        'boleto': '<i class="fas fa-barcode"></i>',
        'dinheiro': '<i class="fas fa-money-bill-wave"></i>'
    };
    return map[tipo] || '<i class="fas fa-wallet"></i>';
}

function selecionarFormaPagamento(el) {
    document.querySelectorAll('.checkout-forma-item').forEach(item => item.classList.remove('selecionada'));
    el.classList.add('selecionada');
    el.querySelector('input[type="radio"]').checked = true;

    const parcelasMax = parseInt(el.dataset.parcelasMax) || 1;
    formaPagamentoSelecionada = {
        id: el.dataset.id,
        descricao: el.dataset.descricao,
        parcelasMax: parcelasMax
    };

    const container = document.getElementById('checkout-parcelas-container');
    const select = document.getElementById('checkout-parcelas');
    if (container && select) {
        if (parcelasMax > 1) {
            let options = '';
            const total = carrinho.getTotal();
            for (let i = 1; i <= parcelasMax; i++) {
                const valorParcela = total / i;
                options += `<option value="${i}">${i}x de ${carrinho.formatarPreco(valorParcela)} sem juros</option>`;
            }
            select.innerHTML = options;
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
            select.innerHTML = '';
        }
    }

    const btn = document.getElementById('btnEnviarWhatsApp');
    if (btn) btn.disabled = false;
}

async function enviarPedidoWhatsApp() {
    if (!formaPagamentoSelecionada || carrinho.itens.length === 0) return;

    try {
        // Buscar primeiro cliente da empresa
        const resClientes = await fetch('/api/clientes');
        const clientes = await resClientes.json();
        const clienteId = clientes.length > 0 ? clientes[0].id : null;

        // Obter parcelas selecionadas
        const selectParcelas = document.getElementById('checkout-parcelas');
        const parcelasEscolhidas = (formaPagamentoSelecionada.parcelasMax > 1 && selectParcelas) ? parseInt(selectParcelas.value) : 1;

        // Montar itens do pedido
        const itens = carrinho.itens.map(item => ({
            produto_id: item.id,
            nome: item.nome,
            quantidade: item.quantidade,
            preco_unitario: item.preco,
            total: item.preco * item.quantidade
        }));

        // Criar pedido no backend
        const resPedido = await fetch('/api/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cliente_id: clienteId,
                forma_pagamento_id: formaPagamentoSelecionada.id,
                parcelas: parcelasEscolhidas,
                itens: itens
            })
        });

        if (!resPedido.ok) {
            throw new Error('Erro ao criar pedido');
        }

        const numero = '5512988997924';

        let mensagem = '*Olá! Gostaria de finalizar minha compra:*\n\n';
        mensagem += '*Produtos:*\n';
        carrinho.itens.forEach(item => {
            mensagem += `• ${item.nome}\n  ${item.quantidade}x - ${carrinho.formatarPreco(item.preco * item.quantidade)}\n`;
        });
        mensagem += `\n*Total:* ${carrinho.formatarPreco(carrinho.getTotal())}\n`;
        mensagem += `\n*Forma de Pagamento:* ${formaPagamentoSelecionada.descricao}\n`;

        if (parcelasEscolhidas > 1) {
            const valorParcela = carrinho.getTotal() / parcelasEscolhidas;
            mensagem += `*Parcelamento:* ${parcelasEscolhidas}x de ${carrinho.formatarPreco(valorParcela)} sem juros\n`;
        } else {
            mensagem += `*Parcelamento:* À vista (1x)\n`;
        }

        const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
        window.open(url, '_blank');

        carrinho.limpar();
        fecharModalCheckout();
    } catch (err) {
        console.error(err);
        alert('Erro ao finalizar pedido. Tente novamente.');
    }
}

// Vincular botões "Finalizar Compra"
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.carrinho-finalizar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (carrinho.itens.length === 0) {
                alert('Seu carrinho está vazio!');
                return;
            }
            abrirModalCheckout();
        });
    });
});
