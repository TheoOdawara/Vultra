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
 *   admin      → attendance:write, attendance:read, reports:read, users:*, devices:*, biometrics:*
 *   professor  → attendance:write, attendance:read
 *   rh         → attendance:read, reports:read
 *   student    → attendance:read (own records only — enforced in application layer)
 *
 * Reference: docs/backend/manuais/autenticacao.md
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, multiSession } from "better-auth/plugins";
import { db } from "./database/client";
import * as authSchema from "./database/schema/auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authSchema.authUsers,
      session: authSchema.authSessions,
      account: authSchema.authAccounts,
      verification: authSchema.authVerifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // set to true in production
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: false, // only super-admin provisions orgs
    }),
    multiSession({
      maximumSessions: 3,
    }),
  ],

  trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});
