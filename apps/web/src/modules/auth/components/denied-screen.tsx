import Link from "next/link";
import { DENIED_MESSAGE, ROLE_HOME, type Role } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";

export function DeniedScreen({ viewerRole }: { viewerRole: Role | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-border bg-surface p-8 text-center">
        <h1 className="font-semibold text-foreground text-lg">Acesso negado</h1>
        <p className="mt-2 text-muted text-sm">{DENIED_MESSAGE}</p>
        {viewerRole === null ? null : (
          <Button asChild className="mt-6">
            <Link href={ROLE_HOME[viewerRole]}>Ir para o início</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
