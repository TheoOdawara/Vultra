"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AttendanceReportRow } from "@vultra/types";
import { reportsApi } from "@/lib/api";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nDaysAgoISO(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}

function RateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate);
  const color = pct >= 75 ? "bg-teal-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function AttendancePage() {
  const [from, setFrom] = useState(nDaysAgoISO(30));
  const [to, setTo] = useState(todayISO());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports", "attendance", { from, to }],
    queryFn: () =>
      reportsApi.attendance({
        from: `${from}T00:00:00.000Z`,
        to: `${to}T23:59:59.999Z`,
      }),
    enabled: !!from && !!to,
  });

  // Sort by attendance rate ascending (lowest first — needs attention)
  const rows = [...(data?.rows ?? [])].sort((a, b) => a.attendanceRate - b.attendanceRate);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Relatório de Presença</h1>
        <p className="text-sm text-gray-500 mt-0.5">Frequência por colaborador no período</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">De</label>
          <input type="date" value={from} max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Até</label>
          <input type="date" value={to} min={from} max={todayISO()}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-500">Erro ao carregar relatório.</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Sem dados no período.</div>
        ) : (
          <>
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
              {rows.length} colaboradores · ordenados por menor frequência
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Colaborador</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Presenças</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Sessões</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-48">Frequência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row: AttendanceReportRow) => (
                  <tr key={row.memberId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.memberName}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{row.attendedSessions}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{row.totalSessions}</td>
                    <td className="px-4 py-3 w-48">
                      <RateBar rate={row.attendanceRate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
