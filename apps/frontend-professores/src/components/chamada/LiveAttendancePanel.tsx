"use client";

/**
 * VULTRA — Live Attendance Panel
 *
 * Displays attendance records as they arrive, polled every 5 s from
 * GET /v1/attendance/sessions/:id/records.
 *
 * LGPD: No biometric data (frames, embeddings) is displayed.
 * Only derived metadata: name, confidence, sentiment label.
 */

import { useAttendancePolling, type SessionAttendanceRecord } from "@/lib/websocket";
import { cn } from "@/lib/utils";

const SENTIMENT_EMOJI: Record<string, string> = {
  happy: "😊",
  neutral: "😐",
  sad: "😢",
  angry: "😠",
  surprise: "😲",
  fear: "😨",
  disgust: "🤢",
};

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 85
      ? "bg-green-100 text-green-800"
      : pct >= 65
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {pct}%
    </span>
  );
}

function RecordRow({ record }: { record: SessionAttendanceRecord }) {
  const time = new Date(record.recordedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700">
          {record.memberName.at(0)?.toUpperCase()}
        </span>
        <div>
          <p className="text-sm font-medium text-gray-900">{record.memberName}</p>
          <p className="text-xs text-gray-400">
            {time} · {record.recognitionMethod === "manual" ? "manual" : "facial"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {record.sentimentLabel && (
          <span title={record.sentimentLabel} className="text-lg">
            {SENTIMENT_EMOJI[record.sentimentLabel] ?? "🙂"}
          </span>
        )}
        <ConfidenceBadge score={record.confidenceScore} />
      </div>
    </div>
  );
}

interface Props {
  sessionId: string | null;
  totalMembers: number;
}

export function LiveAttendancePanel({ sessionId, totalMembers }: Props) {
  const { records, isFetching, isError } = useAttendancePolling(sessionId);

  const presentCount = new Set(records.map((r) => r.memberId)).size;

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              !sessionId
                ? "bg-gray-300"
                : isFetching
                  ? "bg-yellow-400 animate-pulse"
                  : isError
                    ? "bg-red-400"
                    : "bg-green-500"
            )}
          />
          <span className="text-sm font-medium text-gray-700">
            {!sessionId
              ? "Aguardando sessão"
              : isError
                ? "Erro ao carregar registros"
                : "Chamada em andamento"}
          </span>
        </div>
        <div className="text-sm text-gray-500">
          <span className="font-semibold text-green-600">{presentCount}</span>
          {totalMembers > 0 && ` / ${totalMembers}`}
          {" presentes"}
        </div>
      </div>

      {/* Record list */}
      <div className="p-3 space-y-1.5 max-h-96 overflow-y-auto">
        {!sessionId ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Inicie uma sessão para ver as presenças.
          </p>
        ) : records.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Aguardando registros de presença…
          </p>
        ) : (
          records.map((r) => <RecordRow key={r.recordId} record={r} />)
        )}
      </div>
    </div>
  );
}
