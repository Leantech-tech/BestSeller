-- ============================================================
-- TechShop - Schema SaaS (Multi-tenant)
-- SGBD: PostgreSQL 14+
-- Schema: public
-- ============================================================

-- --------------------------------------------------------
-- 1. CRIAR BANCO (executar como superusuário, se necessário)
-- --------------------------------------------------------
-- CREATE DATABASE araca_saas WITH ENCODING = 'UTF8' LC_COLLATE = 'pt_BR.UTF-8';

-- --------------------------------------------------------
-- 2. EXTENSÕES
-- --------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Garante que estamos no schema public
SET search_path TO public;

-- Limpar tabelas existentes para permitir re-execução do script
DROP TABLE IF EXISTS log_integracao, carrinho, contas_receber, itens_pedido, pedidos,
enderecos, clientes, banners, produto_imagens, movimento_estoque, produto_estoque,
produto_precos, produtos, categorias, usuarios, transportadoras, fornecedores,
marcas, depositos, condicoes_pagamento, formas_pagamento, tabelas_preco,
status_pedido_cfg, unidades_medida, empresa_usuarios, assinaturas, empresas, planos
CASCADE;

DROP TYPE IF EXISTS tipo_movimento CASCADE;

-- ============================================================
-- TABELAS DO SaaS (GESTÃO DE TENANTS)
-- ============================================================

