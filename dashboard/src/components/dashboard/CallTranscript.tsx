"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Plus, X, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CallLog, ParticipantType } from "@/lib/types";
import type { Quote } from "@/lib/types";
import { QuoteComparison } from "@/components/dashboard/QuoteComparison";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CallTranscriptProps {
  callLogs: CallLog[];
  quotes?: Quote[];
  incidentId?: string;
  approvedVendorId?: string | null;
  onApprove?: (vendorId: string) => Promise<void>;
}

interface TranscriptLine {
  speaker: "agent" | ParticipantType;
  text: string;
}

interface OwnerMessage {
  text: string;
  timestamp: string;
}

interface InvoiceAttachment {
  type: "invoice";
  vendor: string;
  date: string;
  amount: number;
  description: string;
  imageUrl?: string;
  invoiceId: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: string;
  attachments?: InvoiceAttachment[];
}

interface ConversationTab {
  id: string;
  label: string;
}

// ─── Mock agent response logic ─────────────────────────────────────────────────

const MOCK_INVOICES: InvoiceAttachment[] = [
  {
    type: "invoice",
    vendor: "Mike's Plumbing",
    date: "2025-10-14",
    amount: 285,
    description: "PVC joint repair under bathroom sink — Unit 3B",
    invoiceId: "INV-2025-1014",
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80",
  },
  {
    type: "invoice",
    vendor: "Mike's Plumbing",
    date: "2025-07-03",
    amount: 140,
    description: "Slow drain clearing — Unit 3B bathroom",
    invoiceId: "INV-2025-0703",
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80",
  },
];

