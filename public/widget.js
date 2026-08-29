/*
 * Frontline AI - embeddable lead-assistant widget.
 *
 * Floating mode (default): drop one line into any website:
 *   <script src="https://aibot-rl1g.onrender.com/widget.js" defer></script>
 * It injects a floating chat bubble that talks to the bot backend.
 *
 * Inline mode: add a mount element and the widget renders an always-open chat
 * panel inside it (no bubble):
 *   <div data-frontline-ai-inline style="height:540px"></div>
 *   <script src="https://aibot-rl1g.onrender.com/widget.js" defer></script>
 *
 * Persona: one backend can serve several personas. Pick one with data-agent on
 * the mount element or the script tag (e.g. data-agent="frontline-smb"); if
 * omitted, the backend uses its default agent.
 */
(function () {
  if (window.__leadBotLoaded) return;
  window.__leadBotLoaded = true;

  // This script's own element - used to find the backend origin and data-agent.
  function getScript() {
    var s = document.currentScript;
    if (!s) {
      var all = document.querySelectorAll('script[src*="widget.js"]');
      s = all[all.length - 1];
    }
    return s;
  }
  var SCRIPT = getScript();
  var BASE = (function () {
    try { return new URL(SCRIPT.src).origin; } catch (e) { return ""; }
  })();

  // Inline mount, if the host page provides one. Otherwise we float a bubble.
  var inlineMount = document.querySelector("[data-frontline-ai-inline]");
  var INLINE = !!inlineMount;

  // Persona key: mount wins, then script tag, then backend default.
  var AGENT_KEY =
    (inlineMount && inlineMount.getAttribute("data-agent")) ||
    (SCRIPT && SCRIPT.getAttribute("data-agent")) ||
    "";

  // Relative luminance → pick black or white text for AA contrast on a color,
  // so button/avatar/user-bubble text stays legible whatever --p a client uses.
  function onColor(hex) {
    try {
      var h = String(hex).replace("#", "");
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var c = [0, 2, 4].map(function (i) {
        var v = parseInt(h.substr(i, 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      var L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      var cWhite = 1.05 / (L + 0.05);
      var cBlack = (L + 0.05) / 0.05;
      return cWhite >= cBlack ? "#ffffff" : "#0b0b0c";
    } catch (e) { return "#ffffff"; }
  }

  // Host element + isolated shadow DOM so the host site's CSS can't break us.
  var host = document.createElement("div");
  host.id = "lead-bot-host";
  if (INLINE) {
    inlineMount.appendChild(host);
    host.style.display = "block";
    host.style.height = "100%";
  } else {
    document.body.appendChild(host);
  }
  var root = host.attachShadow({ mode: "open" });

  var css =
    ':host{all:initial;--p:#0d6e6e;--hb:#0f2c2c;--st:#7fd6a6;--on-p:#fff}' +
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
    '.inline{height:100%;display:block}' +
    '.bubble{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;border:none;background:var(--p);color:var(--on-p);font-size:26px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:2147483000}' +
    '.bubble:hover{filter:brightness(.92)}' +
    '.bubble:focus-visible{outline:3px solid #fff;box-shadow:0 0 0 6px var(--hb)}' +
    '.panel{position:fixed;bottom:calc(var(--pb,90px) + var(--kb,0px));right:20px;width:370px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 120px);max-height:calc(var(--vvh,100dvh) - var(--pb,90px) - 24px);background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;z-index:2147483000}' +
    '.panel[hidden]{display:none}' +
    '.inline .panel{position:static;width:100%;height:100%;max-width:none;max-height:none;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18)}' +
    '@media (max-width:520px){.panel{left:12px;right:12px;width:auto;max-width:none}}' +
    '.head{background:var(--hb);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}' +
    '.av{width:38px;height:38px;border-radius:50%;background:var(--p);color:var(--on-p);display:flex;align-items:center;justify-content:center;font-weight:700}' +
    '.head .name{font-weight:600;font-size:14px}' +
    '.head .status{font-size:11px;color:var(--st)}' +
    '.head .x{margin-left:auto;cursor:pointer;font-size:18px;opacity:.7;background:none;border:none;color:#fff}' +
    '.head .x:hover{opacity:1}' +
    '.head .x:focus-visible{outline:2px solid #fff;outline-offset:2px;opacity:1}' +
    '.msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f3f5f4}' +
    '.m{max-width:82%;padding:9px 12px;border-radius:13px;font-size:14px;line-height:1.4}' +
    '.m.bot{background:#fff;color:#13322f;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.06)}' +
    '.m.user{background:var(--p);color:var(--on-p);align-self:flex-end;border-bottom-right-radius:4px}' +
    '.typing{align-self:flex-start;display:flex;gap:4px;padding:11px 13px;background:#fff;border-radius:13px;box-shadow:0 1px 2px rgba(0,0,0,.06)}' +
    '.typing i{width:7px;height:7px;border-radius:50%;background:#b9c2c0;display:inline-block;animation:b 1.2s infinite}' +
    '.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}' +
    '@keyframes b{0%,60%,100%{opacity:.3}30%{opacity:1}}' +
    '.cmp{display:flex;padding:10px;gap:8px;border-top:1px solid #e4e8e7;background:#fff}' +
    '.cmp input{flex:1;border:1px solid #dfe4e3;border-radius:10px;padding:10px 12px;font-size:16px;outline:none;color:#13322f}' +
    '.cmp input:focus-visible{outline:2px solid var(--hb);outline-offset:1px;border-color:var(--hb)}' +
    '.cmp button{background:var(--p);color:var(--on-p);border:none;border-radius:10px;padding:0 16px;font-weight:600;cursor:pointer;font-size:14px}' +
    '.cmp button:disabled{opacity:.5}' +
    '.cmp button:focus-visible{outline:3px solid var(--hb);outline-offset:2px}' +
    '@media (prefers-reduced-motion: reduce){.typing i{animation:none;opacity:.6}.bubble:hover{filter:none}}';

  var panelHtml =
    '<div class="panel" id="panel"' +
    (INLINE ? "" : ' role="dialog" aria-labelledby="brand" hidden') + '>' +
    '<div class="head"><div class="av" id="av" aria-hidden="true">··</div>' +
    '<div><div class="name" id="brand">Loading…</div><div class="status">Usually replies instantly</div></div>' +
    (INLINE ? "" : '<button class="x" type="button" aria-label="Close chat">✕</button>') +
    "</div>" +
    '<div class="msgs" role="log" aria-live="polite" aria-label="Conversation"></div>' +
    '<form class="cmp"><input type="text" aria-label="Type your message" placeholder="Type your message…" autocomplete="off"/>' +
    '<button type="submit">Send</button></form>' +
    "</div>";

  root.innerHTML =
    "<style>" + css + "</style>" +
    '<div class="' + (INLINE ? "inline" : "floating") + '">' +
    (INLINE ? "" : '<button class="bubble" type="button" aria-label="Open chat" aria-expanded="false" aria-controls="panel">💬</button>') +
    panelHtml +
    "</div>";

  var bubble = root.querySelector(".bubble");
  var panel = root.querySelector(".panel");
  var closeBtn = root.querySelector(".x");
  var msgs = root.querySelector(".msgs");
  var form = root.querySelector(".cmp");
  var input = root.querySelector("input");
  var sendBtn = form.querySelector("button");

  var history = [];
  var started = false;
  var sending = false;

  function add(text, who) {
    var d = document.createElement("div");
    d.className = "m " + who;
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function typing(on) {
    var ex = root.getElementById ? root.getElementById("typing") : root.querySelector("#typing");
    if (on) {
      if (ex) return;
      var t = document.createElement("div");
      t.className = "typing";
      t.id = "typing";
      t.innerHTML = "<i></i><i></i><i></i>";
      msgs.appendChild(t);
      msgs.scrollTop = msgs.scrollHeight;
    } else if (ex) {
      ex.remove();
    }
  }

  // Fetched once and shared: branding needs it on load, the greeting on first open.
  var configPromise = null;
  function loadConfig() {
    if (configPromise) return configPromise;
    var configUrl = BASE + "/config" + (AGENT_KEY ? "?agent=" + encodeURIComponent(AGENT_KEY) : "");
    configPromise = fetch(configUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) { return (data && data.agent) || {}; })
      .catch(function () { return {}; });
    return configPromise;
  }

  // Brand and colours only. Runs on load, so a CLOSED bubble is never the wrong
  // colour: before this split the theme landed on first open, and every visitor
  // saw the built-in default (a teal) sitting on the client's own palette.
  function applyBranding(a) {
    if (!a || !Object.keys(a).length) return; // fetch failed: leave the placeholder
    var brand = a.brand || a.brokerage || "Our Team";
    root.querySelector("#brand").textContent = brand;
    var initials = brand.split(" ").map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
    root.querySelector("#av").textContent = initials || "··";
    if (a.theme) {
      if (a.theme.primary) {
        host.style.setProperty("--p", a.theme.primary);
        host.style.setProperty("--on-p", onColor(a.theme.primary));
      }
      if (a.theme.header) host.style.setProperty("--hb", a.theme.header);
      if (a.theme.status) host.style.setProperty("--st", a.theme.status);
    }
  }

  // Greeting stays lazy: it is a message, and it should land when the panel opens.
  function start() {
    if (started) return;
    started = true;
    loadConfig().then(function (a) {
      add(a.greeting || "👋 Aloha! How can I help you today?", "bot");
    });
  }

  function setOpen(open) {
    panel.hidden = !open;
    if (bubble) bubble.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function openPanel() {
    setOpen(true);
    start();
    input.focus();
  }

  // Always hand focus back to the bubble: closing must never strand a keyboard
  // user at the top of the document with no idea where they are.
  function closePanel() {
    setOpen(false);
    if (bubble) bubble.focus();
  }

  // iOS anchors position:fixed to the LAYOUT viewport, and that viewport does not
  // shrink when the keyboard opens. So an open panel keeps its full height, gets
  // dragged out of the visible area, and leaves its input under the keyboard.
  // Mirror the VISUAL viewport into two custom properties and let the CSS sit the
  // panel on top of the keyboard. No visualViewport support means both vars stay
  // unset and the panel keeps exactly the geometry it had before.
  var vv = window.visualViewport;
  function syncViewport() {
    // How much of the layout viewport is hidden at the bottom: keyboard plus toolbars.
    var inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    host.style.setProperty("--kb", inset + "px");
    host.style.setProperty("--vvh", vv.height + "px");
    // The 90px gap exists to clear the bubble, and the bubble is behind the keyboard
    // anyway once it is up, so give that space back to the conversation. The 80px
    // floor keeps desktop pinch-zoom from reading as a keyboard.
    host.style.setProperty("--pb", inset > 80 ? "12px" : "90px");
  }
  if (!INLINE && vv) {
    vv.addEventListener("resize", syncViewport);
    vv.addEventListener("scroll", syncViewport);
    syncViewport();
  }

  // Theme as early as we can, for both modes.
  loadConfig().then(applyBranding);

  if (INLINE) {
    start(); // always-open: load greeting immediately, but don't steal focus
  } else {
    bubble.addEventListener("click", function () {
      if (panel.hidden) openPanel(); else closePanel();
    });
    closeBtn.addEventListener("click", closePanel);
    // Escape closes the panel. Scoped to the panel on purpose: a document-level
    // listener would swallow Escape for the host page's own dialogs and menus.
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.key === "Esc") {
        e.stopPropagation();
        closePanel();
      }
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return; // drop concurrent submits while a reply is in flight
    var text = input.value.trim();
    if (!text) return;
    sending = true;
    add(text, "user");
    history.push({ role: "user", content: text });
    input.value = "";
    sendBtn.disabled = true;
    typing(true);

    var body = { messages: history };
    if (AGENT_KEY) body.agent = AGENT_KEY;

    fetch(BASE + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        typing(false);
        if (data.error) {
          add("⚠️ " + data.error, "bot");
        } else {
          history = data.messages || history;
          add(data.reply, "bot");
        }
      })
      .catch(function () {
        typing(false);
        add("⚠️ Connection error - please try again.", "bot");
      })
      .finally(function () {
        sending = false;
        sendBtn.disabled = false;
        input.focus();
      });
  });
})();
