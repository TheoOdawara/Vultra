import type { Metadata } from "next";
import { SignInForm } from "@/modules/auth";

export const metadata: Metadata = {
  title: "Entrar · Vultra",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;

  return (
    <>
      <h1 className="text-lg font-semibold text-foreground">Entrar</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Acesse o portal da sua instituição.</p>
      <SignInForm next={typeof next === "string" ? next : null} />
    </>
  );
}
