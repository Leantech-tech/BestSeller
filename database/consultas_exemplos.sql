-- ============================================================
-- Consultas úteis para o SaaS BestSeller
-- ============================================================

-- --------------------------------------------------------
-- 1. Listar empresas ativas com dados do plano
-- --------------------------------------------------------
SELECT
    e.id,
    e.slug,
    e.nome_fantasia,
    e.cnpj,
    e.status,
    e.data_ativacao,
    e.data_expiracao,
    p.nome AS plano,
    a.status AS status_assinatura
FROM empresas e
LEFT JOIN assinaturas a ON a.empresa_id = e.id AND a.status = 'ativa'
LEFT JOIN planos p ON p.id = COALESCE(a.plano_id, e.plano_id)
ORDER BY e.created_at DESC;

-- --------------------------------------------------------
-- 2. Produtos de uma empresa específica com estoque
-- --------------------------------------------------------
SELECT
    p.codigo_interno,
    p.nome,
    pr.preco,
    pr.preco_promocional,
    e.saldo_fisico,
    e.saldo_reservado,
    e.saldo_disponivel,
    d.descricao AS deposito,
    c.nome AS categoria
FROM produtos p
JOIN produto_precos pr ON pr.produto_id = p.id AND pr.empresa_id = p.empresa_id
JOIN tabelas_preco tp ON tp.id = pr.tabela_id AND tp.descricao = 'Varejo'
LEFT JOIN produto_estoque e ON e.produto_id = p.id AND e.empresa_id = p.empresa_id
LEFT JOIN depositos d ON d.id = e.deposito_id AND d.empresa_id = p.empresa_id
LEFT JOIN categorias c ON c.id = p.categoria_id AND c.empresa_id = p.empresa_id
WHERE p.empresa_id = 1 AND p.ativo = TRUE
ORDER BY p.nome;

-- --------------------------------------------------------
-- 3. Pedidos pendentes de integração com o RP (por empresa)
-- --------------------------------------------------------
SELECT
    p.numero,
    p.total,
    p.sync_erp_status,
    c.nome AS cliente,
    p.created_at
FROM pedidos p
JOIN clientes c ON c.id = p.cliente_id AND c.empresa_id = p.empresa_id
WHERE p.empresa_id = 1
  AND p.sync_erp_status IN ('pendente', 'erro')
ORDER BY p.created_at;

-- --------------------------------------------------------
-- 4. Contas a receber vencidas (por empresa)
-- --------------------------------------------------------
SELECT
    cr.parcela || '/' || cr.total_parcelas AS parcela,
    cr.valor,
    cr.data_vencimento,
    CURRENT_DATE - cr.data_vencimento AS dias_atraso,
    fp.descricao AS forma_pagamento,
    c.nome AS cliente,
    p.numero AS pedido
FROM contas_receber cr
JOIN pedidos p ON p.id = cr.pedido_id AND p.empresa_id = cr.empresa_id
JOIN clientes c ON c.id = cr.cliente_id AND c.empresa_id = cr.empresa_id
LEFT JOIN formas_pagamento fp ON fp.id = cr.forma_pagamento_id AND fp.empresa_id = cr.empresa_id
WHERE cr.empresa_id = 1
  AND cr.data_vencimento < CURRENT_DATE
  AND cr.baixado = FALSE
  AND cr.status NOT IN ('cancelado', 'pago')
ORDER BY cr.data_vencimento;

-- --------------------------------------------------------
-- 5. Top produtos mais vendidos (por empresa)
-- --------------------------------------------------------
SELECT
    p.codigo_interno,
    p.nome,
    COALESCE(SUM(i.quantidade), 0) AS total_vendido,
    COALESCE(SUM(i.subtotal), 0) AS receita_total
