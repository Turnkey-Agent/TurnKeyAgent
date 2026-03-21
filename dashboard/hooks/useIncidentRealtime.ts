"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Incident, CallLog, GeminiActivity } from "@/lib/types";

interface UseIncidentRealtimeReturn {
  incident: Incident | null;
  callLogs: CallLog[];
  geminiActivity: GeminiActivity[];
  isLoading: boolean;
  error: string | null;
}

export function useIncidentRealtime(
  incidentId: string | null
): UseIncidentRealtimeReturn {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [geminiActivity, setGeminiActivity] = useState<GeminiActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchInitialData = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      // Fetch incident
      const { data: inc, error: incErr } = await supabase
        .from("incidents")
        .select("*")
        .eq("id", id)
        .single();

      if (incErr) throw incErr;
      setIncident(inc as Incident);

      // Fetch call logs
      const { data: logs, error: logsErr } = await supabase
        .from("call_logs")
        .select("*")
        .eq("incident_id", id)
        .order("created_at", { ascending: true });

      if (logsErr) throw logsErr;
      setCallLogs((logs as CallLog[]) ?? []);

      // Fetch gemini activity
      const { data: activity, error: actErr } = await supabase
        .from("gemini_activity")
        .select("*")
        .eq("incident_id", id)
        .order("timestamp", { ascending: false })
        .limit(20);

      if (!actErr) {
        setGeminiActivity((activity as GeminiActivity[]) ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!incidentId) {
      setIsLoading(false);
      return;
    }

    fetchInitialData(incidentId);

    // ── Realtime: incident changes ─────────────────────────────────────────
    const incidentChannel = supabase
      .channel(`incident-${incidentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incidents",
          filter: `id=eq.${incidentId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setIncident((prev) =>
              prev ? { ...prev, ...(payload.new as Partial<Incident>) } : null
            );
          }
        }
      )
      // ── Realtime: new call logs ─────────────────────────────────────────
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_logs",
          filter: `incident_id=eq.${incidentId}`,
        },
        (payload) => {
          setCallLogs((prev) => [...prev, payload.new as CallLog]);
        }
      )
      // ── Realtime: call log updates (transcript streaming) ───────────────
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "call_logs",
          filter: `incident_id=eq.${incidentId}`,
        },
        (payload) => {
          setCallLogs((prev) =>
            prev.map((log) =>
              log.id === (payload.new as CallLog).id
                ? { ...log, ...(payload.new as Partial<CallLog>) }
                : log
            )
          );
        }
      )
      // ── Realtime: Gemini activity ───────────────────────────────────────
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gemini_activity",
          filter: `incident_id=eq.${incidentId}`,
        },
        (payload) => {
          setGeminiActivity((prev) => [payload.new as GeminiActivity, ...prev].slice(0, 20));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "gemini_activity",
          filter: `incident_id=eq.${incidentId}`,
        },
        (payload) => {
          setGeminiActivity((prev) =>
            prev.map((a) =>
              a.id === (payload.new as GeminiActivity).id
                ? { ...a, ...(payload.new as Partial<GeminiActivity>) }
                : a
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(incidentChannel);
    };
  }, [incidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { incident, callLogs, geminiActivity, isLoading, error };
}
