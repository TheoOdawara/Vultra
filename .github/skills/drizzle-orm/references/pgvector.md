# Busca Vetorial — pgvector + ArcFace

## Operadores pgvector

| Operador | Métrica | Uso |
|----------|---------|-----|
| `<=>` | Distância cosseno | **Padrão Vultra** — alinhado com ArcFace |
| `<->` | Distância euclidiana | Não usar — ArcFace não é calibrado para L2 |
| `<#>` | Produto interno negativo | Não usar |

O pgvector não tem suporte nativo no Drizzle — usar `sql` raw.

---

## Padrão de Query de Reconhecimento

**Ordem dos filtros no WHERE é crítica** — o planner PostgreSQL usa o índice B-Tree de `organization_id` antes de ativar o HNSW.

```typescript
// adapters/repositories/biometric.repository.ts
import { sql } from 'drizzle-orm';
import { withTenantContext, withEfSearch } from '../../infrastructure/database/client';

export async function findMemberByEmbedding(
  embedding: number[],
  organizationId: string,
  modelVersion = 'ArcFace-v1',
  threshold = 0.85,
): Promise<{ memberId: string; similarity: number } | null> {
  return withTenantContext(organizationId, (tx) =>
    withEfSearch(tx, 80, async (txEf) => {
      const vec = `[${embedding.join(',')}]`;

      const [result] = await txEf.execute<{
        member_id: string;
        similarity: number;
      }>(sql`
        SELECT
          member_id,
          1 - (face_embedding <=> ${vec}::vector) AS similarity
        FROM biometric_profiles
        WHERE
          organization_id = ${organizationId}   -- 1º: B-Tree index
          AND model_version = ${modelVersion}   -- 2º: evita mismatch de modelo
          AND is_active = TRUE                  -- 3º: exclui perfis inativos (LGPD)
        ORDER BY face_embedding <=> ${vec}::vector  -- HNSW ativado aqui
        LIMIT 1
      `);

      // Threshold aplicado na aplicação — não no SQL (flexibilidade)
      if (!result || result.similarity < threshold) return null;
      return result;
    })
  );
}
```

---

## Thresholds ArcFace (Similaridade Cosseno)

| Similaridade | Ação | Código HTTP |
|---|---|---|
| `>= 0.85` | Match confirmado — registra presença | 200 |
| `0.75 – 0.84` | Match com baixa confiança — revisão manual | 422 `LOW_CONFIDENCE_MATCH` |
| `< 0.75` | Face não reconhecida | 404 `FACE_NOT_RECOGNIZED` |

**Atenção:** 0.85 é calibrado exclusivamente para **ArcFace**. Não aplicar a outros modelos sem recalibração.

---

## `model_version` — Obrigatório

Embeddings de modelos diferentes **não são comparáveis**. Misturar produz matches errados silenciosamente.

Valores válidos:
- `'ArcFace-v1'` — padrão atual do Vultra (ADR-002)
- `'ArcFace-v2'` — versão futura
- `'Facenet512-v1'` — alternativa documentada

Toda query de reconhecimento **deve** incluir `AND model_version = $currentModel`.

---

## Índice HNSW (referência)

O índice é criado na migration `0009_create_hnsw_index.sql`:

```sql
CREATE INDEX idx_biometric_profiles_hnsw
  ON biometric_profiles USING hnsw (face_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

Para > 500k vetores por tenant: aumentar para `m = 32, ef_construction = 128`.

Recriar em produção (sem lock): `CREATE INDEX CONCURRENTLY`.
