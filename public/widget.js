/*
 * Molokai Vacation Properties — embeddable lead-assistant widget.
 * Drop this one line into any website:
 *   <script src="https://aibot-rl1g.onrender.com/widget.js" defer></script>
 * It injects a floating chat bubble that talks to the bot backend.
 */
(function () {
  if (window.__leadBotLoaded) return;
  window.__leadBotLoaded = true;

  // Figure out the backend origin from this script's own URL.
  function getBase() {
    var s = document.currentScript;
    if (!s) {
      var all = document.querySelectorAll('script[src*="widget.js"]');
      s = all[all.length - 1];
    }
    try {
      return new URL(s.src).origin;
    } catch (e) {
      return "";
    }
  }
  var BASE = getBase();

  // Host element + isolated shadow DOM so the host site's CSS can't break us.
  var host = document.createElement("div");
  host.id = "lead-bot-host";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  root.innerHTML =
    '<style>' +
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
    '.bubble{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;border:none;background:#0d6e6e;color:#fff;font-size:26px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:2147483000}' +
    '.bubble:hover{background:#0b5d5d}' +
    '.panel{position:fixed;bottom:90px;right:20px;width:370px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;z-index:2147483000}' +
    '.panel[hidden]{display:none}' +
    '.head{background:#0f2c2c;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}' +
    '.av{width:38px;height:38px;border-radius:50%;background:#0d6e6e;display:flex;align-items:center;justify-content:center;font-weight:700}' +
    '.head .name{font-weight:600;font-size:14px}' +
    '.head .status{font-size:11px;color:#7fd6a6}' +
    '.head .x{margin-left:auto;cursor:pointer;font-size:18px;opacity:.7;background:none;border:none;color:#fff}' +
    '.msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f3f5f4}' +
    '.m{max-width:82%;padding:9px 12px;border-radius:13px;font-size:14px;line-height:1.4}' +
    '.m.bot{background:#fff;color:#13322f;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.06)}' +
    '.m.user{background:#0d6e6e;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
    '.typing{align-self:flex-start;display:flex;gap:4px;padding:11px 13px;background:#fff;border-radius:13px;box-shadow:0 1px 2px rgba(0,0,0,.06)}' +
    '.typing i{width:7px;height:7px;border-radius:50%;background:#b9c2c0;display:inline-block;animation:b 1.2s infinite}' +
    '.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}' +
    '@keyframes b{0%,60%,100%{opacity:.3}30%{opacity:1}}' +
    '.cmp{display:flex;padding:10px;gap:8px;border-top:1px solid #e4e8e7;background:#fff}' +
    '.cmp input{flex:1;border:1px solid #dfe4e3;border-radius:10px;padding:10px 12px;font-size:14px;outline:none}' +
    '.cmp input:focus{border-color:#0d6e6e}' +
    '.cmp button{background:#0d6e6e;color:#fff;border:none;border-radius:10px;padding:0 16px;font-weight:600;cursor:pointer;font-size:14px}' +
    '.cmp button:disabled{opacity:.5}' +
    '</style>' +
    '<button class="bubble" aria-label="Chat">💬</button>' +
    '<div class="panel" hidden>' +
    '  <div class="head"><div class="av" id="av">··</div><div><div class="name" id="brand">Loading…</div><div class="status">Usually replies instantly</div></div><button class="x" aria-label="Close">✕</button></div>' +
    '  <div class="msgs"></div>' +
    '  <form class="cmp"><input type="text" placeholder="Type your message…" autocomplete="off"/><button type="submit">Send</button></form>' +
    '</div>';

  var bubble = root.querySelector(".bubble");
  var panel = root.querySelector(".panel");
  var closeBtn = root.querySelector(".x");
  var msgs = root.querySelector(".msgs");
  var form = root.querySelector(".cmp");
  var input = root.querySelector("input");
  var sendBtn = form.querySelector("button");

  var history = [];
  var started = false;

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

  function openPanel() {
    panel.hidden = false;
    if (!started) {
      started = true;
      // Pull branding from the backend so the widget stays in sync per client.
      fetch(BASE + "/config")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var a = (data && data.agent) || {};
          var brand = a.brokerage || "Our Team";
          root.querySelector("#brand").textContent = brand;
          var initials = brand.split(" ").map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
          root.querySelector("#av").textContent = initials || "··";
          add("👋 Aloha! You've reached " + brand + ". Are you looking to buy or sell? I can help right now.", "bot");
        })
        .catch(function () {
          add("👋 Aloha! Are you looking to buy or sell? I can help right now.", "bot");
        });
    }
    input.focus();
  }

  bubble.addEventListener("click", function () {
    if (panel.hidden) openPanel(); else panel.hidden = true;
  });
  closeBtn.addEventListener("click", function () { panel.hidden = true; });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    add(text, "user");
    history.push({ role: "user", content: text });
    input.value = "";
    sendBtn.disabled = true;
    typing(true);

    fetch(BASE + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
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
        add("⚠️ Connection error — please try again.", "bot");
      })
      .finally(function () {
        sendBtn.disabled = false;
        input.focus();
      });
  });
})();
