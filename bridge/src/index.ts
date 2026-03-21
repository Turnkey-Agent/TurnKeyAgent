import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import {
  handleIncomingCall,
  handleOutboundCall,
  handleMediaStream,
  getActiveCalls,
  initiateCall,
} from "./twilio-handler.js";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// CORS for dashboard
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});

// Health check
app.get("/", (_req, res) => {
  res.json({
    service: "Turnkey Agent Voice Bridge",
    status: "running",
    activeCalls: getActiveCalls().count,
    phone: config.twilioPhoneNumber,
  });
});

// Twilio Voice webhooks
app.post("/twilio/voice", handleIncomingCall);
app.post("/twilio/voice/outbound", handleOutboundCall);

// Dashboard endpoints
app.get("/calls", (_req, res) => res.json(getActiveCalls()));
app.post("/initiate-call", initiateCall);

// HTTP + WebSocket server
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
`);
});
