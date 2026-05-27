"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Device } from "@vultra/types";
import { devicesApi, ApiClientError } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";

// ── One-time API key modal ─────────────────────────────────────────────────────

/**
 * Displays the API key exactly ONCE.
 * Cannot be closed until the user confirms they saved it.
 * Per the device security spec in docs/frontend/admin/guias/dispositivos.md.
 */
function ApiKeyModal({
  apiKey,
  label,
  onClose,
}: {
  apiKey: string;
  label: string;
  onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Chave de API do dispositivo</h2>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
              Esta chave será exibida <strong>apenas uma vez</strong>.
              Copie e configure o dispositivo <strong>{label}</strong> antes de fechar.
            </p>
          </div>
        </div>

        <div className="my-4">
          <div className="flex items-center gap-2 bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-3 break-all">
            <span className="flex-1 select-all">{apiKey}</span>
          </div>
          <button
            onClick={() => void handleCopy()}
            className={cn(
              "mt-2 w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              copied
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
          >
            {copied ? "✓ Copiado!" : "Copiar para área de transferência"}
          </button>
        </div>

        <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-700">
            Confirmo que salvei a chave de API e configurei o dispositivo
          </span>
        </label>

        <button
          disabled={!confirmed}
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

// ── Register device form ───────────────────────────────────────────────────────

function RegisterDeviceModal({
  onClose,
  onRegistered,
}: {
  onClose: () => void;
  onRegistered: (apiKey: string, label: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await devicesApi.register({ label, location: location || undefined });
      onRegistered(result.apiKey, result.device.label);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? `Erro: ${err.code}` : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Cadastrar dispositivo ESP32-CAM</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identificador <span className="text-gray-400 font-normal">(ex: CAM-SALA-101)</span> *
            </label>
            <input
              required
              minLength={1}
              maxLength={100}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
            <input
              maxLength={200}
              placeholder="Ex: Bloco B, 2º andar"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Cadastrando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DevicesPage() {
  const qc = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [pendingApiKey, setPendingApiKey] = useState<{ key: string; label: string } | null>(null);
  const [deactivating, setDeactivating] = useState<Device | null>(null);
  const [filter, setFilter] = useState<"true" | "false" | "all">("true");

  const { data: devices = [], isLoading, isError } = useQuery({
    queryKey: ["devices", filter],
    queryFn: () => devicesApi.list(filter),
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => devicesApi.rotateKey(id),
    onSuccess: (data, id) => {
      const device = devices.find((d) => d.id === id);
      setPendingApiKey({ key: data.apiKey, label: device?.label ?? id });
      void qc.invalidateQueries({ queryKey: ["devices"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => devicesApi.deactivate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["devices"] });
      setDeactivating(null);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dispositivos</h1>
          <p className="text-sm text-gray-500 mt-0.5">ESP32-CAM registrados na organização</p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Cadastrar dispositivo
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["true", "false", "all"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              filter === v ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"
            )}
          >
            {v === "true" ? "Ativos" : v === "false" ? "Inativos" : "Todos"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-500">Erro ao carregar dispositivos.</div>
        ) : devices.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Nenhum dispositivo encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Identificador</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Localização</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Firmware</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Último contato</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {devices.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 font-mono text-xs">{d.label}</td>
                  <td className="px-4 py-3 text-gray-600">{d.location ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{d.firmwareVersion ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDateTime(d.lastSeenAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      d.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                    )}>
                      {d.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {d.isActive && (
                        <>
                          <button
                            onClick={() => rotateMutation.mutate(d.id)}
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                          >
                            Rotacionar chave
                          </button>
                          <button
                            onClick={() => setDeactivating(d)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Desativar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showRegister && (
        <RegisterDeviceModal
          onClose={() => setShowRegister(false)}
          onRegistered={(key, label) => setPendingApiKey({ key, label })}
        />
      )}

      {pendingApiKey && (
        <ApiKeyModal
          apiKey={pendingApiKey.key}
          label={pendingApiKey.label}
          onClose={() => setPendingApiKey(null)}
        />
      )}

      {deactivating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Desativar dispositivo</h2>
            <p className="text-sm text-gray-600 mb-5">
              Confirma a desativação de <strong>{deactivating.label}</strong>?
              O dispositivo perderá acesso imediatamente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeactivating(null)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={() => deactivateMutation.mutate(deactivating.id)} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
