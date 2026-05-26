# 📡 API Endpoints — Referência Completa

> **← [Voltar ao Backend](../README.md)**  
> **Última revisão:** Maio 2026

Todos os endpoints estão sob o prefixo `/v1`. Autenticação via Better Auth (JWT) é obrigatória em todas as rotas de usuário, exceto onde indicado.

---

## Índice

- [Biometria Facial — `/v1/face/*`](#biometria-facial)
- [Chamadas — `/v1/attendance/*`](#chamadas)
- [Membros — `/v1/members/*`](#membros)
- [Dispositivos — `/v1/devices/*`](#dispositivos)
- [Relatórios — `/v1/reports/*`](#relatórios)
- [Saúde — `/v1/health/*`](#saúde)

---

## Biometria Facial

> Contrato canônico completo em [face/README.md](../../../face/README.md).  
> Auth: Bearer JWT. Superfície protegida por rate limiting por usuário e organização.

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| `POST` | `/v1/face/enroll` | `biometrics:enroll` | Cadastra perfil biométrico para um membro |
| `POST` | `/v1/face/verify` | `biometrics:enroll` | Verifica frame contra perfis ativos do tenant |
| `GET` | `/v1/face/list` | `attendance:read` | Lista perfis biométricos ativos |
| `DELETE` | `/v1/face/:profileId` | `biometrics:enroll` | Revoga perfil biométrico (LGPD) |

---

## Chamadas

> Auth: Bearer JWT para rotas de usuário; `X-Device-Token` + `X-Organization-Id` + `X-Device-Id` para rotas de dispositivo.

### Rotas de Usuário

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| `POST` | `/v1/attendance/sessions` | `attendance:write` | Abre nova sessão de chamada |
| `PATCH` | `/v1/attendance/sessions/:id/close` | `attendance:write` | Encerra sessão de chamada |
| `POST` | `/v1/attendance/sessions/:id/records` | `attendance:write` | Registra presença manual |

### Rotas de Dispositivo (ESP32-CAM)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/v1/attendance/device/record` | `deviceAuthPlugin` | Registra presença via reconhecimento facial (fila Redis) |

---

## Membros

> Auth: Bearer JWT. RBAC: `attendance:read` para leitura, `attendance:write` para escrita.

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| `GET` | `/v1/members` | `attendance:read` | Lista membros do tenant com paginação e filtros |
| `POST` | `/v1/members` | `attendance:write` | Cria novo membro |
| `GET` | `/v1/members/:id` | `attendance:read` | Obtém membro por ID |
| `PATCH` | `/v1/members/:id` | `attendance:write` | Atualiza dados do membro |
| `DELETE` | `/v1/members/:id` | `attendance:write` | Desativa membro (soft-delete, LGPD) |

### Query params — `GET /v1/members`

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `role` | `admin\|professor\|rh\|student` | — | Filtra por role |
| `isActive` | `"true"\|"false"` | `"true"` | Filtra por status |
| `search` | `string` (max 100) | — | Busca por nome ou e-mail (ILIKE) |
| `limit` | `number` | `50` | Itens por página |
| `offset` | `number` | `0` | Deslocamento de paginação |

### Erros específicos

| Código | HTTP | Quando |
|--------|------|--------|
| `MEMBER_NOT_FOUND` | 404 | Membro inexistente ou de outro tenant |
| `MEMBER_EXTERNAL_CODE_CONFLICT` | 409 | `externalCode` já usado no tenant |

---

## Dispositivos

> Auth: Bearer JWT. RBAC: `biometrics:enroll` (somente `admin`) para escrita; `attendance:read` para listagem.  
> **⚠️ A `apiKey` é retornada APENAS UMA VEZ** no POST e no rotate-key. Armazene-a com segurança.

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| `GET` | `/v1/devices` | `attendance:read` | Lista dispositivos ESP32-CAM do tenant |
| `POST` | `/v1/devices` | admin (`biometrics:enroll`) | Registra novo dispositivo (retorna `apiKey` — **UMA VEZ**) |
| `PATCH` | `/v1/devices/:id` | admin | Atualiza metadados do dispositivo |
| `POST` | `/v1/devices/:id/rotate-key` | admin | Rotaciona a API key (chave antiga invalidada imediatamente — retorna nova **UMA VEZ**) |
| `DELETE` | `/v1/devices/:id` | admin | Desativa dispositivo |

### Query params — `GET /v1/devices`

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `isActive` | `"true"\|"false"\|"all"` | `"true"` | Filtra por status |

### Exemplo de resposta — `POST /v1/devices` (`201`)

```json
{
  "device": {
    "id": "11111111-...",
    "organizationId": "org-1",
    "label": "CAM-ENTRADA",
    "location": "Portaria",
    "firmwareVersion": null,
    "lastSeenAt": null,
    "isActive": true,
    "createdAt": "2026-05-26T00:00:00.000Z",
    "updatedAt": "2026-05-26T00:00:00.000Z"
  },
  "apiKey": "a3f9...64hex...chars"
}
```

> `apiKey` é um hex de 64 caracteres (32 bytes CSPRNG). Apenas o hash bcrypt é armazenado.

### Erros específicos

| Código | HTTP | Quando |
|--------|------|--------|
| `DEVICE_NOT_FOUND` | 404 | Dispositivo inexistente, inativo ou de outro tenant |

---

## Relatórios

> Auth: Bearer JWT.  
> RBAC: `reports:read` (admin + rh) para ambos os relatórios. Professores acessam apenas o relatório de presença, restrito às próprias sessões.

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| `GET` | `/v1/reports/attendance` | `reports:read` (ou professor autoscoped) | Relatório de presença por membro |
| `GET` | `/v1/reports/wellbeing` | `reports:read` | Relatório de bem-estar e alertas de sentimento (admin/RH apenas) |

### Query params — `GET /v1/reports/attendance`

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `from` | ISO 8601 | ✅ | Início da janela de análise |
| `to` | ISO 8601 | ✅ | Fim da janela de análise |
| `classId` | UUID | ❌ | Filtra por turma/classe |
| `professorId` | UUID | ❌ | Filtra por professor (admin/rh somente) |

### Query params — `GET /v1/reports/wellbeing`

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `from` | ISO 8601 | ✅ | Início da janela |
| `to` | ISO 8601 | ✅ | Fim da janela |
| `alertThreshold` | number | ❌ | Mínimo de eventos negativos para gerar alerta (padrão: 3) |

### Exemplo de resposta — `GET /v1/reports/attendance`

```json
{
  "rows": [
    {
      "memberId": "member-1",
      "memberName": "Ana Silva",
      "memberRole": "student",
      "totalSessions": 10,
      "attendedSessions": 9,
      "attendanceRate": 90,
      "lastAttendedAt": "2026-05-20T08:00:00.000Z"
    }
  ],
  "generatedAt": "2026-05-26T12:00:00.000Z",
  "filter": {
    "from": "2026-05-01T00:00:00.000Z",
    "to": "2026-05-26T23:59:59.000Z"
  }
}
```

### LGPD

Os relatórios não expõem embeddings, frames ou dados biométricos brutos. Apenas metadados e agregações estatísticas de presença e sentimento.

### Erros específicos

| Código | HTTP | Quando |
|--------|------|--------|
| `INVALID_REPORT_RANGE` | 422 | `from >= to` |

---

## Saúde

> Rota pública (sem autenticação).

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/v1/health/ai-service` | Estado do Circuit Breaker do AI Service |

### Exemplo de resposta — `GET /v1/health/ai-service`

```json
{
  "state": "CLOSED",
  "failureCount": 0,
  "lastFailureAt": null,
  "openedAt": null
}
```

Estados possíveis: `CLOSED` (normal), `OPEN` (falha rápida — `503`), `HALF_OPEN` (janela de teste).

---

## RBAC — Resumo de Permissões por Role

| Role | `attendance:read` | `attendance:write` | `reports:read` | `biometrics:enroll` |
|------|:-----------------:|:------------------:|:--------------:|:-------------------:|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `professor` | ✅ | ✅ | ❌ (parcial) | ✅ |
| `rh` | ✅ | ❌ | ✅ | ❌ |
| `student` | ✅ (próprio) | ❌ | ❌ | ❌ |

> **Nota:** `biometrics:enroll` é usada como guard de admin nos endpoints de dispositivos.  
> Professores acessam `/v1/reports/attendance` com escopo restrito às suas próprias sessões.
