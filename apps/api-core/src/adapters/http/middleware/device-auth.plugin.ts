/**
 * VULTRA — Plugin de autenticação de dispositivos ESP32
 *
 * Valida o header `X-API-Key` via Better Auth (@better-auth/api-key plugin).
 * As API keys são armazenadas na tabela `auth_apikeys` (sem RLS), eliminando
 * o problema de "galinha e ovo" onde seria necessário ativar o tenant context
 * antes de poder buscar o device para autenticar.
 *
 * Fluxo:
 *  1. Extrai `X-API-Key` dos headers
 *  2. Valida a key via `auth.api.verifyApiKey()` (tabela auth_apikeys, sem RLS)
 *  3. Extrai `organizationId` (= referenceId) e `deviceId` (= metadata.deviceId)
 *  4. Com o organizationId confiável, ativa o RLS via withTenantContext
 *  5. Busca o device na tabela `devices` para confirmar que está ativo
 *  6. Injeta `authenticatedDevice` no contexto
 *  7. Se inválido → 401 INVALID_DEVICE_TOKEN
 *
 * Header obrigatório (firmware ESP32):
 *  - X-API-Key → API key gerada via POST /v1/devices (plaintext, validada pelo plugin)
 *
 * Referência: docs/backend/manuais/autenticacao.md
 */

import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { InvalidDeviceTokenError } from "../../../core/domain/errors/DomainError";
import { auth } from "../../../infrastructure/auth";
import { db, withTenantContext } from "../../../infrastructure/database/client";
import type { Device } from "../../../infrastructure/database/schema/devices";
import { devices } from "../../../infrastructure/database/schema/index";

export const deviceAuthPlugin = new Elysia({ name: "device-auth-plugin" }).derive(
  { as: "scoped" },
  async ({ headers }): Promise<{ authenticatedDevice: Device }> => {
    const rawKey = headers["x-api-key"];
    if (!rawKey) throw new InvalidDeviceTokenError();

    // 1. Validar key via Better Auth (tabela auth_apikeys — sem RLS)
    //    Retorna referenceId = organizationId e metadata = { deviceId }
    const result = await auth.api.verifyApiKey({
      body: { key: rawKey },
    });

    if (!result.valid || !result.key) throw new InvalidDeviceTokenError();

    const organizationId = result.key.referenceId;
    const deviceId = (result.key.metadata as { deviceId?: string } | null)?.deviceId;

    if (!organizationId || !deviceId) throw new InvalidDeviceTokenError();

    // 2. Com organizationId confiável → ativar RLS e validar device ativo
    const device = await withTenantContext(db, organizationId, async (tx) => {
      const [row] = await tx
        .select()
        .from(devices)
        .where(
          and(
            eq(devices.id, deviceId),
            eq(devices.organizationId, organizationId),
            eq(devices.isActive, true)
          )
        )
        .limit(1);
      return row ?? null;
    });

    if (!device) throw new InvalidDeviceTokenError();

    return { authenticatedDevice: device };
  }
);
