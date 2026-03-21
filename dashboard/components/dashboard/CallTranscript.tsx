"use client";

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { CallLog, ParticipantType } from "@/lib/types";

interface CallTranscriptProps {
  callLogs: CallLog[];
}

// Parse transcript lines into speaker / text pairs
interface TranscriptLine {
  speaker: "agent" | ParticipantType;
  text: string;
  time?: string;
}

function parseTranscript(log: CallLog): TranscriptLine[] {
  if (!log.transcript) return [];

  // Transcript format from Gemini Live:
  // "[Agent]: Hello...\n[Guest]: The pipe is broken..."
  const lines = log.transcript.split("\n").filter(Boolean);
  return lines.map((line) => {
    const agentMatch = line.match(/^\[Agent\]:\s*(.+)/);
    const guestMatch = line.match(/^\[Guest\]:\s*(.+)/);
    const vendorMatch = line.match(/^\[Vendor\]:\s*(.+)/);
    const landlordMatch = line.match(/^\[Landlord\]:\s*(.+)/);

    if (agentMatch) return { speaker: "agent", text: agentMatch[1] };
    if (guestMatch) return { speaker: "guest", text: guestMatch[1] };
    if (vendorMatch) return { speaker: "vendor", text: vendorMatch[1] };
    if (landlordMatch) return { speaker: "landlord", text: landlordMatch[1] };

    // Fallback — unknown line
    return {
      speaker: log.participant_type,
      text: line,
    };
  });
}

function TranscriptBubble({ line }: { line: TranscriptLine }) {
  const isAgent = line.speaker === "agent";

  const participantColor: Record<string, string> = {
    agent: "text-blue-400",
    guest: "text-orange-400",
    vendor: "text-green-400",
    landlord: "text-purple-400",
  };

  const participantLabel: Record<string, string> = {
    agent: "🤖 Agent",
    guest: "Guest",
    vendor: "Vendor",
    landlord: "Landlord",
  };

  return (
    <div className={cn("flex gap-2 animate-slide-in", isAgent && "flex-row-reverse")}>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed",
          isAgent
            ? "bg-blue-500/10 border border-blue-500/20 text-[#e8e8f0] rounded-tr-sm"
            : "bg-[#1a1a24] border border-[#2a2a3a] text-[#e8e8f0] rounded-tl-sm"
        )}
      >
        <span className={cn("text-[10px] font-semibold block mb-0.5", participantColor[line.speaker])}>
          {participantLabel[line.speaker] ?? line.speaker}
        </span>
        {line.text}
      </div>
    </div>
  );
}

export function CallTranscript({ callLogs }: CallTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeLog = callLogs.find((l) => l.status === "active");

  // Build all parsed lines from all call logs (most recent active first)
  const allLines: { logId: string; line: TranscriptLine; participantName: string }[] = [];
  for (const log of callLogs) {
    const lines = parseTranscript(log);
    lines.forEach((line) =>
      allLines.push({ logId: log.id, line, participantName: log.participant_name })
    );
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allLines.length]);

  return (
    <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-[#6b7280]" />
          <span className="text-xs font-semibold text-[#e8e8f0] uppercase tracking-wider">
            Live Transcript
          </span>
        </div>
        {activeLog && (
          <div className="flex items-center gap-1.5 text-[10px] text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-dot" />
            <span>
              {activeLog.participant_name} ({activeLog.participant_type})
            </span>
          </div>
        )}
      </div>

      {/* Transcript bubbles */}
      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        {allLines.length === 0 ? (
          <p className="text-[11px] text-[#6b7280] text-center py-6">
            Transcript will stream here during calls...
          </p>
        ) : (
          allLines.map((item, i) => (
            <TranscriptBubble key={`${item.logId}-${i}`} line={item.line} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Active call sentiment */}
      {activeLog?.sentiment && (
        <div className="border-t border-[#1a1a24] pt-2">
          <span className="text-[10px] text-[#6b7280]">
            Caller sentiment:{" "}
            <span
              className={cn(
                "font-medium",
                activeLog.sentiment === "angry" && "text-red-400",
                activeLog.sentiment === "negative" && "text-orange-400",
                activeLog.sentiment === "neutral" && "text-[#9ca3af]",
                activeLog.sentiment === "positive" && "text-green-400"
              )}
            >
              {activeLog.sentiment}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
