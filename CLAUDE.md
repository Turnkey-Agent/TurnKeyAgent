# Turnkey Agent — Development Guide

## Network Setup

Mac Mini (elias) runs all services. MBP accesses via SSH port forwarding.

**Access from MBP — always use SSH tunnel:**
```bash
# Forward dashboard (4000) + bridge (3456) in one command
ssh -L 4000:localhost:4000 -L 3456:localhost:3456 elias
```
Then open `http://localhost:4000/dashboard` in MBP browser.

Direct LAN access (`192.168.0.10:<port>`) does NOT work — macOS firewall blocks it.

## Services

| Service | Port | Start Command |
|---------|------|---------------|
| Voice Bridge | 3456 | `cd bridge && NGROK_URL="<url>" npx tsx src/index.ts` |
| Dashboard | 4000 | `cd dashboard && npx next dev --port 4000` |
| ngrok | 4040 (inspect) | `ngrok http 3456 --response-header-add "ngrok-skip-browser-warning:true"` |

## Startup Order

1. Start ngrok → copy the https URL
2. Start bridge with `NGROK_URL=<ngrok-url>`
3. Update Twilio webhook (if ngrok URL changed):
   ```bash
   curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers/$TWILIO_PHONE_SID.json" \
     -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
     -d "VoiceUrl=<ngrok-url>/twilio/voice" -d "VoiceMethod=POST"
   ```
   (Creds in .env or 1Password "Twilio - Turnkey Team")
4. Start dashboard

## Environment

- `.env` in repo root — has all secrets (Twilio, Gemini, Supabase, Vercel)
- `dashboard/.env.local` — has `NEXT_PUBLIC_*` vars for the browser
- `.env` is gitignored on main — copy from `~/Desktop/.env` if missing
- GitHub Secrets has Twilio creds for CI/CD

## Key Gotchas

- **ngrok free tier** needs `--response-header-add "ngrok-skip-browser-warning:true"` or Twilio gets empty responses
- **ngrok URL changes on restart** — must update Twilio webhook + restart bridge
- **Twilio sub-account** (AC13aa...) is trial-ish — all callee numbers must be verified first
- **Tailwind version** — dashboard uses v3 syntax (`@tailwind base`). Don't install v4.
- **System env vars** override `.env` — config.ts uses `override: true` in dotenv to fix this
- **Gemini model** — `gemini-2.5-flash-native-audio-latest` for Live API voice calls

## Phone Numbers

| Role | Person | Number |
|------|--------|--------|
| Agent (Twilio) | — | +1 (628) 237-0507 |
| Landlord | Ben | +1 (765) 413-4446 |
| Guest | Ayush | +1 (314) 299-0513 |
| Vendor 1 | Chow | +1 (283) 232-8091 |
| Vendor 2 | Arnav | +1 (408) 581-2962 |

## Demo Flow

1. Open dashboard → type situation → Deploy Agent
2. Agent calls guest (Ayush) → confirms issue
3. Agent calls vendor 1 (Chow) → gets quote
4. Agent calls vendor 2 (Arnav) → gets quote
5. Dashboard shows quotes → landlord (Ben) approves
6. Agent calls selected vendor → schedules repair
