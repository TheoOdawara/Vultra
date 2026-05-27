"use client";

/**
 * VULTRA RH — Wellbeing Dashboard
 *
 * Displays aggregated sentiment data and wellness alerts per the
 * LGPD-compliant data spec: only aggregated labels, no individual
 * biometric data or embeddings exposed.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WellbeingAlert, WellbeingRow } from "@vultra/types";
import { reportsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────────

const SENTIMENT_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  happy:    { emoji: "😊", label: "Feliz",      color: "bg-green-100 text-green-800" },
  neutral:  { emoji: "😐", label: "Neutro",     color: "bg-gray-100 text-gray-700" },
  sad:      { emoji: "😢", label: "Triste",     color: "bg-blue-100 text-blue-800" },
  angry:    { emoji: "😠", label: "Irritado",   color: "bg-red-100 text-red-800" },
  surprise: { emoji: "😲", label: "Surpreso",   color: "bg-yellow-100 text-yellow-800" },
  fear:     { emoji: "😨", label: "Ansioso",    color: "bg-orange-100 text-orange-800" },
  disgust:  { emoji: "🤢", label: "Desconforto",color: "bg-purple-100 text-purple-800" },
};

function SentimentBadge({ label }: { label: string }) {
  const config = SENTIMENT_CONFIG[label] ?? { emoji: "🙂", label, color: "bg-gray-100 text-gray-700" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", config.color)}>
      {config.emoji} {config.label}
    </span>
  );
}

// ── Alert card ─────────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: WellbeingAlert }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <span className="text-xl mt-0.5">🔔</span>
      <div>
        <p className="text-sm font-semibold text-red-900">{alert.memberName}</p>
        <p className="text-xs text-red-700 mt-0.5">
          <SentimentBadge label={alert.dominantNegativeSentiment} /> detectado{" "}
          <strong>{alert.negativeOccurrences}×</strong> nos últimos{" "}
          {alert.observationWindowDays} dias
        </p>
        <p className="text-xs text-red-500 mt-1">
          Considere uma conversa de acolhimento com este colaborador.
        </p>
      </div>
    </div>
  );
}

// ── Breakdown table ────────────────────────────────────────────────────────────

function BreakdownTable({ rows }: { rows: WellbeingRow[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left font-medium text-gray-600">Membro</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Sentimento</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Ocorrências</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Score médio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{row.memberName}</td>
              <td className="px-4 py-3"><SentimentBadge label={row.sentimentLabel} /></td>
              <td className="px-4 py-3 text-center text-gray-700">{row.occurrences}</td>
              <td className="px-4 py-3 text-center text-gray-600">
                {(row.avgScore * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nDaysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function WellbeingPage() {
  const [from, setFrom] = useState(nDaysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [alertThreshold, setAlertThreshold] = useState(3);

  const fromISO = `${from}T00:00:00.000Z`;
  const toISO = `${to}T23:59:59.999Z`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports", "wellbeing", { from: fromISO, to: toISO, alertThreshold }],
    queryFn: () => reportsApi.wellbeing({ from: fromISO, to: toISO, alertThreshold }),
    enabled: !!from && !!to,
  });

  const positiveLabels = new Set(["happy", "neutral"]);
  const negativeRows = (data?.sentimentBreakdown ?? []).filter(
    (r) => !positiveLabels.has(r.sentimentLabel)
  );
  const positiveRows = (data?.sentimentBreakdown ?? []).filter(
    (r) => positiveLabels.has(r.sentimentLabel)
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard de Bem-Estar</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Análise de sentimento agregada por colaborador · LGPD compliant
        </p>
      </div>

      {/* Filters */}
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
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Limiar de alerta <span className="text-gray-400">(ocorrências negativas)</span>
          </label>
          <input type="number" min={1} max={20} value={alertThreshold}
            onChange={(e) => setAlertThreshold(Number(e.target.value))}
            className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
      ) : isError ? (
        <div className="py-16 text-center text-sm text-red-500">Erro ao carregar dados.</div>
      ) : !data ? null : (
        <>
          {/* Alerts */}
          {data.alerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">
                ⚠️ Alertas ({data.alerts.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.alerts.map((alert, i) => (
                  <AlertCard key={i} alert={alert} />
                ))}
              </div>
            </div>
          )}

          {/* Breakdown */}
          {negativeRows.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-700">Sentimentos negativos detectados</h2>
              <BreakdownTable rows={negativeRows} />
            </div>
          )}

          {positiveRows.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-700">Sentimentos positivos / neutros</h2>
              <BreakdownTable rows={positiveRows} />
            </div>
          )}

          {data.sentimentBreakdown.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-400">
              Nenhum dado de sentimento no período.
            </div>
          )}

          <p className="text-xs text-gray-400">
            Gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")} ·
            Limiar de alerta: {data.filter.alertThreshold} ocorrências
          </p>
        </>
      )}
    </div>
  );
}
