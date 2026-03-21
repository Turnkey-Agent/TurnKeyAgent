# Risk Mitigation & Environment

---

## Risk Matrix

| Risk | Mitigation |
|---|---|
| Twilio ↔ Gemini audio quality issues | Test early (by 10 AM). Fallback: WebRTC browser-based calls if PSTN fails |
| Gemini Live API rate limits | Use separate API keys per team member. Stagger demo calls. |
| Voice latency too high | Pre-warm Gemini sessions. Keep system prompts concise. |
| Dashboard not updating real-time | Supabase Realtime as primary, polling as fallback |
| Seed data embedding takes too long | Batch embed via Gemini Embedding 2 batch API ($0.10/M tokens). 50 records is trivial. |
| Demo call goes sideways | Script each role-player's lines. Have a "happy path" rehearsed. Allow organic variation but know the beats. |
| Calendar API OAuth complexity | Use a service account with pre-authorized calendar. Skip OAuth flow in demo. |

---

## Environment Variables

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=             # Direct Postgres connection for BetterAuth

# Google / Gemini
GEMINI_API_KEY=           # From Google AI Studio
GOOGLE_CALENDAR_ID=       # Pre-created calendar
GOOGLE_SERVICE_ACCOUNT=   # For Calendar API

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=      # The agent's phone number

# Vercel
VERCEL_URL=               # Auto-set by Vercel
GATEWAY_API_KEY=          # Vercel AI Gateway key

# BetterAuth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
```
