/*! Zenoxi website agent widget · https://zenoxi.vercel.app
 * Install: <script src="https://zenoxi.vercel.app/widget.js" data-agent="agt_..." async></script>
 * Optional: data-api="https://your-api" (defaults to Zenoxi's API)
 */
(function () {
  "use strict";
  if (window.__zenoxiAgentLoaded) return;
  window.__zenoxiAgentLoaded = true;

  var script = document.currentScript || document.querySelector("script[data-agent]");
  if (!script) return;
  var KEY = script.getAttribute("data-agent");
  var API = (script.getAttribute("data-api") || "https://chat-bot-ai-ouc2.onrender.com").replace(/\/+$/, "");
  if (!KEY) { console.warn("[Zenoxi] Missing data-agent on the widget script."); return; }

  // ---------- storage (works even when the browser blocks storage) ----------
  function store(kind) {
    try { var s = window[kind]; s.setItem("__zx", "1"); s.removeItem("__zx"); return s; } catch (e) { return null; }
  }
  var local = store("localStorage"), session = store("sessionStorage");
  function get(s, k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function set(s, k, v) { try { if (s) s.setItem(k, v); } catch (e) { /* ignore */ } }

  function randomId() {
    var a = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  var visitorId = get(local, "zenoxi_vid") || randomId();
  set(local, "zenoxi_vid", visitorId);
  var CONV_KEY = "zenoxi_conv_" + KEY, MSG_KEY = "zenoxi_msgs_" + KEY;
  var conversationId = get(session, CONV_KEY);
  var messages = [];
  try { messages = JSON.parse(get(session, MSG_KEY) || "[]"); } catch (e) { messages = []; }

  var config = null, open = false, busy = false, chatForm = null;

  var STRINGS = {
    en: { placeholder: "Type your question…", online: "Online · replies instantly", bubble: "Hi! 👋 Ask me anything about {b}.",
      send: "Send inquiry", sending: "Sending…", consent: "I agree to be contacted about this inquiry.", choose: "Choose…",
      required: "Required", email: "Enter a valid email", phone: "Enter a valid phone number", option: "Choose one of the options",
      intro: "Sure! I'll take a few details so the team can contact you. (Type cancel to stop.)", optional: "(optional, type skip)",
      contactQ: "Can the team contact you about this inquiry?", yes: "Yes, contact me", no: "No", cancelled: "No problem, cancelled. Ask me anything else!",
      emailMe: "Email me:", docsQ: "Want us to email you {d}?", yesSend: "Yes, send it", noThanks: "No thanks", wrong: "AI answers can be wrong",
      failed: "Couldn't send. Please try again.", offline: "Couldn't reach the assistant. Check your connection.", open: "Open chat with", close: "Close chat" },
    hi: { placeholder: "अपना सवाल लिखें…", online: "ऑनलाइन · तुरंत जवाब", bubble: "नमस्ते! 👋 {b} के बारे में कुछ भी पूछें।",
      send: "पूछताछ भेजें", sending: "भेजा जा रहा है…", consent: "मैं इस पूछताछ के बारे में संपर्क किए जाने के लिए सहमत हूँ।", choose: "चुनें…",
      required: "ज़रूरी", email: "सही ईमेल लिखें", phone: "सही फ़ोन नंबर लिखें", option: "किसी एक विकल्प को चुनें",
      intro: "ज़रूर! टीम आपसे संपर्क कर सके, इसके लिए कुछ जानकारी लूँगा। (रोकने के लिए cancel लिखें)", optional: "(वैकल्पिक, skip लिखें)",
      contactQ: "क्या टीम इस पूछताछ के बारे में आपसे संपर्क कर सकती है?", yes: "हाँ, संपर्क करें", no: "नहीं", cancelled: "ठीक है, रद्द कर दिया। कुछ और पूछें!",
      emailMe: "मुझे ईमेल करें:", docsQ: "क्या हम आपको {d} ईमेल करें?", yesSend: "हाँ, भेजें", noThanks: "नहीं, धन्यवाद", wrong: "AI के जवाब गलत हो सकते हैं",
      failed: "भेजा नहीं जा सका। फिर कोशिश करें।", offline: "असिस्टेंट से कनेक्ट नहीं हो पाया।", open: "चैट खोलें", close: "चैट बंद करें" },
    te: { placeholder: "మీ ప్రశ్న టైప్ చేయండి…", online: "ఆన్‌లైన్ · వెంటనే సమాధానం", bubble: "నమస్తే! 👋 {b} గురించి ఏదైనా అడగండి.",
      send: "విచారణ పంపండి", sending: "పంపుతున్నాం…", consent: "ఈ విచారణ గురించి నన్ను సంప్రదించడానికి నేను అంగీకరిస్తున్నాను.", choose: "ఎంచుకోండి…",
      required: "తప్పనిసరి", email: "సరైన ఇమెయిల్ ఇవ్వండి", phone: "సరైన ఫోన్ నంబర్ ఇవ్వండి", option: "ఒక ఆప్షన్ ఎంచుకోండి",
      intro: "తప్పకుండా! టీమ్ మిమ్మల్ని సంప్రదించడానికి కొన్ని వివరాలు తీసుకుంటాను. (ఆపడానికి cancel టైప్ చేయండి)", optional: "(ఐచ్ఛికం, skip టైప్ చేయండి)",
      contactQ: "ఈ విచారణ గురించి టీమ్ మిమ్మల్ని సంప్రదించవచ్చా?", yes: "అవును, సంప్రదించండి", no: "వద్దు", cancelled: "సరే, రద్దు చేశాను. ఇంకేమైనా అడగండి!",
      emailMe: "నాకు ఇమెయిల్ చేయండి:", docsQ: "మీకు {d} ఇమెయిల్ చేయాలా?", yesSend: "అవును, పంపండి", noThanks: "వద్దు, ధన్యవాదాలు", wrong: "AI సమాధానాలు తప్పు కావచ్చు",
      failed: "పంపలేకపోయాం. మళ్లీ ప్రయత్నించండి.", offline: "అసిస్టెంట్‌కు కనెక్ట్ కాలేకపోయాం.", open: "చాట్ తెరవండి", close: "చాట్ మూసివేయండి" },
    ta: { placeholder: "உங்கள் கேள்வியை தட்டச்சு செய்யவும்…", online: "ஆன்லைன் · உடனே பதில்", bubble: "வணக்கம்! 👋 {b} பற்றி எதையும் கேளுங்கள்.",
      send: "விசாரணை அனுப்பு", sending: "அனுப்புகிறது…", consent: "இந்த விசாரணை குறித்து என்னைத் தொடர்பு கொள்ள ஒப்புக்கொள்கிறேன்.", choose: "தேர்வு செய்க…",
      required: "அவசியம்", email: "சரியான மின்னஞ்சலை உள்ளிடவும்", phone: "சரியான தொலைபேசி எண்ணை உள்ளிடவும்", option: "ஒரு விருப்பத்தைத் தேர்வு செய்யவும்",
      intro: "நிச்சயமாக! குழு உங்களைத் தொடர்பு கொள்ள சில விவரங்களைப் பெறுகிறேன். (நிறுத்த cancel என தட்டச்சு செய்யவும்)", optional: "(விருப்பம், skip என தட்டச்சு செய்யவும்)",
      contactQ: "இந்த விசாரணை குறித்து குழு உங்களைத் தொடர்பு கொள்ளலாமா?", yes: "ஆம், தொடர்பு கொள்ளுங்கள்", no: "வேண்டாம்", cancelled: "சரி, ரத்து செய்யப்பட்டது. வேறு ஏதாவது கேளுங்கள்!",
      emailMe: "எனக்கு மின்னஞ்சல் செய்யவும்:", docsQ: "உங்களுக்கு {d} மின்னஞ்சல் செய்யட்டுமா?", yesSend: "ஆம், அனுப்பு", noThanks: "வேண்டாம், நன்றி", wrong: "AI பதில்கள் தவறாக இருக்கலாம்",
      failed: "அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", offline: "உதவியாளரை அடைய முடியவில்லை.", open: "அரட்டையைத் திற", close: "அரட்டையை மூடு" },
  };
  // Default form texts are saved in English; show them in the widget language unless the owner changed them.
  var DEFAULT_TEXT = {
    hi: { "Send us an inquiry": "हमें पूछताछ भेजें", "📩 Send an inquiry": "📩 पूछताछ भेजें", "Your name": "आपका नाम", "Phone number": "फ़ोन नंबर",
      "Email": "ईमेल", "What are you interested in?": "आप किसमें रुचि रखते हैं?", "Message": "संदेश",
      "Thanks! We've received your inquiry and will contact you soon.": "धन्यवाद! हमें आपकी पूछताछ मिल गई है, हम जल्द ही संपर्क करेंगे।" },
    te: { "Send us an inquiry": "మాకు విచారణ పంపండి", "📩 Send an inquiry": "📩 విచారణ పంపండి", "Your name": "మీ పేరు", "Phone number": "ఫోన్ నంబర్",
      "Email": "ఇమెయిల్", "What are you interested in?": "మీకు దేనిపై ఆసక్తి ఉంది?", "Message": "సందేశం",
      "Thanks! We've received your inquiry and will contact you soon.": "ధన్యవాదాలు! మీ విచారణ అందింది, త్వరలో మిమ్మల్ని సంప్రదిస్తాం." },
    ta: { "Send us an inquiry": "எங்களுக்கு விசாரணை அனுப்புங்கள்", "📩 Send an inquiry": "📩 விசாரணை அனுப்பு", "Your name": "உங்கள் பெயர்", "Phone number": "தொலைபேசி எண்",
      "Email": "மின்னஞ்சல்", "What are you interested in?": "நீங்கள் எதில் ஆர்வமாக உள்ளீர்கள்?", "Message": "செய்தி",
      "Thanks! We've received your inquiry and will contact you soon.": "நன்றி! உங்கள் விசாரணை கிடைத்தது, விரைவில் தொடர்பு கொள்வோம்." },
  };
  function tr(text) { var m = config && DEFAULT_TEXT[config.language]; return (m && m[text]) || text; }
  function t(key) { var lang = (config && STRINGS[config.language]) || STRINGS.en; return lang[key] || STRINGS.en[key]; }

  // ---------- helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function md(text) {
    var lines = esc(text.replace("[[SHOW_FORM]]", "").replace("[[UNKNOWN]]", "")).split("\n"), html = "", inList = false;
    lines.forEach(function (line) {
      var item = /^\s*([-*•]|\d+\.)\s+(.*)$/.exec(line);
      if (item) { if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + inline(item[2]) + "</li>"; return; }
      if (inList) { html += "</ul>"; inList = false; }
      html += line.trim() ? "<p>" + inline(line) + "</p>" : "";
    });
    return html + (inList ? "</ul>" : "");
  }
  function inline(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  }
  function save() {
    set(session, MSG_KEY, JSON.stringify(messages.slice(-40)));
    if (conversationId) set(session, CONV_KEY, conversationId);
  }

  // ---------- DOM ----------
  var host = document.createElement("div");
  host.id = "zenoxi-agent";
  host.style.cssText = "position:fixed;z-index:2147483000;bottom:0;right:0;width:0;height:0;";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var CSS = "\
:host{all:initial}*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}\
.zx{--c:#ff6a2b;position:fixed;bottom:20px;right:20px;color:#1c1714}.zx.left{right:auto;left:20px}\
.launcher{position:relative;width:62px;height:62px;border:0;border-radius:50%;cursor:pointer;padding:0;background:radial-gradient(circle at 34% 28%,#fff1d6,var(--c) 42%,#c2271a 100%);box-shadow:0 12px 30px -6px rgba(0,0,0,.35),0 0 0 4px rgba(255,255,255,.6);transition:transform .25s cubic-bezier(.2,.8,.2,1)}\
.launcher:hover{transform:scale(1.07) rotate(-4deg)}.launcher:focus-visible{outline:3px solid #2dd4bf;outline-offset:3px}\
.eyes{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:9px}.eyes i{width:7px;height:14px;border-radius:6px;background:#1a0f08;animation:blink 5s infinite}\
@keyframes blink{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}\
.ring{position:absolute;inset:-7px;border-radius:50%;border:2px solid var(--c);opacity:.5;animation:pulse 2.6s infinite}\
@keyframes pulse{0%{transform:scale(.9);opacity:.6}100%{transform:scale(1.25);opacity:0}}\
.launcher.close .lin,.launcher.close .ring{display:none}.lin{position:absolute;inset:0;display:grid;place-items:center;border-radius:50%;overflow:hidden}\
.launcher.custom{background:var(--c)}.avimg{width:100%;height:100%;object-fit:cover}.avtxt{color:#fff;font-weight:800;font-size:20px;letter-spacing:.5px}.avemoji{font-size:28px;line-height:1}\
.av.custom{display:grid;place-items:center;overflow:hidden;background:#fff}.av.custom .avtxt{color:var(--c);font-size:14px}.av.custom .avemoji{font-size:20px}.launcher .x{display:none;color:#fff;font-size:26px;line-height:62px}.launcher.close .x{display:block}\
.bubble{position:absolute;bottom:76px;right:0;width:max-content;max-width:240px;padding:11px 14px;background:#fff;border-radius:16px 16px 4px 16px;box-shadow:0 10px 30px -8px rgba(0,0,0,.3);font-size:14px;line-height:1.4;animation:pop .35s cubic-bezier(.2,.8,.2,1);cursor:pointer}\
.zx.left .bubble{right:auto;left:0;border-radius:16px 16px 16px 4px}\
.bubble button{position:absolute;top:-8px;right:-8px;width:22px;height:22px;border:0;border-radius:50%;background:#1c1714;color:#fff;font-size:12px;cursor:pointer}\
@keyframes pop{from{opacity:0;transform:translateY(10px) scale(.95)}to{opacity:1;transform:none}}\
.panel{position:absolute;bottom:78px;right:0;width:370px;height:min(600px,calc(100vh - 110px));display:flex;flex-direction:column;overflow:hidden;background:#faf7f2;border-radius:22px;box-shadow:0 24px 70px -12px rgba(0,0,0,.4),0 0 0 1px rgba(0,0,0,.06);animation:pop .3s cubic-bezier(.2,.8,.2,1)}\
.zx.left .panel{right:auto;left:0}\
.head{display:flex;align-items:center;gap:11px;padding:14px 14px 14px 16px;color:#fff;background:linear-gradient(135deg,var(--c),#c2271a)}\
.av{position:relative;flex:none;width:38px;height:38px;border-radius:50%;background:radial-gradient(circle at 34% 28%,#fff1d6,#ffb627 50%,#ff6a2b);box-shadow:0 0 0 2px rgba(255,255,255,.5)}\
.av .eyes{gap:6px}.av .eyes i{width:4px;height:9px}\
.title{flex:1;min-width:0}.title b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.title span{font-size:12px;opacity:.9}.title span:before{content:'';display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:#4ade80}\
.icon{width:34px;height:34px;border:0;border-radius:10px;background:rgba(255,255,255,.18);color:#fff;font-size:18px;cursor:pointer}.icon:hover{background:rgba(255,255,255,.3)}\
.body{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}\
.msg{max-width:86%;padding:10px 13px;font-size:14px;line-height:1.5;border-radius:16px;word-wrap:break-word;animation:pop .25s ease}\
.msg p{margin:0 0 6px}.msg p:last-child{margin:0}.msg ul{margin:4px 0;padding-left:18px}.msg a{color:inherit;text-decoration:underline}\
.bot{align-self:flex-start;background:#fff;border:1px solid #eee4d8;border-radius:16px 16px 16px 5px}\
.me{align-self:flex-end;color:#fff;background:var(--c);border-radius:16px 16px 5px 16px}\
.err{align-self:flex-start;color:#9f1239;background:#fff1f2;border:1px solid #fecdd3}\
.ok{align-self:flex-start;color:#166534;background:#dcfce7;border:1px solid #bbf7d0}\
.dots{display:inline-flex;gap:4px}.dots i{width:7px;height:7px;border-radius:50%;background:#c4b8ac;animation:bounce 1s infinite}.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}\
@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-5px);opacity:1}}\
.chips{display:flex;flex-wrap:wrap;gap:7px}.chip{padding:8px 12px;border:1px solid #f3c7a6;border-radius:20px;background:#fff;color:#7c2d12;font-size:13px;cursor:pointer;text-align:left}.chip:hover{background:#fff7ed}\
.form{align-self:stretch;padding:14px;background:#fff;border:1px solid #eee4d8;border-radius:16px;animation:pop .3s ease}\
.form h4{margin:0 0 10px;font-size:15px}.f{margin-bottom:9px}.f label{display:block;margin-bottom:4px;font-size:12px;font-weight:600;color:#5b5049}\
.f input,.f select,.f textarea{width:100%;padding:9px 11px;border:1px solid #e3d7ca;border-radius:10px;background:#fffdfa;font-size:14px;color:#1c1714;outline:0}.f textarea{min-height:64px;resize:vertical}\
.f input:focus,.f select:focus,.f textarea:focus{border-color:var(--c);box-shadow:0 0 0 3px rgba(255,106,43,.15)}.f .e{margin-top:3px;color:#be123c;font-size:12px}\
.consent{display:flex;gap:8px;align-items:flex-start;margin:4px 0 10px;font-size:12px;color:#5b5049}\
.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}\
.primary{width:100%;padding:11px;border:0;border-radius:12px;background:var(--c);color:#fff;font-size:14px;font-weight:700;cursor:pointer}.primary:disabled{opacity:.6;cursor:default}\
.foot{padding:10px 12px 8px;background:#fff;border-top:1px solid #eee4d8}\
.inq{display:block;margin:0 0 8px;padding:6px 10px;border:1px dashed #f3c7a6;border-radius:10px;background:#fff7ed;color:#9a3412;font-size:12.5px;font-weight:600;cursor:pointer}\
.row{display:flex;gap:8px;align-items:flex-end}.row textarea{flex:1;max-height:110px;min-height:42px;padding:10px 12px;border:1px solid #e3d7ca;border-radius:14px;font-size:14px;resize:none;outline:0;background:#fffdfa}.row textarea:focus{border-color:var(--c)}\
.send{flex:none;width:42px;height:42px;border:0;border-radius:13px;background:var(--c);color:#fff;font-size:18px;cursor:pointer}.send:disabled{opacity:.45;cursor:default}\
.by{margin-top:6px;text-align:center;font-size:11px;color:#a2978d}.by a{color:#9a3412;text-decoration:none;font-weight:600}\
.badge{margin-left:6px;padding:1px 7px;border-radius:8px;background:rgba(255,255,255,.25);font-size:10px;font-weight:700;letter-spacing:.4px}\
@media (max-width:480px){.zx{bottom:14px;right:14px}.zx.left{left:14px}.panel{position:fixed;inset:0;width:auto;height:auto;bottom:0;border-radius:0}.launcher.close{display:none}}\
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}";

  var wrap = document.createElement("div");
  wrap.className = "zx";
  root.innerHTML = "<style>" + CSS + "</style>";
  root.appendChild(wrap);

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function eyes() { return h("span", { class: "eyes", "aria-hidden": "true" }, [h("i"), h("i")]); }
  function avatarInner() {
    var a = (config && config.avatar) || { type: "orb" };
    if (a.type === "image" && a.url) return h("img", { class: "avimg", src: a.url, alt: "" });
    if (a.type === "initials") return h("span", { class: "avtxt", text: a.initials || "AI" });
    if (a.type === "emoji") return h("span", { class: "avemoji", text: a.emoji || "🤖" });
    return eyes();
  }

  var launcher, panel, body, input, sendBtn, bubble;

  function renderLauncher() {
    launcher = h("button", { class: "launcher", type: "button", "aria-label": "Open chat with " + config.name, onclick: toggle },
      [h("span", { class: "ring" }), h("span", { class: "lin" }, [avatarInner()]), h("span", { class: "x", text: "×" })]);
    if (config.avatar && config.avatar.type !== "orb") launcher.classList.add("custom");
    wrap.appendChild(launcher);
    if (!get(session, "zenoxi_bubble_" + KEY) && !open) {
      setTimeout(function () {
        if (open) return;
        bubble = h("div", { class: "bubble", role: "status", onclick: toggle },
          [h("span", { text: t("bubble").replace("{b}", config.business_name) }),
           h("button", { type: "button", "aria-label": "Dismiss", text: "×", onclick: function (e) { e.stopPropagation(); hideBubble(); } })]);
        wrap.appendChild(bubble);
      }, 2500);
    }
  }
  function hideBubble() { if (bubble) { bubble.remove(); bubble = null; } set(session, "zenoxi_bubble_" + KEY, "1"); }

  function renderPanel() {
    body = h("div", { class: "body", "aria-live": "polite" });
    input = h("textarea", { rows: "1", placeholder: t("placeholder"), "aria-label": "Message",
      oninput: function () { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 110) + "px"; sendBtn.disabled = !input.value.trim() || busy; },
      onkeydown: function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitInput(); } } });
    sendBtn = h("button", { class: "send", type: "button", "aria-label": "Send", text: "➤", onclick: submitInput });
    sendBtn.disabled = true;
    var form = config.form || {};
    panel = h("div", { class: "panel", role: "dialog", "aria-label": config.name }, [
      h("div", { class: "head" }, [
        h("span", { class: "av" + (config.avatar && config.avatar.type !== "orb" ? " custom" : "") }, [avatarInner()]),
        h("div", { class: "title" }, [h("b", { html: esc(config.name) + (config.preview ? '<span class="badge">PREVIEW</span>' : "") }), h("span", { text: t("online") })]),
        h("button", { class: "icon", type: "button", "aria-label": "Close chat", text: "×", onclick: toggle }),
      ]),
      body,
      h("div", { class: "foot" }, [
        form.enabled ? h("button", { class: "inq", type: "button", text: tr(form.button_label || "📩 Send an inquiry"), onclick: showForm }) : null,
        h("div", { class: "row" }, [input, sendBtn]),
        h("div", { class: "by", html: 'Powered by <a href="https://zenoxi.vercel.app" target="_blank" rel="noopener">Zenoxi</a> · ' + esc(t("wrong")) }),
      ]),
    ]);
    wrap.appendChild(panel);
    if (!messages.length) messages.push({ role: "assistant", content: config.welcome_message || "Hi! How can I help?" });
    messages.forEach(function (m) { addBubble(m.role, m.content); });
    if (messages.length === 1 && (config.suggested_questions || []).length) {
      var chips = h("div", { class: "chips suggest" });
      config.suggested_questions.forEach(function (q) {
        chips.appendChild(h("button", { class: "chip", type: "button", text: q, onclick: function () { chips.remove(); ask(q); } }));
      });
      body.appendChild(chips);
    }
    scroll();
    setTimeout(function () { input.focus(); }, 150);
  }

  function addBubble(role, content, cls) {
    var el = h("div", { class: "msg " + (cls || (role === "user" ? "me" : "bot")), html: role === "user" ? esc(content).replace(/\n/g, "<br>") : md(content) });
    body.appendChild(el);
    scroll();
    return el;
  }
  function scroll() { if (body) body.scrollTop = body.scrollHeight; }

  function toggle() {
    open = !open;
    hideBubble();
    launcher.classList.toggle("close", open);
    launcher.setAttribute("aria-label", open ? "Close chat" : "Open chat with " + config.name);
    if (open) renderPanel(); else if (panel) { panel.remove(); panel = null; body = null; }
  }

  function clearSuggestions() {
    var old = body && body.querySelector(".suggest");
    if (old) old.remove();
  }

  function submitInput() {
    var text = input.value.trim();
    if (!text || busy) return;
    clearSuggestions();
    input.value = ""; input.style.height = "auto"; sendBtn.disabled = true;
    if (chatForm) return chatFormAnswer(text);
    ask(text);
  }

  // ---------- chat ----------
  function ask(text) {
    busy = true;
    messages.push({ role: "user", content: text }); addBubble("user", text); save();
    var el = addBubble("assistant", "");
    el.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
    var answer = "";
    fetch(API + "/api/public/agents/" + encodeURIComponent(KEY) + "/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId, conversation_id: conversationId, message: text, page_url: location.href.slice(0, 500) }),
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (d) { throw new Error(typeof d.detail === "string" ? d.detail : "Something went wrong. Please try again."); });
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buf += dec.decode(r.value, { stream: true });
          var lines = buf.split("\n"); buf = lines.pop() || "";
          lines.forEach(function (line) {
            if (!line.trim()) return;
            var ev = JSON.parse(line);
            if (ev.type === "conversation") { conversationId = ev.conversation_id; save(); }
            else if (ev.type === "token") { answer += ev.content; el.innerHTML = md(answer) || '<span class="dots"><i></i><i></i><i></i></span>'; scroll(); }
            else if (ev.type === "final") {
              answer = ev.content; el.innerHTML = md(answer);
              messages.push({ role: "assistant", content: answer }); save();
              if (ev.show_form) setTimeout(showForm, 400);
            } else if (ev.type === "error") throw new Error(ev.message);
          });
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      el.className = "msg err"; el.textContent = err.message || t("offline");
    }).then(function () { busy = false; if (input) sendBtn.disabled = !input.value.trim(); scroll(); });
  }

  // ---------- inquiry form ----------
  var EMAIL = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/, PHONE = /^\+?[\d\s()-]{7,20}$/;
  function validate(field, value) {
    if (field.required && !value) return t("required");
    if (value && field.type === "email" && !EMAIL.test(value)) return t("email");
    if (value && field.type === "phone" && !PHONE.test(value)) return t("phone");
    if (value && field.type === "select" && field.options && field.options.length && field.options.indexOf(value) < 0) return t("option");
    return "";
  }
  function showForm() {
    if (!body || !config.form || !config.form.enabled) return;
    if (body.querySelector(".form") || chatForm) return;
    if (config.form.style === "chat") return startChatForm();
    var f = config.form, inputs = {};
    var card = h("form", { class: "form", novalidate: "true" }, [h("h4", { text: tr(f.title || "Send us an inquiry") })]);
    (f.fields || []).forEach(function (field) {
      var id = "zx-" + field.key, ctl;
      if (field.type === "select") {
        ctl = h("select", { id: id }, [h("option", { value: "", text: t("choose") })].concat((field.options || []).map(function (o) { return h("option", { value: o, text: o }); })));
      } else if (field.type === "textarea") ctl = h("textarea", { id: id });
      else ctl = h("input", { id: id, type: field.type === "phone" ? "tel" : field.type === "email" ? "email" : field.type === "date" ? "date" : "text", autocomplete: field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.key === "name" ? "name" : "off" });
      inputs[field.key] = ctl;
      card.appendChild(h("div", { class: "f" }, [h("label", { for: id, text: tr(field.label) + (field.required ? " *" : "") }), ctl, h("div", { class: "e" })]));
    });
    var hp = h("input", { class: "hp", name: "website", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });
    var consent = h("input", { type: "checkbox", id: "zx-consent" });
    var btn = h("button", { class: "primary", type: "submit", text: t("send") });
    var docBoxes = [];
    if ((config.documents || []).length) {
      var docsWrap = h("div", { class: "f docs" }, [h("label", { text: t("emailMe") })]);
      config.documents.forEach(function (d) {
        var cb = h("input", { type: "checkbox", value: d.id });
        docBoxes.push(cb);
        docsWrap.appendChild(h("label", { class: "consent" }, [cb, h("span", { text: d.title })]));
      });
      card.appendChild(docsWrap);
    }
    card.appendChild(hp);
    card.appendChild(h("label", { class: "consent", for: "zx-consent" }, [consent, h("span", { text: t("consent") })]));
    card.appendChild(btn);
    card.addEventListener("submit", function (e) {
      e.preventDefault();
      var values = {}, bad = false;
      (f.fields || []).forEach(function (field) {
        var v = inputs[field.key].value.trim(), msg = validate(field, v);
        inputs[field.key].parentNode.querySelector(".e").textContent = msg;
        if (msg) bad = true; values[field.key] = v;
      });
      if (bad) return;
      btn.disabled = true; btn.textContent = t("sending");
      var docs = docBoxes.filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.value; });
      sendLead(values, consent.checked, hp.value, docs, function (ok, detail) {
        if (ok) { card.remove(); addBubble("assistant", detail, "ok"); }
        else {
          btn.disabled = false; btn.textContent = t("send");
          if (detail && detail.fields) Object.keys(detail.fields).forEach(function (k) { if (inputs[k]) inputs[k].parentNode.querySelector(".e").textContent = detail.fields[k]; });
          else addBubble("assistant", (detail && detail.message) || detail || t("failed"), "err");
        }
      });
    });
    body.appendChild(card);
    scroll();
    var first = inputs[(f.fields || [])[0] && f.fields[0].key];
    if (first) first.focus();
  }

  // conversational style: ask one field at a time in the chat
  function startChatForm() {
    chatForm = { i: 0, values: {}, fields: (config.form.fields || []).slice() };
    addBubble("assistant", t("intro"));
    askField();
  }
  function askField() {
    var field = chatForm.fields[chatForm.i];
    if (!field) {
      addBubble("assistant", t("contactQ"));
      chipRow([t("yes"), t("no")], function (choice) { askDocs(choice === t("yes")); });
      chatForm.awaitingConsent = true;
      return;
    }
    addBubble("assistant", tr(field.label) + (field.required ? "" : " " + t("optional")));
    if (field.type === "select" && field.options && field.options.length) chipRow(field.options, chatFormAnswer);
    input.placeholder = tr(field.label);
  }
  function chipRow(options, onPick) {
    var row = h("div", { class: "chips" });
    options.forEach(function (o) { row.appendChild(h("button", { class: "chip", type: "button", text: o, onclick: function () { row.remove(); addBubble("user", o); onPick(o, true); } })); });
    body.appendChild(row); scroll();
  }
  function chatFormAnswer(text, fromChip) {
    if (!chatForm) return;
    if (!fromChip) addBubble("user", text);
    if (/^cancel$/i.test(text)) { chatForm = null; input.placeholder = t("placeholder"); return addBubble("assistant", t("cancelled")); }
    if (chatForm.awaitingDocs) return finishChatForm(chatForm.consent, /^y/i.test(text));
    if (chatForm.awaitingConsent) return askDocs(/^y/i.test(text));
    var field = chatForm.fields[chatForm.i];
    var value = !field.required && /^skip$/i.test(text) ? "" : text;
    var msg = validate(field, value);
    if (msg) { addBubble("assistant", msg + ". " + tr(field.label) + "?", "err"); return; }
    chatForm.values[field.key] = value; chatForm.i += 1; askField();
  }
  function askDocs(consent) {
    var docs = config.documents || [];
    if (!consent || !docs.length || !chatForm.values.email) return finishChatForm(consent, false);
    chatForm.consent = consent; chatForm.awaitingConsent = false; chatForm.awaitingDocs = true;
    addBubble("assistant", t("docsQ").replace("{d}", docs.map(function (d) { return d.title; }).join(", ")));
    chipRow([t("yesSend"), t("noThanks")], function (choice) { finishChatForm(consent, choice === t("yesSend")); });
  }
  function finishChatForm(consent, withDocs) {
    var values = chatForm.values;
    chatForm = null; input.placeholder = t("placeholder");
    var el = addBubble("assistant", t("sending"));
    var docs = withDocs ? (config.documents || []).map(function (d) { return d.id; }) : [];
    sendLead(values, consent, "", docs, function (ok, detail) {
      el.className = "msg " + (ok ? "ok" : "err");
      el.innerHTML = md(ok ? detail : (detail && detail.message) || detail || t("failed"));
    });
  }

  function sendLead(values, consent, honeypot, documents, done) {
    fetch(API + "/api/public/agents/" + encodeURIComponent(KEY) + "/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId, conversation_id: conversationId, fields: values, consent: consent, website: honeypot, documents: documents || [], page_url: location.href.slice(0, 500) }),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (d) {
        if (res.ok) done(true, tr(d.message || (config.form && config.form.success_message) || "Thanks! We'll be in touch."));
        else done(false, d.detail);
      });
    }).catch(function () { done(false, t("offline")); });
  }

  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) toggle(); });

  // ---------- start ----------
  function start() {
    fetch(API + "/api/public/agents/" + encodeURIComponent(KEY) + "/config")
      .then(function (r) { return r.ok ? r.json() : r.json().then(function (d) { throw new Error(d.detail || r.status); }); })
      .then(function (cfg) {
        config = cfg;
        wrap.style.setProperty("--c", cfg.color || "#ff6a2b");
        if (cfg.position === "left") { wrap.classList.add("left"); host.style.right = "auto"; host.style.left = "0"; }
        document.body.appendChild(host);
        renderLauncher();
      })
      .catch(function (err) { console.warn("[Zenoxi] Assistant not loaded:", err.message || err); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
