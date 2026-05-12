/**
 * VULTRA — Biometrics Repository
 *
 * Handles database operations for biometric_profiles.
 * All queries include organization_id filter (multitenancy).
 * Vector similarity search uses pgvector cosine distance (<=>).
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../../infrastructure/database/client";
import { biometricProfiles } from "../../infrastructure/database/schema";
import type {
  IBiometricRepository,
  SimilarityMatch,
  BiometricProfileLookup,
  EnrollParams,
} from "../../core/ports/IBiometricRepository";
import { CURRENT_MODEL_VERSION } from "../../core/domain/constants";

interface FindBySimilarityRow {
  id: string;
  member_id: string;
  similarity: string | number;
  model_version: string;
}

interface ReturningIdRow {
  id: string;
}

export class BiometricsRepository implements IBiometricRepository {
  constructor(private readonly db: Db) {}

  private readonly lookupSelection = {
    profileId: biometricProfiles.id,
    organizationId: biometricProfiles.organizationId,
    memberId: biometricProfiles.memberId,
    modelVersion: biometricProfiles.modelVersion,
    qualityScore: biometricProfiles.qualityScore,
    isActive: biometricProfiles.isActive,
    deviceId: biometricProfiles.deviceId,
    createdBy: biometricProfiles.createdBy,
    enrolledAt: biometricProfiles.enrolledAt,
    lastMatchedAt: biometricProfiles.lastMatchedAt,
    deletedAt: biometricProfiles.deletedAt,
    deletedBy: biometricProfiles.deletedBy,
  };

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
    memberId?: string
  ): Promise<SimilarityMatch | null> {
    const vectorLiteral = `[${embedding.join(",")}]`;
    const memberFilter = memberId ? sql`AND member_id = ${memberId}::uuid` : sql``;

    const rows = await this.db.execute(sql`
      SELECT
        id,
        member_id,
        1 - (face_embedding <=> ${vectorLiteral}::vector) AS similarity,
        model_version
      FROM biometric_profiles
      WHERE
        organization_id = ${organizationId}::uuid
        AND model_version = ${modelVersion}
        AND is_active = TRUE
        ${memberFilter}
      ORDER BY face_embedding <=> ${vectorLiteral}::vector
      LIMIT 1
    `);

    if (rows.rows.length === 0) return null;

    const row = rows.rows[0] as FindBySimilarityRow | undefined;
    if (!row) return null;

    return {
      profileId: row.id,
      memberId: row.member_id,
      similarity: Number(row.similarity),
      modelVersion: row.model_version,
    };
  }

  /**
   * List active biometric profiles for a tenant, optionally filtered by member.
   * The embedding vector is intentionally excluded from the returned shape.
   */
  async findByOrgAndMember(
    organizationId: string,
    memberId?: string
  ): Promise<BiometricProfileLookup[]> {
    const conditions = [
      eq(biometricProfiles.organizationId, organizationId),
      eq(biometricProfiles.isActive, true),
    ];

    if (memberId) {
      conditions.push(eq(biometricProfiles.memberId, memberId));
    }

    const rows = await this.db
      .select(this.lookupSelection)
      .from(biometricProfiles)
      .where(and(...conditions))
      .orderBy(desc(biometricProfiles.enrolledAt));

    return rows;
  }

  async findActiveProfileById(
    profileId: string,
    organizationId: string
  ): Promise<BiometricProfileLookup | null> {
    const [profile] = await this.db
      .select(this.lookupSelection)
      .from(biometricProfiles)
      .where(
        and(
          eq(biometricProfiles.id, profileId),
          eq(biometricProfiles.organizationId, organizationId),
          eq(biometricProfiles.isActive, true)
        )
      )
      .limit(1);

    return profile ?? null;
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
          eq(biometricProfiles.isActive, true)
        )
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

    const row = result.rows[0] as ReturningIdRow | undefined;
    if (!row) {
      throw new Error("Failed to persist biometric profile");
    }

    return row.id;
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
          eq(biometricProfiles.isActive, true)
        )
      );
  }

  /**
   * Soft-revoke a member's biometric profile (LGPD Art. 18, VI).
   * Sets is_active = FALSE, nullifies the embedding vector and records deletion audit columns.
   */
  async revoke(profileId: string, organizationId: string, deletedBy: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE biometric_profiles
      SET
        is_active = FALSE,
        face_embedding = NULL,
        deleted_at = NOW(),
        deleted_by = ${deletedBy}::uuid
      WHERE id = ${profileId}::uuid
        AND organization_id = ${organizationId}::uuid
        AND is_active = TRUE
      RETURNING id
    `);

    return result.rows.length > 0;
  }
}
