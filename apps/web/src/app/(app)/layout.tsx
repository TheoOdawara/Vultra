import { headers } from "next/headers";
import { AppShell } from "@/modules/shell";
import { ROLE_HEADER, roleFromHeader } from "@/shared/auth/role-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = roleFromHeader((await headers()).get(ROLE_HEADER));

  return <AppShell viewerRole={role}>{children}</AppShell>;
}
