import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import {
  handleIncomingCall,
  handleOutboundCall,
  handleMediaStream,
  getActiveCalls,
} from "./twilio-handler.js";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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

// Active calls status
app.get("/calls", (_req, res) => {
  res.json(getActiveCalls());
});

// Create HTTP server and WebSocket server on same port
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrades for Twilio Media Streams
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "/", `http://${request.headers.host}`)
    .pathname;

  if (pathname === "/twilio/media-stream") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleMediaStream(ws);
    });
  } else {
    socket.destroy();
  }
});

server.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║         TURNKEY AGENT — VOICE BRIDGE             ║
╠══════════════════════════════════════════════════╣
║  Server:    http://localhost:${config.port}                ║
║  Phone:     ${config.twilioPhoneNumber.padEnd(35)}║
║  Gemini:    ${config.geminiLiveModel.slice(0, 35).padEnd(35)}║
║  WebSocket: ws://localhost:${config.port}/twilio/media-stream ║
╚══════════════════════════════════════════════════╝

Next steps:
  1. Run: ngrok http ${config.port}
  2. Run: npx tsx ../scripts/setup-twilio.ts <ngrok-url>
  3. Call ${config.twilioPhoneNumber} to test!
`);
});
