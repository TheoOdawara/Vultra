"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function Header() {
  const { data: session } = useSession();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-end px-6">
      {session?.user && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {session.user.name ?? session.user.email}
          </span>
          <button
            onClick={() => void handleSignOut()}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Sair
          </button>
        </div>
      )}
    </header>
  );
}
