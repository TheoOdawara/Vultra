# Better Auth — Autenticação IoT (ESP32-CAM)

## Fluxo Completo

```
ESP32-CAM
  │
  ├── Header: X-Device-Token: <raw_api_key>
  ├── Header: X-Device-Id:    <device_uuid>
  │
  └──► withDeviceAuth
         │
         ├── Busca device por ID (isActive = true)
         ├── Bun.password.verify(rawToken, device.tokenHash)  [bcrypt]
         ├── Fire-and-forget: UPDATE devices SET last_seen_at = NOW()
         │
         └──► { device } no contexto da rota
```

---

## Registro de Dispositivo (Provisionamento)

```typescript
// use-cases/RegisterDeviceUseCase.ts
async execute(dto: RegisterDeviceDTO) {
  const rawToken   = crypto.randomUUID() + crypto.randomUUID(); // 72 chars
  const tokenHash  = await Bun.password.hash(rawToken, { algorithm: 'bcrypt', cost: 12 });

  const [device] = await db
    .insert(devices)
    .values({
      organizationId: dto.organizationId,
      name:           dto.name,
      location:       dto.location,
      tokenHash,
      isActive:       true,
    })
    .returning();

  // rawToken é retornado UMA VEZ apenas — não fica armazenado em texto puro
  return { device, rawToken };
}
```

> **Segurança:** `rawToken` é enviado em texto puro **apenas na resposta de criação**. O servidor nunca mais terá acesso ao valor original — apenas ao hash.

---

## Rotação de API Key

```typescript
// use-cases/RotateDeviceTokenUseCase.ts
async execute(dto: { deviceId: string; organizationId: string }) {
  const newRawToken = crypto.randomUUID() + crypto.randomUUID();
  const newHash     = await Bun.password.hash(newRawToken, { algorithm: 'bcrypt', cost: 12 });

  await db
    .update(devices)
    .set({ tokenHash: newHash, updatedAt: new Date() })
    .where(
      and(
        eq(devices.id,             dto.deviceId),
        eq(devices.organizationId, dto.organizationId),
      )
    );

  return { rawToken: newRawToken }; // retornar ao admin para reprogramar ESP32
}
```

---

## Esquema de Tabela (Referência)

```sql
-- devices
id              uuid NOT NULL DEFAULT gen_random_uuid()
organization_id uuid NOT NULL REFERENCES organizations(id)
name            text NOT NULL
location        text
token_hash      text NOT NULL          -- bcrypt hash do rawToken
is_active       boolean DEFAULT true
last_seen_at    timestamptz
created_at      timestamptz DEFAULT now()
```

---

## Regras Críticas

| Regra | Motivo |
|-------|--------|
| Nunca armazenar `rawToken` em texto puro | Segurança — comprometimento do DB não expõe keys |
| Sempre validar `isActive = true` | Dispositivos descomissionados rejeitados imediatamente |
| `last_seen_at` fire-and-forget | Não adiciona latência à resposta do frame |
| Erro genérico `InvalidDeviceTokenError` | Não vazar se ID ou token foi o campo inválido |
| Cost 12 no bcrypt | Balance segurança vs latência para IoT (≈ 300ms aceitável no handshake) |
