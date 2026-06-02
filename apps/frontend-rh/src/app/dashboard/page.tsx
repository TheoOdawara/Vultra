"use client";

import Link from "next/link";

export default function RhDashboard() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Painel RH</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestão de presença e bem-estar dos colaboradores</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/attendance"
          className="rounded-xl border border-gray-200 bg-white p-6 hover:border-teal-300 hover:shadow-sm transition-all"
        >
          <div className="text-3xl mb-3">📅</div>
          <h2 className="font-semibold text-gray-900">Relatório de Presença</h2>
          <p className="text-sm text-gray-500 mt-1">
            Frequência por colaborador com filtro por período
          </p>
        </Link>

        <Link
          href="/dashboard/wellbeing"
          className="rounded-xl border border-gray-200 bg-white p-6 hover:border-teal-300 hover:shadow-sm transition-all"
        >
          <div className="text-3xl mb-3">🌡️</div>
          <h2 className="font-semibold text-gray-900">Dashboard de Bem-Estar</h2>
          <p className="text-sm text-gray-500 mt-1">
            Sentimento agregado e alertas de atenção · LGPD compliant
          </p>
        </Link>
      </div>
    </div>
  );
}
