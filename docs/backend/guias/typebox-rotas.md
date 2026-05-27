# 🧩 Padrão de Rota com TypeBox

> **← [Voltar ao Backend](../README.md)**

---

## Regras Fundamentais

1. **TypeBox é obrigatório** para toda validação. Uso de Zod, Joi ou Yup é **PROIBIDO**.
2. **`any` é proibido** no TypeScript. Ative o modo `strict` e use interfaces explícitas.
3. **Rotas sempre com `/v1/`** como prefixo. Ex: `GET /v1/attendance/sessions`.
4. **`derive` para contexto:** User, organization e db injetados via `derive`, nunca por parâmetro manual.
5. **Sem lógica no handler:** Handlers delegam ao Use Case. São orquestradores, não executores.

---

## Estrutura de uma Rota ElysiaJS

Toda rota deve declarar explicitamente `body`, `params`, `query` e `response` usando `t.Object()`. Sem exceções — TypeBox é o contrato entre cliente e servidor.

```typescript
// Exemplo ilustrativo do padrão — não é código final
new Elysia({ prefix: "/attendance" })
  .derive(/* injeta currentUser, currentOrg via Better Auth */)
  .post(
    "/record",
    ({ body, currentOrg }) => recordAttendanceUseCase.execute({ ...body, organizationId: currentOrg }),
    {
      body: t.Object({
        sessionId:   t.String({ format: "uuid" }),
        frameBase64: t.String(),
      }),
      response: t.Object({
        recordId:        t.String(),
        confidenceScore: t.Number(),
      }),
    }
  );
```

---

## Onde Ficam os Schemas TypeBox

Os schemas TypeBox ficam em arquivos **separados** das rotas, em `adapters/http/schemas/`, e são importados pelas rotas.

```
adapters/http/
├── routes/
│   └── attendance.routes.ts      ← importa os schemas
└── schemas/
    └── attendance.schema.ts      ← define t.Object() de body e response
```

Isso permite reutilizar schemas em múltiplas rotas e facilita testes isolados de validação.

---

## Tipagem do Contexto com `derive`

O retorno do `derive` é automaticamente tipado pelo ElysiaJS. Nunca use `as` para coerção manual de tipos dentro de handlers.

```typescript
// ✅ Correto
.derive(async ({ headers }) => {
  const session = await auth.api.getSession({ headers });
  return { currentUser: session.user }; // tipagem inferida
})
.get("/me", ({ currentUser }) => currentUser) // currentUser é tipado

// ❌ Incorreto
.get("/me", (ctx) => (ctx as any).currentUser)
```

---

## Convenção de Prefixos de Rota

| Recurso | Prefixo | Exemplo |
|---------|---------|---------|
| Sessões de chamada | `/v1/attendance/sessions` | `POST /v1/attendance/sessions` |
| Registros de presença | `/v1/attendance/records` | `GET /v1/attendance/records?sessionId=` |
| Membros | `/v1/members` | `GET /v1/members` |
| Dispositivos IoT | `/v1/devices` | `POST /v1/devices` |
| Perfis biométricos | `/v1/face` | `POST /v1/face/enroll` (legado `/v1/biometric/*` → 404) |
| Relatórios | `/v1/reports` | `GET /v1/reports/attendance` |
| Health checks | `/v1/health` | `GET /v1/health/ai-service` |
