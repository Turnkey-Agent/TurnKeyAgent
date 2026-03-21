"use client";

import { useEffect, useState } from "react";
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import type { CallLog, ParticipantType } from "@/lib/types";

interface ActiveCallsPanelProps {
  callLogs: CallLog[];
}

// Track elapsed seconds for active calls
function useCallTimer(callLog: CallLog) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (callLog.status !== "active") {
      setElapsed(callLog.duration_seconds ?? 0);
      return;
    }
    const start = new Date(callLog.created_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callLog.status, callLog.created_at, callLog.duration_seconds]);
  return elapsed;
}

function CallRow({ log }: { log: CallLog }) {
  const elapsed = useCallTimer(log);
  const isActive = log.status === "active";

  const participantColors: Record<ParticipantType, string> = {
    guest: "text-orange-400",
    vendor: "text-blue-400",
    landlord: "text-purple-400",
  };

  const participantLabels: Record<ParticipantType, string> = {
    guest: "Guest",
    vendor: "Vendor",
    landlord: "Landlord",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
        isActive ? "bg-[var(--surface-2)]" : "opacity-50"
      )}
    >
      {/* Status dot */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isActive ? "bg-green-500 live-dot" : "bg-gray-600"
          )}
        />
        {isActive && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 opacity-40 scale-150 animate-ping" />
        )}
      </div>

      {/* Direction icon */}
      <div className={cn("flex-shrink-0", participantColors[log.participant_type])}>
        {!isActive ? (
          <PhoneOff size={13} />
        ) : log.direction === "inbound" ? (
          <PhoneIncoming size={13} />
        ) : (
          <PhoneOutgoing size={13} />
        )}
      </div>

      {/* Name + type */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--text)] truncate">
          {log.participant_name || log.participant_phone}
        </p>
        <p className={cn("text-[10px]", participantColors[log.participant_type])}>
          {participantLabels[log.participant_type]}
        </p>
      </div>

      {/* Timer / waveform */}
      <div className="flex-shrink-0 text-right">
        {isActive ? (
          <div className="flex items-end gap-0.5 h-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="wave-bar w-0.5 bg-green-500 rounded-full"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            {formatDuration(elapsed)}
          </span>
        )}
      </div>
    </div>
  );
}

export function ActiveCallsPanel({ callLogs }: ActiveCallsPanelProps) {
  const activeCalls = callLogs.filter((l) => l.status === "active");
  const recentCalls = callLogs.filter((l) => l.status !== "active").slice(-3);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-[var(--text-muted)]" />
          <span className="text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
            Active Calls
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              activeCalls.length > 0 ? "bg-green-500 live-dot" : "bg-[var(--border)]"
            )}
          />
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            {activeCalls.length} live
          </span>
        </div>
      </div>

      {/* Call rows */}
      <div className="flex flex-col gap-1">
        {activeCalls.length === 0 && recentCalls.length === 0 ? (
          <p className="text-[11px] text-[var(--text-muted)] text-center py-4">
            No calls yet
          </p>
        ) : (
          <>
            {activeCalls.map((log) => (
              <CallRow key={log.id} log={log} />
            ))}
            {recentCalls.length > 0 && activeCalls.length > 0 && (
              <div className="border-t border-[var(--border)] my-1" />
            )}
            {recentCalls.map((log) => (
              <CallRow key={log.id} log={log} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
