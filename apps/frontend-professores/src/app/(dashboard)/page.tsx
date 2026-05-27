"use client";

import Link from "next/link";

export default function ProfessoresDashboard() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Início</h1>
        <p className="text-sm text-gray-500 mt-0.5">Bem-vindo ao portal de professores VULTRA</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/chamada"
          className="rounded-xl border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="text-3xl mb-3">📋</div>
          <h2 className="font-semibold text-gray-900">Iniciar Chamada</h2>
          <p className="text-sm text-gray-500 mt-1">
            Abra uma sessão de presença com reconhecimento facial em tempo real
          </p>
        </Link>

        <Link
          href="/dashboard/relatorios"
          className="rounded-xl border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="text-3xl mb-3">📊</div>
          <h2 className="font-semibold text-gray-900">Relatórios</h2>
          <p className="text-sm text-gray-500 mt-1">
            Frequência por turma no período selecionado
          </p>
        </Link>
      </div>
    </div>
  );
}
