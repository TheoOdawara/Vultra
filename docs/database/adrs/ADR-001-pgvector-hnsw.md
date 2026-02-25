# ADR-001 — pgvector com Índice HNSW para Busca Vetorial

> **Status:** Aceito  
> **Data:** Fevereiro 2026  
> **Contexto:** Camada de Dados — Busca por Reconhecimento Facial

---

## Contexto

O VULTRA precisa armazenar embeddings faciais (vetores float32 de 512 dimensões) e realizar buscas por similaridade em tempo real durante o reconhecimento. O critério de performance é: latência < 200ms para tenants com até 500k perfis biométricos.

---

## Decisão

Usar **pgvector** como extensão de vetores no PostgreSQL existente, com índice **HNSW** (`vector_cosine_ops`).

---

## Alternativas Avaliadas

| Opção | Avaliação |
|-------|-----------|
| **pgvector + HNSW** | ✅ Escolhida — integra com o PostgreSQL existente, sem serviço extra |
| pgvector + IVFFlat | ⚠️ Mais rápido para build, porém menor precisão em recall |
| Pinecone (SaaS) | ❌ Dependência externa gerenciada, custo variável, dados biométricos fora do controle |
| Weaviate | ❌ Serviço adicional — operacionalmente mais complexo |
| Qdrant | ❌ Idem — overhead operacional sem benefício proporcional ao volume atual |

---

## Justificativa da Escolha

1. **Sem serviço extra:** pgvector roda dentro do PostgreSQL já existente — zero overhead de infraestrutura.
2. **HNSW vs IVFFlat:** HNSW tem recall superior e não requer parâmetro `lists` que depende do volume de dados. Mais adequado para crescimento orgânico.
3. **Conformidade LGPD:** Dados biométricos permanecem no banco gerenciado internamente — não saem para serviços de terceiros.
4. **`vector_cosine_ops`:** Alinhado com o espaço métrico do ArcFace, que foi treinado com perda de cosseno.

---

## Consequências

- **Positivas:** Stack simplificada, ACID garantido, backup unificado com resto do banco, sem SDK externo no código.
- **Negativas:** pgvector tem limitações para datasets > 10M vetores — nesse volume futuro, migrar para solução dedicada.
- **Parâmetros:** `m=16, ef_construction=64` para até ~500k vetores. Reavaliação necessária ao cruzar esse volume.
