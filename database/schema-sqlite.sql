-- ============================================================
-- Araça Casa & Construção - Schema SQLite (desenvolvimento)
-- ============================================================

DROP TABLE IF EXISTS log_integracao;
DROP TABLE IF EXISTS carrinho;
DROP TABLE IF EXISTS contas_receber;
DROP TABLE IF EXISTS itens_pedido;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS enderecos;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS banners;
DROP TABLE IF EXISTS produto_imagens;
DROP TABLE IF EXISTS movimento_estoque;
DROP TABLE IF EXISTS produto_estoque;
DROP TABLE IF EXISTS produto_precos;
DROP TABLE IF EXISTS produtos;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS transportadoras;
DROP TABLE IF EXISTS fornecedores;
DROP TABLE IF EXISTS marcas;
DROP TABLE IF EXISTS depositos;
DROP TABLE IF EXISTS condicoes_pagamento;
DROP TABLE IF EXISTS formas_pagamento;
DROP TABLE IF EXISTS tabelas_preco;
DROP TABLE IF EXISTS status_pedido_cfg;
DROP TABLE IF EXISTS unidades_medida;
DROP TABLE IF EXISTS empresa_usuarios;
DROP TABLE IF EXISTS empresas;

-- ============================================================
-- 1. EMPRESAS
-- ============================================================
CREATE TABLE empresas (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid                TEXT DEFAULT (lower(hex(randomblob(16)))),
    slug                TEXT NOT NULL UNIQUE,
    razao_social        TEXT NOT NULL,
    nome_fantasia       TEXT NOT NULL,
    cnpj                TEXT,
    ie                  TEXT,
    im                  TEXT,
    email               TEXT NOT NULL,
    telefone            TEXT,
    whatsapp            TEXT,
    cep                 TEXT,
    logradouro          TEXT,
    numero              TEXT,
    complemento         TEXT,
    bairro              TEXT,
    cidade              TEXT,
    estado              TEXT,
    ibge_cidade         TEXT,
    logo_url            TEXT,
    favicon_url         TEXT,
    cor_primaria        TEXT DEFAULT '#1a6fc4',
    cor_secundaria      TEXT DEFAULT '#f5f5f5',
    tema_escuro         INTEGER DEFAULT 0,
    config              TEXT DEFAULT '{}',
    plano_id            INTEGER,
    data_ativacao       TEXT DEFAULT CURRENT_DATE,
    data_expiracao      TEXT,
    trial               INTEGER DEFAULT 1,
    trial_dias          INTEGER DEFAULT 14,
    status              TEXT DEFAULT 'ativo',
    motivo_suspensao    TEXT,
    responsavel_nome    TEXT,
    responsavel_email   TEXT,
    responsavel_cpf     TEXT,
    responsavel_telefone TEXT,
    created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_empresas_slug ON empresas(slug);
CREATE INDEX idx_empresas_status ON empresas(status);

-- ============================================================
-- 2. USUÁRIOS ADMIN
-- ============================================================
CREATE TABLE empresa_usuarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    nome            TEXT NOT NULL,
    email           TEXT NOT NULL,
    senha_hash      TEXT,
    perfil          TEXT DEFAULT 'operador',
    ativo           INTEGER DEFAULT 1,
    ultimo_acesso   TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- 3. UNIDADES DE MEDIDA (global)
-- ============================================================
CREATE TABLE unidades_medida (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo          TEXT NOT NULL UNIQUE,
    descricao       TEXT NOT NULL,
    permite_fracao  INTEGER DEFAULT 1,
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. STATUS DE PEDIDO
-- ============================================================
CREATE TABLE status_pedido_cfg (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    codigo          TEXT NOT NULL,
    descricao       TEXT NOT NULL,
    cor             TEXT DEFAULT '#666666',
    icone           TEXT,
    finaliza        INTEGER DEFAULT 0,
    cancela         INTEGER DEFAULT 0,
    envia_rp        INTEGER DEFAULT 0,
    ordem           INTEGER DEFAULT 0,
    ativo           INTEGER DEFAULT 1,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    UNIQUE(empresa_id, codigo)
);

-- ============================================================
-- 5. TABELAS DE PREÇO
-- ============================================================
CREATE TABLE tabelas_preco (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    codigo_erp      TEXT,
    descricao       TEXT NOT NULL,
    markup          REAL,
    padrao          INTEGER DEFAULT 0,
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- 6. FORMAS DE PAGAMENTO
-- ============================================================
CREATE TABLE formas_pagamento (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    codigo_erp      TEXT,
    descricao       TEXT NOT NULL,
    tipo            TEXT,
    parcelas_max    INTEGER DEFAULT 1,
    taxa_operacao   REAL DEFAULT 0,
    usa_gateway     INTEGER DEFAULT 0,
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- 7. CONDIÇÕES DE PAGAMENTO
-- ============================================================
CREATE TABLE condicoes_pagamento (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    codigo_erp      TEXT,
    descricao       TEXT NOT NULL,
    parcelas        INTEGER DEFAULT 1,
    dias_parcelas   TEXT DEFAULT '[0]',
    tipo            TEXT DEFAULT 'a_vista',
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- 8. DEPÓSITOS
-- ============================================================
CREATE TABLE depositos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    codigo_erp      TEXT,
    descricao       TEXT NOT NULL,
    endereco        TEXT,
    padrao          INTEGER DEFAULT 0,
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- 9. MARCAS
-- ============================================================
CREATE TABLE marcas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    nome            TEXT NOT NULL,
    codigo_erp      TEXT,
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- 10. FORNECEDORES
-- ============================================================
CREATE TABLE fornecedores (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    codigo_erp      TEXT,
    tipo_pessoa     TEXT DEFAULT 'J',
    razao_social    TEXT NOT NULL,
    nome_fantasia   TEXT,
    cnpj_cpf        TEXT,
    ie_rg           TEXT,
    telefone        TEXT,
    email           TEXT,
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- 11. TRANSPORTADORAS
-- ============================================================
CREATE TABLE transportadoras (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    codigo_erp      TEXT,
    razao_social    TEXT NOT NULL,
    nome_fantasia   TEXT,
    cnpj            TEXT,
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- 12. CATEGORIAS
-- ============================================================
CREATE TABLE categorias (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    codigo_erp      TEXT,
    slug            TEXT NOT NULL,
    nome            TEXT NOT NULL,
    descricao       TEXT,
    icone           TEXT,
    cor             TEXT DEFAULT '#1a6fc4',
    categoria_pai_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    ordem           INTEGER DEFAULT 0,
    nivel           INTEGER DEFAULT 0,
    caminho         TEXT,
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(empresa_id, slug)
);

CREATE INDEX idx_categorias_empresa ON categorias(empresa_id);
CREATE INDEX idx_categorias_pai ON categorias(categoria_pai_id);

-- ============================================================
-- 13. PRODUTOS
-- ============================================================
CREATE TABLE produtos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id          INTEGER NOT NULL,
    codigo_erp          TEXT,
    codigo_interno      TEXT NOT NULL,
    codigo_barras       TEXT,
    nome                TEXT NOT NULL,
    nome_reduzido       TEXT,
    descricao           TEXT,
    descricao_curta     TEXT,
    descricao_tecnica   TEXT,
    categoria_id        INTEGER NOT NULL,
    marca_id            INTEGER REFERENCES marcas(id) ON DELETE SET NULL,
    unidade_id          INTEGER REFERENCES unidades_medida(id) ON DELETE SET NULL,
    fornecedor_id       INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL,
    peso_bruto          REAL DEFAULT 0,
    altura              REAL DEFAULT 0,
    largura             REAL DEFAULT 0,
    comprimento         REAL DEFAULT 0,
    ncm                 TEXT,
    custo_reposicao     REAL DEFAULT 0,
    custo_medio         REAL DEFAULT 0,
    markup              REAL DEFAULT 1.80,
    controla_estoque    INTEGER DEFAULT 1,
    destaque            INTEGER DEFAULT 0,
    lancamento          INTEGER DEFAULT 0,
    mais_vendido        INTEGER DEFAULT 0,
    ativo               INTEGER DEFAULT 1,
    garantia            INTEGER,
    url_amigavel        TEXT,
    cfop_venda          TEXT DEFAULT '5102',
    cst_icms            TEXT DEFAULT '000',
    origem              TEXT DEFAULT '0',
    imagem              TEXT,
    created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
);

CREATE INDEX idx_produtos_empresa ON produtos(empresa_id);
CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_produtos_ativo ON produtos(ativo);

-- ============================================================
-- 14. PRODUTO PREÇOS
-- ============================================================
CREATE TABLE produto_precos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id          INTEGER NOT NULL,
    produto_id          INTEGER NOT NULL,
    tabela_id           INTEGER NOT NULL,
    preco               REAL DEFAULT 0,
    preco_promocional   REAL,
    ativo               INTEGER DEFAULT 1,
    updated_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
    FOREIGN KEY (tabela_id) REFERENCES tabelas_preco(id) ON DELETE CASCADE,
    UNIQUE(empresa_id, produto_id, tabela_id)
);

-- ============================================================
-- 15. PRODUTO ESTOQUE
-- ============================================================
CREATE TABLE produto_estoque (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id          INTEGER NOT NULL,
    produto_id          INTEGER NOT NULL,
    deposito_id         INTEGER NOT NULL,
    saldo_fisico        REAL DEFAULT 0,
    saldo_reservado     REAL DEFAULT 0,
    updated_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
    FOREIGN KEY (deposito_id) REFERENCES depositos(id) ON DELETE CASCADE,
    UNIQUE(empresa_id, produto_id, deposito_id)
);

-- ============================================================
-- 16. PRODUTO IMAGENS
-- ============================================================
CREATE TABLE produto_imagens (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    produto_id      INTEGER NOT NULL,
    imagem          TEXT NOT NULL,
    ordem           INTEGER DEFAULT 0,
    principal       INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
);

-- ============================================================
-- 17. BANNERS
-- ============================================================
CREATE TABLE banners (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    imagem          TEXT NOT NULL,
    imagem_mobile   TEXT,
    titulo          TEXT NOT NULL,
    subtitulo       TEXT,
    link            TEXT,
    ordem           INTEGER DEFAULT 0,
    ativo           INTEGER DEFAULT 1,
    data_inicio     TEXT,
    data_fim        TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- 18. CLIENTES
-- ============================================================
CREATE TABLE clientes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    tipo_pessoa     TEXT DEFAULT 'F',
    nome            TEXT NOT NULL,
    nome_fantasia   TEXT,
    cpf_cnpj        TEXT,
    rg_ie           TEXT,
    email           TEXT NOT NULL,
    telefone        TEXT,
    celular         TEXT,
    codigo_erp      TEXT,
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- 19. ENDEREÇOS
-- ============================================================
CREATE TABLE enderecos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    cliente_id      INTEGER NOT NULL,
    tipo            TEXT DEFAULT 'entrega',
    cep             TEXT NOT NULL,
    logradouro      TEXT NOT NULL,
    numero          TEXT,
    complemento     TEXT,
    bairro          TEXT,
    cidade          TEXT,
    estado          TEXT,
    ibge            TEXT,
    padrao          INTEGER DEFAULT 0,
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- ============================================================
-- 20. VENDEDORES (usuarios)
-- ============================================================
CREATE TABLE usuarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    codigo_erp      TEXT,
    nome            TEXT NOT NULL,
    email           TEXT NOT NULL,
    senha_hash      TEXT,
    perfil          TEXT DEFAULT 'vendedor',
    comissao_pct    REAL DEFAULT 0,
    ativo           INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- 21. PEDIDOS
-- ============================================================
CREATE TABLE pedidos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id          INTEGER NOT NULL,
    numero              TEXT NOT NULL,
    cliente_id          INTEGER NOT NULL,
    endereco_id         INTEGER,
    vendedor_id         INTEGER,
    transportadora_id   INTEGER,
    forma_pagamento_id  INTEGER,
    condicao_pagamento_id INTEGER,
    tabela_preco_id     INTEGER DEFAULT 1,
    status              TEXT DEFAULT 'pendente',
    obs                 TEXT,
    obs_interna         TEXT,
    subtotal            REAL DEFAULT 0,
    desconto            REAL DEFAULT 0,
    frete               REAL DEFAULT 0,
    total               REAL DEFAULT 0,
    created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (forma_pagamento_id) REFERENCES formas_pagamento(id) ON DELETE SET NULL
);

CREATE INDEX idx_pedidos_empresa ON pedidos(empresa_id);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_status ON pedidos(status);

-- ============================================================
-- 22. ITENS DO PEDIDO
-- ============================================================
CREATE TABLE itens_pedido (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    pedido_id       INTEGER NOT NULL,
    sequencia       INTEGER NOT NULL,
    produto_id      INTEGER NOT NULL,
    codigo_interno  TEXT,
    nome            TEXT NOT NULL,
    quantidade      REAL NOT NULL,
    unidade         TEXT,
    preco_unitario  REAL NOT NULL,
    desconto_pct    REAL DEFAULT 0,
    desconto_valor  REAL DEFAULT 0,
    total           REAL NOT NULL,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
);

-- ============================================================
-- 23. CONTAS A RECEBER
-- ============================================================
CREATE TABLE contas_receber (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id          INTEGER NOT NULL,
    pedido_id           INTEGER NOT NULL,
    parcela             INTEGER NOT NULL,
    valor               REAL NOT NULL,
    vencimento          TEXT,
    data_pagamento      TEXT,
    valor_pago          REAL DEFAULT 0,
    status              TEXT DEFAULT 'pendente',
    forma_pagamento_id  INTEGER,
    obs                 TEXT,
    created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
);

-- ============================================================
-- 24. CARRINHO
-- ============================================================
CREATE TABLE carrinho (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    sessao_id       TEXT NOT NULL,
    cliente_id      INTEGER,
    produto_id      INTEGER NOT NULL,
    quantidade      REAL NOT NULL,
    preco_unitario  REAL NOT NULL,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
);

-- ============================================================
-- 25. LOG DE INTEGRAÇÃO
-- ============================================================
CREATE TABLE log_integracao (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL,
    tipo            TEXT NOT NULL,
    modulo          TEXT,
    payload         TEXT,
    resposta        TEXT,
    sucesso         INTEGER DEFAULT 0,
    mensagem_erro   TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ============================================================
-- DADOS INICIAIS
-- ============================================================

INSERT INTO empresas (id, slug, razao_social, nome_fantasia, email, telefone, whatsapp,
    cep, logradouro, numero, bairro, cidade, estado, cnpj,
    cor_primaria, cor_secundaria, status)
VALUES (1, 'araca-demo', 'Araca Materiais de Construcao e Logistica', 'Araça Casa & Construção',
    'contato@araca.com.br', '(12) 3456-7890', '(12) 97407-0653',
    '11611-630', 'Rua Inácio de Carvalho', '17', 'Varadouro', 'São Sebastião', 'SP', '05.750.359/0001-08',
    '#1a6fc4', '#f5f5f5', 'ativo');

INSERT INTO unidades_medida (codigo, descricao, permite_fracao, ativo) VALUES
('UN', 'Unidade', 0, 1),
('KG', 'Quilograma', 1, 1),
('M', 'Metro', 1, 1),
('M2', 'Metro Quadrado', 1, 1),
('M3', 'Metro Cúbico', 1, 1),
('CX', 'Caixa', 0, 1),
('PC', 'Pacote', 0, 1),
('RL', 'Rolo', 1, 1),
('LT', 'Litro', 1, 1),
('PAR', 'Par', 0, 1),
('BD', 'Bidão', 0, 1),
('GL', 'Galão', 0, 1),
('SC', 'Saco', 0, 1),
('TB', 'Tubo', 1, 1),
('CH', 'Chapa', 1, 1),
('HR', 'Haste', 0, 1),
('MT', 'Metro Linear', 1, 1);

INSERT INTO status_pedido_cfg (empresa_id, codigo, descricao, cor, icone, finaliza, cancela, envia_rp, ordem, ativo) VALUES
(1, 'pendente', 'Pendente', '#f59e0b', 'fa-clock', 0, 0, 0, 1, 1),
(1, 'pago', 'Pago', '#10b981', 'fa-check-circle', 0, 0, 1, 2, 1),
(1, 'separacao', 'Em Separação', '#3b82f6', 'fa-boxes-stacked', 0, 0, 1, 3, 1),
(1, 'enviado', 'Enviado', '#6366f1', 'fa-truck-fast', 1, 0, 1, 4, 1),
(1, 'entregue', 'Entregue', '#22c55e', 'fa-house-check', 1, 0, 1, 5, 1),
(1, 'cancelado', 'Cancelado', '#ef4444', 'fa-ban', 0, 1, 0, 6, 1);

INSERT INTO tabelas_preco (empresa_id, codigo_erp, descricao, markup, padrao, ativo) VALUES
(1, '001', 'Varejo', 1.80, 1, 1),
(1, '002', 'Atacado', 1.40, 0, 1),
(1, '003', 'Promocional', 1.20, 0, 1);

INSERT INTO formas_pagamento (empresa_id, codigo_erp, descricao, tipo, parcelas_max, taxa_operacao, usa_gateway, ativo) VALUES
(1, '001', 'PIX', 'pix', 1, 0, 0, 1),
(1, '002', 'Cartão de Crédito', 'cartao_credito', 12, 3.5, 1, 1),
(1, '003', 'Cartão de Débito', 'cartao_debito', 1, 1.5, 1, 1),
(1, '004', 'Boleto Bancário', 'boleto', 1, 0, 0, 1),
(1, '005', 'Dinheiro', 'dinheiro', 1, 0, 0, 1);

INSERT INTO condicoes_pagamento (empresa_id, codigo_erp, descricao, parcelas, dias_parcelas, tipo, ativo) VALUES
(1, '001', 'À Vista', 1, '[0]', 'a_vista', 1),
(1, '002', '30 Dias', 1, '[30]', 'prazo', 1),
(1, '003', '30/60 Dias', 2, '[30,60]', 'prazo', 1),
(1, '004', '30/60/90 Dias', 3, '[30,60,90]', 'prazo', 1);

INSERT INTO depositos (empresa_id, codigo_erp, descricao, endereco, padrao, ativo) VALUES
(1, '01', 'Depósito Central', 'Rua Inácio de Carvalho, 17 - Varadouro, São Sebastião - SP', 1, 1),
(1, '02', 'Depósito Auxiliar', 'Av. da Praia, 100 - Centro, São Sebastião - SP', 0, 1);

INSERT INTO marcas (empresa_id, nome, codigo_erp, ativo) VALUES
(1, 'Deca', 'DECA001', 1),
(1, 'Coral', 'CORAL001', 1),
(1, 'Suvinil', 'SUV001', 1),
(1, 'Tramontina', 'TRAM001', 1),
(1, 'Vonder', 'VON001', 1),
(1, '3M', '3M001', 1),
(1, 'Stanley', 'STAN001', 1),
(1, 'Black & Decker', 'BD001', 1),
(1, 'Hydra', 'HYDRA001', 1),
(1, 'Lorenzetti', 'LOR001', 1);

INSERT INTO fornecedores (empresa_id, codigo_erp, tipo_pessoa, razao_social, nome_fantasia, cnpj_cpf, ie_rg, telefone, email, ativo) VALUES
(1, 'FOR001', 'J', 'Deca S.A.', 'Deca', '43.599.66/0001-02', '123456789', '(11) 4003-2121', 'vendas@deca.com.br', 1),
(1, 'FOR002', 'J', 'Coral Tintas Ltda', 'Coral', '12.345.678/0001-90', '987654321', '(11) 3004-5678', 'contato@coral.com.br', 1),
(1, 'FOR003', 'J', 'Tramontina Farroupilha S.A.', 'Tramontina', '91.813.378/0001-60', '456789123', '(54) 2102-8000', 'vendas@tramontina.com.br', 1);

INSERT INTO transportadoras (empresa_id, codigo_erp, razao_social, nome_fantasia, cnpj, ativo) VALUES
(1, 'TR001', 'Transportes Rápidos Ltda', 'TransRápido', '11.222.333/0001-44', 1),
(1, 'TR002', 'Logística Express S.A.', 'LogExpress', '55.666.777/0001-88', 1);

INSERT INTO empresa_usuarios (empresa_id, nome, email, senha_hash, perfil, ativo) VALUES
(1, 'Administrador', 'admin@araca.com.br', NULL, 'admin', 1),
(1, 'Operador', 'operador@araca.com.br', NULL, 'operador', 1);

INSERT INTO usuarios (empresa_id, codigo_erp, nome, email, senha_hash, perfil, comissao_pct, ativo) VALUES
(1, 'VEN001', 'João Vendedor', 'joao@araca.com.br', NULL, 'vendedor', 2.5, 1),
(1, 'VEN002', 'Maria Vendedora', 'maria@araca.com.br', NULL, 'vendedor', 2.5, 1);

INSERT INTO categorias (empresa_id, codigo_erp, slug, nome, descricao, icone, cor, ordem, nivel, caminho, ativo) VALUES
(1, 'CAT001', 'banheiro', 'Banheiro', 'Produtos para banheiro e lavabo', 'fa-bath', '#3b82f6', 1, 0, '/banheiro', 1),
(1, 'CAT002', 'cozinha', 'Cozinha', 'Materiais para cozinha e área gourmet', 'fa-utensils', '#f97316', 2, 0, '/cozinha', 1),
(1, 'CAT003', 'jardim', 'Jardim e Lazer', 'Produtos para jardim, piscina e área externa', 'fa-leaf', '#22c55e', 3, 0, '/jardim', 1),
(1, 'CAT004', 'construcao', 'Construção', 'Materiais básicos de construção civil', 'fa-hard-hat', '#64748b', 4, 0, '/construcao', 1),
(1, 'CAT005', 'eletrica', 'Elétrica', 'Materiais elétricos e iluminação', 'fa-bolt', '#eab308', 5, 0, '/eletrica', 1),
(1, 'CAT006', 'hidraulica', 'Hidráulica', 'Tubos, conexões e acessórios hidráulicos', 'fa-faucet', '#06b6d4', 6, 0, '/hidraulica', 1),
(1, 'CAT007', 'tintas', 'Tintas', 'Tintas, vernizes e acessórios para pintura', 'fa-paint-roller', '#ec4899', 7, 0, '/tintas', 1),
(1, 'CAT008', 'ferramentas', 'Ferramentas', 'Ferramentas manuais e elétricas', 'fa-screwdriver-wrench', '#ef4444', 8, 0, '/ferramentas', 1),
(1, 'CAT009', 'pisos', 'Pisos e Revestimentos', 'Pisos, porcelanatos e revestimentos', 'fa-border-all', '#8b5cf6', 9, 0, '/pisos', 1),
(1, 'CAT010', 'portas', 'Portas e Janelas', 'Portas, janelas e acessórios', 'fa-door-open', '#14b8a6', 10, 0, '/portas', 1),
(1, 'CAT011', 'metais', 'Metais Sanitários', 'Torneiras, registros e acessórios', 'fa-faucet-drip', '#0ea5e9', 11, 0, '/metais', 1),
(1, 'CAT012', 'azulejos', 'Azulejos e Cerâmicas', 'Revestimentos cerâmicos', 'fa-layer-group', '#f43f5e', 12, 0, '/azulejos', 1),
(1, 'CAT013', 'cimento', 'Cimento e Argamassa', 'Materiais de base para construção', 'fa-cubes-stacked', '#78716c', 13, 0, '/cimento', 1),
(1, 'CAT014', 'tijolos', 'Tijolos e Blocos', 'Tijolos, blocos e elementos vazados', 'fa-border-none', '#a16207', 14, 0, '/tijolos', 1),
(1, 'CAT015', 'telhas', 'Telhas e Coberturas', 'Telhas e acessórios para cobertura', 'fa-house-chimney', '#d97706', 15, 0, '/telhas', 1),
(1, 'CAT016', 'drywall', 'Drywall e Forros', 'Placas de drywall e forros', 'fa-table-cells', '#6b7280', 16, 0, '/drywall', 1),
(1, 'CAT017', 'impermeabilizacao', 'Impermeabilização', 'Mantas e produtos impermeabilizantes', 'fa-droplet', '#1d4ed8', 17, 0, '/impermeabilizacao', 1),
(1, 'CAT018', 'esquadrias', 'Esquadrias de Alumínio', 'Perfis e esquadrias de alumínio', 'fa-window-maximize', '#64748b', 18, 0, '/esquadrias', 1),
(1, 'CAT019', 'madeiras', 'Madeiras', 'Madeiras brutas e beneficiadas', 'fa-tree', '#92400e', 19, 0, '/madeiras', 1),
(1, 'CAT020', 'descartaveis', 'Descartáveis', 'Produtos descartáveis para limpeza', 'fa-soap', '#10b981', 20, 0, '/descartaveis', 1);

INSERT INTO clientes (empresa_id, tipo_pessoa, nome, nome_fantasia, cpf_cnpj, rg_ie, email, telefone, celular, codigo_erp, ativo) VALUES
(1, 'J', 'Construtora Silva Ltda', 'Construtora Silva', '12.345.678/0001-90', '123456789', 'contato@silva.com.br', '(12) 3456-7890', '(12) 98765-4321', 'CLI001', 1),
(1, 'F', 'João da Silva', NULL, '123.456.789-00', '123456789', 'joao@email.com', '(12) 3456-7890', '(12) 98765-4321', 'CLI002', 1);

INSERT INTO banners (empresa_id, imagem, imagem_mobile, titulo, subtitulo, link, ordem, ativo) VALUES
(1, 'images/banner1.jpg', NULL, 'Promoção de Verão', 'Até 30% de desconto em produtos selecionados', 'index.html?promo=verao', 1, 1),
(1, 'images/banner2.jpg', NULL, 'Novo Departamento', 'Confira nossa nova linha de ferramentas', 'index.html?cat=ferramentas', 2, 1),
(1, 'images/banner3.jpg', NULL, 'Entrega Rápida', 'Receba em até 24h na região', NULL, 3, 1);
