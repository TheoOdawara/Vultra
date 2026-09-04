import type { Role } from "@/shared/auth/guards";

export interface NavItem {
  readonly label: string;
  readonly href: string;
}

export interface NavGroup {
  readonly label: string | null;
  readonly items: readonly NavItem[];
}

export const NAVIGATION: Record<Role, readonly NavGroup[]> = {
  gestor: [
    {
      label: "Cadastro",
      items: [
        { label: "Membros", href: "/members" },
        { label: "Turmas", href: "/classes" },
        { label: "Dispositivos", href: "/devices" },
      ],
    },
    {
      label: "Biometria",
      items: [{ label: "Perfis biométricos", href: "/biometric-profiles" }],
    },
    {
      label: "Relatórios",
      items: [
        { label: "Frequência", href: "/reports/attendance" },
        { label: "Bem-estar", href: "/reports/wellbeing" },
      ],
    },
    {
      label: "Governança",
      items: [
        { label: "Auditoria", href: "/audit-logs" },
        { label: "Retenção", href: "/retention" },
      ],
    },
  ],
  professor: [
    {
      label: null,
      items: [
        { label: "Chamada", href: "/attendance" },
        { label: "Minhas turmas", href: "/classes" },
        { label: "Frequência", href: "/reports/attendance" },
      ],
    },
  ],
  rh: [
    {
      label: null,
      items: [{ label: "Bem-estar", href: "/reports/wellbeing" }],
    },
  ],
};

export function navItemsFor(role: Role): readonly NavItem[] {
  return NAVIGATION[role].flatMap((group) => group.items);
}

export function activeHrefFor(role: Role, pathname: string): string | null {
  const matches = navItemsFor(role).filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return matches.reduce<string | null>(
    (longest, item) =>
      longest === null || item.href.length > longest.length ? item.href : longest,
    null
  );
}
