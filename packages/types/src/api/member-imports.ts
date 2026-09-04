import type { MemberImport } from "../domain.js";
import type { CreateMemberBody } from "./members.js";

export interface CreateMemberImportBody {
  members: CreateMemberBody[];
}

export type CreateMemberImportResponse = MemberImport;

export type GetMemberImportResponse = MemberImport;
