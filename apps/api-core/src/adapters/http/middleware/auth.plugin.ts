/**
 * VULTRA — Plugin de autenticação de utilizadores (Better Auth)
 *
 * Injeta `currentUser` e `currentOrg` no contexto de todas as rotas
 * protegidas via `.derive()`. Os handlers NUNCA chamam getSession() diretamente.
 *
 * Uso:
 *   app.use(authPlugin)
 *      .get('/v1/me', ({ currentUser }) => currentUser)
 *
 * Referência: docs/backend/manuais/autenticacao.md
 */

import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { UnauthorizedError } from "../../../core/domain/errors/DomainError";
import { auth } from "../../../infrastructure/auth";
import { db } from "../../../infrastructure/database/client";
import { authMembers } from "../../../infrastructure/database/schema";
import { rememberRequestIdentity } from "../../../shared/infra/http/request-identity.ts";

export const authPlugin = new Elysia({ name: "auth-plugin" }).derive(
  { as: "scoped" },
  async ({
    headers,
    request,
  }): Promise<{
    currentUser: typeof auth.$Infer.Session.user;
    currentOrg: string | undefined | null;
    currentRole: string | null;
  }> => {
    // Converte os headers do Elysia (Record<string, string>) para o formato
    // esperado pelo Better Auth (Headers ou Record<string, string>).
    const session = await auth.api.getSession({ headers: headers as Record<string, string> });

    if (!session) throw new UnauthorizedError();

    const currentOrg = session.session.activeOrganizationId;
    const memberships = currentOrg
      ? await db
          .select({
            role: authMembers.role,
          })
          .from(authMembers)
          .where(
            and(eq(authMembers.organizationId, currentOrg), eq(authMembers.userId, session.user.id))
          )
          .limit(1)
      : [];

    const [membership] = memberships;
    const currentRole = membership === undefined ? null : membership.role;

    rememberRequestIdentity(request, {
      userId: session.user.id,
      organizationId: currentOrg ?? null,
      role: currentRole,
    });

    return {
      currentUser: session.user,
      currentOrg,
      currentRole,
    };
  }
);
