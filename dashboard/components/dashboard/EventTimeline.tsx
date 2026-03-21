"use client";

import { useEffect, useRef } from "react";
import { Activity, Brain, Mic, Search, Zap, CheckCircle, Clock } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { TimelineEvent, GeminiModel } from "@/lib/types";

interface EventTimelineProps {
  events: TimelineEvent[];
}

function getEventIcon(event: TimelineEvent) {
  const model = event.model as GeminiModel | undefined;
  if (model === "gemini-2.5-flash-native-audio") return <Mic size={12} className="text-green-400" />;
  if (model === "gemini-embedding-2") return <Search size={12} className="text-blue-400" />;
  if (model === "gemini-3.1-flash") return <Zap size={12} className="text-purple-400" />;

  const text = event.event.toLowerCase();
  if (text.includes("resolv") || text.includes("complet")) return <CheckCircle size={12} className="text-emerald-400" />;
  if (text.includes("call") || text.includes("calling")) return <Mic size={12} className="text-orange-400" />;
  if (text.includes("search") || text.includes("found")) return <Search size={12} className="text-blue-400" />;
  if (text.includes("analyz") || text.includes("recommend")) return <Brain size={12} className="text-purple-400" />;
  return <Activity size={12} className="text-[#6b7280]" />;
}

function TimelineRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  return (
    <div className="flex gap-3 animate-slide-in">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-6 h-6 rounded-full bg-[#1a1a24] border border-[#2a2a3a] flex items-center justify-center flex-shrink-0">
          {getEventIcon(event)}
        </div>
        {!isLast && <div className="w-px flex-1 bg-[#2a2a3a] my-1" />}
      </div>

      {/* Content */}
      <div className={cn("pb-3 min-w-0", isLast && "pb-0")}>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] text-[#e8e8f0] font-medium leading-tight">
            {event.event}
          </span>
          <span className="text-[9px] text-[#6b7280] font-mono flex-shrink-0">
            {formatTime(event.timestamp)}
          </span>
        </div>
        {event.details && (
          <p className="text-[10px] text-[#6b7280] mt-0.5 leading-relaxed">
            {event.details}
          </p>
        )}
      </div>
    </div>
  );
}

export function EventTimeline({ events }: EventTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as events arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-[#6b7280]" />
        <span className="text-xs font-semibold text-[#e8e8f0] uppercase tracking-wider">
          Timeline
        </span>
        <span className="ml-auto text-[10px] text-[#6b7280] font-mono">
          {events.length} events
        </span>
      </div>

      {/* Events */}
      <div className="flex flex-col max-h-72 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="text-[11px] text-[#6b7280] text-center py-6">
            Waiting for agent actions...
          </p>
        ) : (
          events.map((event, i) => (
            <TimelineRow
              key={`${event.timestamp}-${i}`}
              event={event}
              isLast={i === events.length - 1}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
