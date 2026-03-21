"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Incident {
  id: string;
  status: string;
  category: string;
  description: string;
  urgency: string;
  quotes: Array<{
    vendor_id: string;
    amount: number;
    eta_days: number;
    notes?: string;
  }>;
  timeline: Array<{
    timestamp: string;
    event: string;
    details: string;
  }>;
  created_at: string;
}

interface ActiveCall {
  callSid: string;
  streamSid: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: "#f59e0b",
  triaging: "#3b82f6",
  quoting: "#8b5cf6",
  pending_approval: "#f97316",
  approved: "#10b981",
  scheduled: "#06b6d4",
  in_progress: "#6366f1",
  resolved: "#22c55e",
};

export default function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Fetch incidents
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) {
        setIncidents(data);
        if (data.length > 0 && !selectedIncident) {
          setSelectedIncident(data[0]);
        }
      }
    }
    load();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("incidents")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setIncidents((prev) => [payload.new as Incident, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setIncidents((prev) =>
              prev.map((i) =>
                i.id === (payload.new as Incident).id
                  ? (payload.new as Incident)
                  : i
              )
            );
            setSelectedIncident((prev) =>
              prev?.id === (payload.new as Incident).id
                ? (payload.new as Incident)
                : prev
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Poll active calls from bridge
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/bridge/calls");
        if (res.ok) {
          const data = await res.json();
          setActiveCalls(data.calls || []);
        }
      } catch {
        // Bridge may not be running
      }
    }, 2000);
    return () => clearInterval(poll);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Left Sidebar — Active Calls + Incident List */}
      <aside
        style={{
          width: 280,
          borderRight: "1px solid #333",
          padding: 16,
          overflowY: "auto",
        }}
      >
        <h2 style={{ fontSize: 14, textTransform: "uppercase", color: "#888", marginBottom: 16 }}>
          Active Calls ({activeCalls.length})
        </h2>
        {activeCalls.length === 0 ? (
          <p style={{ color: "#555", fontSize: 13 }}>No active calls</p>
        ) : (
          activeCalls.map((call) => (
            <div
              key={call.callSid}
              style={{
                padding: 8,
                marginBottom: 8,
                borderRadius: 6,
                backgroundColor: "#1a2e1a",
                border: "1px solid #2d5a2d",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: "#22c55e",
                  marginRight: 8,
                  animation: "pulse 2s infinite",
                }}
              />
              <span style={{ fontSize: 13 }}>{call.callSid.slice(-8)}</span>
            </div>
          ))
        )}

        <h2
          style={{
            fontSize: 14,
            textTransform: "uppercase",
            color: "#888",
            marginTop: 24,
            marginBottom: 16,
          }}
        >
          Incidents ({incidents.length})
        </h2>
        {incidents.map((incident) => (
          <div
            key={incident.id}
            onClick={() => setSelectedIncident(incident)}
            style={{
              padding: 10,
              marginBottom: 8,
              borderRadius: 6,
              cursor: "pointer",
              backgroundColor:
                selectedIncident?.id === incident.id ? "#1a1a2e" : "#111",
              border: `1px solid ${selectedIncident?.id === incident.id ? "#4444aa" : "#222"}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 4,
                  backgroundColor: STATUS_COLORS[incident.status] || "#666",
                  color: "#fff",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {incident.status}
              </span>
              <span style={{ fontSize: 11, color: "#666" }}>
                {incident.category}
              </span>
            </div>
            <p
              style={{
                fontSize: 13,
                margin: 0,
                color: "#ccc",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {incident.description}
            </p>
          </div>
        ))}
      </aside>

      {/* Main Content — Selected Incident Detail */}
      <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        {selectedIncident ? (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h1 style={{ fontSize: 24, margin: 0 }}>
                  {selectedIncident.category.charAt(0).toUpperCase() +
                    selectedIncident.category.slice(1)}{" "}
                  Emergency
                </h1>
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 6,
                    backgroundColor:
                      STATUS_COLORS[selectedIncident.status] || "#666",
                    color: "#fff",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {selectedIncident.status}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 6,
                    backgroundColor:
                      selectedIncident.urgency === "emergency"
                        ? "#dc2626"
                        : selectedIncident.urgency === "high"
                          ? "#f97316"
                          : "#666",
                    color: "#fff",
                    textTransform: "uppercase",
                  }}
                >
                  {selectedIncident.urgency}
                </span>
              </div>
              <p style={{ color: "#999", marginTop: 8 }}>
                {selectedIncident.description}
              </p>
            </div>

            {/* Quote Comparison */}
            {selectedIncident.quotes && selectedIncident.quotes.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>
                  Quote Comparison
                </h2>
                <div style={{ display: "flex", gap: 16 }}>
                  {selectedIncident.quotes.map((quote, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        padding: 16,
                        borderRadius: 8,
                        backgroundColor: "#111",
                        border: `1px solid ${i === 0 ? "#22c55e" : "#333"}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          marginBottom: 8,
                        }}
                      >
                        Vendor {i + 1}
                        {i === 0 && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 11,
                              color: "#22c55e",
                            }}
                          >
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
                        ${quote.amount}
                      </div>
                      <div style={{ fontSize: 13, color: "#888" }}>
                        {quote.eta_days} day{quote.eta_days !== 1 ? "s" : ""}
                      </div>
                      {quote.notes && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#666",
                            marginTop: 8,
                            fontStyle: "italic",
                          }}
                        >
                          {quote.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>Timeline</h2>
              <div
                style={{
                  borderLeft: "2px solid #333",
                  paddingLeft: 20,
                  marginLeft: 8,
                }}
              >
                {(selectedIncident.timeline || []).map((entry, i) => (
                  <div key={i} style={{ marginBottom: 16, position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: -26,
                        top: 4,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: "#3b82f6",
                      }}
                    />
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                    <div style={{ fontSize: 13 }}>{entry.details}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#555",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>
                Turnkey Agent Dashboard
              </h2>
              <p>Waiting for incidents...</p>
              <p style={{ fontSize: 13, color: "#444" }}>
                Call +1 (628) 237-0507 to create an incident
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
