"use client";

/**
 * VULTRA — Live Attendance Panel
 *
 * Displays real-time attendance events as they arrive via WebSocket.
 * Shows member name, confidence score, and sentiment label per record.
 *
 * LGPD: No biometric data (frames, embeddings) is displayed.
 * Only derived metadata: name, confidence, sentiment label.
 */

import { useAttendanceWebSocket, type AttendanceEvent } from "@/lib/websocket";
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

function RecordEvent({ event }: { event: Extract<AttendanceEvent, { type: "RECORD_CREATED" }> }) {
  const time = new Date(event.recordedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white border border-gray-100 shadow-sm animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3">
        <span className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700">
          {event.memberName.at(0)?.toUpperCase()}
        </span>
        <div>
          <p className="text-sm font-medium text-gray-900">{event.memberName}</p>
          <p className="text-xs text-gray-400">{time}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {event.sentimentLabel && (
          <span title={event.sentimentLabel} className="text-lg">
            {SENTIMENT_EMOJI[event.sentimentLabel] ?? "🙂"}
          </span>
        )}
        <ConfidenceBadge score={event.confidenceScore} />
      </div>
    </div>
  );
}

interface Props {
  sessionId: string | null;
  totalMembers: number;
}

export function LiveAttendancePanel({ sessionId, totalMembers }: Props) {
  const { state, events } = useAttendanceWebSocket(sessionId);

  const records = events.filter(
    (e): e is Extract<AttendanceEvent, { type: "RECORD_CREATED" }> =>
      e.type === "RECORD_CREATED"
  );

  const aiDegraded = events.find((e) => e.type === "AI_DEGRADED");
  const presentCount = new Set(records.map((r) => r.memberId)).size;

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              state === "open"
                ? "bg-green-500 animate-pulse"
                : state === "connecting"
                  ? "bg-yellow-400 animate-pulse"
                  : "bg-gray-300"
            )}
          />
          <span className="text-sm font-medium text-gray-700">
            {state === "open"
              ? "Chamada em andamento"
              : state === "connecting"
                ? "Conectando…"
                : "Aguardando sessão"}
          </span>
        </div>
        <div className="text-sm text-gray-500">
          <span className="font-semibold text-green-600">{presentCount}</span>
          {totalMembers > 0 && ` / ${totalMembers}`}
          {" presentes"}
        </div>
      </div>

      {/* AI degradation banner */}
      {aiDegraded && aiDegraded.type === "AI_DEGRADED" && (
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-200 text-xs text-orange-700">
          ⚠️ Reconhecimento facial temporariamente indisponível. Tente novamente em{" "}
          {aiDegraded.retryAfter}s ou use o registro manual.
        </div>
      )}

      {/* Event list */}
      <div className="p-3 space-y-1.5 max-h-96 overflow-y-auto">
        {!sessionId ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Inicie uma sessão para ver as presenças em tempo real.
          </p>
        ) : records.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Aguardando registros de presença…
          </p>
        ) : (
          records.map((e, i) => <RecordEvent key={i} event={e} />)
        )}
      </div>
    </div>
  );
}
