import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { handleIncomingCall, handleOutboundCall, handleMediaStream, getActiveCalls } from "./twilio-handler.js";
import { startWorkflow, approveVendor, getWorkflow, getWorkflowByIncident } from "./workflow.js";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// CORS
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});

// Health
app.get("/", (_req, res) => {
  res.json({ service: "Turnkey Agent Voice Bridge", status: "running", activeCalls: getActiveCalls().count, phone: config.twilioPhoneNumber });
});

// Twilio webhooks
app.post("/twilio/voice", handleIncomingCall);
app.post("/twilio/voice/outbound", handleOutboundCall);

// Dashboard endpoints
app.get("/calls", (_req, res) => res.json(getActiveCalls()));

// ── Workflow endpoints ──

// Start the full demo workflow
app.post("/workflow/start", async (req, res) => {
  const { situation, guestPhone, vendor1Phone, vendor2Phone, landlordPhone } = req.body;
  if (!situation || !guestPhone) {
    res.status(400).json({ error: "Missing situation or guestPhone" });
    return;
  }
  const state = await startWorkflow({
    situation,
    guestPhone: normalizePhone(guestPhone),
    vendor1Phone: normalizePhone(vendor1Phone || "+12832328091"),
    vendor2Phone: normalizePhone(vendor2Phone || "+14085812962"),
    landlordPhone: normalizePhone(landlordPhone || "+17654134446"),
    ngrokUrl: config.ngrokUrl,
  });
  res.json({ workflowId: state.id, incidentId: state.incidentId, status: state.status });
});

// Landlord approves a vendor
app.post("/workflow/approve", async (req, res) => {
  const { incidentId, vendorPhone } = req.body;
  if (!incidentId || !vendorPhone) {
    res.status(400).json({ error: "Missing incidentId or vendorPhone" });
    return;
  }
  await approveVendor(incidentId, normalizePhone(vendorPhone));
  res.json({ success: true, message: "Vendor approved — scheduling call initiated" });
});

// Get workflow status
app.get("/workflow/:id", (req, res) => {
  const state = getWorkflow(req.params.id);
  if (!state) { res.status(404).json({ error: "Workflow not found" }); return; }
  res.json(state);
});

// HTTP + WebSocket
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "/", `http://${request.headers.host}`).pathname;
  if (pathname === "/twilio/media-stream") {
    wss.handleUpgrade(request, socket, head, (ws) => handleMediaStream(ws));
  } else {
    socket.destroy();
  }
});

server.listen(config.port, () => {
  console.log(`
  TURNKEY AGENT — VOICE BRIDGE
  Server:    http://localhost:${config.port}
  Phone:     ${config.twilioPhoneNumber}
  Gemini:    ${config.geminiLiveModel}
  Tunnel:    ${config.ngrokUrl || "(not set)"}

  Endpoints:
    POST /workflow/start    — Start demo (situation, guestPhone, vendor phones)
    POST /workflow/approve  — Landlord approves vendor (incidentId, vendorPhone)
    GET  /workflow/:id      — Get workflow status
    GET  /calls             — Active calls
`);
});

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}
