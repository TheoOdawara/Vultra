"use client";

/**
 * VULTRA — Live Attendance (Chamada) Page
 *
 * Professor opens a session, the ESP32 sends frames, the AI Service
 * processes them, and attendance records are polled every 5 s.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi } from "@/lib/api";
import { LiveAttendancePanel } from "@/components/chamada/LiveAttendancePanel";
import { SessionControls } from "@/components/chamada/SessionControls";
import { ManualOverride } from "@/components/chamada/ManualOverride";

export default function ChamadaPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const qc = useQueryClient();

  // Fetch active member count so the panel can show X / Y present
  const { data: membersData } = useQuery({
    queryKey: ["members", { isActive: "true", role: "student" }],
    queryFn: () => membersApi.list({ isActive: "true", role: "student", limit: 1 }),
  });

  function handleRecorded() {
    // Immediately refetch the records list so the manual entry appears at once
    void qc.invalidateQueries({ queryKey: ["attendance", "records", sessionId] });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Chamada</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Controle de presença em tempo real via reconhecimento facial
        </p>
      </div>

      {/* Session controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <SessionControls
          sessionId={sessionId}
          onSessionOpened={(id) => setSessionId(id)}
          onSessionClosed={() => setSessionId(null)}
        />
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <LiveAttendancePanel
            sessionId={sessionId}
            totalMembers={membersData?.total ?? 0}
          />
        </div>

        {/* Manual override — only visible when session is open */}
        {sessionId && (
          <div>
            <ManualOverride
              sessionId={sessionId}
              onRecorded={handleRecorded}
            />
          </div>
        )}
      </div>
    </div>
  );
}
