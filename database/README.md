# BestSeller - Schema SaaS (Multi-tenant)

## Visão Geral

Este schema foi projetado para rodar como **SaaS multi-tenant**, onde cada empresa (tenant) tem seus dados completamente isolados no mesmo banco de dados, compartilhando apenas algumas tabelas globais como `unidades_medida`.

## Arquitetura Multi-tenant

Todas as tabelas possuem a coluna **`empresa_id`** que vincula o registro à empresa correta. As queries sempre devem filtrar por `empresa_id` para garantir isolamento dos dados.

## Como usar no DBeaver

1. Conecte-se ao PostgreSQL
2. Crie o banco:
   ```sql
   CREATE DATABASE araca_saas WITH ENCODING = 'UTF8';
   ```
3. Abra o `schema.sql` no editor SQL
4. **Certifique-se de que o banco ativo é o `araca_saas`** (verifique o dropdown na parte superior do SQL Editor)
5. Execute o script inteiro

---

## Estrutura

### Tabelas do SaaS (Gestão de Tenants)

| Tabela | Descrição |
|--------|-----------|
| **empresas** | Cadastro da empresa/tenant (dados da loja) |
| **planos** | Planos de assinatura disponíveis |
| **assinaturas** | Controle de pagamento e vigência |
| **empresa_usuarios** | Usuários do painel administrativo da empresa |

### Tabelas do E-commerce (todas com `empresa_id`)

| Tabela | Descrição |
|--------|-----------|
| **categorias** | Categorias hierárquicas de produtos |
| **produtos** | Catálogo completo com dados fiscais e logísticos |
| **produto_precos** | Preço do produto em cada tabela de preço |
| **produto_estoque** | Saldo físico/reservado/disponível por depósito |
| **movimento_estoque** | Histórico de todas as movimentações |
| **produto_imagens** | Galeria de imagens |
| **banners** | Slides do carrossel |
| **marcas** | Marcas/fabricantes |
| **fornecedores** | Fornecedores |
| **depositos** | Locais de estoque |
| **transportadoras** | Transportadoras |
| **tabelas_preco** | Tabelas de preço (Varejo, Atacado...) |
| **formas_pagamento** | PIX, Cartão, Boleto, Dinheiro |
| **condicoes_pagamento** | À Vista, 30/60/90 dias |
| **usuarios** | Vendedores e operadores da loja |
| **status_pedido_cfg** | Status de pedido configuráveis |
| **clientes** | Clientes da loja |
| **enderecos** | Endereços de entrega |
| **pedidos** | Pedidos de venda |
| **itens_pedido** | Itens com snapshot fiscal |
| **contas_receber** | Financeiro parcelado |
| **carrinho** | Carrinho persistente |
| **log_integracao** | Log de comunicação com o RP |

### Tabelas Globais (sem `empresa_id`)

| Tabela | Descrição |
|--------|-----------|
| **unidades_medida** | UN, KG, M, M2, CX, etc. (compartilhada entre tenants) |

---

## Constraints de unicidade

Todas as constraints `UNIQUE` incluem `empresa_id`, permitindo que tenants diferentes tenham:
- Códigos de produto iguais (`TOR-001` em empresas distintas)
- E-mails de clientes iguais
- Números de pedido iguais (isolados por empresa)

---

## Dados iniciais

O script já cria uma empresa de demonstração (`araca-demo`) com:
- 20 categorias
- 20 produtos com preços e estoque
- 3 banners
- 2 depósitos
- 3 tabelas de preço
- 5 formas de pagamento
- 4 condições de pagamento
- 6 status de pedido

---

## Segurança Multi-tenant

**Regra de ouro:** toda query no backend deve incluir `WHERE empresa_id = ?`:

```sql
-- ❌ ERRADO - expõe dados de todos os tenants
SELECT * FROM produtos WHERE ativo = TRUE;

-- ✅ CERTO - isola por empresa
SELECT * FROM produtos WHERE empresa_id = 1 AND ativo = TRUE;
```
