"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const BRIDGE_URL = "http://localhost:3456";

interface Incident {
  id: string;
  status: string;
  category: string;
  description: string;
  urgency: string;
  guest_phone: string;
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
  durationSec: number;
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

  // New incident form
  const [showForm, setShowForm] = useState(true);
  const [situation, setSituation] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [category, setCategory] = useState("plumbing");
  const [urgency, setUrgency] = useState("emergency");
  const [calling, setCalling] = useState(false);

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
          setShowForm(false);
        }
      }
    }
    load();

    const channel = supabase
      .channel("incidents")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newInc = payload.new as Incident;
            setIncidents((prev) => [newInc, ...prev]);
            setSelectedIncident(newInc);
            setShowForm(false);
          } else if (payload.eventType === "UPDATE") {
            setIncidents((prev) =>
              prev.map((i) =>
                i.id === (payload.new as Incident).id ? (payload.new as Incident) : i
              )
            );
            setSelectedIncident((prev) =>
              prev?.id === (payload.new as Incident).id ? (payload.new as Incident) : prev
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Poll active calls
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/calls`);
        if (res.ok) setActiveCalls((await res.json()).calls || []);
      } catch { /* bridge may be down */ }
    }, 1500);
    return () => clearInterval(poll);
  }, []);

  // Initiate outbound call to guest
  const handleInitiateCall = useCallback(async () => {
    if (!situation.trim() || !guestPhone.trim()) return;
    setCalling(true);
    try {
      const res = await fetch(`${BRIDGE_URL}/initiate-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: guestPhone.startsWith("+") ? guestPhone : `+1${guestPhone}`,
          situation,
          type: "guest",
        }),
      });
      const data = await res.json();
      if (data.callSid) {
        console.log("Call initiated:", data.callSid);
      }
    } catch (err) {
      console.error("Failed to initiate call:", err);
    } finally {
      setCalling(false);
    }
  }, [situation, guestPhone]);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Left Sidebar */}
      <aside style={{ width: 280, borderRight: "1px solid #333", padding: 16, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", color: "#888", margin: 0 }}>
            Active Calls ({activeCalls.length})
          </h2>
        </div>

        {activeCalls.map((call) => (
          <div key={call.callSid} style={{
            padding: 8, marginBottom: 8, borderRadius: 6,
            backgroundColor: "#1a2e1a", border: "1px solid #2d5a2d",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                backgroundColor: "#22c55e", marginRight: 8,
              }} />
              <span style={{ fontSize: 13 }}>{call.callSid.slice(-8)}</span>
            </div>
            <span style={{ fontSize: 11, color: "#4ade80" }}>{call.durationSec}s</span>
          </div>
        ))}
        {activeCalls.length === 0 && (
          <p style={{ color: "#555", fontSize: 13 }}>No active calls</p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", color: "#888", margin: 0 }}>
            Incidents ({incidents.length})
          </h2>
          <button
            onClick={() => setShowForm(true)}
            style={{
              fontSize: 18, lineHeight: 1, padding: "2px 8px", cursor: "pointer",
              backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: 4,
            }}
          >+</button>
        </div>

        {incidents.map((incident) => (
          <div
            key={incident.id}
            onClick={() => { setSelectedIncident(incident); setShowForm(false); }}
            style={{
              padding: 10, marginBottom: 8, borderRadius: 6, cursor: "pointer",
              backgroundColor: selectedIncident?.id === incident.id && !showForm ? "#1a1a2e" : "#111",
              border: `1px solid ${selectedIncident?.id === incident.id && !showForm ? "#4444aa" : "#222"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{
                fontSize: 11, padding: "2px 6px", borderRadius: 4,
                backgroundColor: STATUS_COLORS[incident.status] || "#666",
                color: "#fff", textTransform: "uppercase", fontWeight: 600,
              }}>
                {incident.status}
              </span>
              <span style={{ fontSize: 11, color: "#666" }}>{incident.category}</span>
            </div>
            <p style={{ fontSize: 13, margin: 0, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {incident.description}
            </p>
          </div>
        ))}
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        {showForm ? (
          /* New Incident + Call Form */
          <div style={{ maxWidth: 600 }}>
            <h1 style={{ fontSize: 24, marginBottom: 24 }}>New Incident</h1>
            <p style={{ color: "#888", marginBottom: 24 }}>
              Describe the situation. The AI agent will call the guest to gather details and triage.
            </p>

            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>
                Guest Phone Number
              </span>
              <input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="+17654134446"
                style={{
                  width: "100%", padding: "10px 12px", backgroundColor: "#111",
                  border: "1px solid #333", borderRadius: 6, color: "#fff", fontSize: 15,
                }}
              />
            </label>

            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <label style={{ flex: 1 }}>
                <span style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", backgroundColor: "#111",
                    border: "1px solid #333", borderRadius: 6, color: "#fff", fontSize: 14,
                  }}
                >
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="hvac">HVAC</option>
                  <option value="appliance">Appliance</option>
                  <option value="structural">Structural</option>
                </select>
              </label>
              <label style={{ flex: 1 }}>
                <span style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>Urgency</span>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", backgroundColor: "#111",
                    border: "1px solid #333", borderRadius: 6, color: "#fff", fontSize: 14,
                  }}
                >
                  <option value="emergency">Emergency</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
            </div>

            <label style={{ display: "block", marginBottom: 24 }}>
              <span style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>
                Situation Description
              </span>
              <textarea
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                placeholder="Guest reported bathroom flooding from burst pipe under sink. Water spreading to hallway. Guest is upset and wants immediate resolution."
                rows={5}
                style={{
                  width: "100%", padding: "10px 12px", backgroundColor: "#111",
                  border: "1px solid #333", borderRadius: 6, color: "#fff", fontSize: 14,
                  resize: "vertical", fontFamily: "inherit",
                }}
              />
            </label>

            <button
              onClick={handleInitiateCall}
              disabled={calling || !situation.trim() || !guestPhone.trim()}
              style={{
                padding: "14px 32px", fontSize: 16, fontWeight: 600,
                backgroundColor: calling ? "#555" : "#dc2626",
                color: "#fff", border: "none", borderRadius: 8, cursor: calling ? "default" : "pointer",
                width: "100%",
              }}
            >
              {calling ? "Calling..." : "Call Guest Now"}
            </button>

            <p style={{ fontSize: 12, color: "#555", marginTop: 12, textAlign: "center" }}>
              Agent will call from +1 (628) 237-0507 and handle the conversation autonomously
            </p>
          </div>
        ) : selectedIncident ? (
          /* Incident Detail */
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h1 style={{ fontSize: 24, margin: 0 }}>
                  {selectedIncident.category.charAt(0).toUpperCase() + selectedIncident.category.slice(1)} Emergency
                </h1>
                <span style={{
                  fontSize: 12, padding: "4px 10px", borderRadius: 6,
                  backgroundColor: STATUS_COLORS[selectedIncident.status] || "#666",
                  color: "#fff", textTransform: "uppercase", fontWeight: 600,
                }}>
                  {selectedIncident.status}
                </span>
                <span style={{
                  fontSize: 12, padding: "4px 10px", borderRadius: 6,
                  backgroundColor: selectedIncident.urgency === "emergency" ? "#dc2626"
                    : selectedIncident.urgency === "high" ? "#f97316" : "#666",
                  color: "#fff", textTransform: "uppercase",
                }}>
                  {selectedIncident.urgency}
                </span>
              </div>
              <p style={{ color: "#999", marginTop: 8 }}>{selectedIncident.description}</p>
              {selectedIncident.guest_phone && (
                <p style={{ color: "#666", fontSize: 13 }}>Guest: {selectedIncident.guest_phone}</p>
              )}
            </div>

            {/* Quote Comparison */}
            {selectedIncident.quotes?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>Quote Comparison</h2>
                <div style={{ display: "flex", gap: 16 }}>
                  {selectedIncident.quotes.map((quote, i) => (
                    <div key={i} style={{
                      flex: 1, padding: 16, borderRadius: 8, backgroundColor: "#111",
                      border: `1px solid ${i === 0 ? "#22c55e" : "#333"}`,
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                        Vendor {i + 1}
                        {i === 0 && <span style={{ marginLeft: 8, fontSize: 11, color: "#22c55e" }}>RECOMMENDED</span>}
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>${quote.amount}</div>
                      <div style={{ fontSize: 13, color: "#888" }}>
                        {quote.eta_days} day{quote.eta_days !== 1 ? "s" : ""}
                      </div>
                      {quote.notes && (
                        <div style={{ fontSize: 12, color: "#666", marginTop: 8, fontStyle: "italic" }}>
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
              <div style={{ borderLeft: "2px solid #333", paddingLeft: 20, marginLeft: 8 }}>
                {(selectedIncident.timeline || []).map((entry, i) => (
                  <div key={i} style={{ marginBottom: 16, position: "relative" }}>
                    <div style={{
                      position: "absolute", left: -26, top: 4,
                      width: 10, height: 10, borderRadius: "50%", backgroundColor: "#3b82f6",
                    }} />
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#555" }}>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Turnkey Agent</h2>
              <p>123 Lemon Drive, San Francisco</p>
              <p style={{ fontSize: 13, color: "#444" }}>Click + to create an incident</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
