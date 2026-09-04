import type { BiometricProfile, VerificationResult } from "../domain.js";
import type { Collection, CursorQuery, SortDirection } from "../pagination.js";

export interface ListBiometricProfilesQuery extends CursorQuery {
  memberId?: string;
  isActive?: boolean;
  sort?: "enrolledAt";
  direction?: SortDirection;
}

export type ListBiometricProfilesResponse = Collection<BiometricProfile>;

export interface CreateBiometricProfileBody {
  memberId: string;
  frameBase64: string;
}

export interface CreateBiometricProfileResponse {
  profileId: string;
  memberId: string;
  qualityScore: number;
  modelVersion: string;
  enrolledAt: string;
}

export interface CreateBiometricVerificationBody {
  frameBase64: string;
  memberId?: string;
}

export interface CreateBiometricVerificationResponse {
  result: VerificationResult;
  memberId?: string;
  confidence: number;
  processingMs: number;
}
