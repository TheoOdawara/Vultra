"use client";

import { useQuery } from "@tanstack/react-query";
import { healthApi, membersApi, devicesApi } from "@/lib/api";
import type { AiServiceHealthResponse } from "@vultra/types";
import { cn, formatDateTime } from "@/lib/utils";

// ── Health card ────────────────────────────────────────────────────────────────

function AiHealthCard({ health }: { health: AiServiceHealthResponse | undefined }) {
  if (!health) return null;

  const stateLabel: Record<string, string> = {
    CLOSED: "Fechado (normal)",
    OPEN: "Aberto (falhas)",
    HALF_OPEN: "Meio-aberto (testando)",
  };

  const stateColor: Record<string, string> = {
    ok: "border-green-200 bg-green-50",
    degraded: "border-orange-200 bg-orange-50",
    unavailable: "border-red-200 bg-red-50",
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        stateColor[health.status] ?? "border-gray-200 bg-gray-50"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">AI Service</p>
          <p className="mt-1 text-2xl font-semibold capitalize">
            {health.status === "ok" ? "Online" : health.status === "degraded" ? "Degradado" : "Offline"}
          </p>
        </div>
        <span className="text-2xl">
          {health.status === "ok" ? "✅" : health.status === "degraded" ? "⚠️" : "❌"}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-xs text-gray-600">
        <p>Circuit: <span className="font-medium">{stateLabel[health.circuitState] ?? health.circuitState}</span></p>
        <p>Falhas: <span className="font-medium">{health.failureCount}</span></p>
        {health.lastFailureAt && (
          <p>Última falha: <span className="font-medium">{formatDateTime(health.lastFailureAt)}</span></p>
        )}
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: health } = useQuery({
    queryKey: ["health", "ai-service"],
    queryFn: () => healthApi.aiService(),
    refetchInterval: 30_000,
  });

  const { data: membersData } = useQuery({
    queryKey: ["members", { isActive: "true" }],
    queryFn: () => membersApi.list({ isActive: "true", limit: 1 }),
  });

  const { data: devices } = useQuery({
    queryKey: ["devices", "active"],
    queryFn: () => devicesApi.list("true"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Visão geral</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Monitoramento do sistema VULTRA em tempo real
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Membros ativos"
          value={membersData?.total ?? "—"}
          icon="👥"
        />
        <StatCard
          label="Dispositivos ativos"
          value={devices?.length ?? "—"}
          icon="📡"
        />
        <AiHealthCard health={health} />
      </div>
    </div>
  );
}
