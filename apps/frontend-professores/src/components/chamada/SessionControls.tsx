"use client";

/**
 * VULTRA — Session Controls
 *
 * Buttons to open and close an attendance session.
 * Requires a deviceId to open (professor selects which ESP32 to use).
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { attendanceApi, membersApi, ApiClientError } from "@/lib/api";
import type { OpenSessionBody } from "@vultra/types";

interface Props {
  sessionId: string | null;
  onSessionOpened: (sessionId: string) => void;
  onSessionClosed: () => void;
}

export function SessionControls({ sessionId, onSessionOpened, onSessionClosed }: Props) {
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openMutation = useMutation({
    mutationFn: (body: OpenSessionBody) => attendanceApi.openSession(body),
    onSuccess: (data) => {
      onSessionOpened(data.sessionId);
      setError(null);
    },
    onError: (err) => {
      if (err instanceof ApiClientError) {
        setError(
          err.code === "SESSION_ALREADY_OPEN_FOR_DEVICE"
            ? "Este dispositivo já tem uma sessão aberta."
            : `Erro: ${err.code}`
        );
      }
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => {
      if (!sessionId) throw new Error("No session");
      return attendanceApi.closeSession(sessionId);
    },
    onSuccess: () => {
      onSessionClosed();
      setError(null);
    },
  });

  if (sessionId) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Sessão ativa
        </span>
        <button
          onClick={() => closeMutation.mutate()}
          disabled={closeMutation.isPending}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {closeMutation.isPending ? "Encerrando…" : "Encerrar sessão"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          ID do dispositivo ESP32
        </label>
        <input
          type="text"
          placeholder="UUID do dispositivo"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
        />
      </div>
      <button
        disabled={!deviceId || openMutation.isPending}
        onClick={() => openMutation.mutate({ deviceId })}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {openMutation.isPending ? "Abrindo…" : "Iniciar chamada"}
      </button>
      {error && (
        <p className="w-full text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
