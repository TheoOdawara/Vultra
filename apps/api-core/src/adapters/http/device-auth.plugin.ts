/**
 * VULTRA — Plugin de autenticação de dispositivos ESP32
 *
 * Valida o header `X-Device-Token` contra o hash bcrypt armazenado na tabela
 * `devices`, garantindo isolamento por `organizationId` do tenant.
 *
 * Fluxo:
 *  1. Extrai `X-Device-Token` e `X-Organization-Id` dos headers
 *  2. Busca o device ativo na tabela `devices` pelo organizationId
 *  3. Valida o token via `Bun.password.verify()` contra `api_key_hash`
 *  4. Injeta `authenticatedDevice` no contexto
 *  5. Se inválido → 401 INVALID_DEVICE_TOKEN
 *
 * Referência: docs/backend/manuais/autenticacao.md
 */

import { Elysia }  from 'elysia';
import { eq, and } from 'drizzle-orm';
import { db }      from '../../infrastructure/database/client';
import { devices } from '../../infrastructure/database/schema/index';
import { InvalidDeviceTokenError } from '../../core/domain/errors/DomainError';
import type { Device } from '../../infrastructure/database/schema/devices';

export const deviceAuthPlugin = new Elysia({ name: 'device-auth-plugin' })
  .derive(
    { as: 'scoped' },
    async ({ headers }): Promise<{ authenticatedDevice: Device }> => {
      const rawToken  = headers['x-device-token'];
      const rawOrgId  = headers['x-organization-id'];

      if (!rawToken || !rawOrgId) throw new InvalidDeviceTokenError();

      const [device] = await db
        .select()
        .from(devices)
        .where(
          and(
            eq(devices.organizationId, rawOrgId),
            eq(devices.isActive, true)
          )
        )
        .limit(1);

      if (!device) throw new InvalidDeviceTokenError();

      const isValid = await Bun.password.verify(rawToken, device.apiKeyHash);
      if (!isValid) throw new InvalidDeviceTokenError();

      return { authenticatedDevice: device };
    }
  );