FROM produtos p
LEFT JOIN itens_pedido i ON i.produto_id = p.id AND i.empresa_id = p.empresa_id
LEFT JOIN pedidos ped ON ped.id = i.pedido_id
    AND ped.empresa_id = i.empresa_id
    AND ped.status NOT IN ('cancelado')
    AND ped.faturado = TRUE
WHERE p.empresa_id = 1
GROUP BY p.id, p.codigo_interno, p.nome
ORDER BY total_vendido DESC
LIMIT 10;

-- --------------------------------------------------------
-- 6. Dashboard do dia (por empresa)
-- --------------------------------------------------------
SELECT
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS pedidos_hoje,
    SUM(total) FILTER (WHERE created_at >= CURRENT_DATE) AS faturamento_hoje,
    COUNT(*) FILTER (WHERE status = 'pendente') AS pendentes,
    COUNT(*) FILTER (WHERE status = 'pago') AS aguardando_separacao,
    COUNT(*) FILTER (WHERE sync_erp_status != 'confirmado') AS nao_integrados
FROM pedidos
WHERE empresa_id = 1 AND status != 'cancelado';

-- --------------------------------------------------------
-- 7. Verificar uso do plano (produtos vs limite)
-- --------------------------------------------------------
SELECT
    e.nome_fantasia,
    p.nome AS plano,
    p.limite_produtos,
    COUNT(DISTINCT pr.id) AS produtos_cadastrados,
    CASE WHEN p.limite_produtos IS NOT NULL
         THEN p.limite_produtos - COUNT(DISTINCT pr.id)
         ELSE NULL
    END AS restante
FROM empresas e
JOIN planos p ON p.id = e.plano_id
LEFT JOIN produtos pr ON pr.empresa_id = e.id AND pr.ativo = TRUE
WHERE e.id = 1
GROUP BY e.id, e.nome_fantasia, p.nome, p.limite_produtos;

-- --------------------------------------------------------
-- 8. Carrinho abandonado (por empresa)
-- --------------------------------------------------------
SELECT
    c.nome AS cliente,
    c.email,
    p.codigo_interno,
    p.nome AS produto,
    car.quantidade,
    car.preco_unitario,
    car.created_at,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - car.created_at)) AS dias_abandonado
FROM carrinho car
JOIN clientes c ON c.id = car.cliente_id AND c.empresa_id = car.empresa_id
JOIN produtos p ON p.id = car.produto_id AND p.empresa_id = car.empresa_id
WHERE car.empresa_id = 1
  AND car.created_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY dias_abandonado DESC;

-- --------------------------------------------------------
-- 9. Movimentação de estoque de um produto (por empresa)
-- --------------------------------------------------------
SELECT
    m.created_at,
    m.tipo,
    m.quantidade,
    m.quantidade_anterior,
    m.quantidade_nova,
    m.motivo,
    d.descricao AS deposito,
    u.nome AS usuario
FROM movimento_estoque m
JOIN depositos d ON d.id = m.deposito_id AND d.empresa_id = m.empresa_id
LEFT JOIN usuarios u ON u.id = m.usuario_id AND u.empresa_id = m.empresa_id
WHERE m.empresa_id = 1
  AND m.produto_id = (SELECT id FROM produtos WHERE empresa_id = 1 AND codigo_interno = 'TOR-001')
ORDER BY m.created_at DESC;

-- --------------------------------------------------------
-- 10. Ranking de clientes (por empresa)
-- --------------------------------------------------------
SELECT
    c.nome,
    c.email,
    COUNT(p.id) AS total_pedidos,
    COALESCE(SUM(p.total), 0) AS total_gasto,
    MAX(p.created_at) AS ultima_compra
FROM clientes c
LEFT JOIN pedidos p ON p.cliente_id = c.id AND p.empresa_id = c.empresa_id
    AND p.status NOT IN ('cancelado', 'pendente')
WHERE c.empresa_id = 1
GROUP BY c.id, c.nome, c.email
ORDER BY total_gasto DESC
LIMIT 20;
