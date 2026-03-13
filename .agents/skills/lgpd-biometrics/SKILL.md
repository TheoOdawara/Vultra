---
description: "Conformidade LGPD para dados biométricos — processamento RAM-only, minimização de dados e direitos do titular."
---

# LGPD Biometrics

Padrões de conformidade com a **LGPD (Lei 13.709/2018)** para tratamento de dados biométricos faciais. O princípio central é: **nenhuma imagem facial persiste em disco** — apenas o vetor numérico de embedding.

## When to Use This Skill

- Implementar ou modificar fluxos de registro ou reconhecimento biométrico
- Criar migrations que envolvam dados de `biometric_profiles`
- Implementar endpoints de exclusão de dados do titular (`/v1/biometric/:id`)
- Revisar conformidade de logs e audit trail
- Implementar consentimento ou versionamento de termos biométricos

## Quick Start

```typescript
// Fluxo correto: frame chega base64 → RAM → embedding → descarte
async execute(dto: { frameBase64: string; organizationId: string }) {
  // 1. Enviar para AI Service via Redis (processamento em RAM no Python)
  const job: AIJob = {
    job_id:          crypto.randomUUID(),
    organization_id: dto.organizationId,
    frame_base64:    dto.frameBase64,   // NUNCA persistir, nunca logar
    model_name:      'ArcFace',
  };

  await this.aiQueue.enqueue(job);          // lpush → Python processa → rpush resultado
  const result = await this.aiQueue.dequeue(job.job_id);

  // 2. Persistir APENAS o vetor (512 floats) — nunca a imagem
  await this.repo.save({
    organizationId: dto.organizationId,
    embedding:      result.vector,         // vector(512)
    modelVersion:   'ArcFace_v1',
    isActive:       true,
  });

  // dto.frameBase64 é descartado aqui — GC da V8 recolhe
}
```

## Key Rules

| Regra | Base Legal | Implementação |
|-------|-----------|---------------|
| Zero persistência de imagem | LGPD Art. 11 (dado sensível) | Processar em RAM, nunca `imwrite` ou `/tmp` |
| Soft delete para direito ao esquecimento | LGPD Art. 18-VI | `face_embedding = NULL; is_active = false` |
| Audit log imutável | LGPD Art. 6-X (qualidade/rastreabilidade) | Trigger impede UPDATE/DELETE em `audit_logs` |
| Consentimento versionado | LGPD Art. 7-I / Art. 11 | Campo `consent_version` em `organizations.settings` |
| Isolamento por `organization_id` | Princípio da finalidade / LGPD Art. 6 | WHERE em todo SELECT de `biometric_profiles` |

## Resources

- [Processamento RAM-only — fluxo completo Python/DeepFace](references/ram-processing.md)
- [Compliance LGPD — artigos, soft delete, audit trail, consentimento](references/compliance.md)
- [Docs segurança e LGPD](../../../docs/backend/guias/seguranca-lgpd.md)
- [Docs processamento RAM](../../../docs/backend/arquitetura/processamento-ram.md)
- [ADR-002 — ArcFace modelo padrão](../../../docs/backend/adrs/ADR-002-arcface-modelo-padrao.md)
