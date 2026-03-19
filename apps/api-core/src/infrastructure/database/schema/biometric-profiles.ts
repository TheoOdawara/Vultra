import { sql } from "drizzle-orm";
import { boolean, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { vector } from "./_types";
import { members } from "./members";
import { organizations } from "./organizations";

/**
 * Perfis biométricos — LGPD Art. 11 (dados de categoria especial)
 *
 * REGRA INVIOLÁVEL: apenas o vetor numérico (face_embedding) é persistido.
 * A imagem bruta é processada exclusivamente na RAM do AI Service e descartada
 * imediatamente após a geração do embedding.
 *
 * Índices relevantes (definidos na migration SQL):
 *  - HNSW em face_embedding (vector_cosine_ops) → migration 0009
 *  - Partial UNIQUE em (member_id, model_version) WHERE is_active = TRUE → migration 0005
 *  - CHECK constraint em quality_score BETWEEN 0 AND 1 → migration 0005
 */
export const biometricProfiles = pgTable("biometric_profiles", {
  id: uuid("id").notNull().default(sql`gen_uuid_v7()`).primaryKey(),

  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" }),

  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "restrict" }),

  /** Embedding facial 512-dim (ArcFace). Somente vetores, proibido imagem (LGPD). */
  faceEmbedding: vector("face_embedding", { dimensions: 512 }).notNull(),

  /**
   * Versão do modelo que gerou o vetor.
   * OBRIGATÓRIO incluir `AND model_version = $currentModel` em queries de reconhecimento.
   * Consulte: docs/database/arquitetura/versionamento-embeddings.md
   */
  modelVersion: text("model_version").notNull().default("ArcFace-v1"),

  /** Score de qualidade do enroll [0, 1]. Mínimo recomendado: 0.7. */
  qualityScore: real("quality_score").notNull(),

  /** FALSE = desativado por migração de modelo ou revogação LGPD */
  isActive: boolean("is_active").notNull().default(true),

  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }),
});

export type BiometricProfile = typeof biometricProfiles.$inferSelect;
export type NewBiometricProfile = typeof biometricProfiles.$inferInsert;
