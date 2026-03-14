# LGPD Biometrics — Compliance

## Artigos LGPD Aplicáveis

| Artigo | Tema | Implementação no Vultra |
|--------|------|------------------------|
| Art. 5-II | Dado sensível (biométrico) | Classificação da `face_embedding` como dado sensível — restrição de acesso por role |
| Art. 7-I / 11 | Consentimento para biométrico | Campo `consent_version` em `organizations.settings` — consentimento versioned |
| Art. 6-X | Responsabilização e rastreabilidade | Tabela `audit_logs` com trigger de imutabilidade |
| Art. 18-VI | Direito ao esquecimento / exclusão | Soft delete: `face_embedding = NULL; is_active = false` |
| Art. 46 | Medidas de segurança | pgvector isolado por `organization_id`; RLS no PostgreSQL |

---

## Soft Delete — Direito ao Esquecimento

```typescript
// use-cases/DeleteBiometricProfileUseCase.ts
async execute(dto: { memberId: string; organizationId: string }) {
  // Soft delete: apagar embedding, manter histórico de presença
  await db
    .update(biometricProfiles)
    .set({
      faceEmbedding: null,     // dado biométrico removido
      isActive:      false,
      deletedAt:     new Date(),
    })
    .where(
      and(
        eq(biometricProfiles.memberId,       dto.memberId),
        eq(biometricProfiles.organizationId, dto.organizationId),
      )
    );

  // Audit log obrigatório para operação de exclusão
  await db.insert(auditLogs).values({
    organizationId: dto.organizationId,
    actorId:        currentUserId,
    action:         'biometric.delete',
    targetId:       dto.memberId,
    metadata:       { reason: 'lgpd_art18_request' },
  });
}
```

> **Nota:** Registros de presença (`attendance_records`) são mantidos para fins de auditoria, mas sem vínculo ao embedding (apenas `member_id`).

---

## Audit Log — Imutabilidade

```sql
-- Trigger que impede modificação de logs (append-only)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs são imutáveis — INSERT only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

---

## Consentimento Versionado

```typescript
// organizations.settings armazena versão de consentimento biométrico
interface OrganizationSettings {
  biometric_consent_version: string;  // ex: "2024-v2"
  biometric_consent_updated_at: string;
  data_retention_days: number;         // padrão: 365
}

// Verificar no momento do registro biométrico
async function assertConsentValid(organizationId: string, memberId: string) {
  const org = await getOrganization(organizationId);
  const consent = await getMemberConsent(memberId);

  if (consent.version !== org.settings.biometric_consent_version) {
    throw new ConsentRequiredError('Novo consentimento biométrico necessário');
  }
}
```

---

## Relatório de Impacto (RIPD) — Checklist

- [ ] Dados biométricos classificados como sensíveis (Art. 5-II)
- [ ] Base legal definida: consentimento (Art. 7-I) para cada titular
- [ ] Consentimento registrado e versionado no banco
- [ ] Mecanismo de exclusão implementado e testado (Art. 18-VI)
- [ ] Audit trail imutável em `audit_logs`
- [ ] Isolamento multitenant verificado (WHERE `organization_id`)
- [ ] RLS habilitado no PostgreSQL
- [ ] Política de retenção definida (`data_retention_days`)
- [ ] Acesso ao pgvector restrito por role (`rh`, `admin` apenas)
- [ ] Nenhum log imprime `frame_base64` ou vetor bruto completo
