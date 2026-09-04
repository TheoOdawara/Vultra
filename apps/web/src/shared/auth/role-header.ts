import { ROLES, type Role } from "./guards";

export const ROLE_HEADER = "x-vultra-role";

export function roleFromHeader(value: string | null | undefined): Role | null {
  if (value === null || value === undefined) return null;

  return (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}
