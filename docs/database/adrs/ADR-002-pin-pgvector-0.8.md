# ADR-002 — Pin do pgvector em 0.8.6 (tag exata, sem tag flutuante)

> **Status:** Aceito
> **Data:** Agosto 2026
> **Contexto:** Camada de Dados — Reprodutibilidade dos experimentos da Iniciação Científica

---

## Contexto

O `infra/docker-compose.yml` usava a imagem `pgvector/pgvector:pg16` — uma **tag flutuante** que aponta para a versão mais recente do pgvector compilada para PostgreSQL 16. A documentação do projeto referenciava pgvector 0.7, mas a tag entregava qualquer versão a depender de quando o `docker pull` fosse feito.

Dois problemas:

1. **Reprodutibilidade científica.** O paper da IC mede o impacto do isolamento multitenant (RLS/filtros) sobre o recall do índice HNSW e o traduz em taxas de erro biométrico (FNIR/FPIR). O comportamento da busca filtrada mudou **materialmente** entre pgvector 0.7 e 0.8: a 0.8 introduziu o `iterative_scan` (`hnsw.iterative_scan = off | strict_order | relaxed_order`), que continua varrendo o grafo quando o filtro descarta candidatos — exatamente o mecanismo que um dos experimentos varre. Resultados obtidos em versões diferentes não são comparáveis; uma tag flutuante torna o setup experimental irreproduzível.
2. **Deriva silenciosa em desenvolvimento.** Dois desenvolvedores com pulls em datas diferentes podem observar comportamentos de índice diferentes sem nenhuma mudança no repo.

---

## Decisão

1. Pinar a imagem em **`pgvector/pgvector:0.8.6-pg16-bookworm`** (versão exata; 0.8.6 é a última da série 0.8.x na data desta decisão). O sufixo `-bookworm` é explícito porque a tag `0.8.6-pg16` resolve para essa variante hoje, mas o repositório publica também `-trixie` — com o sufixo, a base do sistema deixa de flutuar.
2. Adicionar o smoke test **`infra/scripts/check-pgvector.sh`**, que compara a versão disponível/instalada no container com a tag pinada no compose e falha em divergência.
3. A versão exata do pgvector passa a constar na seção de setup experimental do paper.

---

## Regras de upgrade

- Upgrade de versão é **sempre deliberado**: alterar a tag no `docker-compose.yml`, rodar `ALTER EXTENSION vector UPDATE;` nos bancos existentes e registrar a mudança (o smoke test aponta divergência entre imagem e extensão instalada).
- A tag pinada fixa a versão do pgvector e a base do sistema, mas ainda é reconstruída quando o PostgreSQL 16 recebe um patch. O congelamento definitivo é por digest: registrar o `sha256` de `docker image inspect pgvector/pgvector:0.8.6-pg16-bookworm` junto aos resultados e citá-lo na seção de setup do paper.
- **Durante a janela de coleta de dados dos experimentos, a versão é congelada** — nenhum upgrade, nem de patch, até a rodada terminar.
- Índices HNSW criados em versões anteriores permanecem válidos após `ALTER EXTENSION ... UPDATE`, mas para os experimentos os índices devem ser **recriados na versão pinada** (o build do grafo é parte do objeto de estudo).

---

## Consequências

- **Positivas:** setup experimental citável e reproduzível; `iterative_scan` disponível para o experimento de varredura; sem deriva silenciosa entre ambientes.
- **Negativas:** correções de bug do pgvector não chegam automaticamente — o upgrade vira tarefa explícita.
- **Relacionados:** [ADR-001 — pgvector com HNSW](./ADR-001-pgvector-hnsw.md) · pré-registro do desenho experimental em `docs/research/pre-registro.md`.
