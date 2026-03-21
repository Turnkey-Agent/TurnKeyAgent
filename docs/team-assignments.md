# Team Assignments & Timeline

> 4-person team — parallel workstreams

---

## Team Roles

### Ben Shyong ([@Bshyong158](https://github.com/Bshyong158)) — Product Lead + Voice Engineer + Landlord Role-Player
- Owns the demo script and presentation narrative
- Sets up Twilio account with 1 phone number
- Builds the WebSocket bridge (Python FastAPI recommended)
- Implements audio resampling (Twilio μ-law 8kHz ↔ Gemini 16kHz PCM)
- Registers all function tools with Gemini Live API
- Implements function handlers (Supabase queries, calendar creation)
- Handles outbound call initiation via Twilio REST API
- Tests voice quality and latency
- Role-plays the landlord during demo
- **Key resource:** `github.com/sa-kanean/gemini-live-voice-ai-agent-with-telephony`

### Ayush Ojha ([@ayushozha](https://github.com/ayushozha)) — Data Layer
- Supabase schema setup (tables, extensions, functions)
- Seeds the 5-year maintenance history data
- Generates property photos (Google Imagen or stock)
- Runs the embedding pipeline: maintenance logs → Gemini Embedding 2 → Supabase pgvector
- Vector search function (match_maintenance_logs)
- Handles BetterAuth wired to Supabase Postgres

### Person 3: FRONTEND — Vercel Dashboard
- Next.js 15 app on Vercel
- Real-time incident tracker UI (Supabase Realtime subscriptions)
- Live call status indicators (active/completed/failed)
- Quote comparison cards with AI recommendation highlight
- Streaming call transcript display
- Landlord approval button (triggers workflow continuation)
- Timeline/audit log of all agent actions
- BetterAuth login page
- **Recommended:** Vercel AI SDK `useChat` for streaming, shadcn/ui for components

### Person 4: ORCHESTRATION — Workflow DevKit + Multi-Agent
- Vercel Workflow DevKit setup with DurableAgent
- Implements main incident workflow (triage → quote → approve → schedule → resolve)
- Parallel vendor call orchestration (`Promise.all` with durable steps)
- Gemini 3.1 Flash integration for quote analysis/recommendation
- Google Calendar API integration for scheduling
- Supabase Realtime broadcasting for dashboard updates
- Handles "plumber calls back for door code" inbound flow routing

---

## Workstreams

| Workstream | Owner | Priority | Notes |
|---|---|---|---|
| **Voice Engine** | Ben | Highest — start first | Must have working phone call by 10:30 AM |
| **Data Layer** | Ayush | Foundation | Schema + seed data + embeddings — everyone plugs into this |
| **Dashboard** | Person 3 | High | Real-time UI is the human verification layer |
| **Orchestration** | Person 4 | Integrator | Connects voice → database → dashboard |

---

## Hackathon Timeline

| Time | Milestone |
|---|---|
| 9:00–9:30 | Architecture alignment, repo setup, Supabase project created |
| 9:30–11:00 | Parallel build: Schema + seed data // Twilio bridge // Dashboard skeleton // Workflow scaffold |
| 11:00–12:00 | Embedding pipeline running, first voice call working, dashboard showing data |
| 12:00–1:00 | Lunch + integration: bridge → Supabase function tools working |
| 1:00–3:00 | Full flow integration: Guest call → triage → vendor calls → dashboard updates |
| 3:00–5:00 | Landlord approval flow, calendar scheduling, door code retrieval |
| 5:00–6:00 | Demo rehearsal #1 — identify gaps |
| 6:00–7:00 | Polish: UI cleanup, error handling, demo script refinement |
| 7:00–8:00 | Demo rehearsal #2 — full run-through with all 4 on phones |
| 8:00–9:00 | Final fixes, presentation prep |
| 9:00+ | **DEMO TIME** |

---

## Judge Alignment

| Judge | What They See |
|---|---|
| **Paige Bailey** (Google AI DevRel) | Full Gemini stack: Live Audio, Embedding 2, 3.1 Flash reasoning, TTS |
| **Timothy Jordan** (VP DevEx, Vercel) | AI SDK 6 + Workflow DevKit + DurableAgent + real-time dashboard on Vercel |
| **Bereket Engida** (CEO, BetterAuth) | BetterAuth securing the dashboard — his library in production context |
| **Debanshu Das** (Sr. SWE, Google) | Clean Gemini function calling, proper audio handling, technical depth |
| **Greg Kress** (Supabase) | pgvector + Realtime + RLS — Supabase as the unified data layer |
| **David Ventimiglia** (Supabase) | Postgres schema design, vector search, hybrid query approach |
| **Paavas Bhasin** (Meta) | Systems thinking, production-grade architecture |
| **Aneesh Saripalli** (Anthropic) | Clean agent architecture, proper tool design |

---

## What Makes This Win

1. **Real phone calls** — Not a chat demo. Judges hear actual phones ringing.
2. **Multi-agent parallelism** — Two vendor calls simultaneously, visible on dashboard.
3. **End-to-end workflow** — Guest emergency → plumber at the door. Complete loop.
4. **5 years of context** — Embeddings search on real history, not toy data.
5. **Human-in-the-loop** — Landlord approval step = responsible AI design.
6. **Full Gemini stack** — Every model family represented.
7. **Production architecture** — Durable workflows, proper auth, real database.
8. **Solves a real problem** — STR property management is a $2–5B market.
