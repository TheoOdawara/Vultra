import { headers } from "next/headers";
import { DeniedScreen } from "@/modules/auth";
import { ROLE_HEADER, roleFromHeader } from "@/shared/auth/role-header";

export default async function DeniedPage() {
  return <DeniedScreen viewerRole={roleFromHeader((await headers()).get(ROLE_HEADER))} />;
}
