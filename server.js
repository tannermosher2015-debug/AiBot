// Local development server. Serves the demo page and the /chat endpoint.
// (On Netlify, the same bot logic runs via netlify/functions/chat.js instead.)
import "dotenv/config"; // load .env BEFORE importing the bot (which creates the API client)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { AGENT, runChat } from "./lib/bot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/config", (_req, res) => res.json({ agent: AGENT }));

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
