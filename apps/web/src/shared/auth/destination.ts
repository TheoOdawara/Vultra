import { decideAccess, ROLE_HOME, type Role } from "./guards";

const PLACEHOLDER_ORIGIN = "https://portal.invalid";

function isRelativePath(next: string): boolean {
  if (!next.startsWith("/")) return false;

  const second = next.charAt(1);
  return second !== "/" && second !== "\\";
}

export function resolveDestination(next: string | null | undefined, role: Role): string {
  const home = ROLE_HOME[role];

  if (next === null || next === undefined || next === "") return home;
  if (!isRelativePath(next)) return home;

  let target: URL;

  try {
    target = new URL(next, PLACEHOLDER_ORIGIN);
  } catch {
    return home;
  }

  if (target.origin !== PLACEHOLDER_ORIGIN) return home;
  if (decideAccess(target.pathname, role).outcome !== "allow") return home;

  return `${target.pathname}${target.search}`;
}
