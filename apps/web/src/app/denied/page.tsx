import { DENIED_MESSAGE } from "@/shared/auth/guards";

export default function DeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-border bg-surface p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted">{DENIED_MESSAGE}</p>
      </div>
    </main>
  );
}
