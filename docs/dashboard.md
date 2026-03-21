# Dashboard Specification

> Next.js 15 + AI SDK 6 + Vercel Workflow DevKit + Supabase Realtime

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  TURNKEY AGENT — Lemon Property Dashboard           │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ ACTIVE   │  INCIDENT #1247 — Unit 3B Pipe Leak     │
│ CALLS    │  ┌─────────────────────────────────────┐ │
│          │  │  STATUS: ● QUOTING                  │ │
│ 🟢 Guest │  │                                     │ │
│   2:34   │  │  TIMELINE                           │ │
│          │  │  9:14 AM — Guest called (angry)     │ │
│ 🟢 Plmbr1│  │  9:15 AM — Searched history: found  │ │
│   1:12   │  │            similar issue Oct 2024   │ │
│          │  │  9:16 AM — Calling Plumber 1...     │ │
│ 🟢 Plmbr2│  │  9:16 AM — Calling Plumber 2...     │ │
│   0:48   │  │  9:18 AM — Plumber 1: $300 / 2 days│ │
│          │  │  9:20 AM — Plumber 2: $1000 / 5 days│ │
│ ⚪ Lndlrd│  │                                     │ │
│   idle   │  ├─────────────────────────────────────┤ │
│          │  │  QUOTE COMPARISON                   │ │
│──────────│  │  ┌──────────┬──────────┐            │ │
│          │  │  │Plumber 1 │Plumber 2 │            │ │
│ PROPERTY │  │  │⭐ 4.9    │⭐ 4.2    │            │ │
│ CONTEXT  │  │  │$300      │$1,000    │            │ │
│          │  │  │2 days    │5 days    │            │ │
│ Similar  │  │  │12 prev   │3 prev    │            │ │
│ Issues:  │  │  │jobs here │jobs here │            │ │
│ - Oct 24 │  │  │✅ RECMND │          │            │ │
│ - Jul 22 │  │  └──────────┴──────────┘            │ │
│          │  │                                     │ │
│ Vendor   │  │  [APPROVE PLUMBER 1]  [OVERRIDE]    │ │
│ Code:    │  │                                     │ │
│ ****     │  └─────────────────────────────────────┘ │
│          │                                          │
│ Live     │  CALL TRANSCRIPTS (streaming)            │
│ Audio    │  ┌─────────────────────────────────────┐ │
│ Wavefm   │  │ 🔴 Plumber 1: "Yeah I can do $300  │ │
│          │  │    and be there Wednesday morning"   │ │
│          │  │ 🔵 Agent: "That works. Let me check │ │
│          │  │    with the property owner..."       │ │
│          │  └─────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────┘
```

---

## Components

### Left Sidebar
- **Active Calls:** Real-time indicators (green = active, gray = idle) with call duration timers
- **Property Context:** Similar past issues pulled from maintenance history via embedding search
- **Vendor Code:** Masked by default, shown only to verified vendors
- **Live Audio Waveform:** Visual indicator of active call audio

### Main Content Area
- **Incident Header:** Incident ID, unit, issue summary, current status badge
- **Timeline / Audit Log:** Chronological list of all agent actions with timestamps
- **Quote Comparison Cards:** Side-by-side vendor quotes with AI recommendation highlight
- **Approval Buttons:** Landlord can approve recommended vendor or override

### Bottom Panel
- **Streaming Call Transcripts:** Real-time display of active call dialog

---

## Real-time Updates

| Source | Mechanism |
|---|---|
| Incidents & call logs | Supabase Realtime subscriptions |
| Agent reasoning | Vercel AI SDK `useChat` streaming |
| Workflow step completion | Server-Sent Events from Workflow DevKit |

---

## Tech Recommendations

- **UI Framework:** shadcn/ui for components
- **Streaming:** Vercel AI SDK `useChat` for agent reasoning display
- **Auth:** BetterAuth login page for landlord/property manager access
