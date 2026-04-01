/**
 * VULTRA — Biometrics Repository
 *
 * Handles database operations for biometric_profiles.
 * All queries include organization_id filter (multitenancy).
 * Vector similarity search uses pgvector cosine distance (<=>).
 */

import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { biometricProfiles } from "../../infrastructure/database/schema";

const CURRENT_MODEL_VERSION = "ArcFace-v1";

export interface SimilarityMatch {
  memberId: string;
  similarity: number;
  modelVersion: string;
}

export interface EnrollParams {
  organizationId: string;
  memberId: string;
  faceEmbedding: number[];
  qualityScore: number;
  modelVersion?: string;
}

export class BiometricsRepository {
  constructor(private readonly db: NodePgDatabase<any>) {}

  /**
   * Find the most similar biometric profile for a given embedding.
   * Uses pgvector cosine distance (<=>) — lower distance = higher similarity.
   * Always filters by organization_id + model_version + is_active = true.
   *
   * Returns null if no profiles exist for the tenant.
   */
  async findBySimilarity(
    embedding: number[],
    organizationId: string,
    modelVersion: string = CURRENT_MODEL_VERSION,
  ): Promise<SimilarityMatch | null> {
    const vectorLiteral = `[${embedding.join(",")}]`;

    const rows = await this.db.execute(sql`
      SELECT
        member_id,
        1 - (face_embedding <=> ${vectorLiteral}::vector) AS similarity,
        model_version
      FROM biometric_profiles
      WHERE
        organization_id = ${organizationId}::uuid
        AND model_version = ${modelVersion}
        AND is_active = TRUE
      ORDER BY face_embedding <=> ${vectorLiteral}::vector
      LIMIT 1
    `);

    if (rows.rows.length === 0) return null;

    const row = rows.rows[0] as any;
    return {
      memberId: row.member_id,
      similarity: parseFloat(row.similarity),
      modelVersion: row.model_version,
    };
  }

  /**
   * Create a new biometric profile (enroll).
   * Deactivates any existing active profile for the same member+model before inserting.
   */
  async enroll(params: EnrollParams): Promise<string> {
    const modelVersion = params.modelVersion ?? CURRENT_MODEL_VERSION;

    // Deactivate existing active profile for this member+model (if any)
    await this.db
      .update(biometricProfiles)
      .set({ isActive: false })
      .where(
        and(
          eq(biometricProfiles.memberId, params.memberId),
          eq(biometricProfiles.modelVersion, modelVersion),
          eq(biometricProfiles.isActive, true),
        ),
      );

    const vectorLiteral = `[${params.faceEmbedding.join(",")}]`;

    const result = await this.db.execute(sql`
      INSERT INTO biometric_profiles
        (organization_id, member_id, face_embedding, model_version, quality_score, is_active)
      VALUES
        (${params.organizationId}::uuid, ${params.memberId}::uuid,
         ${vectorLiteral}::vector, ${modelVersion}, ${params.qualityScore}, TRUE)
      RETURNING id
    `);

    return (result.rows[0] as any).id;
  }

  /**
   * Update last_matched_at timestamp after a successful recognition.
   */
  async touchLastMatched(memberId: string, organizationId: string): Promise<void> {
    await this.db
      .update(biometricProfiles)
      .set({ lastMatchedAt: new Date() })
      .where(
        and(
          eq(biometricProfiles.memberId, memberId),
          eq(biometricProfiles.organizationId, organizationId),
          eq(biometricProfiles.isActive, true),
        ),
      );
  }

  /**
   * Soft-revoke a member's biometric profile (LGPD Art. 18, VI).
   * Sets is_active = FALSE and nullifies the embedding vector.
   */
  async revoke(memberId: string, organizationId: string): Promise<void> {
    await this.db.execute(sql`
      UPDATE biometric_profiles
      SET is_active = FALSE, face_embedding = NULL
      WHERE member_id = ${memberId}::uuid
        AND organization_id = ${organizationId}::uuid
        AND is_active = TRUE
    `);
  }
}
