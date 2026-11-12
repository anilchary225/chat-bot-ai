import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowUp, BarChart3, Bot, Check, Code2, Copy, ExternalLink, FileText, Globe, HelpCircle, Inbox, LoaderCircle, Mail,
  MessageSquareText, Palette, Plus, Rocket, Sparkles, StickyNote, Trash2, Upload, Wand2, X
} from "lucide-react";
import Orb from "./Orb";
import Markdown from "./Markdown";
import { AgentAvatar, AiKeyBox, AnalyticsTab, AvatarPicker, EmailsTab, InboxTab, LeadsTab } from "./AgentStudioExtra";

const spring = { type: "spring", stiffness: 340, damping: 30 };

async function api(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === "string" ? detail : detail?.message || "Something went wrong.");
  }
  return data;
}
const json = (body, method = "POST") => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function streamNdjson(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.filter((l) => l.trim()).forEach((l) => onEvent(JSON.parse(l)));
  }
}

function StatusPill({ agent }) {
  if (agent.disabled) return <span className="ag-pill off">Disabled by admin</span>;
  return <span className={`ag-pill ${agent.status}`}>{agent.status === "live" ? "● Live" : "Draft"}</span>;
}

// ------------------------------------------------------------------ list + create

function AgentsHome({ apiBase, onOpen, onError }) {
  const [agents, setAgents] = useState(null);
  const [creating, setCreating] = useState(false);
  const [business, setBusiness] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(apiBase, "/api/agents").then(setAgents).catch((e) => { setAgents([]); onError(e.message); });
  }, [apiBase, onError]);

  const create = async (event) => {
    event.preventDefault();
    if (!business.trim() || busy) return;
    setBusy(true);
    try {
      const agent = await api(apiBase, "/api/agents", json({ business_name: business.trim(), website: website.trim() || null }));
      onOpen(agent);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ag-home">
      <motion.div className="ag-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <span className="rt-badge"><Bot size={14} /> Website Agents</span>
        <h1>An AI assistant for <span className="rt-grad">your website</span></h1>
        <p>Tell Zenoxi about your business in a quick chat. It builds an assistant that answers your visitors from
          your information and collects inquiries, then you add it to your site with one line of code.</p>
      </motion.div>

      <div className="ag-grid">
        <motion.button type="button" className="ag-card ag-new" onClick={() => setCreating(true)} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <span className="ag-new-icon"><Plus size={22} /></span>
          <strong>Create a new agent</strong>
          <em>About 5 minutes</em>
        </motion.button>
        {agents === null && <div className="ag-card ag-loading"><LoaderCircle className="spin" size={20} /></div>}
        {agents?.map((a, i) => (
          <motion.button key={a.id} type="button" className="ag-card" onClick={() => onOpen(a)} whileHover={{ y: -3 }}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }}>
            <div className="ag-card-top">
              <AgentAvatar agent={a} />
              <StatusPill agent={a} />
            </div>
            <strong>{a.name}</strong>
            <em>{a.business_name}</em>
            <div className="ag-card-stats">
              <span><Inbox size={13} /> {a.stats?.leads ?? 0} {a.stats?.leads === 1 ? "lead" : "leads"}</span>
              <span><MessageSquareText size={13} /> {a.stats?.messages_today ?? 0} today</span>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget && !busy) setCreating(false); }}>
            <motion.form className="delete-dialog ag-create" onSubmit={create} initial={{ y: 30, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }} transition={spring}>
              <h2>Create a website agent</h2>
              <p>Zenoxi will read your website (if you have one) and then ask you a few questions.</p>
              <label className="auth-field"><span>Business name</span>
                <div><Sparkles size={16} /><input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="e.g. Sri Sai Coaching Centre" maxLength={80} autoFocus required /></div>
              </label>
              <label className="auth-field"><span>Website (optional)</span>
                <div><Globe size={16} /><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbusiness.com" maxLength={300} /></div>
              </label>
              <div className="delete-dialog-actions">
                <button type="button" className="dialog-cancel" onClick={() => setCreating(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="rt-primary" disabled={busy || !business.trim()}>
                  {busy ? <><LoaderCircle size={16} className="spin" /> {website ? "Reading website…" : "Creating…"}</> : <>Start <ArrowUp size={16} style={{ transform: "rotate(90deg)" }} /></>}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ setup: interview + profile

function ProfileEditor({ profile, onChange }) {
  const setField = (key, value) => onChange({ ...profile, [key]: value });
  const setList = (key, i, patch) => setField(key, profile[key].map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const addRow = (key, row) => setField(key, [...profile[key], row]);
  const removeRow = (key, i) => setField(key, profile[key].filter((_, j) => j !== i));
  return (
    <div className="pf">
      <div className="pf-grid">
        <label className="pf-f"><span>Business name</span><input value={profile.business_name} onChange={(e) => setField("business_name", e.target.value)} /></label>
        <label className="pf-f"><span>Tagline</span><input value={profile.tagline} onChange={(e) => setField("tagline", e.target.value)} /></label>
      </div>
      <label className="pf-f"><span>About the business</span><textarea rows={3} value={profile.description} onChange={(e) => setField("description", e.target.value)} /></label>
      <div className="pf-grid">
        <label className="pf-f"><span>Opening hours</span><input value={profile.hours} onChange={(e) => setField("hours", e.target.value)} /></label>
        <label className="pf-f"><span>Location</span><input value={profile.location} onChange={(e) => setField("location", e.target.value)} /></label>
        <label className="pf-f"><span>Service area</span><input value={profile.service_area} onChange={(e) => setField("service_area", e.target.value)} /></label>
        {["phone", "email", "whatsapp", "website"].map((k) => (
          <label key={k} className="pf-f"><span>{k[0].toUpperCase() + k.slice(1)}</span>
            <input value={profile.contact[k]} onChange={(e) => setField("contact", { ...profile.contact, [k]: e.target.value })} /></label>
        ))}
      </div>
      <div className="pf-sec"><h4>Services / products</h4>
        {profile.services.map((s, i) => (
          <div key={i} className="pf-row">
            <input placeholder="Name" value={s.name} onChange={(e) => setList("services", i, { name: e.target.value })} />
            <input placeholder="Price" value={s.price} onChange={(e) => setList("services", i, { price: e.target.value })} />
            <input placeholder="Details" value={s.details} onChange={(e) => setList("services", i, { details: e.target.value })} />
            <button type="button" className="icon-btn" aria-label="Remove service" onClick={() => removeRow("services", i)}><X size={15} /></button>
          </div>
        ))}
        <button type="button" className="rt-ghost pf-add" onClick={() => addRow("services", { name: "", price: "", details: "" })}><Plus size={14} /> Add service</button>
      </div>
      <div className="pf-sec"><h4>Frequently asked questions</h4>
        {profile.faqs.map((f, i) => (
          <div key={i} className="pf-row pf-faq">
            <input placeholder="Question" value={f.q} onChange={(e) => setList("faqs", i, { q: e.target.value })} />
            <textarea rows={2} placeholder="Answer" value={f.a} onChange={(e) => setList("faqs", i, { a: e.target.value })} />
            <button type="button" className="icon-btn" aria-label="Remove FAQ" onClick={() => removeRow("faqs", i)}><X size={15} /></button>
          </div>
        ))}
        <button type="button" className="rt-ghost pf-add" onClick={() => addRow("faqs", { q: "", a: "" })}><Plus size={14} /> Add FAQ</button>
      </div>
      <div className="pf-sec"><h4>Policies</h4>
        {profile.policies.map((p, i) => (
          <div key={i} className="pf-row pf-faq">
            <input placeholder="Title (e.g. Refunds)" value={p.title} onChange={(e) => setList("policies", i, { title: e.target.value })} />
            <textarea rows={2} placeholder="Policy" value={p.text} onChange={(e) => setList("policies", i, { text: e.target.value })} />
            <button type="button" className="icon-btn" aria-label="Remove policy" onClick={() => removeRow("policies", i)}><X size={15} /></button>
          </div>
        ))}
        <button type="button" className="rt-ghost pf-add" onClick={() => addRow("policies", { title: "", text: "" })}><Plus size={14} /> Add policy</button>
      </div>
      <div className="pf-grid">
        <label className="pf-f"><span>Tone</span><input value={profile.tone} onChange={(e) => setField("tone", e.target.value)} /></label>
        <label className="pf-f"><span>Languages</span><input value={profile.languages} onChange={(e) => setField("languages", e.target.value)} /></label>
        <label className="pf-f"><span>Hand over to a human when…</span><input value={profile.handoff.when} onChange={(e) => setField("handoff", { ...profile.handoff, when: e.target.value })} /></label>
        <label className="pf-f"><span>…and how</span><input value={profile.handoff.how} onChange={(e) => setField("handoff", { ...profile.handoff, how: e.target.value })} /></label>
      </div>
      <label className="pf-f"><span>Never say or promise (one per line)</span>
        <textarea rows={2} value={profile.never_say.join("\n")} onChange={(e) => setField("never_say", e.target.value.split("\n"))} /></label>
    </div>
  );
}

function SetupTab({ apiBase, agent, onAgent, onError, goTo }) {
  const [messages, setMessages] = useState(agent.interview || []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(agent.profile);
  const [building, setBuilding] = useState(false);
  const [editing, setEditing] = useState(Boolean(agent.profile));
  const listRef = useRef(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  const send = async (event) => {
    event?.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setText("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const data = await api(apiBase, `/api/agents/${agent.id}/interview`, json({ message }));
      setMessages(data.interview);
    } catch (e) {
      onError(e.message);
      setMessages((m) => m.slice(0, -1));
      setText(message);
    } finally {
      setBusy(false);
    }
  };

  const build = async () => {
    setBuilding(true);
    try {
      const data = await api(apiBase, `/api/agents/${agent.id}/profile/generate`, { method: "POST" });
      setProfile(data.profile);
      setEditing(true);
    } catch (e) {
      onError(e.message);
    } finally {
      setBuilding(false);
    }
  };

  const save = async () => {
    setBuilding(true);
    try {
      const clean = {
        ...profile,
        never_say: profile.never_say.filter((x) => x.trim()),
        services: profile.services.filter((s) => s.name.trim()),
        faqs: profile.faqs.filter((f) => f.q.trim() && f.a.trim()),
        policies: profile.policies.filter((p) => p.text.trim()),
      };
      const updated = await api(apiBase, `/api/agents/${agent.id}/profile`, json({ profile: clean }, "PUT"));
      onAgent(updated);
      goTo("test");
    } catch (e) {
      onError(e.message);
    } finally {
      setBuilding(false);
    }
  };

  if (editing && profile) {
    return (
      <div className="ag-panel">
        <div className="ag-panel-head">
          <div><h3>Review your business profile</h3><p>This is what your agent knows. Fix anything wrong, then save.</p></div>
          <button type="button" className="rt-ghost" onClick={() => setEditing(false)}><MessageSquareText size={15} /> Back to interview</button>
        </div>
        <ProfileEditor profile={profile} onChange={setProfile} />
        <div className="ag-actions">
          <motion.button type="button" className="rt-primary" onClick={save} disabled={building} whileTap={{ scale: 0.97 }}>
            {building ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} Save & test my agent
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="ag-panel ag-interview">
      <div className="ag-panel-head">
        <div><h3>Tell Zenoxi about your business</h3><p>Answer in your own words. The more you share, the better your agent answers.</p></div>
        <motion.button type="button" className="rt-primary" onClick={build} disabled={building || messages.filter((m) => m.role === "user").length < 1} whileTap={{ scale: 0.97 }}>
          {building ? <><LoaderCircle size={16} className="spin" /> Building…</> : <><Wand2 size={16} /> Build my agent</>}
        </motion.button>
      </div>
      <div className="iv-list" ref={listRef}>
        {messages.map((m, i) => (
          <motion.div key={i} className={`iv-msg ${m.role}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {m.role === "assistant" && <Orb size={28} still />}
            <div className="iv-bubble">{m.role === "assistant" ? <Markdown>{m.content}</Markdown> : m.content}</div>
          </motion.div>
        ))}
        {busy && <div className="iv-msg assistant"><Orb size={28} state="thinking" /><div className="iv-bubble"><span className="shimmer">Thinking</span></div></div>}
      </div>
      <form className="iv-composer" onSubmit={send}>
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your answer…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} disabled={busy} />
        <button type="submit" className="send-btn" disabled={!text.trim() || busy} aria-label="Send answer"><ArrowUp size={18} /></button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ knowledge

const KIND_ICON = { page: Globe, file: FileText, note: StickyNote, profile: Sparkles };

function KnowledgeTab({ apiBase, agent, onError }) {
  const [sources, setSources] = useState(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState({ title: "", text: "" });
  const [busy, setBusy] = useState("");
  const fileRef = useRef(null);
  const base = `/api/agents/${agent.id}/sources`;

  const load = () => api(apiBase, base).then(setSources).catch((e) => onError(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [agent.id]);

  const run = async (kind, fn) => {
    setBusy(kind);
    try { await fn(); await load(); } catch (e) { onError(e.message); } finally { setBusy(""); }
  };

  return (
    <div className="ag-panel">
      <div className="ag-panel-head"><div><h3>Knowledge</h3><p>Your agent answers only from these sources.</p></div></div>
      <div className="kn-add">
        <form className="kn-box" onSubmit={(e) => { e.preventDefault(); if (url.trim()) run("web", async () => { await api(apiBase, `${base}/website`, json({ url })); setUrl(""); }); }}>
          <strong><Globe size={15} /> Read a website</strong>
          <div className="kn-row"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourbusiness.com" />
            <button className="rt-primary" disabled={!url.trim() || busy}>{busy === "web" ? <LoaderCircle size={15} className="spin" /> : "Read"}</button></div>
          <em>Reads up to 8 important pages (about, services, pricing, contact…).</em>
        </form>
        <div className="kn-box">
          <strong><Upload size={15} /> Upload a file</strong>
          <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.csv,.json"
            onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) run("file", () => { const form = new FormData(); form.append("file", f); return api(apiBase, `${base}/file`, { method: "POST", body: form }); }); }} />
          <button type="button" className="rt-ghost" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
            {busy === "file" ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />} Brochure, price list, menu…
          </button>
          <em>PDF, Word, text or CSV · up to 10 MB.</em>
        </div>
        <form className="kn-box kn-note" onSubmit={(e) => { e.preventDefault(); run("note", async () => { await api(apiBase, `${base}/text`, json(note)); setNote({ title: "", text: "" }); }); }}>
          <strong><StickyNote size={15} /> Add a note</strong>
          <input value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} placeholder="Title (e.g. Diwali offer)" />
          <textarea rows={3} value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} placeholder="Anything your agent should know…" />
          <button className="rt-primary" disabled={!note.title.trim() || !note.text.trim() || Boolean(busy)}>{busy === "note" ? <LoaderCircle size={15} className="spin" /> : "Add note"}</button>
        </form>
      </div>
      <div className="kn-list">
        {sources === null && <LoaderCircle className="spin" size={18} />}
        {sources?.length === 0 && <p className="ag-empty">No knowledge yet. Finish the interview or add a source above.</p>}
        <AnimatePresence initial={false}>
          {sources?.map((s) => {
            const Icon = KIND_ICON[s.kind] || FileText;
            return (
              <motion.div key={s.id} layout className="kn-item" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                <span className={`kn-icon k-${s.kind}`}><Icon size={15} /></span>
                <span className="kn-text"><strong>{s.title}</strong><em>{s.source || s.kind} · {s.chars.toLocaleString()} characters</em></span>
                {s.has_file && (
                  <label className="kn-share" title="Visitors can ask to receive this file by email (turn on in the Emails tab)">
                    <span className="cz-switch"><input type="checkbox" checked={s.shareable} onChange={(e) => run("share", () => api(apiBase, `${base}/${s.id}`, json({ shareable: e.target.checked }, "PATCH")))} /><span /></span>
                    <span>Email to visitors</span>
                  </label>
                )}
                <button type="button" className="delete-chat" style={{ opacity: 1 }} aria-label={`Remove ${s.title}`}
                  onClick={() => run("del", () => api(apiBase, `${base}/${s.id}`, { method: "DELETE" }))}><Trash2 size={14} /></button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ customize

const FIELD_TYPES = [["text", "Text"], ["phone", "Phone"], ["email", "Email"], ["select", "Choice"], ["date", "Date"], ["textarea", "Long text"]];

function CustomizeTab({ apiBase, agent, onAgent, onError }) {
  const [name, setName] = useState(agent.name);
  const [s, setS] = useState(agent.settings);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (patch) => setS((old) => ({ ...old, ...patch }));
  const setForm = (patch) => setS((old) => ({ ...old, form: { ...old.form, ...patch } }));
  const setField = (i, patch) => setForm({ fields: s.form.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  const save = async () => {
    setBusy(true);
    try {
      const updated = await api(apiBase, `/api/agents/${agent.id}`, json({ name, settings: s }, "PATCH"));
      onAgent(updated);
      setS(updated.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const questions = [...(s.suggested_questions || []), "", "", "", ""].slice(0, 4);

  return (
    <div className="ag-panel">
      <div className="ag-panel-head">
        <div><h3>Look & behaviour</h3><p>How your agent appears and talks on your website.</p></div>
        <motion.button type="button" className="rt-primary" onClick={save} disabled={busy} whileTap={{ scale: 0.97 }}>
          {busy ? <LoaderCircle size={16} className="spin" /> : saved ? <Check size={16} /> : <Palette size={16} />} {saved ? "Saved" : "Save changes"}
        </motion.button>
      </div>
      <div className="pf-grid">
        <label className="pf-f"><span>Agent name</span><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
        <label className="pf-f"><span>Brand colour</span>
          <div className="cz-color"><input type="color" value={s.color} onChange={(e) => set({ color: e.target.value })} /><code>{s.color}</code></div></label>
        <label className="pf-f"><span>Position</span>
          <select value={s.position} onChange={(e) => set({ position: e.target.value })}><option value="right">Bottom right</option><option value="left">Bottom left</option></select></label>
        <label className="pf-f"><span>Tone</span><input value={s.tone} onChange={(e) => set({ tone: e.target.value })} placeholder="friendly, formal, short…" /></label>
      </div>
      <AvatarPicker apiBase={apiBase} agent={agent} settings={s} onSettings={setS} onAgent={onAgent} onError={onError} />
      <label className="pf-f"><span>Widget language (buttons and labels; answers follow the visitor's language)</span>
        <select value={s.language || "en"} onChange={(e) => set({ language: e.target.value })}>
          <option value="en">English</option><option value="hi">हिन्दी (Hindi)</option><option value="te">తెలుగు (Telugu)</option><option value="ta">தமிழ் (Tamil)</option>
        </select></label>
      <label className="pf-f"><span>Welcome message</span><textarea rows={2} value={s.welcome_message} onChange={(e) => set({ welcome_message: e.target.value })} /></label>
      <label className="pf-f"><span>When the agent doesn't know</span><textarea rows={2} value={s.handoff_message} onChange={(e) => set({ handoff_message: e.target.value })} /></label>
      <div className="pf-sec"><h4>Suggested questions (shown as buttons)</h4>
        <div className="pf-grid">{questions.map((q, i) => (
          <input key={i} className="pf-input" value={q} placeholder={`Question ${i + 1}`} onChange={(e) => {
            const next = [...questions]; next[i] = e.target.value; set({ suggested_questions: next });
          }} />))}</div>
      </div>
      <div className="pf-sec">
        <div className="cz-form-head">
          <h4>Inquiry form</h4>
          <label className="cz-switch"><input type="checkbox" checked={s.form.enabled} onChange={(e) => setForm({ enabled: e.target.checked })} /><span /> {s.form.enabled ? "On" : "Off"}</label>
        </div>
        {s.form.enabled && (
          <>
            <div className="cz-style">
              {[["card", "Form card", "A neat form appears in the chat"], ["chat", "Conversational", "The agent asks one question at a time"]].map(([value, label, hint]) => (
                <button key={value} type="button" className={`cz-opt ${s.form.style === value ? "on" : ""}`} onClick={() => setForm({ style: value })}>
                  <strong>{label}</strong><em>{hint}</em></button>
              ))}
            </div>
            <div className="pf-grid">
              <label className="pf-f"><span>Form title</span><input value={s.form.title} onChange={(e) => setForm({ title: e.target.value })} /></label>
              <label className="pf-f"><span>Button label</span><input value={s.form.button_label} onChange={(e) => setForm({ button_label: e.target.value })} /></label>
            </div>
            <label className="pf-f"><span>Thank-you message</span><input value={s.form.success_message} onChange={(e) => setForm({ success_message: e.target.value })} /></label>
            <div className="cz-fields">
              {s.form.fields.map((f, i) => (
                <div key={i} className="cz-field">
                  <input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="Field label" />
                  <select value={f.type} onChange={(e) => setField(i, { type: e.target.value })}>{FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <label className="cz-req"><input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> Required</label>
                  <button type="button" className="icon-btn" aria-label="Remove field" onClick={() => setForm({ fields: s.form.fields.filter((_, j) => j !== i) })}><X size={15} /></button>
                  {f.type === "select" && <input className="cz-options" value={(f.options || []).join(", ")} placeholder="Options, separated by commas"
                    onChange={(e) => setField(i, { options: e.target.value.split(",").map((o) => o.trim()) })} />}
                </div>
              ))}
              {s.form.fields.length < 10 && <button type="button" className="rt-ghost pf-add" onClick={() => setForm({ fields: [...s.form.fields, { label: "", type: "text", required: false }] })}><Plus size={14} /> Add field</button>}
            </div>
          </>
        )}
      </div>
      <AiKeyBox apiBase={apiBase} agent={agent} onAgent={onAgent} onError={onError} />
    </div>
  );
}

// ------------------------------------------------------------------ test playground

function TestTab({ apiBase, agent, onError }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: agent.settings?.welcome_message || "Hi!" }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const ask = async (question) => {
    const message = (question ?? text).trim();
    if (!message || busy) return;
    setText("");
    const history = messages.slice(1).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "", pending: true }]);
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/api/agents/${agent.id}/test`, json({ message, history }));
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Test failed");
      let answer = "";
      await streamNdjson(res, (ev) => {
        if (ev.type === "token") answer += ev.content;
        if (ev.type === "final") answer = ev.content;
        if (ev.type === "error") throw new Error(ev.message);
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: answer.replace("[[SHOW_FORM]]", ""), pending: ev.type !== "final", form: ev.show_form }]);
      });
    } catch (e) {
      onError(e.message);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ag-panel ag-interview">
      <div className="ag-panel-head"><div><h3>Test your agent</h3><p>Ask what your customers would ask. Answers come only from your knowledge.</p></div>
        <button type="button" className="rt-ghost" onClick={() => setMessages((m) => m.slice(0, 1))}>Clear</button></div>
      <div className="iv-list" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`iv-msg ${m.role}`}>
            {m.role === "assistant" && <Orb size={28} still={!m.pending} state={m.pending ? "thinking" : "idle"} />}
            <div className="iv-bubble">
              {m.role === "assistant" ? (m.content ? <Markdown>{m.content}</Markdown> : <span className="shimmer">Thinking</span>) : m.content}
              {m.form && <div className="tt-form"><Inbox size={14} /> On your website, the inquiry form opens here.</div>}
            </div>
          </div>
        ))}
        {messages.length === 1 && (agent.settings?.suggested_questions || []).length > 0 && (
          <div className="chips-row">{agent.settings.suggested_questions.map((q) => <button key={q} type="button" className="kw-chip hit" onClick={() => ask(q)}>{q}</button>)}</div>
        )}
      </div>
      <form className="iv-composer" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask like a visitor…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} />
        <button type="submit" className="send-btn" disabled={!text.trim() || busy} aria-label="Send"><ArrowUp size={18} /></button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ install

function InstallTab({ apiBase, agent, onAgent, onError }) {
  const [domains, setDomains] = useState(agent.allowed_domains || []);
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${window.location.origin}/widget.js" data-agent="${agent.public_key}" data-api="${apiBase}" async></script>`;
  const preview = `${window.location.origin}/widget-demo.html?agent=${agent.public_key}&api=${encodeURIComponent(apiBase)}&name=${encodeURIComponent(agent.business_name)}`;

  const patch = async (body) => {
    setBusy(true);
    try {
      const updated = await api(apiBase, `/api/agents/${agent.id}`, json(body, "PATCH"));
      onAgent(updated);
      setDomains(updated.allowed_domains);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  };
  const live = agent.status === "live";

  return (
    <div className="ag-panel">
      <div className="ag-panel-head"><div><h3>Add it to your website</h3><p>Three steps: allow your domain, go live, paste one line of code.</p></div>
        <a className="rt-ghost" href={preview} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Preview on a sample page</a></div>

      <div className="in-step"><span className="in-num">1</span><div>
        <h4>Websites allowed to use this agent</h4>
        <p>The agent only works on these domains (subdomains included).</p>
        <div className="in-domains">
          {domains.map((d) => (
            <span key={d} className="kw-chip hit">{d}<button type="button" aria-label={`Remove ${d}`} onClick={() => patch({ allowed_domains: domains.filter((x) => x !== d) })}><X size={12} /></button></span>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); if (domain.trim()) { patch({ allowed_domains: [...domains, domain.trim()] }); setDomain(""); } }}>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourbusiness.com" /><button className="rt-ghost" disabled={!domain.trim() || busy}><Plus size={14} /> Add</button>
          </form>
        </div>
      </div></div>

      <div className="in-step"><span className="in-num">2</span><div>
        <h4>Go live</h4>
        <p>{live ? "Your agent is live on the allowed websites." : "While in draft, the agent only works in previews."}</p>
        <motion.button type="button" className={live ? "rt-ghost" : "rt-primary"} disabled={busy || agent.disabled} onClick={() => patch({ status: live ? "draft" : "live" })} whileTap={{ scale: 0.97 }}>
          {busy ? <LoaderCircle size={15} className="spin" /> : <Rocket size={15} />} {live ? "Switch back to draft" : "Go live"}
        </motion.button>
      </div></div>

      <div className="in-step"><span className="in-num">3</span><div>
        <h4>Paste this code before <code>&lt;/body&gt;</code> on every page</h4>
        <div className="in-code"><code>{snippet}</code>
          <button type="button" className="rt-ghost" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}</button></div>
        <ul className="in-tips">
          <li><strong>WordPress:</strong> Appearance → Theme File Editor → footer.php (or a "header & footer scripts" plugin).</li>
          <li><strong>Wix:</strong> Settings → Custom code → Add code → Body - end, all pages.</li>
          <li><strong>Shopify:</strong> Online Store → Themes → Edit code → theme.liquid, before <code>&lt;/body&gt;</code>.</li>
          <li><strong>Any HTML site / React:</strong> paste it in your main HTML file before <code>&lt;/body&gt;</code>.</li>
        </ul>
      </div></div>
    </div>
  );
}

// ------------------------------------------------------------------ builder shell

const TABS = [
  ["setup", "Setup", Wand2], ["knowledge", "Knowledge", FileText], ["customize", "Customize", Palette],
  ["test", "Test", MessageSquareText], ["install", "Install", Code2], ["leads", "Leads", Inbox],
  ["inbox", "Inbox", HelpCircle], ["emails", "Emails", Mail], ["analytics", "Analytics", BarChart3],
];

function AgentBuilder({ apiBase, agent: initial, onBack, onError, onDeleted }) {
  const [agent, setAgent] = useState(initial);
  const [tab, setTab] = useState(initial.interview_done ? "test" : "setup");
  const [confirm, setConfirm] = useState(false);
  const props = { apiBase, agent, onAgent: setAgent, onError, goTo: setTab };

  const remove = async () => {
    try { await api(apiBase, `/api/agents/${agent.id}`, { method: "DELETE" }); onDeleted(); } catch (e) { onError(e.message); }
  };

  return (
    <div className="ag-builder">
      <div className="ag-top">
        <button type="button" className="rt-ghost" onClick={onBack}><ArrowLeft size={15} /> All agents</button>
        <div className="ag-title"><AgentAvatar agent={agent} />
          <div><strong>{agent.name}</strong><em>{agent.business_name}</em></div><StatusPill agent={agent} /></div>
        <button type="button" className="icon-btn" aria-label="Delete agent" title="Delete agent" onClick={() => setConfirm(true)}><Trash2 size={16} /></button>
      </div>
      <div className="ag-tabs" role="tablist">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
            {tab === key && <motion.span layoutId="ag-tab" className="ag-tab-bg" transition={spring} />}
            <span><Icon size={15} /> {label}</span>
          </button>
        ))}
      </div>
      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
        {tab === "setup" && <SetupTab {...props} />}
        {tab === "knowledge" && <KnowledgeTab {...props} />}
        {tab === "customize" && <CustomizeTab {...props} />}
        {tab === "test" && <TestTab {...props} />}
        {tab === "install" && <InstallTab {...props} />}
        {tab === "leads" && <LeadsTab {...props} />}
        {tab === "inbox" && <InboxTab {...props} />}
        {tab === "emails" && <EmailsTab {...props} />}
        {tab === "analytics" && <AnalyticsTab {...props} />}
      </motion.div>
      <AnimatePresence>
        {confirm && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { if (e.target === e.currentTarget) setConfirm(false); }}>
            <motion.div className="delete-dialog" role="alertdialog" initial={{ y: 30, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={spring}>
              <div className="delete-dialog-icon"><Trash2 size={20} /></div>
              <h2>Delete {agent.name}?</h2>
              <p>Its knowledge, conversations and leads are permanently deleted, and the widget stops working on your site.</p>
              <div className="delete-dialog-actions">
                <button className="dialog-cancel" type="button" autoFocus onClick={() => setConfirm(false)}>Cancel</button>
                <button className="dialog-delete" type="button" onClick={remove}>Delete agent</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AgentStudio({ apiBase, onError }) {
  const [open, setOpen] = useState(null);
  const [version, setVersion] = useState(0);
  return (
    <div className="agent-studio">
      {open
        ? <AgentBuilder key={open.id} apiBase={apiBase} agent={open} onError={onError}
            onBack={() => { setOpen(null); setVersion((v) => v + 1); }} onDeleted={() => { setOpen(null); setVersion((v) => v + 1); }} />
        : <AgentsHome key={version} apiBase={apiBase} onOpen={setOpen} onError={onError} />}
    </div>
  );
}
