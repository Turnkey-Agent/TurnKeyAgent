# Demo Script

> The story we tell the judges — 6 scenes, end-to-end emergency maintenance resolution

---

## Scene 1: Guest Emergency (Inbound Call)

- Pissed-off guest calls the Turnkey Agent phone number
- *"There's water EVERYWHERE. The bathroom is flooding!"*
- Agent stays calm (affective dialog), asks clarifying questions
- Agent searches 5-year maintenance history via Embeddings 2 → finds this unit had a similar pipe issue 18 months ago
- Agent tells guest: *"I see this unit had a pipe repair in October 2024. I'm dispatching plumbers now. I'll call you back within 30 minutes with an ETA."*
- **Dashboard updates** in real-time — incident card created, status: `TRIAGING`

---

## Scene 2: Parallel Vendor Outreach (2 Simultaneous Outbound Calls)

- Agent calls **Plumber 1** and **Plumber 2** simultaneously (multi-agent)
- Each call is a separate Gemini Live session with its own persona

**Plumber 1 call:**
> "Hi, this is Turnkey Agent calling on behalf of Lemon Property at 742 Evergreen Terrace, Unit 3B. We have an emergency bathroom pipe leak. The property had a similar issue 18 months ago — PVC joint under the sink. Can you give me a quote and availability?"

- Plumber 1: **$300, can be there in 2 days**

**Plumber 2 call:** Same script
- Plumber 2: **$1,000, can be there in 5 days**

- **Dashboard updates** — both quote cards appear side by side in real-time as calls complete

---

## Scene 3: AI Recommendation + Landlord Approval (Outbound Call)

Gemini 3.1 Flash analyzes both quotes against:
- Price difference (70% cheaper)
- Time difference (3 days faster)
- Historical vendor ratings from database
- Past work quality on this property

**Generates recommendation:** Plumber 1 — better price, faster, has done work on this property before

Agent calls the **Landlord (Ben)**:
> "Hi Ben, this is your Turnkey Agent. Unit 3B at Lemon Property has a bathroom pipe emergency. I've got two quotes: Plumber 1 at $300 within 2 days, Plumber 2 at $1,000 within 5 days. Based on price, speed, and Plumber 1's previous work on this property, I recommend Plumber 1. Should I schedule them?"

Ben: *"Yes, go with Plumber 1."*

- **Dashboard updates** — status: `APPROVED`, plumber selected

---

## Scene 4: Scheduling (Outbound Call + Calendar)

- Agent calls **Plumber 1** back
- *"Great news — the landlord approved your quote. Can we schedule you for March 23rd in the morning?"*
- Plumber 1 confirms
- Agent creates **Google Calendar event** with property address, unit number, issue description, and access instructions
- Agent sends TTS voice note to guest via the dashboard: *"Good news — a plumber is scheduled for March 23rd morning to fix your bathroom. You don't need to be present."*
- **Dashboard updates** — status: `SCHEDULED`, calendar link visible

---

## Scene 5: Day-of Access (Inbound Call)

- Plumber 1 arrives, calls the Turnkey Agent number
- *"Hey, I'm at 742 Evergreen Terrace for the pipe repair. What's the door code?"*
- Agent verifies caller against scheduled vendor in database
- Agent retrieves vendor access code from Supabase (separate from guest code)
- *"The vendor access code is 4729. The unit is 3B, second floor. The issue is under the bathroom sink — PVC joint. Please update me when the repair is complete."*
- **Dashboard updates** — status: `IN PROGRESS`

---

## Scene 6: Completion

- Plumber calls back: *"All done, replaced the joint."*
- Agent logs completion, updates maintenance history
- Agent sends summary TTS to landlord and guest
- **Dashboard updates** — status: `RESOLVED`, full timeline visible

---

## Call Scripts for Role-Players

### Call 1: Angry Guest (Inbound)

**Character:** Karen Mitchell, current Airbnb guest, just woke up to a flooded bathroom
**Personality:** Frustrated but not abusive. Gets more upset describing damage. Wants it fixed TODAY.

- Opening: Karen calls the agent number, immediately upset
- 4–5 exchanges where agent asks clarifying questions
- Karen mentions: water everywhere, towels soaked, can't use bathroom, leaving in 3 days, wants refund
- Agent: stays calm, asks about severity, location, source; tells her help is on the way
- Karen's tone softens when agent is competent and fast

### Call 2: Plumber 1 — Mike (Outbound)

**Character:** Mike Kowalski, Mike's Rapid Plumbing. Knows this property well.
**Personality:** Friendly, slightly amused. *"Oh, 742 Evergreen again? Let me guess — the PVC joint."*

- Agent identifies itself, describes emergency, mentions PVC history
- Mike recognizes property, knows exactly what it is
- Quote: $300, Wednesday morning (2 days)
- Mike mentions he recommended replacing the whole section last time
- Quick, efficient call

### Call 3: Plumber 2 — Derek (Outbound)

**Character:** Derek Lawson, Bay Area Premier Plumbing. Doesn't know the property.
**Personality:** Professional but methodical. Asks lots of questions. Tries to upsell.

- Agent gives same info
- Derek asks: age of building? pipe type? PVC or copper? previous work?
- Derek suggests "a full assessment might be warranted"
- Quote: $1,000, 5 days out
- Longer call — thorough but slow

### Call 4: Landlord — Ben (Outbound)

**Character:** Ben Shyong, property owner
**Personality:** Busy, wants the summary fast, trusts the agent

- Agent summarizes issue, history (third PVC failure), both quotes
- Presents recommendation: Plumber 1 — 70% cheaper, 3 days faster, prior work
- Ben asks 1–2 questions ("Will this keep happening?" "Should we replace the whole section?")
- Ben approves: *"Go with Mike. And tell him to actually replace the whole section this time."*

### Call 5: Scheduling Callback (Outbound)

- Agent calls Mike back, confirms approval
- Schedules Wednesday morning
- Mentions owner wants full section replacement
- Mike agrees, might be $50 more but worth it

### Call 6: Day-of Access (Inbound)

- Mike arrives, calls for door code
- Agent verifies against scheduled vendor
- Gives vendor code: 4729
- Gives unit details and issue summary
- Mike: *"Got it. I'll call you when it's done."*
