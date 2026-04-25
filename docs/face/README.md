# Reconhecimento Facial — Contrato Canônico

> Estado atual da feature biométrica facial no Vultra.
> Decisão arquitetural relacionada: [ADR-006 — Reutilização de `biometric_profiles` e Rate Limiting da Superfície Biométrica](../backend/adrs/ADR-006-biometric-profiles-e-rate-limiting-biometria.md)

---

## Resumo executivo

- **Recurso canônico:** `biometric_profiles`
- **Superfície HTTP canônica:** `/v1/face/*`
- **Legado `/v1/biometric/*`:** descontinuado, responde `404`
- **Revogação canônica:** `DELETE /v1/face/:profileId`
- **Persistência sensível:** somente `face_embedding` (`vector(512)`) em `biometric_profiles`
- **Imagens/faces em base64:** nunca persistidas

---

## Endpoints finais

| Método | Rota | Finalidade |
|--------|------|------------|
| `POST` | `/v1/face/enroll` | Cadastra um novo perfil biométrico para um membro |
| `POST` | `/v1/face/verify` | Verifica um frame contra perfis ativos do tenant |
| `GET` | `/v1/face/list` | Lista perfis biométricos ativos |
| `DELETE` | `/v1/face/:profileId` | Revoga um perfil biométrico por `profileId` |

> Todas as operações exigem autenticação de usuário e isolamento por `organizationId`.

---

## RBAC observado

| Papel | Enroll | Verify | List | Delete |
|------|--------|--------|------|--------|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `professor` | ✅ | ✅ | ✅ | ✅ |
| `rh` | ❌ | ✅ | ✅ | ❌ |
| `student` | ❌ | ❌ | ❌ | ❌ |

---

## Contratos HTTP

### `POST /v1/face/enroll`

**Request**

```json
{
  "memberId": "11111111-1111-1111-1111-111111111111",
  "frameBase64": "<base64>"
}
```

**Response `201`**

```json
{
  "profileId": "profile-1",
  "qualityScore": 0.91,
  "modelVersion": "ArcFace-v1",
  "processingMs": 98
}
```

Notas:
- gera `jobId` na rota;
- usa `biometric_profiles` como persistência final;
- se já existir perfil ativo para o mesmo membro/modelo, o perfil anterior é desativado antes da inserção do novo.

### `POST /v1/face/verify`

**Request**

```json
{
  "frameBase64": "<base64>",
  "memberId": "11111111-1111-1111-1111-111111111111"
}
```

`memberId` é **opcional** e atua como filtro 1:N dentro do tenant.

**Response `200` — sempre para resultado biométrico válido**

`MATCH`

```json
{
  "result": "MATCH",
  "memberId": "member-1",
  "confidence": 0.91,
  "processingMs": 98
}
```

`POSSÍVEL`

```json
{
  "result": "POSSÍVEL",
  "memberId": "member-1",
  "confidence": 0.8,
  "processingMs": 132
}
```

`SEM_MATCH`

```json
{
  "result": "SEM_MATCH",
  "confidence": 0,
  "processingMs": 111
}
```

Notas:
- `verify` não usa `404` para ausência de match;
- `SEM_MATCH` não inclui `memberId`;
- `last_matched_at` é atualizado somente em `MATCH`.

### `GET /v1/face/list`

**Query params**

- `memberId?` — filtro opcional por membro

**Response `200`**

```json
[
  {
    "profileId": "profile-1",
    "organizationId": "org-1",
    "memberId": "member-1",
    "modelVersion": "ArcFace-v1",
    "qualityScore": 0.91,
    "isActive": true,
    "deviceId": null,
    "createdBy": "user-1",
    "enrolledAt": "2026-04-25T00:00:00.000Z",
    "lastMatchedAt": null,
    "deletedAt": null,
    "deletedBy": null
  }
]
```

Notas:
- a listagem expõe somente metadados sanitizados;
- `face_embedding` nunca faz parte da resposta;
- o repositório lista apenas perfis ativos.

### `DELETE /v1/face/:profileId`

**Response `200`**

```json
{
  "success": true
}
```

Notas:
- revogação é feita por `profileId`, não por `memberId`;
- o perfil precisa pertencer ao tenant atual e estar ativo.

---

## Thresholds observáveis

### Verificação

| Resultado | Regra |
|----------|-------|
| `MATCH` | similaridade `> 0.85` |
| `POSSÍVEL` | similaridade `>= 0.75` e `<= 0.85` |
| `SEM_MATCH` | sem perfil elegível ou similaridade `< 0.75` |