function getMockAgentReply(userText: string): { text: string; attachments?: InvoiceAttachment[] } {
  const lower = userText.toLowerCase();

  if (/(plumb|plumber|pipe|drain|leak|sink|water)/i.test(lower)) {
    const last = MOCK_INVOICES[0];
    return {
      text: `Your most recent plumbing service was on **${last.date}** by **${last.vendor}**. Here's the invoice from that visit — retrieved from your maintenance records in Supabase.`,
      attachments: [last],
    };
  }

  if (/(invoice|receipt|bill|payment|cost|price|charge)/i.test(lower)) {
    return {
      text: `I found ${MOCK_INVOICES.length} invoices matching plumbing work on this property. Showing the most recent two:`,
      attachments: MOCK_INVOICES,
    };
  }

  if (/(when|schedule|appointment|next|last|fix)/i.test(lower)) {
    return {
      text: "Based on the records I have, the last service appointment was on 2025-10-14 for a plumbing repair. The next scheduled visit is the HVAC service for Unit 7F, arriving in 2 days.",
    };
  }

  return {
    text: "I'm reviewing your property records. Could you be more specific — are you asking about a maintenance invoice, a scheduled appointment, or a vendor quote?",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function parseTranscript(log: CallLog): TranscriptLine[] {
  if (!log.transcript) return [];
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
    return { speaker: log.participant_type, text: line };
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
            ? "bg-blue-500/10 border border-blue-500/20 text-[var(--text)] rounded-tr-sm"
            : "bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-tl-sm"
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

function OwnerMessageBubble({ message }: { message: OwnerMessage }) {
  return (
    <div className="flex gap-2 animate-slide-in">
      <div className="max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-purple-500/10 border border-purple-500/20 text-[var(--text)] rounded-tl-sm">
        <span className="text-[10px] font-semibold block mb-0.5 text-purple-400">
          Landlord (You)
        </span>
        {message.text}
      </div>
    </div>
  );
}

function InvoiceCard({ invoice }: { invoice: InvoiceAttachment }) {
  const [imgOpen, setImgOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden text-xs">
      {/* Image preview */}
      {invoice.imageUrl && (
        <div
          className="relative cursor-pointer group"
          onClick={() => setImgOpen((o) => !o)}
        >
          <img
            src={invoice.imageUrl}
            alt={`Invoice ${invoice.invoiceId}`}
            className={cn(
              "w-full object-cover transition-all",
              imgOpen ? "max-h-64" : "max-h-28"
            )}
          />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ImageIcon size={18} className="text-white" />
            <span className="text-white text-[10px] ml-1">
              {imgOpen ? "Collapse" : "View full"}
            </span>
          </div>
        </div>
      )}
      {/* Invoice metadata */}
      <div className="px-3 py-2 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileText size={11} className="text-[var(--text-muted)]" />
            <span className="font-semibold text-[var(--text)]">{invoice.invoiceId}</span>
          </div>
          <span className="text-green-400 font-semibold">${invoice.amount}</span>
        </div>
        <p className="text-[var(--text-muted)]">{invoice.vendor} · {invoice.date}</p>
        <p className="text-[var(--text-subtle)] leading-relaxed">{invoice.description}</p>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isAgent = message.role === "agent";
  return (
    <div className={cn("flex flex-col gap-2 animate-slide-in", isAgent ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
          isAgent
            ? "bg-blue-500/10 border border-blue-500/20 text-[var(--text)] rounded-tr-sm"
            : "bg-purple-500/10 border border-purple-500/20 text-[var(--text)] rounded-tl-sm"
        )}
      >
        <span className={cn("text-[10px] font-semibold block mb-0.5", isAgent ? "text-blue-400" : "text-purple-400")}>
          {isAgent ? "🤖 Agent" : "You"}
        </span>
        {/* Simple bold markdown rendering */}
        {message.text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={i}>{part.slice(2, -2)}</strong>
            : <span key={i}>{part}</span>
        )}
      </div>
      {/* Inline invoice attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <div className={cn("flex flex-col gap-2 w-full max-w-[85%]", isAgent ? "items-end" : "items-start")}>
          {message.attachments.map((att) => (
            <div key={att.invoiceId} className="w-full">
              <InvoiceCard invoice={att} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

let tabCounter = 1;

export function CallTranscript({
  callLogs,
  quotes,
  incidentId,
  approvedVendorId,
  onApprove,
}: CallTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Live transcript state
  const [ownerInput, setOwnerInput] = useState("");
  const [ownerMessages, setOwnerMessages] = useState<OwnerMessage[]>([]);

  // Tab state
  const [tabs, setTabs] = useState<ConversationTab[]>([{ id: "live", label: "Live Transcript" }]);
  const [activeTabId, setActiveTabId] = useState("live");

  // Chat histories per tab (keyed by tab id)
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});

  const activeLog = callLogs.find((l) => l.status === "active");
  const hasQuotes = quotes && quotes.length > 0;

  const allLines: { logId: string; line: TranscriptLine }[] = [];
  for (const log of callLogs) {
    parseTranscript(log).forEach((line) => allLines.push({ logId: log.id, line }));
  }

  // Auto-scroll live transcript
  useEffect(() => {
    if (activeTabId === "live") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allLines.length, ownerMessages.length, activeTabId]);

  // Auto-scroll chat tabs
  useEffect(() => {
    if (activeTabId !== "live") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistories, activeTabId]);

  // ── Live transcript handlers ────────────────────────────────────────────────

  const handleSend = () => {
    const text = ownerInput.trim();
    if (!text) return;
    setOwnerMessages((prev) => [...prev, { text, timestamp: new Date().toISOString() }]);
    setOwnerInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Tab management ──────────────────────────────────────────────────────────

  const addTab = () => {
    const id = `chat-${tabCounter++}`;
    const label = `Conversation ${tabCounter - 1}`;
    setTabs((prev) => [...prev, { id, label }]);
    setActiveTabId(id);
    setChatHistories((prev) => ({ ...prev, [id]: [] }));
    setChatInputs((prev) => ({ ...prev, [id]: "" }));
  };

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeTabId === tabId) {
      setActiveTabId("live");
    }
    setChatHistories((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
  };

  // ── Chat tab handlers ───────────────────────────────────────────────────────

  const sendChatMessage = (tabId: string) => {
    const text = (chatInputs[tabId] ?? "").trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `${tabId}-${Date.now()}-u`,
      role: "user",
      text,
      timestamp: new Date().toISOString(),
    };

    setChatHistories((prev) => ({
      ...prev,
      [tabId]: [...(prev[tabId] ?? []), userMsg],
    }));
    setChatInputs((prev) => ({ ...prev, [tabId]: "" }));

    // Simulate agent reply after short delay
    setTimeout(() => {
      const reply = getMockAgentReply(text);
      const agentMsg: ChatMessage = {
        id: `${tabId}-${Date.now()}-a`,
        role: "agent",
        text: reply.text,
        timestamp: new Date().toISOString(),
        attachments: reply.attachments,
      };
      setChatHistories((prev) => ({
        ...prev,
        [tabId]: [...(prev[tabId] ?? []), agentMsg],
      }));
    }, 600);
  };

  const handleChatKeyDown = (tabId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage(tabId);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const isLiveTab = activeTabId === "live";
  const currentChatHistory = chatHistories[activeTabId] ?? [];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col">
      {/* Header with tabs */}
      <div className="border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-0 px-2 pt-2 overflow-x-auto">
          <div className="flex items-center gap-1 mr-2 px-1 py-1 flex-shrink-0">
            <MessageSquare size={13} className="text-[var(--text-muted)]" />
          </div>

          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-t-lg flex-shrink-0 transition-colors border border-transparent border-b-0",
                activeTabId === tab.id
                  ? "bg-[var(--surface)] text-[var(--text)] border-[var(--border)] border-b-[var(--surface)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
              )}
            >
              {tab.id === "live" && (
                <>
                  {activeLog && <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-dot flex-shrink-0" />}
                  {tab.label}
                </>
              )}
              {tab.id !== "live" && (
                <>
                  {tab.label}
                  <span
                    onClick={(e) => closeTab(tab.id, e)}
                    className="ml-0.5 p-0.5 rounded hover:bg-[var(--border)] cursor-pointer"
                  >
                    <X size={9} />
                  </span>
                </>
              )}
            </button>
          ))}

          {/* Add new tab */}
          <button
            onClick={addTab}
            className="flex items-center justify-center w-6 h-6 ml-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors flex-shrink-0"
            title="Open new conversation"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Live transcript active call badge */}
        {isLiveTab && activeLog && (
          <div className="flex items-center gap-1.5 text-[10px] text-green-400 px-4 pb-2">
            <span>{activeLog.participant_name} ({activeLog.participant_type})</span>
          </div>
        )}
      </div>

      {/* ── Live Transcript tab ──────────────────────────────────────────────── */}
      {isLiveTab && (
        <>
          <div className="flex flex-col gap-2 p-4 overflow-y-auto" style={{ maxHeight: "460px" }}>
            {allLines.length === 0 && !hasQuotes ? (
              <p className="text-[11px] text-[var(--text-muted)] text-center py-6">
                Transcript will stream here during calls...
              </p>
            ) : (
              allLines.map((item, i) => <TranscriptBubble key={`${item.logId}-${i}`} line={item.line} />)
            )}

            {hasQuotes && (
              <div className="flex flex-col gap-2 animate-slide-in">
                <div className="flex gap-2 flex-row-reverse">
                  <div className="max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-blue-500/10 border border-blue-500/20 text-[var(--text)] rounded-tr-sm">
                    <span className="text-[10px] font-semibold block mb-0.5 text-blue-400">🤖 Agent</span>
                    I've collected quotes from {quotes.length} vendor{quotes.length > 1 ? "s" : ""} and have a recommendation. Please review and approve below.
                  </div>
                </div>
                <div className="ml-2 mr-0">
                  <QuoteComparison
                    quotes={quotes}
                    incidentId={incidentId ?? ""}
                    approvedVendorId={approvedVendorId ?? null}
                    onApprove={onApprove ?? (async () => {})}
                  />
                </div>
              </div>
            )}

            {ownerMessages.map((msg, i) => (
              <OwnerMessageBubble key={i} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>

          {activeLog?.sentiment && (
            <div className="px-4 pb-2 border-t border-[var(--border-subtle)] pt-2">
              <span className="text-[10px] text-[var(--text-muted)]">
                Caller sentiment:{" "}
                <span
                  className={cn(
                    "font-medium",
                    activeLog.sentiment === "angry" && "text-red-400",
                    activeLog.sentiment === "negative" && "text-orange-400",
                    activeLog.sentiment === "neutral" && "text-[var(--text-subtle)]",
                    activeLog.sentiment === "positive" && "text-green-400"
                  )}
                >
                  {activeLog.sentiment}
                </span>
              </span>
            </div>
          )}

          <div className="px-4 pb-4 pt-3 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2">
              <input
                type="text"
                value={ownerInput}
                onChange={(e) => setOwnerInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Suggest next steps or give instructions to the agent..."
                className="flex-1 bg-transparent text-xs text-[var(--text)] placeholder-[var(--text-muted)] outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!ownerInput.trim()}
                className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send size={11} className="text-white" />
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1.5 px-1">
              Press Enter to send · Agent will act on your instructions
            </p>
          </div>
        </>
      )}

      {/* ── Chat conversation tabs ───────────────────────────────────────────── */}
      {!isLiveTab && (
        <>
          <div className="flex flex-col gap-2 p-4 overflow-y-auto" style={{ maxHeight: "460px" }}>
            {currentChatHistory.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[11px] text-[var(--text-muted)]">Ask the agent anything about your property</p>
                <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                  {[
                    "When's my last plumber fixing?",
                    "Show me recent invoices",
                    "Any upcoming appointments?",
                  ].map((hint) => (
                    <button
                      key={hint}
                      onClick={() => {
                        setChatInputs((prev) => ({ ...prev, [activeTabId]: hint }));
                      }}
                      className="text-[10px] px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-blue-500/40 transition-colors"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentChatHistory.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            <div ref={chatBottomRef} />
          </div>

          <div className="px-4 pb-4 pt-3 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2">
              <input
                type="text"
                value={chatInputs[activeTabId] ?? ""}
                onChange={(e) => setChatInputs((prev) => ({ ...prev, [activeTabId]: e.target.value }))}
                onKeyDown={(e) => handleChatKeyDown(activeTabId, e)}
                placeholder="Ask about invoices, appointments, history..."
                className="flex-1 bg-transparent text-xs text-[var(--text)] placeholder-[var(--text-muted)] outline-none"
              />
              <button
                onClick={() => sendChatMessage(activeTabId)}
                disabled={!(chatInputs[activeTabId] ?? "").trim()}
                className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send size={11} className="text-white" />
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1.5 px-1">
              Press Enter to send · Agent searches Supabase records
            </p>
          </div>
        </>
      )}
    </div>
  );
}
