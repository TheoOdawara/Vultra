/**
 * VULTRA — Tipos customizados para Drizzle ORM
 *
 * Drizzle não suporta nativamente `vector` (pgvector) nem `inet` (PostgreSQL).
 * Este módulo define ambos via `customType` com serialização correta.
 */

import { customType } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// vector(N) — pgvector
// Armazena embeddings faciais 512-dim.
// LGPD Art. 11: APENAS o vetor é persistido. Imagem processada na RAM e descartada.
// ---------------------------------------------------------------------------
export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 512})`;
  },
  /** Serializa number[] → "[0.1,0.2,...]" para envio ao driver PostgreSQL */
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  /** Deserializa "[0.1,0.2,...]" recebido do driver → number[] */
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(',').map(Number);
  },
});

// ---------------------------------------------------------------------------
// inet — endereço IP PostgreSQL (IPv4 e IPv6)
// Utilizado em audit_logs.ip_address.
// ---------------------------------------------------------------------------
export const inet = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'inet';
  },
});