### Enroll

| Regra | Efeito |
|------|--------|
| `qualityScore < 0.50` | rejeita com `422 LOW_QUALITY` |
| `qualityScore >= 0.50` | permite persistência do perfil |

---

## Erros HTTP publicados

| Status | Código | Quando ocorre |
|--------|--------|---------------|
| `401` | `UNAUTHORIZED` | requisição sem autenticação |
| `403` | `INSUFFICIENT_PERMISSIONS` | papel sem permissão biométrica |
| `404` | `MEMBER_NOT_FOUND` | `memberId` fora do tenant em fluxos que exigem resolução do membro |
| `404` | `BIOMETRIC_PROFILE_NOT_FOUND` | `profileId` inexistente, inativo ou fora da organização no revoke |
| `404` | `NOT_FOUND` | rotas legadas `/v1/biometric/*` |
| `413` | `PAYLOAD_TOO_LARGE` | `frameBase64` acima de 1 MB |
| `422` | `VALIDATION_ERROR` | body/query/path inválido via TypeBox |
| `422` | `LOW_QUALITY` | qualidade insuficiente no enroll |
| `429` | `RATE_LIMIT_EXCEEDED` | limite por usuário ou por organização excedido |
| `503` | `AI_SERVICE_UNAVAILABLE` | indisponibilidade do AI Service / Circuit Breaker |

### Headers relevantes

| Header | Quando aparece |
|--------|----------------|
| `Retry-After` | obrigatório em `429`; opcional em `503` quando houver cooldown conhecido |

---

## Rate limiting biométrico

Aplicado em toda a superfície `/v1/face/*`:

- autenticação/autorização acontecem **antes** do limiter;
- o limite é avaliado por **usuário** e por **organização**;
- prevalece o primeiro limite excedido;
- resposta de bloqueio: `429` + `Retry-After`.

Parâmetros atuais da implementação:

| Dimensão | Limite |
|----------|--------|
| Usuário | `10` requisições por janela de `1s` |
| Organização | `20` requisições por janela de `1s` |
| Bloqueio | `60s` |

---

## Pipeline Redis + Circuit Breaker

Fluxo canônico:

1. rota `/v1/face/*` valida auth, RBAC, rate limit e tamanho do payload;
2. o backend gera `jobId` e publica o job em `ai:recognition:queue`;
3. o AI Service processa o frame **em RAM** e publica o resultado em `ai:recognition:result:{jobId}`;
4. o API Core aguarda o resultado com timeout de `3000 ms`;
5. o Circuit Breaker Redis protege a superfície biométrica contra falhas repetidas.

Parâmetros observáveis:

| Item | Valor |
|------|-------|
| Fila | `ai:recognition:queue` |
| Chave de resultado | `ai:recognition:result:{jobId}` |
| Timeout por job | `3000 ms` |
| TTL do resultado no Redis | `60 s` |
| Circuit Breaker abre após | `5` falhas |
| Cooldown OPEN → HALF_OPEN | `30 s` |

Estados do Circuit Breaker:

- `CLOSED` — operação normal
- `OPEN` — falha rápida com `503 AI_SERVICE_UNAVAILABLE`
- `HALF_OPEN` — janela de teste antes de fechar novamente

---

## Segurança e conformidade LGPD

- nenhuma imagem facial é persistida em banco, disco ou audit log;
- `audit_logs` biométricos não armazenam `frameBase64`, `embedding` ou `faceEmbedding`;
- o recurso sensível é `biometric_profiles`, sempre filtrado por `organizationId`;
- revoke LGPD:
  - `is_active = FALSE`
  - `face_embedding = NULL`
  - `deleted_at` e `deleted_by` preenchidos
- a migration `0015` adicionou rastreabilidade (`device_id`, `created_by`) e suporte explícito à revogação lógica.

---

## Compatibilidade legada

As rotas abaixo foram removidas da superfície pública e devem responder `404`:

- `POST /v1/biometric/enroll`
- `POST /v1/biometric/verify`
- `GET /v1/biometric/list`
- `DELETE /v1/biometric/:profileId`

---

## Referências

- [ADR-006 — Reutilização de `biometric_profiles` e Rate Limiting da Superfície Biométrica](../backend/adrs/ADR-006-biometric-profiles-e-rate-limiting-biometria.md)
- [Schema — `biometric_profiles`](../database/arquitetura/schema.md)
- [Backend — índice técnico](../backend/README.md)
