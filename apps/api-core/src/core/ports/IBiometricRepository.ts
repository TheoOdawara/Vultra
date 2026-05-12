/**
 * VULTRA — IBiometricRepository Port
 *
 * Contract consumed by Biometrics Use Cases.
 * Implementations live in adapters/repositories/.
 * Use Cases NEVER import concrete classes.
 */

// ── Domain types ──────────────────────────────────────────────────────────────

export interface SimilarityMatch {
  profileId: string;
  memberId: string;
  similarity: number;
  modelVersion: string;
}

export interface BiometricProfileLookup {
  profileId: string;
  organizationId: string;
  memberId: string;
  modelVersion: string;
  qualityScore: number;
  isActive: boolean;
  deviceId: string | null;
  createdBy: string | null;
  enrolledAt: Date;
  lastMatchedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
}

export interface EnrollParams {
  organizationId: string;
  memberId: string;
  faceEmbedding: number[];
  qualityScore: number;
  modelVersion?: string;
}

// ── Port interface ────────────────────────────────────────────────────────────

export interface IBiometricRepository {
  findBySimilarity(
    embedding: number[],
    organizationId: string,
    modelVersion?: string,
    memberId?: string
  ): Promise<SimilarityMatch | null>;

  findByOrgAndMember(organizationId: string, memberId?: string): Promise<BiometricProfileLookup[]>;

  findActiveProfileById(
    profileId: string,
    organizationId: string
  ): Promise<BiometricProfileLookup | null>;

  enroll(params: EnrollParams): Promise<string>;

  touchLastMatched(memberId: string, organizationId: string): Promise<void>;

  revoke(profileId: string, organizationId: string, deletedBy: string): Promise<boolean>;
}
