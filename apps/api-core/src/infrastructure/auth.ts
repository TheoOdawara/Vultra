/**
 * VULTRA — Configuração do Better Auth
 *
 * Plugins ativos:
 *  - organization  → multitenant (só super-admin provisiona orgs via endpoint)
 *  - passkey       → WebAuthn/FIDO2 (Touch ID, Face ID, YubiKey)
 *  - multiSession  → máx. 3 sessões simultâneas por utilizador
 *
 * RBAC (AccessControl):
 *  - admin     → todos os recursos
 *  - professor → attendance:write, attendance:read
 *  - rh        → attendance:read, reports:read
 *  - student   → sem permissões (acesso via dispositivo ESP32 apenas)
 *
 * Variáveis de ambiente obrigatórias:
 *  - BETTER_AUTH_SECRET  (mín. 32 chars — gerar: openssl rand -base64 32)
 *  - BETTER_AUTH_URL     (ex: https://api.vultra.app)
 *  - DATABASE_URL        (PostgreSQL connection string)
 *  - BETTER_AUTH_TRUSTED_ORIGINS (CSV — ex: https://admin.vultra.app,https://rh.vultra.app)
 *
 * Referência: docs/backend/manuais/autenticacao.md
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession, organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
// NOTE: passkey plugin não está disponível no better-auth 1.5.5.

import { db } from "./database/client";
import {
  authAccounts,
  authInvitations,
  authMembers,
  authOrganizations,
  authSessions,
  authUsers,
  authVerifications,
} from "./database/schema/index";

// ─────────────────────────────────────────────
// RBAC — AccessControl matrix
// Consulte docs/backend/manuais/autenticacao.md para matriz completa.
// ─────────────────────────────────────────────
const ac = createAccessControl({
  attendance: ["write", "read"] as const,
  reports: ["read"] as const,
  users: ["create", "update", "delete", "read"] as const,
  devices: ["create", "update", "delete", "read"] as const,
  biometrics: ["enroll", "delete", "read"] as const,
});

const adminRole = ac.newRole({
  attendance: ["write", "read"],
  reports: ["read"],
  users: ["create", "update", "delete", "read"],
  devices: ["create", "update", "delete", "read"],
  biometrics: ["enroll", "delete", "read"],
});

const professorRole = ac.newRole({
  attendance: ["write", "read"],
});

const rhRole = ac.newRole({
  attendance: ["read"],
  reports: ["read"],
});

// student: acesso de leitura às próprias presenças (a camada de aplicação
// restringe ao próprio membro_id). Dispositivos ESP32 não usam este role.
const studentRole = ac.newRole({
  attendance: ["read"],
});

// ─────────────────────────────────────────────
// Better Auth — instância principal
// ─────────────────────────────────────────────
export const auth = betterAuth({
  /**
   * baseURL e secret são lidos das env vars BETTER_AUTH_URL e BETTER_AUTH_SECRET.
   * NÃO definir aqui para evitar hardcode em repositório.
   */

  database: drizzleAdapter(db, {
    provider: "pg",
    /**
     * Mapeia os nomes de modelo Better Auth para as tabelas Drizzle `auth_*`.
     * Os nomes das chaves devem corresponder exatamente ao esperado pelo Better Auth.
     */
    schema: {
      user: authUsers,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
      organization: authOrganizations,
      member: authMembers,
      invitation: authInvitations,
    },
  }),

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    organization({
      ac,
      roles: {
        admin: adminRole,
        professor: professorRole,
        rh: rhRole,
        student: studentRole,
      },
      /**
       * Apenas super-admins provisionam organizations via endpoint dedicado,
       * que cria `auth_organizations` + `organizations` de domínio numa única
       * transação. Criação direta pelo utilizador é bloqueada.
       */
      allowUserToCreateOrganization: false,
    }),

    multiSession({
      maximumSessions: 3,
    }),
  ],

  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? [],

  advanced: {
    database: {
      /**
       * Better Auth gera IDs como UUID (v4) nativamente.
       * Os IDs do domínio continuam UUID v7 via gen_uuid_v7() no PostgreSQL.
       */
      generateId: "uuid",
    },
  },
});

/** Tipo inferido da sessão (utilizador + sessão). */
export type Session = typeof auth.$Infer.Session;

/** Tipo inferido do utilizador autenticado. */
export type AuthUser = typeof auth.$Infer.Session.user;
