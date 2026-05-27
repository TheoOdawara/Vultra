"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AttendanceReportRow } from "@vultra/types";
import { reportsApi } from "@/lib/api";

// ── Date helpers ───────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

// ── Attendance bar ─────────────────────────────────────────────────────────────

function AttendanceBar({ rate }: { rate: number }) {
  const pct = Math.round(rate);
  const color = pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-10 text-right">{pct}%</span>
    </div>
  );
}

// ── Row component ──────────────────────────────────────────────────────────────

function AttendanceRow({ row }: { row: AttendanceReportRow }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-900">{row.memberName}</td>
      <td className="px-4 py-3 text-gray-500 text-xs capitalize">{row.memberRole}</td>
      <td className="px-4 py-3 text-center text-gray-700">{row.attendedSessions}</td>
      <td className="px-4 py-3 text-center text-gray-700">{row.totalSessions}</td>
      <td className="px-4 py-3 w-40">
        <AttendanceBar rate={row.attendanceRate} />
      </td>
    </tr>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [from, setFrom] = useState(thirtyDaysAgoISO());
  const [to, setTo] = useState(todayISO());

  const fromISO = `${from}T00:00:00.000Z`;
  const toISO = `${to}T23:59:59.999Z`;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reports", "attendance", { from: fromISO, to: toISO }],
    queryFn: () => reportsApi.attendance({ from: fromISO, to: toISO }),
    enabled: !!from && !!to,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Frequência por membro no período</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">De</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Até</label>
          <input
            type="date"
            value={to}
            min={from}
            max={todayISO()}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => void refetch()}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Gerar relatório
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-500">Erro ao carregar relatório.</div>
        ) : !data ? (
          <div className="py-16 text-center text-sm text-gray-400">
            Selecione um período e clique em Gerar relatório.
          </div>
        ) : data.rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Sem dados no período.</div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
              {data.rows.length} membros · gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Membro</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Papel</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Presenças</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Sessões</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Taxa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.rows.map((row) => (
                  <AttendanceRow key={row.memberId} row={row} />
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