-- --------------------------------------------------------
-- 3. EMPRESAS / TENANTS
-- --------------------------------------------------------
CREATE TABLE empresas (
    id                  SERIAL PRIMARY KEY,
    uuid                UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    slug                VARCHAR(50) NOT NULL UNIQUE,        -- url-amigavel: araca-casa
    razao_social        VARCHAR(150) NOT NULL,
    nome_fantasia       VARCHAR(150) NOT NULL,              -- nome exibido no site
    cnpj                VARCHAR(18),
    ie                  VARCHAR(20),
    im                  VARCHAR(20),

    -- Contato
    email               VARCHAR(150) NOT NULL,
    telefone            VARCHAR(20),
    whatsapp            VARCHAR(20),

    -- Endereço
    cep                 VARCHAR(9),
    logradouro          VARCHAR(255),
    numero              VARCHAR(20),
    complemento         VARCHAR(100),
    bairro              VARCHAR(100),
    cidade              VARCHAR(100),
    estado              CHAR(2),
    ibge_cidade         VARCHAR(7),

    -- Configurações visuais
    logo_url            VARCHAR(500),
    favicon_url         VARCHAR(500),
    cor_primaria        VARCHAR(7) DEFAULT '#1a6fc4',
    cor_secundaria      VARCHAR(7) DEFAULT '#f5f5f5',
    tema_escuro         BOOLEAN DEFAULT FALSE,

    -- Configurações do e-commerce
    config              JSONB DEFAULT '{}',                  -- domínio personalizado, horário, etc.

    -- Plano / Assinatura
    plano_id            INTEGER,
    data_ativacao       DATE DEFAULT CURRENT_DATE,
    data_expiracao      DATE,
    trial               BOOLEAN DEFAULT TRUE,
    trial_dias          INTEGER DEFAULT 14,

    -- Status
    status              VARCHAR(20) DEFAULT 'ativo',         -- ativo, suspenso, cancelado, pendente
    motivo_suspensao    TEXT,

    -- Dados do responsável / dono
    responsavel_nome    VARCHAR(150),
    responsavel_email   VARCHAR(150),
    responsavel_cpf     VARCHAR(14),
    responsavel_telefone VARCHAR(20),

    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE empresas IS 'Tenants/empresas do SaaS. Cada empresa tem seu e-commerce isolado.';

CREATE INDEX idx_empresas_slug ON empresas(slug);
CREATE INDEX idx_empresas_status ON empresas(status);
CREATE INDEX idx_empresas_uuid ON empresas(uuid);

-- --------------------------------------------------------
-- 4. PLANOS DE ASSINATURA
-- --------------------------------------------------------
CREATE TABLE planos (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,    -- basico, profissional, enterprise
    nome            VARCHAR(100) NOT NULL,
    descricao       TEXT,
    preco_mensal    DECIMAL(10,2) NOT NULL,
    preco_anual     DECIMAL(10,2),
    limite_produtos INTEGER,                        -- NULL = ilimitado
    limite_usuarios INTEGER,
    limite_clientes INTEGER,
    limite_pedidos_mes INTEGER,
    recursos        JSONB DEFAULT '{}',              -- funcionalidades liberadas
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 5. ASSINATURAS
-- --------------------------------------------------------
CREATE TABLE assinaturas (
    id                  SERIAL PRIMARY KEY,
    empresa_id          INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    plano_id            INTEGER NOT NULL REFERENCES planos(id),
    status              VARCHAR(20) DEFAULT 'ativa', -- ativa, vencida, cancelada, upgrade
    valor               DECIMAL(10,2) NOT NULL,
    ciclo               VARCHAR(10) DEFAULT 'mensal',-- mensal, anual
    data_inicio         DATE NOT NULL,
    data_vencimento     DATE NOT NULL,
    data_cancelamento   DATE,
    gateway_pagamento   VARCHAR(50),                 -- stripe, pagarme, etc.
    gateway_assinatura_id VARCHAR(100),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assinaturas_empresa ON assinaturas(empresa_id);

-- --------------------------------------------------------
-- 6. USUÁRIOS DO SaaS (admin / operador da empresa)
-- --------------------------------------------------------
CREATE TABLE empresa_usuarios (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    senha_hash      VARCHAR(255),
    perfil          VARCHAR(20) DEFAULT 'operador',  -- dono, admin, operador, vendedor
    ativo           BOOLEAN DEFAULT TRUE,
    ultimo_acesso   TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_empresa_usuario_email UNIQUE (empresa_id, email)
);

CREATE INDEX idx_empresa_usuarios_empresa ON empresa_usuarios(empresa_id);

-- ============================================================
-- TABELAS AUXILIARES (públicas ou por empresa)
-- ============================================================

-- --------------------------------------------------------
-- 7. UNIDADES DE MEDIDA (globais)
-- --------------------------------------------------------
CREATE TABLE unidades_medida (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(10) NOT NULL UNIQUE,    -- UN, KG, M, M2, M3, PC, CX, RL
    descricao       VARCHAR(50) NOT NULL,
    permite_fracao  BOOLEAN DEFAULT TRUE,
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 8. STATUS DE PEDIDO (por empresa)
-- --------------------------------------------------------
CREATE TABLE status_pedido_cfg (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo          VARCHAR(20) NOT NULL,
    descricao       VARCHAR(50) NOT NULL,
    cor             VARCHAR(7) DEFAULT '#666666',
    icone           VARCHAR(30),
    finaliza        BOOLEAN DEFAULT FALSE,
    cancela         BOOLEAN DEFAULT FALSE,
    envia_rp        BOOLEAN DEFAULT FALSE,
    ordem           INTEGER DEFAULT 0,
    ativo           BOOLEAN DEFAULT TRUE,

    CONSTRAINT uq_status_pedido_cfg UNIQUE (empresa_id, codigo)
);

CREATE INDEX idx_status_pedido_cfg_empresa ON status_pedido_cfg(empresa_id);

-- --------------------------------------------------------
-- 9. TABELAS DE PREÇO (por empresa)
-- --------------------------------------------------------
CREATE TABLE tabelas_preco (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo_erp      VARCHAR(30),
    descricao       VARCHAR(100) NOT NULL,
    padrao          BOOLEAN DEFAULT FALSE,
    markup          DECIMAL(5,2),
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tabelas_preco_empresa ON tabelas_preco(empresa_id);

-- --------------------------------------------------------
-- 10. FORMAS DE PAGAMENTO (por empresa)
-- --------------------------------------------------------
CREATE TABLE formas_pagamento (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo_erp      VARCHAR(30),
    descricao       VARCHAR(50) NOT NULL,
    tipo            VARCHAR(20),                    -- pix, cartao_credito, cartao_debito, boleto, dinheiro
    parcelas_max    INTEGER DEFAULT 1,
    taxa_operacao   DECIMAL(5,4) DEFAULT 0,
    usa_gateway     BOOLEAN DEFAULT FALSE,
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_formas_pagamento_empresa ON formas_pagamento(empresa_id);

-- --------------------------------------------------------
-- 11. CONDIÇÕES DE PAGAMENTO (por empresa)
-- --------------------------------------------------------
CREATE TABLE condicoes_pagamento (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo_erp      VARCHAR(30),
    descricao       VARCHAR(100) NOT NULL,
    parcelas        INTEGER DEFAULT 1,
    dias_parcelas   INTEGER[] DEFAULT ARRAY[0],
    tipo            VARCHAR(20) DEFAULT 'a_vista',
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_condicoes_pagamento_empresa ON condicoes_pagamento(empresa_id);

-- --------------------------------------------------------
-- 12. DEPÓSITOS / LOCAIS DE ESTOQUE (por empresa)
-- --------------------------------------------------------
CREATE TABLE depositos (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo_erp      VARCHAR(30),
    descricao       VARCHAR(100) NOT NULL,
    endereco        VARCHAR(255),
    padrao          BOOLEAN DEFAULT FALSE,
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_depositos_empresa ON depositos(empresa_id);

-- --------------------------------------------------------
-- 13. MARCAS / FABRICANTES (por empresa)
-- --------------------------------------------------------
CREATE TABLE marcas (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo_erp      VARCHAR(30),
    nome            VARCHAR(100) NOT NULL,
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_marcas_empresa ON marcas(empresa_id);
CREATE INDEX idx_marcas_codigo_erp ON marcas(empresa_id, codigo_erp) WHERE codigo_erp IS NOT NULL;

-- --------------------------------------------------------
-- 14. FORNECEDORES (por empresa)
-- --------------------------------------------------------
CREATE TABLE fornecedores (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo_erp      VARCHAR(30),
    tipo_pessoa     CHAR(1) NOT NULL DEFAULT 'J',
    razao_social    VARCHAR(150) NOT NULL,
    nome_fantasia   VARCHAR(150),
    cnpj_cpf        VARCHAR(18),
    ie_rg           VARCHAR(20),
    telefone        VARCHAR(20),
    email           VARCHAR(150),
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_fornecedores_cnpj_cpf UNIQUE (empresa_id, cnpj_cpf)
);

CREATE INDEX idx_fornecedores_empresa ON fornecedores(empresa_id);
CREATE INDEX idx_fornecedores_codigo_erp ON fornecedores(empresa_id, codigo_erp) WHERE codigo_erp IS NOT NULL;

-- --------------------------------------------------------
-- 15. TRANSPORTADORAS (por empresa)
-- --------------------------------------------------------
CREATE TABLE transportadoras (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo_erp      VARCHAR(30),
    razao_social    VARCHAR(150) NOT NULL,
    nome_fantasia   VARCHAR(150),
    cnpj            VARCHAR(18),
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transportadoras_empresa ON transportadoras(empresa_id);

-- --------------------------------------------------------
-- 16. USUÁRIOS / VENDEDORES DA LOJA (por empresa)
-- --------------------------------------------------------
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo_erp      VARCHAR(30),
    nome            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    senha_hash      VARCHAR(255),
    perfil          VARCHAR(20) DEFAULT 'vendedor',
    comissao_pct    DECIMAL(5,2) DEFAULT 0,
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_usuarios_email UNIQUE (empresa_id, email)
);

CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_usuarios_codigo_erp ON usuarios(empresa_id, codigo_erp) WHERE codigo_erp IS NOT NULL;

-- ============================================================
-- TABELAS PRINCIPAIS DO E-COMMERCE (por empresa)
-- ============================================================

-- --------------------------------------------------------
-- 17. CATEGORIAS
-- --------------------------------------------------------
CREATE TABLE categorias (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo_erp      VARCHAR(30),
    slug            VARCHAR(50) NOT NULL,
    nome            VARCHAR(100) NOT NULL,
    descricao       TEXT,
    icone           VARCHAR(50),
    cor             VARCHAR(7) DEFAULT '#1a6fc4',
    categoria_pai_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    ordem           INTEGER DEFAULT 0,
    nivel           INTEGER DEFAULT 0,
    caminho         VARCHAR(500),
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_categorias_slug UNIQUE (empresa_id, slug)
);

CREATE INDEX idx_categorias_empresa ON categorias(empresa_id);
CREATE INDEX idx_categorias_pai ON categorias(categoria_pai_id);
CREATE INDEX idx_categorias_codigo_erp ON categorias(empresa_id, codigo_erp) WHERE codigo_erp IS NOT NULL;

-- --------------------------------------------------------
-- 18. PRODUTOS
-- --------------------------------------------------------
CREATE TABLE produtos (
    id                  SERIAL PRIMARY KEY,
    empresa_id          INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo_erp          VARCHAR(30),
    codigo_interno      VARCHAR(20) NOT NULL,
    codigo_barras       VARCHAR(14),
    nome                VARCHAR(255) NOT NULL,
    nome_reduzido       VARCHAR(60),
    descricao           TEXT,
    descricao_curta     VARCHAR(255),
    descricao_tecnica   TEXT,

    categoria_id        INTEGER NOT NULL,
    marca_id            INTEGER REFERENCES marcas(id) ON DELETE SET NULL,
    fornecedor_id       INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL,
    unidade_id          INTEGER REFERENCES unidades_medida(id) ON DELETE SET NULL,

    peso_liquido        DECIMAL(10,3) DEFAULT 0,
    peso_bruto          DECIMAL(10,3) DEFAULT 0,
    altura              DECIMAL(10,2) DEFAULT 0,
    largura             DECIMAL(10,2) DEFAULT 0,
    comprimento         DECIMAL(10,2) DEFAULT 0,
    cubagem             DECIMAL(10,6) DEFAULT 0,

    ncm                 VARCHAR(12),
    cest                VARCHAR(7),
    origem              CHAR(1) DEFAULT '0',
    cfop_venda          VARCHAR(4) DEFAULT '5102',
    cst_icms            VARCHAR(3) DEFAULT '000',
    aliquota_icms       DECIMAL(5,2) DEFAULT 0,
    aliquota_ipi        DECIMAL(5,2) DEFAULT 0,
    aliquota_pis        DECIMAL(5,2) DEFAULT 0,
    aliquota_cofins     DECIMAL(5,2) DEFAULT 0,

    custo_reposicao     DECIMAL(10,2) DEFAULT 0,
    custo_medio         DECIMAL(10,2) DEFAULT 0,
    markup              DECIMAL(5,2) DEFAULT 1.80,

    controla_estoque    BOOLEAN DEFAULT TRUE,
    controla_lote       BOOLEAN DEFAULT FALSE,
    permite_venda_sem_estoque BOOLEAN DEFAULT FALSE,
    destaque            BOOLEAN DEFAULT FALSE,
    lancamento          BOOLEAN DEFAULT FALSE,
    mais_vendido        BOOLEAN DEFAULT FALSE,
    seo_title           VARCHAR(150),
    seo_description     VARCHAR(255),
    seo_keywords        VARCHAR(255),
    url_amigavel        VARCHAR(255),
    imagem              VARCHAR(500),
    garantia            INTEGER,

    sync_erp_id         VARCHAR(50),
    sync_erp_status     VARCHAR(20) DEFAULT 'ok',
    sync_erp_ultima     TIMESTAMP,

    ativo               BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_produtos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT,
    CONSTRAINT uq_produtos_codigo_interno UNIQUE (empresa_id, codigo_interno),
    CONSTRAINT uq_produtos_url UNIQUE (empresa_id, url_amigavel)
);

CREATE INDEX idx_produtos_empresa ON produtos(empresa_id);
CREATE INDEX idx_produtos_categoria ON produtos(empresa_id, categoria_id);
CREATE INDEX idx_produtos_marca ON produtos(marca_id);
CREATE INDEX idx_produtos_destaque ON produtos(empresa_id, destaque) WHERE destaque = TRUE;
CREATE INDEX idx_produtos_ativo ON produtos(empresa_id, ativo) WHERE ativo = TRUE;
CREATE INDEX idx_produtos_sync ON produtos(empresa_id, sync_erp_status) WHERE sync_erp_status != 'ok';
CREATE INDEX idx_produtos_nome ON produtos USING gin(to_tsvector('portuguese', nome));

-- --------------------------------------------------------
-- 19. PREÇOS POR TABELA
-- --------------------------------------------------------
CREATE TABLE produto_precos (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    produto_id      INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    tabela_id       INTEGER NOT NULL REFERENCES tabelas_preco(id) ON DELETE CASCADE,
    preco           DECIMAL(10,2) NOT NULL,
    preco_promocional DECIMAL(10,2),
    promocao_inicio DATE,
    promocao_fim    DATE,
    ativo           BOOLEAN DEFAULT TRUE,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_produto_precos UNIQUE (empresa_id, produto_id, tabela_id)
);

CREATE INDEX idx_produto_precos_empresa ON produto_precos(empresa_id);

-- --------------------------------------------------------
-- 20. ESTOQUE POR DEPÓSITO
-- --------------------------------------------------------
CREATE TABLE produto_estoque (
    id                  SERIAL PRIMARY KEY,
    empresa_id          INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    produto_id          INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    deposito_id         INTEGER NOT NULL REFERENCES depositos(id) ON DELETE CASCADE,
    saldo_fisico        DECIMAL(12,3) DEFAULT 0,
    saldo_reservado     DECIMAL(12,3) DEFAULT 0,
    saldo_disponivel    DECIMAL(12,3) GENERATED ALWAYS AS (saldo_fisico - saldo_reservado) STORED,
    localizacao         VARCHAR(50),
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_produto_estoque UNIQUE (empresa_id, produto_id, deposito_id)
);

CREATE INDEX idx_estoque_empresa ON produto_estoque(empresa_id);

-- --------------------------------------------------------
-- 21. MOVIMENTAÇÃO DE ESTOQUE
-- --------------------------------------------------------
CREATE TYPE tipo_movimento AS ENUM (
    'entrada_compra', 'entrada_ajuste', 'entrada_transferencia',
    'saida_venda', 'saida_cancelamento', 'saida_ajuste',
    'saida_transferencia', 'saida_devolucao'
);

CREATE TABLE movimento_estoque (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    produto_id      INTEGER NOT NULL REFERENCES produtos(id),
    deposito_id     INTEGER NOT NULL REFERENCES depositos(id),
    tipo            tipo_movimento NOT NULL,
    quantidade      DECIMAL(12,3) NOT NULL,
    quantidade_anterior DECIMAL(12,3) NOT NULL,
    quantidade_nova DECIMAL(12,3) NOT NULL,
    motivo          VARCHAR(255),
    documento       VARCHAR(50),
    pedido_id       INTEGER,
    usuario_id      INTEGER REFERENCES usuarios(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_movimento_qtd CHECK (quantidade <> 0)
);

CREATE INDEX idx_movimento_empresa ON movimento_estoque(empresa_id);
CREATE INDEX idx_movimento_produto ON movimento_estoque(empresa_id, produto_id);
CREATE INDEX idx_movimento_tipo ON movimento_estoque(tipo);

-- --------------------------------------------------------
-- 22. IMAGENS DO PRODUTO
-- --------------------------------------------------------
CREATE TABLE produto_imagens (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    produto_id      INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    url             VARCHAR(500) NOT NULL,
    url_thumb       VARCHAR(500),
    ordem           INTEGER DEFAULT 0,
    principal       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_imagens_empresa ON produto_imagens(empresa_id);

-- --------------------------------------------------------
-- 23. BANNERS
-- --------------------------------------------------------
CREATE TABLE banners (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    imagem          VARCHAR(500) NOT NULL,
    imagem_mobile   VARCHAR(500),
    titulo          VARCHAR(150) NOT NULL,
    subtitulo       VARCHAR(255),
    link            VARCHAR(500),
    ordem           INTEGER DEFAULT 0,
    ativo           BOOLEAN DEFAULT TRUE,
    data_inicio     DATE,
    data_fim        DATE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_banners_empresa ON banners(empresa_id);

-- --------------------------------------------------------
-- 24. CLIENTES
-- --------------------------------------------------------
CREATE TABLE clientes (
    id                  SERIAL PRIMARY KEY,
    empresa_id          INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo_erp          VARCHAR(30),
    tipo_pessoa         CHAR(1) NOT NULL DEFAULT 'F',
    nome                VARCHAR(150) NOT NULL,
    nome_fantasia       VARCHAR(150),
    cpf_cnpj            VARCHAR(18),
    rg_ie               VARCHAR(20),
    im                  VARCHAR(20),
    sexo                CHAR(1),
    data_nascimento     DATE,
    email               VARCHAR(150) NOT NULL,
    email_secundario    VARCHAR(150),
    telefone            VARCHAR(20),
    celular             VARCHAR(20),
    receber_email       BOOLEAN DEFAULT TRUE,
    cep                 VARCHAR(9),
    logradouro          VARCHAR(255),
    numero              VARCHAR(20),
    complemento         VARCHAR(100),
    bairro              VARCHAR(100),
    cidade              VARCHAR(100),
    estado              CHAR(2),
    ibge_cidade         VARCHAR(7),
    tabela_preco_id     INTEGER REFERENCES tabelas_preco(id) ON DELETE SET NULL,
    limite_credito      DECIMAL(10,2) DEFAULT 0,
    saldo_devedor       DECIMAL(10,2) DEFAULT 0,
    inadimplente        BOOLEAN DEFAULT FALSE,
    ultima_compra       DATE,
    total_comprado      DECIMAL(12,2) DEFAULT 0,
    senha_hash          VARCHAR(255),
    token_reset         VARCHAR(255),
    token_expira        TIMESTAMP,
    confirmado          BOOLEAN DEFAULT FALSE,
    sync_erp_id         VARCHAR(50),
    sync_erp_status     VARCHAR(20) DEFAULT 'ok',
    sync_erp_ultima     TIMESTAMP,
    ativo               BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_clientes_email UNIQUE (empresa_id, email),
    CONSTRAINT uq_clientes_cpf_cnpj UNIQUE (empresa_id, cpf_cnpj)
);

CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_clientes_email ON clientes(empresa_id, email);
CREATE INDEX idx_clientes_inadimplente ON clientes(empresa_id, inadimplente) WHERE inadimplente = TRUE;

-- --------------------------------------------------------
-- 25. ENDEREÇOS DE ENTREGA
-- --------------------------------------------------------
CREATE TABLE enderecos (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    apelido         VARCHAR(50),
    cep             VARCHAR(9) NOT NULL,
    logradouro      VARCHAR(255) NOT NULL,
    numero          VARCHAR(20) NOT NULL,
    complemento     VARCHAR(100),
    bairro          VARCHAR(100) NOT NULL,
    cidade          VARCHAR(100) NOT NULL,
    estado          CHAR(2) NOT NULL,
    ibge_cidade     VARCHAR(7),
    referencia      VARCHAR(255),
    entrega         BOOLEAN DEFAULT TRUE,
    cobranca        BOOLEAN DEFAULT FALSE,
    padrao          BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_enderecos_empresa ON enderecos(empresa_id);
CREATE INDEX idx_enderecos_cliente ON enderecos(empresa_id, cliente_id);

-- --------------------------------------------------------
-- 26. PEDIDOS
-- --------------------------------------------------------
CREATE TABLE pedidos (
    id                  SERIAL PRIMARY KEY,
    empresa_id          INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    numero              VARCHAR(20) NOT NULL,
    numero_erp          VARCHAR(30),
    serie               VARCHAR(3) DEFAULT '1',
    cliente_id          INTEGER NOT NULL REFERENCES clientes(id),
    endereco_id         INTEGER NOT NULL REFERENCES enderecos(id),
    usuario_id          INTEGER REFERENCES usuarios(id),
    tabela_preco_id     INTEGER REFERENCES tabelas_preco(id),
    transportadora_id   INTEGER REFERENCES transportadoras(id),
    subtotal_produtos   DECIMAL(10,2) NOT NULL DEFAULT 0,
    desconto_itens      DECIMAL(10,2) DEFAULT 0,
    desconto_pedido     DECIMAL(10,2) DEFAULT 0,
    desconto_pedido_pct DECIMAL(5,2) DEFAULT 0,
    frete_valor         DECIMAL(10,2) DEFAULT 0,
    seguro_valor        DECIMAL(10,2) DEFAULT 0,
    outras_despesas     DECIMAL(10,2) DEFAULT 0,
    total_produtos      DECIMAL(10,2) GENERATED ALWAYS AS (subtotal_produtos - desconto_itens) STORED,
    total               DECIMAL(10,2) GENERATED ALWAYS AS (subtotal_produtos - desconto_itens - desconto_pedido + frete_valor + seguro_valor + outras_despesas) STORED,
    total_pago          DECIMAL(10,2) DEFAULT 0,
    troco               DECIMAL(10,2) DEFAULT 0,
    saldo_receber       DECIMAL(10,2) GENERATED ALWAYS AS (subtotal_produtos - desconto_itens - desconto_pedido + frete_valor + seguro_valor + outras_despesas - total_pago) STORED,
    peso_total          DECIMAL(10,3) DEFAULT 0,
    volume_total        DECIMAL(10,6) DEFAULT 0,
    forma_pagamento_id  INTEGER REFERENCES formas_pagamento(id),
    condicao_pagamento_id INTEGER REFERENCES condicoes_pagamento(id),
    parcelas            INTEGER DEFAULT 1,
    frete_tipo          VARCHAR(20),
    frete_cep           VARCHAR(9),
    frete_prazo         INTEGER,
    frete_rastreio      VARCHAR(50),
    frete_data_envio    TIMESTAMP,
    frete_data_entrega  TIMESTAMP,
    status              VARCHAR(20) NOT NULL DEFAULT 'pendente',
    status_descricao    VARCHAR(50),
    faturado            BOOLEAN DEFAULT FALSE,
    faturado_data       TIMESTAMP,
    faturado_nota       VARCHAR(20),
    faturado_serie      VARCHAR(3),
    faturado_chave      VARCHAR(44),
    obs_interna         TEXT,
    obs_cliente         TEXT,
    canal               VARCHAR(20) DEFAULT 'ecommerce',
    origem              VARCHAR(50),
    utm_source          VARCHAR(100),
    utm_medium          VARCHAR(100),
    utm_campaign        VARCHAR(100),
    sync_erp_id         VARCHAR(50),
    sync_erp_status     VARCHAR(20) DEFAULT 'pendente',
    sync_erp_mensagem   TEXT,
    sync_erp_envio      TIMESTAMP,
    sync_erp_retorno    TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmado_at       TIMESTAMP,
    pago_at             TIMESTAMP,
    separado_at         TIMESTAMP,
    enviado_at          TIMESTAMP,
    entregue_at         TIMESTAMP,
    cancelado_at        TIMESTAMP,
    cancelado_motivo    VARCHAR(255),

    CONSTRAINT uq_pedidos_numero UNIQUE (empresa_id, numero)
);

CREATE INDEX idx_pedidos_empresa ON pedidos(empresa_id);
CREATE INDEX idx_pedidos_cliente ON pedidos(empresa_id, cliente_id);
CREATE INDEX idx_pedidos_status ON pedidos(empresa_id, status);
CREATE INDEX idx_pedidos_created ON pedidos(empresa_id, created_at);
CREATE INDEX idx_pedidos_sync ON pedidos(empresa_id, sync_erp_status) WHERE sync_erp_status NOT IN ('confirmado');

-- --------------------------------------------------------
-- 27. ITENS DO PEDIDO
-- --------------------------------------------------------
CREATE TABLE itens_pedido (
    id                  SERIAL PRIMARY KEY,
    empresa_id          INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    pedido_id           INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id          INTEGER NOT NULL REFERENCES produtos(id),
    produto_codigo      VARCHAR(20) NOT NULL,
    produto_codigo_erp  VARCHAR(30),
    produto_nome        VARCHAR(255) NOT NULL,
    produto_ean         VARCHAR(14),
    produto_ncm         VARCHAR(12),
    produto_unidade     VARCHAR(10),
    quantidade          DECIMAL(12,3) NOT NULL DEFAULT 1,
    preco_tabela        DECIMAL(10,2) NOT NULL DEFAULT 0,
    preco_venda         DECIMAL(10,2) NOT NULL DEFAULT 0,
    desconto_unitario   DECIMAL(10,2) DEFAULT 0,
    desconto_pct        DECIMAL(5,2) DEFAULT 0,
    preco_liquido       DECIMAL(10,2) GENERATED ALWAYS AS (preco_venda - desconto_unitario) STORED,
    subtotal            DECIMAL(10,2) GENERATED ALWAYS AS (quantidade * (preco_venda - desconto_unitario)) STORED,
    custo_unitario      DECIMAL(10,2) DEFAULT 0,
    cfop                VARCHAR(4),
    cst_icms            VARCHAR(3),
    aliquota_icms       DECIMAL(5,2) DEFAULT 0,
    aliquota_ipi        DECIMAL(5,2) DEFAULT 0,
    base_icms           DECIMAL(10,2) DEFAULT 0,
    valor_icms          DECIMAL(10,2) DEFAULT 0,
    base_ipi            DECIMAL(10,2) DEFAULT 0,
    valor_ipi           DECIMAL(10,2) DEFAULT 0,
    sequencia           INTEGER NOT NULL DEFAULT 0,
    deposito_id         INTEGER REFERENCES depositos(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_itens_pedido_empresa ON itens_pedido(empresa_id);
CREATE INDEX idx_itens_pedido ON itens_pedido(empresa_id, pedido_id);

-- --------------------------------------------------------
-- 28. CONTAS A RECEBER
-- --------------------------------------------------------
CREATE TABLE contas_receber (
    id                  SERIAL PRIMARY KEY,
    empresa_id          INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    pedido_id           INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    cliente_id          INTEGER NOT NULL REFERENCES clientes(id),
    documento           VARCHAR(50),
    parcela             INTEGER NOT NULL DEFAULT 1,
    total_parcelas      INTEGER NOT NULL DEFAULT 1,
    valor               DECIMAL(10,2) NOT NULL,
    juros               DECIMAL(10,2) DEFAULT 0,
    desconto            DECIMAL(10,2) DEFAULT 0,
    valor_liquido       DECIMAL(10,2) GENERATED ALWAYS AS (valor + juros - desconto) STORED,
    data_emissao        DATE NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento     DATE NOT NULL,
    data_pagamento      DATE,
    forma_pagamento_id  INTEGER REFERENCES formas_pagamento(id),
    condicao_id         INTEGER REFERENCES condicoes_pagamento(id),
    boleto_linha        VARCHAR(60),
    boleto_url          VARCHAR(500),
    pix_qrcode          TEXT,
    pix_txid            VARCHAR(50),
    pix_expiracao       TIMESTAMP,
    status              VARCHAR(20) DEFAULT 'pendente',
    baixado             BOOLEAN DEFAULT FALSE,
    baixado_por         INTEGER REFERENCES usuarios(id),
    baixado_em          TIMESTAMP,
    sync_erp_id         VARCHAR(50),
    sync_erp_status     VARCHAR(20) DEFAULT 'pendente',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contas_empresa ON contas_receber(empresa_id);
CREATE INDEX idx_contas_pedido ON contas_receber(empresa_id, pedido_id);
CREATE INDEX idx_contas_vencimento ON contas_receber(empresa_id, data_vencimento);

-- --------------------------------------------------------
-- 29. CARRINHO
-- --------------------------------------------------------
CREATE TABLE carrinho (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    produto_id      INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    quantidade      DECIMAL(12,3) NOT NULL DEFAULT 1,
    preco_unitario  DECIMAL(10,2),
    session_id      VARCHAR(100),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_carrinho UNIQUE (empresa_id, cliente_id, produto_id)
);

CREATE INDEX idx_carrinho_session ON carrinho(session_id) WHERE session_id IS NOT NULL;

-- --------------------------------------------------------
-- 30. LOG DE INTEGRAÇÃO
-- --------------------------------------------------------
CREATE TABLE log_integracao (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    entidade        VARCHAR(30) NOT NULL,
    entidade_id     INTEGER,
    operacao        VARCHAR(20) NOT NULL,
    direcao         VARCHAR(10) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    mensagem        TEXT,
    payload_envio   JSONB,
    payload_retorno JSONB,
    http_status     INTEGER,
    tempo_ms        INTEGER,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_log_empresa ON log_integracao(empresa_id);
CREATE INDEX idx_log_entidade ON log_integracao(empresa_id, entidade, entidade_id);

-- ============================================================
-- DADOS INICIAIS
-- ============================================================

-- --------------------------------------------------------
-- Empresa demonstração
-- --------------------------------------------------------
INSERT INTO empresas (
    slug, razao_social, nome_fantasia, cnpj, email, telefone,
    cep, logradouro, numero, bairro, cidade, estado,
    cor_primaria, status, responsavel_nome, responsavel_email, responsavel_telefone
) VALUES (
    'araca-demo', 'Araca Materiais de Construcao e Logistica',
    'TechShop', '05.750.359/0001-08',
    'contato@araca.com.br', '(12) 97407-0653',
    '11611-630', 'Rua Inácio de Carvalho', '17', 'Varadouro',
    'São Sebastião', 'SP',
    '#1a6fc4', 'ativo', 'Administrador', 'admin@araca.com.br', '(12) 97407-0653'
) RETURNING id;

-- Guardar o ID da empresa para os próximos inserts
DO $func$
DECLARE
    v_empresa_id INTEGER;
BEGIN
    SELECT id INTO v_empresa_id FROM empresas WHERE slug = 'araca-demo';

    -- Unidades de medida (globais, sem empresa_id)
    INSERT INTO unidades_medida (codigo, descricao, permite_fracao) VALUES
    ('UN', 'Unidade', FALSE),
    ('KG', 'Quilograma', TRUE),
    ('M', 'Metro', TRUE),
    ('M2', 'Metro Quadrado', TRUE),
    ('M3', 'Metro Cúbico', TRUE),
    ('PC', 'Peça', FALSE),
    ('CX', 'Caixa', FALSE),
    ('RL', 'Rolo', FALSE),
    ('LT', 'Litro', TRUE),
    ('PR', 'Par', FALSE),
    ('DZ', 'Dúzia', FALSE),
    ('BD', 'Balde', FALSE),
    ('GL', 'Galão', FALSE);

    -- Depósitos
    INSERT INTO depositos (empresa_id, codigo_erp, descricao, padrao) VALUES
    (v_empresa_id, '01', 'Depósito Principal', TRUE),
    (v_empresa_id, '02', 'Loja Física', FALSE);

    -- Tabelas de preço
    INSERT INTO tabelas_preco (empresa_id, descricao, padrao, markup) VALUES
    (v_empresa_id, 'Varejo', TRUE, 1.80),
    (v_empresa_id, 'Atacado', FALSE, 1.40),
    (v_empresa_id, 'Revenda', FALSE, 1.25);

    -- Formas de pagamento
    INSERT INTO formas_pagamento (empresa_id, descricao, tipo, parcelas_max, taxa_operacao, usa_gateway) VALUES
    (v_empresa_id, 'PIX', 'pix', 1, 0, FALSE),
    (v_empresa_id, 'Cartão de Crédito', 'cartao_credito', 12, 0.0399, TRUE),
    (v_empresa_id, 'Cartão de Débito', 'cartao_debito', 1, 0.0199, TRUE),
    (v_empresa_id, 'Boleto Bancário', 'boleto', 1, 0.0299, TRUE),
    (v_empresa_id, 'Dinheiro', 'dinheiro', 1, 0, FALSE);

    -- Condições de pagamento
    INSERT INTO condicoes_pagamento (empresa_id, descricao, parcelas, dias_parcelas, tipo) VALUES
    (v_empresa_id, 'À Vista', 1, ARRAY[0], 'a_vista'),
    (v_empresa_id, '30 Dias', 1, ARRAY[30], 'parcelado'),
    (v_empresa_id, '30/60 Dias', 2, ARRAY[30,60], 'parcelado'),
    (v_empresa_id, '30/60/90 Dias', 3, ARRAY[30,60,90], 'parcelado');

    -- Status de pedido
    INSERT INTO status_pedido_cfg (empresa_id, codigo, descricao, cor, finaliza, cancela, envia_rp, ordem) VALUES
    (v_empresa_id, 'pendente',     'Pendente',      '#f0ad4e', FALSE, FALSE, FALSE, 1),
    (v_empresa_id, 'pago',         'Pago',          '#5cb85c', FALSE, FALSE, TRUE,  2),
    (v_empresa_id, 'em_separacao', 'Em Separação',  '#5bc0de', FALSE, FALSE, FALSE, 3),
    (v_empresa_id, 'enviado',      'Enviado',       '#337ab7', FALSE, FALSE, FALSE, 4),
    (v_empresa_id, 'entregue',     'Entregue',      '#5cb85c', TRUE,  FALSE, FALSE, 5),
    (v_empresa_id, 'cancelado',    'Cancelado',     '#d9534f', FALSE, TRUE,  FALSE, 99);

    -- Categorias
    INSERT INTO categorias (empresa_id, slug, nome, icone, ordem) VALUES
    (v_empresa_id, 'todos',          'Todos os Produtos',         'fas fa-house',        0),
    (v_empresa_id, 'banheiro',       'Banheiro',                  'fas fa-bath',         1),
    (v_empresa_id, 'climatizacao',   'Climatização e Ventilação', 'fas fa-snowflake',    2),
    (v_empresa_id, 'cozinha',        'Cozinha e Áreas de Serviço','fas fa-utensils',     3),
    (v_empresa_id, 'decoracao',      'Decoração',                 'fas fa-couch',        4),
    (v_empresa_id, 'eletros',        'Eletros',                   'fas fa-plug',         5),
    (v_empresa_id, 'ferragens',      'Ferragens',                 'fas fa-link',         6),
    (v_empresa_id, 'ferramentas',    'Ferramentas',               'fas fa-tools',        7),
    (v_empresa_id, 'iluminacao',     'Iluminação',                'fas fa-lightbulb',    8),
    (v_empresa_id, 'jardim',         'Jardim e Varanda',          'fas fa-leaf',         9),
    (v_empresa_id, 'construcao',     'Materiais de Construção',   'fas fa-trowel-bricks',10),
    (v_empresa_id, 'eletrica',       'Materiais Elétricos',       'fas fa-bolt',         11),
    (v_empresa_id, 'hidraulica',     'Materiais Hidráulicos',     'fas fa-droplet',      12),
    (v_empresa_id, 'moveis',         'Móveis',                    'fas fa-chair',        13),
    (v_empresa_id, 'petshop',        'Pet Shop',                  'fas fa-paw',          14),
    (v_empresa_id, 'pintura',        'Pinturas e Acessórios',     'fas fa-paint-roller', 15),
    (v_empresa_id, 'pisos',          'Pisos e Revestimentos',     'fas fa-layer-group',  16),
    (v_empresa_id, 'esquadrias',     'Portas, Janelas e Portões', 'fas fa-door-open',    17),
    (v_empresa_id, 'torneiras',      'Torneiras',                 'fas fa-faucet',       18),
    (v_empresa_id, 'utilidades',     'Utilidades Domésticas',     'fas fa-blender',      19);

END $func$;

-- Produtos
DO $func$
DECLARE
    v_empresa_id INTEGER;
BEGIN
    SELECT id INTO v_empresa_id FROM empresas WHERE slug = 'araca-demo';

    INSERT INTO produtos (
        empresa_id, codigo_interno, nome, descricao, categoria_id, destaque,
        ncm, cfop_venda, peso_bruto, altura, largura, comprimento
    ) VALUES
    (v_empresa_id, 'TOR-001', 'Torneira Monocomando Inox', 'Torneira monocomando em aço inox 304, acabamento escovado, design moderno.', (SELECT id FROM categorias WHERE slug='banheiro' AND empresa_id=v_empresa_id), TRUE, '8481.80.99', '5102', 1.2, 30, 15, 20),
    (v_empresa_id, 'CHV-002', 'Chuveiro Elétrico Lorenzetti', 'Chuveiro elétrico com 4 temperaturas, resistência de alta durabilidade.', (SELECT id FROM categorias WHERE slug='banheiro' AND empresa_id=v_empresa_id), FALSE, '8481.80.99', '5102', 0.8, 25, 20, 15),
    (v_empresa_id, 'AR-003',  'Ar Condicionado Split 9000 BTU', 'Ar condicionado split inverter 9000 BTUs, econômico e silencioso.', (SELECT id FROM categorias WHERE slug='climatizacao' AND empresa_id=v_empresa_id), TRUE, '8415.10.10', '5102', 32.0, 80, 30, 25),
    (v_empresa_id, 'VT-004',  'Ventilador de Teto 3 Pás', 'Ventilador de teto com 3 pás em MDF, motor silencioso e 3 velocidades.', (SELECT id FROM categorias WHERE slug='climatizacao' AND empresa_id=v_empresa_id), FALSE, '8414.51.00', '5102', 4.5, 40, 40, 20),
    (v_empresa_id, 'CUB-005', 'Cuba de Inox para Cozinha', 'Cuba de embutir em aço inox 304, acabamento acetinado.', (SELECT id FROM categorias WHERE slug='cozinha' AND empresa_id=v_empresa_id), TRUE, '7324.10.00', '5102', 3.2, 50, 40, 25),
    (v_empresa_id, 'TOR-006', 'Torneira Gourmet Cozinha', 'Torneira gourmet com mangueira extensível, dois jatos de água.', (SELECT id FROM categorias WHERE slug='cozinha' AND empresa_id=v_empresa_id), FALSE, '8481.80.99', '5102', 1.5, 35, 18, 22),
    (v_empresa_id, 'ESP-007', 'Espelho Decorativo Redondo', 'Espelho decorativo redondo com moldura em metal preto fosco. Diâmetro 60cm.', (SELECT id FROM categorias WHERE slug='decoracao' AND empresa_id=v_empresa_id), FALSE, '7009.91.00', '5102', 2.8, 60, 60, 3),
    (v_empresa_id, 'VAS-008', 'Vaso de Cerâmica Moderno', 'Vaso de cerâmica com acabamento texturizado em tons de cinza.', (SELECT id FROM categorias WHERE slug='decoracao' AND empresa_id=v_empresa_id), FALSE, '6913.90.00', '5102', 0.9, 25, 15, 15),
    (v_empresa_id, 'FUR-009', 'Furadeira Parafusadeira 12V', 'Furadeira parafusadeira à bateria 12V, com 2 velocidades.', (SELECT id FROM categorias WHERE slug='ferramentas' AND empresa_id=v_empresa_id), TRUE, '8467.21.00', '5102', 1.8, 25, 20, 10),
    (v_empresa_id, 'SER-010', 'Serra Circular 7-1/4" 1400W', 'Serra circular com disco de 7-1/4 polegadas, potência de 1400W.', (SELECT id FROM categorias WHERE slug='ferramentas' AND empresa_id=v_empresa_id), FALSE, '8467.22.00', '5102', 4.2, 30, 25, 20),
    (v_empresa_id, 'LUM-011', 'Luminária Pendente Industrial', 'Luminária pendente estilo industrial com cúpula em metal preto.', (SELECT id FROM categorias WHERE slug='iluminacao' AND empresa_id=v_empresa_id), FALSE, '9405.10.00', '5102', 1.1, 25, 25, 25),
    (v_empresa_id, 'SPO-012', 'Spot LED Embutir 7W', 'Spot de embutir LED 7W, luz branca fria 6500K. Caixa com 4 unidades.', (SELECT id FROM categorias WHERE slug='iluminacao' AND empresa_id=v_empresa_id), FALSE, '9405.40.00', '5102', 0.3, 10, 10, 5),
    (v_empresa_id, 'FEC-013', 'Fechadura Eletrônica Digital', 'Fechadura eletrônica com biometria, senha e cartão RFID.', (SELECT id FROM categorias WHERE slug='ferragens' AND empresa_id=v_empresa_id), TRUE, '8301.40.00', '5102', 2.5, 20, 15, 8),
    (v_empresa_id, 'DOB-014', 'Dobradiça Reta 3-1/2" 3 Unid.', 'Dobradiça reta em aço zincado, 3-1/2 polegadas. Embalagem com 3 unidades.', (SELECT id FROM categorias WHERE slug='ferragens' AND empresa_id=v_empresa_id), FALSE, '8302.10.00', '5102', 0.2, 5, 4, 3),
    (v_empresa_id, 'CHU-015', 'Churrasqueira de Tijolo', 'Churrasqueira pré-moldada em tijolo refratário.', (SELECT id FROM categorias WHERE slug='jardim' AND empresa_id=v_empresa_id), TRUE, '7321.11.00', '5102', 45.0, 120, 80, 60),
    (v_empresa_id, 'VAS-016', 'Vaso Autoirrigável 40cm', 'Vaso autoirrigável em polipropileno, sistema de reserva de água.', (SELECT id FROM categorias WHERE slug='jardim' AND empresa_id=v_empresa_id), FALSE, '3926.90.00', '5102', 0.4, 40, 40, 35),
    (v_empresa_id, 'GEL-017', 'Geladeira Frost Free 375L', 'Geladeira frost free com 375 litros, prateleiras de vidro temperado.', (SELECT id FROM categorias WHERE slug='eletros' AND empresa_id=v_empresa_id), TRUE, '8418.10.00', '5102', 62.0, 170, 65, 70),
    (v_empresa_id, 'MIC-018', 'Micro-ondas 30L Inox', 'Micro-ondas com capacidade de 30 litros, painel digital.', (SELECT id FROM categorias WHERE slug='eletros' AND empresa_id=v_empresa_id), FALSE, '8516.50.00', '5102', 12.5, 30, 50, 35),
    (v_empresa_id, 'MIS-019', 'Misturador Monocomando Luxo', 'Misturador monocomando para lavatório com acabamento cromado premium.', (SELECT id FROM categorias WHERE slug='banheiro' AND empresa_id=v_empresa_id), FALSE, '8481.80.99', '5102', 1.0, 20, 15, 15),
    (v_empresa_id, 'EXA-020', 'Exaustor para Cozinha 60cm', 'Depurador de ar com 3 velocidades, filtro de alumínio lavável.', (SELECT id FROM categorias WHERE slug='cozinha' AND empresa_id=v_empresa_id), FALSE, '8414.60.00', '5102', 5.5, 15, 60, 40);

    -- Preços na tabela Varejo
    INSERT INTO produto_precos (empresa_id, produto_id, tabela_id, preco, preco_promocional)
    SELECT v_empresa_id, p.id, t.id,
        CASE p.codigo_interno
            WHEN 'TOR-001' THEN 249.90 WHEN 'CHV-002' THEN 189.50 WHEN 'AR-003'  THEN 1899.00
            WHEN 'VT-004'  THEN 349.90 WHEN 'CUB-005' THEN 599.00 WHEN 'TOR-006' THEN 429.90
            WHEN 'ESP-007' THEN 199.90 WHEN 'VAS-008' THEN 89.90  WHEN 'FUR-009' THEN 299.00
            WHEN 'SER-010' THEN 459.00 WHEN 'LUM-011' THEN 179.90 WHEN 'SPO-012' THEN 39.90
            WHEN 'FEC-013' THEN 799.00 WHEN 'DOB-014' THEN 24.90  WHEN 'CHU-015' THEN 459.00
            WHEN 'VAS-016' THEN 69.90  WHEN 'GEL-017' THEN 2899.00 WHEN 'MIC-018' THEN 699.00
            WHEN 'MIS-019' THEN 359.00 WHEN 'EXA-020' THEN 549.00
        END,
        CASE p.codigo_interno
            WHEN 'TOR-001' THEN 329.90 WHEN 'CHV-002' THEN 249.00 WHEN 'AR-003'  THEN 2399.00
            WHEN 'VT-004'  THEN 459.90 WHEN 'CUB-005' THEN 799.00 WHEN 'TOR-006' THEN 559.00
            WHEN 'ESP-007' THEN 279.00 WHEN 'VAS-008' THEN 129.00 WHEN 'FUR-009' THEN 399.00
            WHEN 'SER-010' THEN 599.00 WHEN 'LUM-011' THEN 249.00 WHEN 'SPO-012' THEN 59.00
            WHEN 'FEC-013' THEN 1099.00 WHEN 'DOB-014' THEN 34.90 WHEN 'CHU-015' THEN 599.00
            WHEN 'VAS-016' THEN 99.00  WHEN 'GEL-017' THEN 3599.00 WHEN 'MIC-018' THEN 899.00
            WHEN 'MIS-019' THEN 499.00 WHEN 'EXA-020' THEN 749.00
        END
    FROM produtos p
    CROSS JOIN tabelas_preco t
    WHERE p.empresa_id = v_empresa_id AND t.empresa_id = v_empresa_id AND t.descricao = 'Varejo';

    -- Estoque inicial no depósito padrão
    INSERT INTO produto_estoque (empresa_id, produto_id, deposito_id, saldo_fisico, saldo_reservado)
    SELECT v_empresa_id, p.id, d.id,
        CASE p.codigo_interno
            WHEN 'TOR-001' THEN 15 WHEN 'CHV-002' THEN 23 WHEN 'AR-003'  THEN 8
            WHEN 'VT-004'  THEN 12 WHEN 'CUB-005' THEN 10 WHEN 'TOR-006' THEN 18
            WHEN 'ESP-007' THEN 20 WHEN 'VAS-008' THEN 30 WHEN 'FUR-009' THEN 14
            WHEN 'SER-010' THEN 7  WHEN 'LUM-011' THEN 16 WHEN 'SPO-012' THEN 50
            WHEN 'FEC-013' THEN 6  WHEN 'DOB-014' THEN 40 WHEN 'CHU-015' THEN 5
            WHEN 'VAS-016' THEN 25 WHEN 'GEL-017' THEN 4  WHEN 'MIC-018' THEN 11
            WHEN 'MIS-019' THEN 9  WHEN 'EXA-020' THEN 8
        END, 0
    FROM produtos p
    CROSS JOIN depositos d
    WHERE p.empresa_id = v_empresa_id AND d.empresa_id = v_empresa_id AND d.padrao = TRUE;

    -- Banners
    INSERT INTO banners (empresa_id, imagem, titulo, subtitulo, link, ordem) VALUES
    (v_empresa_id, 'images/banner_cozinha_hd.jpg',  'Transforme sua Cozinha',     'Design sofisticado e funcionalidade para o coração da sua casa',        'index.html?categoria=cozinha',   0),
    (v_empresa_id, 'images/banner_banheiro_hd.jpg', 'O Banheiro dos seus Sonhos', 'Conforto e elegância com acabamentos premium de alta qualidade',        'index.html?categoria=banheiro',  1),
    (v_empresa_id, 'images/banner_jardim_hd.jpg',   'Ambientes para Relaxar',     'Crie espaços externos acolhedores e cheios de estilo para sua família', 'index.html?categoria=jardim',    2);

END $func$;

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DO $func$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        AND tablename IN (
            'empresas','categorias','produtos','clientes','pedidos','contas_receber',
            'marcas','fornecedores','usuarios','tabelas_preco','carrinho','empresa_usuarios',
            'assinaturas','status_pedido_cfg','depositos','formas_pagamento',
            'condicoes_pagamento','transportadoras','banners'
        )
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            t, t
        );
    END LOOP;
END $func$;

CREATE OR REPLACE FUNCTION gerar_numero_pedido()
RETURNS TRIGGER AS $func$
DECLARE
    ano VARCHAR(4);
    seq INTEGER;
BEGIN
    ano := TO_CHAR(CURRENT_DATE, 'YYYY');
    SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '^PED-\\d{4}-', ''), '')), '0')::INTEGER + 1
    INTO seq FROM pedidos
    WHERE empresa_id = NEW.empresa_id AND numero LIKE 'PED-' || ano || '-%';
    NEW.numero := 'PED-' || ano || '-' || LPAD(seq::TEXT, 6, '0');
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedido_numero
    BEFORE INSERT ON pedidos
    FOR EACH ROW WHEN (NEW.numero IS NULL)
    EXECUTE FUNCTION gerar_numero_pedido();

CREATE OR REPLACE FUNCTION reservar_estoque_pedido()
RETURNS TRIGGER AS $func$
DECLARE
    v_deposito_id INTEGER;
BEGIN
    SELECT id INTO v_deposito_id FROM depositos WHERE empresa_id = NEW.empresa_id AND padrao = TRUE LIMIT 1;
    IF NEW.deposito_id IS NULL THEN
        NEW.deposito_id := v_deposito_id;
    END IF;

    UPDATE produto_estoque
    SET saldo_reservado = saldo_reservado + NEW.quantidade,
        updated_at = CURRENT_TIMESTAMP
    WHERE empresa_id = NEW.empresa_id AND produto_id = NEW.produto_id AND deposito_id = NEW.deposito_id;

    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER trg_itens_reserva
    AFTER INSERT ON itens_pedido
    FOR EACH ROW EXECUTE FUNCTION reservar_estoque_pedido();

CREATE OR REPLACE FUNCTION liberar_estoque_pedido()
RETURNS TRIGGER AS $func$
BEGIN
    UPDATE produto_estoque
    SET saldo_reservado = GREATEST(saldo_reservado - OLD.quantidade, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE empresa_id = OLD.empresa_id AND produto_id = OLD.produto_id AND deposito_id = OLD.deposito_id;
    RETURN OLD;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER trg_itens_libera
    AFTER DELETE ON itens_pedido
    FOR EACH ROW EXECUTE FUNCTION liberar_estoque_pedido();

CREATE OR REPLACE FUNCTION baixar_estoque_faturamento()
RETURNS TRIGGER AS $func$
BEGIN
    IF NEW.faturado = TRUE AND OLD.faturado = FALSE THEN
        INSERT INTO movimento_estoque (
            empresa_id, produto_id, deposito_id, tipo, quantidade,
            quantidade_anterior, quantidade_nova, motivo, pedido_id
        )
        SELECT
            i.empresa_id,
            i.produto_id,
            i.deposito_id,
            'saida_venda',
            -i.quantidade,
            e.saldo_fisico,
            e.saldo_fisico - i.quantidade,
            'Faturamento pedido ' || NEW.numero,
            NEW.id
        FROM itens_pedido i
        JOIN produto_estoque e ON e.empresa_id = i.empresa_id
            AND e.produto_id = i.produto_id AND e.deposito_id = i.deposito_id
        WHERE i.pedido_id = NEW.id;

        UPDATE produto_estoque e
        SET saldo_fisico = e.saldo_fisico - i.quantidade,
            saldo_reservado = GREATEST(e.saldo_reservado - i.quantidade, 0),
            updated_at = CURRENT_TIMESTAMP
        FROM itens_pedido i
        WHERE i.pedido_id = NEW.id
          AND e.empresa_id = i.empresa_id
          AND e.produto_id = i.produto_id
          AND e.deposito_id = i.deposito_id;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedido_baixa_estoque
    AFTER UPDATE ON pedidos
    FOR EACH ROW WHEN (NEW.faturado IS DISTINCT FROM OLD.faturado)
    EXECUTE FUNCTION baixar_estoque_faturamento();

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
