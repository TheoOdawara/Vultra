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

import { Elysia } from 'elysia';
import { auth }   from '../auth';
import { UnauthorizedError } from '../../core/domain/errors/DomainError';

export const authPlugin = new Elysia({ name: 'auth-plugin' })
  .derive(
    { as: 'scoped' },
    async ({ headers }): Promise<{ currentUser: typeof auth.$Infer.Session.user; currentOrg: string | undefined | null }> => {
      // Converte os headers do Elysia (Record<string, string>) para o formato
      // esperado pelo Better Auth (Headers ou Record<string, string>).
      const session = await auth.api.getSession({ headers: headers as Record<string, string> });

      if (!session) throw new UnauthorizedError();

      return {
        currentUser: session.user,
        currentOrg:  session.session.activeOrganizationId,
      };
    }
  );
