"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Visão geral", icon: "⊞" },
  { href: "/dashboard/members", label: "Membros", icon: "👥" },
  { href: "/dashboard/devices", label: "Dispositivos", icon: "📡" },
  { href: "/dashboard/reports", label: "Relatórios", icon: "📊" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex flex-col bg-white border-r border-gray-200 flex-shrink-0">
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <span className="text-lg font-bold text-blue-600">VULTRA</span>
        <span className="ml-2 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          Admin
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <SystemHealthIndicator />
      </div>
    </aside>
  );
}

// ── System health mini-badge ───────────────────────────────────────────────────

import { useQuery } from "@tanstack/react-query";
import { healthApi } from "@/lib/api";

function SystemHealthIndicator() {
  const { data } = useQuery({
    queryKey: ["health", "ai-service"],
    queryFn: () => healthApi.aiService(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const statusColors = {
    ok: "bg-green-500",
    degraded: "bg-orange-500",
    unavailable: "bg-red-500",
  } as const;

  const status = data?.status ?? "unavailable";

  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition-colors"
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          statusColors[status]
        )}
      />
      <span>
        AI Service:{" "}
        <span className="font-medium">
          {status === "ok" ? "online" : status === "degraded" ? "degradado" : "offline"}
        </span>
      </span>
    </Link>
  );
}
