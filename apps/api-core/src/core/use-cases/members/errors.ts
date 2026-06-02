/**
 * VULTRA — Member Use Case Errors
 *
 * Centralised error classes for the members domain.
 * Import from here — never from a peer use case file.
 */

import { DomainError } from "../../domain/errors/DomainError";

export class MemberNotFoundError extends DomainError {
  constructor() {
    super("MEMBER_NOT_FOUND", 404, "Member not found");
  }
}
