# 📐 Estratégia de Indexação

> **← [Voltar ao Database](../README.md)**

---

## Índice HNSW — `biometric_profiles.face_embedding`

O índice **HNSW (Hierarchical Navigable Small World)** é o coração da busca por reconhecimento facial. Ele permite busca aproximada por vizinhos mais próximos (ANN) em vetores 512d com latência de poucos milissegundos.

| Parâmetro | Valor |Descrição |
|-----------|-------|----------|
| `m` | `16` | Número de conexões por nó — controla a precisão vs. tamanho |
| `ef_construction` | `64` | Fator de construção — maior = melhor precisão, mais lento no build |
| `ops` | `vector_cosine_ops` | Comparação por distância cosseno (alinhado com ArcFace) |
| Escalabilidade | ~500k vetores | Parâmetros atuais adequados até este volume |

> Para datasets com **> 500k vetores**, considere `m=32, ef_construction=128` — custa mais RAM mas mantém precisão.

---

## Índices B-Tree

| Tabela | Coluna(s) | Tipo | Propósito |
|--------|-----------|------|-----------|
| `biometric_profiles` | HNSW em `face_embedding` | HNSW | Busca ANN vetorial |
| `attendance_records` | `(organization_id, member_id, recorded_at)` | B-Tree | Relatórios por período |
| `audit_logs` | `(organization_id, created_at DESC)` | B-Tree | Paginação temporal |
| `members` | `(organization_id, role)` | B-Tree | Filtros de listagem |
| `members` | `(organization_id)` | B-Tree | Listagem geral por tenant |

---

## Restrições de Performance

1. Toda query com `ORDER BY face_embedding <=> $1` deve incluir `WHERE organization_id = $2` **antes** do ORDER BY — o planner do PostgreSQL usa o índice B-Tree do `organization_id` para limitar o espaço de busca antes de aplicar o HNSW.

2. Nunca realizar busca vetorial sem o filtro de tenant — resulta em scan de toda a tabela e possível cross-tenant match.

3. O índice HNSW é construído em background e pode levar minutos em tabelas grandes. Em produção, criar o índice **antes** de inserir dados (ou usar `CONCURRENTLY`).
