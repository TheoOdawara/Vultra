import type { Config } from 'drizzle-kit';

/**
 * Drizzle Kit — Configuração para api-core
 *
 * Estratégia de migrations: MANUAL (append-only SQL)
 * As migrations são escritas à mão em /migrations/*.sql — o Drizzle Kit
 * é usado apenas para EXECUTAR as migrations (drizzle-kit migrate),
 * nunca para gerá-las automaticamente (drizzle-kit generate).
 *
 * Política de migrations: docs/database/manuais/migrations.md
 */
export default {
  schema:    './src/infrastructure/database/schema/index.ts',
  out:       './src/infrastructure/database/migrations',
  dialect:   'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
  verbose: true,
  strict:  true,
} satisfies Config;
