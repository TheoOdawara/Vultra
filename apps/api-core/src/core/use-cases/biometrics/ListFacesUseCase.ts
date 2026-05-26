/**
 * VULTRA — ListFacesUseCase
 *
 * GET /v1/face/list
 * Lists active biometric profiles for a tenant, optionally filtered by member.
 */

import type {
  BiometricProfileLookup,
  IBiometricRepository,
} from "../../ports/IBiometricRepository";

export interface ListFacesInput {
  organizationId: string;
  memberId?: string;
}

export class ListFacesUseCase {
  constructor(private readonly biometricsRepo: IBiometricRepository) {}

  async execute(input: ListFacesInput): Promise<BiometricProfileLookup[]> {
    return this.biometricsRepo.findByOrgAndMember(input.organizationId, input.memberId);
  }
}
