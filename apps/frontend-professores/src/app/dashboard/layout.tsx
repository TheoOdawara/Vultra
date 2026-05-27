"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Início", icon: "🏠" },
  { href: "/dashboard/chamada", label: "Chamada", icon: "📋" },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="w-56 flex flex-col bg-white border-r border-gray-200">
        <div className="flex items-center h-16 px-5 border-b border-gray-200">
          <span className="text-lg font-bold text-blue-600">VULTRA</span>
          <span className="ml-2 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Prof</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              )}>
              <span>{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {session?.user && <p className="text-xs text-gray-500 truncate mb-2">{session.user.email}</p>}
          <button onClick={() => { void signOut(); router.push("/login"); }}
            className="text-xs text-red-500 hover:text-red-700">Sair</button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
