/**
 * VULTRA — Better Auth Configuration
 *
 * Initializes Better Auth with:
 *   - emailAndPassword provider
 *   - organization plugin (tenant management, RBAC)
 *   - multiSession plugin (max 3 concurrent sessions)
 *
 * Passkey plugin is scaffolded but disabled — not available in better-auth ≤ 1.5.5.
 * Enable when upstream releases the plugin.
 *
 * RBAC AccessControl matrix:
 *   admin      → members:read, members:manage, attendance:write, attendance:read,
 *                reports:read, devices:manage, biometrics:*
 *   professor  → members:read, attendance:write, attendance:read, biometrics:*
 *   rh         → members:read, attendance:read, reports:read, biometrics:verify+list
 *   student    → attendance:read (own records only — enforced in application layer)
 *
 * Reference: docs/backend/manuais/autenticacao.md
 */

import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAccessControl, multiSession, organization } from "better-auth/plugins";
import { env } from "../shared/infra/env/env.ts";
import { db } from "./database/client";
import * as authSchema from "./database/schema/auth-schema";

export const accessControl = createAccessControl({
  members: ["read", "manage"],
  attendance: ["write", "read"],
  reports: ["read"],
  biometrics: ["enroll", "verify", "list", "delete"],
  devices: ["manage"],
} as const);

export const organizationRoles = {
  admin: accessControl.newRole({
    members: ["read", "manage"],
    attendance: ["write", "read"],
    reports: ["read"],
    biometrics: ["enroll", "verify", "list", "delete"],
    devices: ["manage"],
  }),
  professor: accessControl.newRole({
    members: ["read"],
    attendance: ["write", "read"],
    biometrics: ["enroll", "verify", "list", "delete"],
  }),
  rh: accessControl.newRole({
    members: ["read"],
    attendance: ["read"],
    reports: ["read"],
    biometrics: ["verify", "list"],
  }),
  student: accessControl.newRole({
    attendance: ["read"],
  }),
} as const;

type PermissionRequest = Partial<Record<keyof typeof accessControl.statements, readonly string[]>>;

export function checkPermission(
  role: string | null | undefined,
  permission: PermissionRequest
): boolean {
  if (!role) {
    return false;
  }

  const resolvedRole = organizationRoles[role as keyof typeof organizationRoles];
  if (!resolvedRole) {
    return false;
  }

  return Object.entries(permission).every(([resource, actions]) => {
    if (!actions) {
      return true;
    }

    const allowedActions =
      resolvedRole.statements[resource as keyof typeof resolvedRole.statements] ?? [];

    return actions.every((action) =>
      (allowedActions as readonly string[]).includes(action as string)
    );
  });
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authSchema.authUsers,
      session: authSchema.authSessions,
      account: authSchema.authAccounts,
      verification: authSchema.authVerifications,
      apikey: authSchema.authApiKeys,
    },
  }),

  advanced: {
    database: {
      generateId: "uuid",
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // set to true in production
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: false, // only super-admin provisions orgs
      ac: accessControl,
      roles: organizationRoles,
    }),
    multiSession({
      maximumSessions: 3,
    }),
    apiKey({
      // Device keys são org-owned — ESP32 não representa um usuário
      references: "organization",
      // Metadados necessários para armazenar { deviceId }
      enableMetadata: true,
      // Header padrão que o ESP32 enviará
      apiKeyHeaders: "x-api-key",
    }),
  ],

  trustedOrigins: [...env.trustedOrigins],

  secret: env.authSecret,
  baseURL: env.authBaseUrl,
});
