export const ROLES = ["gestor", "professor", "rh"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_HOME: Record<Role, string> = {
  gestor: "/members",
  professor: "/attendance",
  rh: "/reports/wellbeing",
};

export const PUBLIC_ROUTES: readonly string[] = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
];

export const ROUTE_GUARDS: readonly { readonly prefix: string; readonly roles: readonly Role[] }[] =
  [
    { prefix: "/members", roles: ["gestor"] },
    { prefix: "/member-imports", roles: ["gestor"] },
    { prefix: "/devices", roles: ["gestor"] },
    { prefix: "/biometric-profiles", roles: ["gestor"] },
    { prefix: "/audit-logs", roles: ["gestor"] },
    { prefix: "/retention", roles: ["gestor"] },
    { prefix: "/classes", roles: ["gestor", "professor"] },
    { prefix: "/reports/attendance", roles: ["gestor", "professor"] },
    { prefix: "/reports/wellbeing", roles: ["rh", "gestor"] },
    { prefix: "/attendance", roles: ["professor", "gestor"] },
  ];

export type AccessDecision =
  | { outcome: "allow" }
  | { outcome: "redirect"; to: string }
  | { outcome: "deny" };

export const DENIED_MESSAGE = "Você não tem acesso a esta área.";

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function guardFor(pathname: string): (typeof ROUTE_GUARDS)[number] | undefined {
  return [...ROUTE_GUARDS]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((guard) => pathname === guard.prefix || pathname.startsWith(`${guard.prefix}/`));
}

export function decideAccess(pathname: string, role: Role | null): AccessDecision {
  if (isPublic(pathname)) {
    return role === null ? { outcome: "allow" } : { outcome: "redirect", to: ROLE_HOME[role] };
  }

  if (pathname === "/") {
    return role === null
      ? { outcome: "redirect", to: "/login?next=%2F" }
      : { outcome: "redirect", to: ROLE_HOME[role] };
  }

  if (role === null) {
    return { outcome: "redirect", to: `/login?next=${encodeURIComponent(pathname)}` };
  }

  const guard = guardFor(pathname);
  if (guard === undefined) return { outcome: "deny" };

  return guard.roles.includes(role) ? { outcome: "allow" } : { outcome: "deny" };
}
