# Architecture Overview

> Turnkey Agent — Vercel x Google DeepMind Hackathon | March 21, 2026

## The Pitch

Turnkey Agent is an AI property management agent that handles emergency maintenance end-to-end — from an angry guest's phone call to a plumber walking through the door — using voice calls, not chat. It triages issues against 5 years of property history, parallel-calls vendors for quotes, recommends the best option to the landlord, schedules the repair, and gives the plumber the door code when they arrive. Every interaction is a real phone call powered by Gemini.

**Why it wins:** Real phone calls to real phones. Multi-agent parallel orchestration visible in real-time. Solves a $2–5B market pain point. Uses the entire Gemini stack (Live Audio, Embeddings 2, Flash 3.1, TTS). Deployed on Vercel with durable workflows.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Voice (Real-time) | Gemini 2.5 Flash Native Audio (Live API) | All phone conversations — bidirectional, low-latency |
| Voice (Async) | Gemini 2.5 Flash TTS | Voice notes, notifications, summaries |
| Telephony | Twilio Voice + Media Streams | PSTN phone calls, audio streaming via WebSocket |
| Reasoning | Gemini 3.1 Flash | Quote comparison, vendor recommendation, decision logic |
| Embeddings | Gemini Embedding 2 | Maintenance history search, property knowledge retrieval |
| Database | Supabase (Postgres + pgvector) | Property data, maintenance logs, vendor info, access codes, embeddings |
| Auth | BetterAuth | Dashboard login (landlord/property manager) |
| Frontend | Next.js on Vercel | Real-time dashboard showing multi-agent activity |
| Orchestration | Vercel AI SDK 6 + Workflow DevKit | Durable agent workflows, parallel task execution |
| Scheduling | Google Calendar API | Repair scheduling |
| Bridge | FastAPI/Quart WebSocket proxy (or Pipecat) | Converts Twilio SIP/RTP to Gemini Live WebSocket |

---

## Architecture Diagram (ASCII)

```
                    ┌─────────────────────────────────┐
                    │     VERCEL DASHBOARD (Next.js)   │
                    │  ┌───────────────────────────┐   │
                    │  │  Real-time Agent Activity  │   │
                    │  │  - Call status cards        │   │
                    │  │  - Quote comparison         │   │
                    │  │  - Timeline / audit log     │   │
                    │  │  - Approval buttons         │   │
                    │  └───────────┬───────────────┘   │
                    │              │ WebSocket/SSE      │
                    │  ┌───────────▼───────────────┐   │
                    │  │   AI SDK 6 + Workflow DK   │   │
                    │  │   (DurableAgent)           │   │
                    │  │   - Orchestrator agent      │   │
                    │  │   - Parallel call spawner   │   │
                    │  └───────────┬───────────────┘   │
                    └──────────────┼───────────────────┘
                                   │
              ┌────────────────────┼─────────────────────┐
              │                    │                      │
    ┌─────────▼────────┐  ┌───────▼────────┐  ┌─────────▼────────┐
    │  VOICE ENGINE    │  │  REASONING     │  │  KNOWLEDGE       │
    │                  │  │                │  │                  │
    │  Twilio Voice    │  │  Gemini 3.1    │  │  Supabase        │
    │       ↕          │  │  Flash         │  │  + pgvector      │
    │  WebSocket Proxy │  │                │  │  + Embedding 2   │
    │       ↕          │  │  - Compare     │  │                  │
    │  Gemini Live API │  │    quotes      │  │  - Properties    │
    │  (2.5 Flash      │  │  - Recommend   │  │  - Maint history │
    │   Native Audio)  │  │    vendor      │  │  - Vendor codes  │
    │                  │  │  - Assess      │  │  - Call logs     │
    │  4 phone lines:  │  │    urgency     │  │  - Photos        │
    │  - Guest         │  │                │  │  - Embeddings    │
    │  - Plumber 1     │  └────────────────┘  │                  │
    │  - Plumber 2     │                      └──────────────────┘
    │  - Landlord      │          │
    └──────────────────┘  ┌───────▼────────┐
                          │  SCHEDULING    │
                          │  Google Cal API│
                          └────────────────┘
```

See also: [`architecture-diagram.svg`](./architecture-diagram.svg) for the full visual diagram.
