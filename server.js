// Local development server. Serves the demo page and the /chat endpoint.
// (On Netlify, the same bot logic runs via netlify/functions/chat.js instead.)
import "dotenv/config"; // load .env BEFORE importing the bot (which creates the API client)
import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { AGENT, runChat } from "./lib/bot.js";
import { getAgent, publicConfig } from "./lib/agents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Behind Render's proxy — trust it so rate limiting sees the real client IP.
app.set("trust proxy", 1);

// CORS: only reflect origins on the allowlist (ALLOWED_ORIGINS, comma-separated).
// If unset, fall back to reflecting any origin so the demo keeps working — but warn,
// because that lets any site call this backend and spend your tokens.
const ALLOWED = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (ALLOWED.length === 0) {
  console.warn("[cors] ALLOWED_ORIGINS not set — reflecting any origin. Set it to lock the widget to your sites.");
}
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED.length === 0 || ALLOWED.includes(origin))) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "120kb" })); // cap payload size
app.use(express.static(path.join(__dirname, "public")));

// Branding/greeting for the widget. `?agent=<key>` picks a persona (defaults to
// this deploy's agent), so one backend can serve several client widgets.
app.get("/config", (req, res) => res.json({ agent: publicConfig(getAgent(req.query.agent)) }));

// Throttle /chat per IP — protects against abuse and runaway API spend.
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 40, // ~40 messages / 5 min / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You're sending messages a little fast — give it a moment and try again." },
});

// Validate the conversation payload before spending any tokens.
function validateChat(req, res, next) {
  const messages = req.body && req.body.messages;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid request." });
  }
  if (messages.length > 60) {
    return res.status(400).json({ error: "This conversation is quite long — please start a new chat." });
  }
  next();
}

app.post("/chat", chatLimiter, validateChat, async (req, res) => {
  try {
    const agent = getAgent(req.body.agent);
    const { reply, messages } = await runChat(req.body.messages, agent);
    res.json({ reply, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong — please try again." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🏠  Lead bot running at http://localhost:${PORT}`);
  console.log(`    Agent: ${AGENT.name} · ${AGENT.brokerage} · ${AGENT.area}\n`);
});
