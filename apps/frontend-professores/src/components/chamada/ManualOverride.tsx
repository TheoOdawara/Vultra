"use client";

/**
 * VULTRA — Manual Attendance Override
 *
 * Allows professors to manually mark a student as present
 * when facial recognition is unavailable or fails.
 *
 * IMPORTANT: Manual records are flagged is_manual=true in attendance_records.
 * They are traceable and auditable.
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { attendanceApi, membersApi, ApiClientError } from "@/lib/api";
import type { Member } from "@vultra/types";

interface Props {
  sessionId: string;
  onRecorded: () => void;
}

export function ManualOverride({ sessionId, onRecorded }: Props) {
  const [memberId, setMemberId] = useState("");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: membersData } = useQuery({
    queryKey: ["members", { search, isActive: "true" }],
    queryFn: () => membersApi.list({ search, isActive: "true", limit: 10 }),
    enabled: search.length >= 2,
  });

  const mutation = useMutation({
    mutationFn: () =>
      attendanceApi.manualRecord(sessionId, { memberId }),
    onSuccess: (data) => {
      setSuccess(`Presença registrada manualmente.`);
      setMemberId("");
      setSearch("");
      setError(null);
      onRecorded();
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      if (err instanceof ApiClientError) {
        setError(
          err.code === "ATTENDANCE_RECORD_CONFLICT"
            ? "Este membro já tem presença registrada nesta sessão."
            : err.code === "MEMBER_NOT_FOUND"
              ? "Membro não encontrado."
              : `Erro: ${err.code}`
        );
      }
    },
  });

  function selectMember(m: Member) {
    setMemberId(m.id);
    setSearch(m.fullName);
    setShowSearch(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Registro manual</h3>

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar aluno por nome…"
          value={search}
          onFocus={() => setShowSearch(true)}
          onChange={(e) => {
            setSearch(e.target.value);
            setMemberId("");
            setShowSearch(true);
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {showSearch && membersData && membersData.members.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {membersData.members.map((m) => (
              <button
                key={m.id}
                onClick={() => selectMember(m)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
              >
                <span>{m.fullName}</span>
                {m.externalCode && (
                  <span className="text-xs text-gray-400 font-mono">{m.externalCode}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {success && <p className="mt-2 text-xs text-green-600">{success}</p>}

      <button
        disabled={!memberId || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {mutation.isPending ? "Registrando…" : "Marcar presente"}
      </button>
    </div>
  );
}
