// Local development server. Serves the demo page and the /chat endpoint.
// (On Netlify, the same bot logic runs via netlify/functions/chat.js instead.)
import "dotenv/config"; // load .env BEFORE importing the bot (which creates the API client)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { AGENT, CONFIG, runChat } from "./lib/bot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Allow the embeddable widget to call this backend from the client's website
// (a cross-origin request). Note: CORS is a browser guardrail, not abuse
// protection — add rate limiting before heavy public use.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.header("Access-Control-Allow-Origin", origin);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/config", (_req, res) => res.json({ agent: CONFIG }));

app.post("/chat", async (req, res) => {
  try {
    const { reply, messages } = await runChat(req.body.messages);
    res.json({ reply, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong — check the server logs." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🏠  Lead bot demo running at http://localhost:${PORT}`);
  console.log(`    Agent: ${AGENT.name} · ${AGENT.brokerage} · ${AGENT.area}\n`);
});
