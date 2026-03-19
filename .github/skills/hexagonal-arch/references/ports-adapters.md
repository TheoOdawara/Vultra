# Ports e Adapters — Interfaces e Implementações

## Port (Interface) — `core/ports/`

O port define o **contrato** que o adapter deve implementar. Sem dependências externas.

```typescript
// core/ports/IBiometricRepository.ts
import type { BiometricProfile } from '../domain/entities/BiometricProfile';

export interface IBiometricRepository {
  findByEmbedding(
    embedding: number[],
    organizationId: string,
    modelVersion?: string,
  ): Promise<{ memberId: string; similarity: number } | null>;

  enroll(data: {
    memberId:       string;
    organizationId: string;
    embedding:      number[];
    modelVersion:   string;
    qualityScore:   number;
  }): Promise<BiometricProfile>;

  deactivate(memberId: string, organizationId: string): Promise<void>;
}
```

```typescript
// core/ports/IAIQueueAdapter.ts
export interface IAIQueueAdapter {
  processFrame(input: {
    frameBase64:    string;
    organizationId: string;
  }): Promise<{
    embedding:  number[];
    sentiment?: { label: string; score: number };
  }>;

  getCircuitState(): Promise<'CLOSED' | 'OPEN' | 'HALF_OPEN'>;
}
```

---

## Adapter (Implementação) — `adapters/repositories/`

O adapter implementa o port usando Drizzle/Redis/etc.

```typescript
// adapters/repositories/biometric.repository.ts
import type { IBiometricRepository } from '../../core/ports/IBiometricRepository';
import { withTenantContext, withEfSearch } from '../../infrastructure/database/client';
import { sql, eq, and }  from 'drizzle-orm';
import * as schema       from '../../infrastructure/database/schema';

export class DrizzleBiometricRepository implements IBiometricRepository {
  constructor(private readonly db: Database) {}

  async findByEmbedding(embedding, organizationId, modelVersion = 'ArcFace-v1') {
    return withTenantContext(organizationId, (tx) =>
      withEfSearch(tx, 80, async (txEf) => {
        const vec = `[${embedding.join(',')}]`;
        const [result] = await txEf.execute<{ member_id: string; similarity: number }>(sql`
          SELECT member_id, 1 - (face_embedding <=> ${vec}::vector) AS similarity
          FROM biometric_profiles
          WHERE organization_id = ${organizationId}
            AND model_version = ${modelVersion}
            AND is_active = TRUE
          ORDER BY face_embedding <=> ${vec}::vector
          LIMIT 1
        `);
        if (!result || result.similarity < 0.85) return null;
        return { memberId: result.member_id, similarity: result.similarity };
      })
    );
  }

  async deactivate(memberId, organizationId) {
    await withTenantContext(organizationId, (tx) =>
      tx.update(schema.biometricProfiles)
        .set({ isActive: false })
        .where(and(
          eq(schema.biometricProfiles.organizationId, organizationId),
          eq(schema.biometricProfiles.memberId, memberId),
        ))
    );
  }
}
```
