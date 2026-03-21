"use client";

import { Brain, Mic, Search, Zap, Volume2 } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { GeminiActivity, GeminiModel } from "@/lib/types";

interface GeminiActivityFeedProps {
  activities: GeminiActivity[];
}

const fallbackConfig = {
  label: "Gemini",
  color: "text-gray-400",
  bg: "bg-gray-500/10 border-gray-500/20",
  icon: <Brain size={11} />,
};

const modelConfig: Record<
  GeminiModel,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  "gemini-2.5-flash-native-audio": {
    label: "Native Audio",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    icon: <Mic size={11} />,
  },
  "gemini-2.5-flash-native-audio-latest": {
    label: "Native Audio",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    icon: <Mic size={11} />,
  },
  "gemini-embedding-2": {
    label: "Embedding 2",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    icon: <Search size={11} />,
  },
  "gemini-3.1-flash": {
    label: "Flash 3.1",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    icon: <Zap size={11} />,
  },
  "gemini-2.5-flash-tts": {
    label: "TTS",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    icon: <Volume2 size={11} />,
  },
};

function ActivityRow({ activity }: { activity: GeminiActivity }) {
  const config = modelConfig[activity.model] ?? fallbackConfig;
  const isActive = activity.status === "active";

  return (
    <div className={cn("flex items-start gap-2.5 py-2 animate-fade-in")}>
      {/* Model badge */}
      <div
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium flex-shrink-0 mt-0.5",
          config.bg,
          config.color
        )}
      >
        {config.icon}
        <span>{config.label}</span>
        {isActive && (
          <span className="w-1 h-1 rounded-full bg-current live-dot ml-0.5" />
        )}
      </div>

      {/* Label + result */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[var(--text)] leading-tight">{activity.label}</p>
        {activity.result && (
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{activity.result}</p>
        )}
      </div>

      <span className="text-[9px] text-[var(--text-muted)] flex-shrink-0 font-mono">
        {formatTime(activity.timestamp)}
      </span>
    </div>
  );
}

export function GeminiActivityFeed({ activities }: GeminiActivityFeedProps) {
  // Current active model statuses
  const activeModels = activities
    .filter((a) => a.status === "active")
    .map((a) => a.model);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain size={14} className="text-[var(--text-muted)]" />
        <span className="text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
          Gemini Activity
        </span>
      </div>

      {/* Live model status pills */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(modelConfig) as GeminiModel[]).map((model) => {
          const config = modelConfig[model];
          const isLive = activeModels.includes(model);
          return (
            <div
              key={model}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-all",
                isLive
                  ? cn(config.bg, config.color, "border-current/30")
                  : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)]"
              )}
            >
              {config.icon}
              <span>{config.label}</span>
              {isLive && (
                <span className="w-1 h-1 rounded-full bg-current live-dot" />
              )}
            </div>
          );
        })}
      </div>

      {/* Activity feed */}
      <div className="flex flex-col divide-y divide-[var(--border-subtle)] max-h-48 overflow-y-auto">
        {activities.length === 0 ? (
          <p className="text-[11px] text-[var(--text-muted)] text-center py-4">
            Waiting for agent activity...
          </p>
        ) : (
          activities.map((a) => <ActivityRow key={a.id} activity={a} />)
        )}
      </div>
    </div>
  );
}
