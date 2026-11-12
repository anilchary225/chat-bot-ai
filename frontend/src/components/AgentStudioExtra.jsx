import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Bot, Check, Download, FileSpreadsheet, HelpCircle, ImagePlus, Inbox, KeyRound, LoaderCircle, Mail,
  MessageSquareText, Send, Sparkles, StickyNote, Trash2, TrendingUp, X, Zap
} from "lucide-react";
import Markdown from "./Markdown";

export async function api(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === "string" ? detail : detail?.message || "Something went wrong.");
  }
  return data;
}
export const json = (body, method = "POST") => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const spring = { type: "spring", stiffness: 340, damping: 30 };

// ------------------------------------------------------------------ avatar

export function AgentAvatar({ agent, size = 38 }) {
  const a = agent.settings?.avatar || { type: "orb" };
  const color = agent.settings?.color || "#ff6a2b";
  const style = { width: size, height: size, background: color, fontSize: size * 0.42 };
  if (a.type === "image" && agent.avatar_url) return <span className="ag-av" style={style}><img src={agent.avatar_url} alt="" /></span>;
  if (a.type === "initials") return <span className="ag-av" style={style}>{a.initials || "AI"}</span>;
  if (a.type === "emoji") return <span className="ag-av emoji" style={{ ...style, fontSize: size * 0.55 }}>{a.emoji || "🤖"}</span>;
  return <span className="ag-av orb" style={style}><i /><i /></span>;
}

export function AvatarPicker({ apiBase, agent, settings, onSettings, onAgent, onError }) {
  const a = settings.avatar || { type: "orb", emoji: "🤖", initials: "AI" };
  const set = (patch) => onSettings({ ...settings, avatar: { ...a, ...patch } });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const upload = async (file) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const updated = await api(apiBase, `/api/agents/${agent.id}/avatar`, { method: "POST", body: form });
      onAgent(updated);
      onSettings({ ...settings, avatar: { ...a, type: "image" } });
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const preview = { ...agent, settings: { ...settings, avatar: a } };
  return (
    <div className="pf-sec">
      <h4>Avatar</h4>
      <div className="av-pick">
        <AgentAvatar agent={preview} size={56} />
        <div className="av-opts">
          {[["orb", "Orb"], ["initials", "Initials"], ["emoji", "Emoji"], ["image", "Your logo"]].map(([type, label]) => (
            <button key={type} type="button" className={`cz-opt av-opt ${a.type === type ? "on" : ""}`}
              onClick={() => (type === "image" && !agent.avatar_url ? fileRef.current?.click() : set({ type }))}>
              <strong>{label}</strong>
            </button>
          ))}
        </div>
      </div>
      {a.type === "initials" && <label className="pf-f av-input"><span>Initials (up to 3)</span><input maxLength={3} value={a.initials || ""} onChange={(e) => set({ initials: e.target.value.toUpperCase() })} /></label>}
      {a.type === "emoji" && (
        <div className="av-emojis">{["🤖", "🎓", "💼", "🍕", "💇", "🏥", "🏠", "🛍️", "✈️", "💪", "📚", "☕"].map((e) => (
          <button key={e} type="button" className={a.emoji === e ? "on" : ""} onClick={() => set({ emoji: e })}>{e}</button>))}</div>
      )}
      <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) upload(f); }} />
      {(a.type === "image" || agent.avatar_url) && (
        <button type="button" className="rt-ghost pf-add" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <LoaderCircle size={14} className="spin" /> : <ImagePlus size={14} />} {agent.avatar_url ? "Replace logo" : "Upload logo"} (PNG, JPG or WebP, up to 1 MB)
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ own AI key

export function AiKeyBox({ apiBase, agent, onAgent, onError }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api(apiBase, `/api/agents/${agent.id}/ai-key`, json({ key }, "PUT"));
      onAgent(await api(apiBase, `/api/agents/${agent.id}`));
      setKey("");
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api(apiBase, `/api/agents/${agent.id}/ai-key`, { method: "DELETE" });
      onAgent(await api(apiBase, `/api/agents/${agent.id}`));
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="pf-sec ai-key">
      <h4>AI usage</h4>
      <p className="ai-key-note">
        {agent.own_ai_key
          ? <>Using <b>your own OpenRouter key</b> (…{agent.ai_key_last4}): up to 2,000 visitor messages a day.</>
          : <>Using Zenoxi's shared free AI: up to 100 visitor messages a day. Add your own OpenRouter key for more (stored encrypted).</>}
      </p>
      {agent.own_ai_key
        ? <button type="button" className="rt-ghost" onClick={remove} disabled={busy}><Trash2 size={14} /> Remove my key</button>
        : (
          <div className="kn-row">
            <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-or-…" />
            <button type="button" className="rt-primary" onClick={save} disabled={busy || key.trim().length < 20}>{busy ? <LoaderCircle size={15} className="spin" /> : <KeyRound size={15} />} Save</button>
          </div>
        )}
    </div>
  );
}

// ------------------------------------------------------------------ leads

const STATUSES = [["new", "New"], ["contacted", "Contacted"], ["interested", "Interested"], ["won", "Won"], ["lost", "Lost"]];

async function download(apiBase, path, filename) {
  const res = await fetch(`${apiBase}${path}`);
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (res.headers.get("content-disposition") || "").match(/filename="([^"]+)"/)?.[1] || filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LeadsTab({ apiBase, agent, onError }) {
  const [leads, setLeads] = useState(null);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [exporting, setExporting] = useState("");
  const base = `/api/agents/${agent.id}/leads`;

  useEffect(() => { api(apiBase, base).then(setLeads).catch((e) => { setLeads([]); onError(e.message); }); }, [apiBase, base, onError]);

  const fields = agent.settings?.form?.fields || [];
  const keys = [...new Set([...fields.map((f) => f.key), ...(leads || []).flatMap((l) => Object.keys(l.fields))])].slice(0, 4);
  const label = (k) => fields.find((f) => f.key === k)?.label || k;
  const shown = (leads || []).filter((l) => (status === "all" || l.status === status)
    && (!query || JSON.stringify(l.fields).toLowerCase().includes(query.toLowerCase())));

  const patch = async (lead, body) => {
    try {
      const updated = await api(apiBase, `${base}/${lead.id}`, json(body, "PATCH"));
      setLeads((all) => all.map((l) => (l.id === lead.id ? updated : l)));
      if (open?.id === lead.id) setOpen(updated);
    } catch (e) { onError(e.message); }
  };
  const remove = async (lead) => {
    try {
      await api(apiBase, `${base}/${lead.id}`, { method: "DELETE" });
      setLeads((all) => all.filter((l) => l.id !== lead.id));
      setOpen(null);
    } catch (e) { onError(e.message); }
  };
  const openLead = async (lead) => {
    setOpen(lead);
    setConversation(null);
    if (lead.conversation_id) {
      try { setConversation(await api(apiBase, `/api/agents/${agent.id}/conversations/${lead.conversation_id}`)); } catch { setConversation({ messages: [] }); }
    }
  };
  const exportAs = async (format) => {
    setExporting(format);
    try { await download(apiBase, `${base}/export?format=${format}${status !== "all" ? `&status=${status}` : ""}`, `leads.${format}`); }
    catch (e) { onError(e.message); } finally { setExporting(""); }
  };
  const counts = Object.fromEntries(STATUSES.map(([s]) => [s, (leads || []).filter((l) => l.status === s).length]));

  return (
    <div className="ag-panel">
      <div className="ag-panel-head">
        <div><h3>Leads</h3><p>Inquiries from your website. Track them from new to won.</p></div>
        <div className="ld-actions">
          <button type="button" className="rt-primary" onClick={() => exportAs("xlsx")} disabled={!leads?.length || Boolean(exporting)}>
            {exporting === "xlsx" ? <LoaderCircle size={15} className="spin" /> : <FileSpreadsheet size={15} />} Excel</button>
          <button type="button" className="rt-ghost" onClick={() => exportAs("csv")} disabled={!leads?.length || Boolean(exporting)}>
            {exporting === "csv" ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />} CSV</button>
        </div>
      </div>
      <div className="ld-filters">
        <div className="ld-chips">
          <button type="button" className={status === "all" ? "on" : ""} onClick={() => setStatus("all")}>All <b>{leads?.length ?? 0}</b></button>
          {STATUSES.map(([s, l]) => <button key={s} type="button" className={`${status === s ? "on" : ""} st-${s}`} onClick={() => setStatus(s)}>{l} <b>{counts[s]}</b></button>)}
        </div>
        <input className="ld-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads…" />
      </div>
      {leads === null && <LoaderCircle className="spin" size={18} />}
      {leads?.length === 0 && <p className="ag-empty"><Inbox size={16} /> No inquiries yet. They'll appear here as visitors send them.</p>}
      {shown.length > 0 && (
        <div className="ld-wrap"><table className="ld-table ld-click">
          <thead><tr><th>Date</th>{keys.map((k) => <th key={k}>{label(k)}</th>)}<th>Summary</th><th>Status</th></tr></thead>
          <tbody>{shown.map((l) => (
            <tr key={l.id} onClick={() => openLead(l)}>
              <td>{new Date(l.created_at).toLocaleDateString()}<br /><em>{new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</em></td>
              {keys.map((k) => <td key={k}>{l.fields[k] || "—"}</td>)}
              <td className="ld-sum">{l.summary || <em>—</em>}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <select className={`ld-status st-${l.status}`} value={l.status} onChange={(e) => patch(l, { status: e.target.value })}>
                  {STATUSES.map(([s, lbl]) => <option key={s} value={s}>{lbl}</option>)}
                </select>
              </td>
            </tr>))}
          </tbody>
        </table></div>
      )}
      {createPortal(
      <AnimatePresence>
          {open && (
            <motion.div className="modal-backdrop ld-drawer-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
              <motion.aside className="ld-drawer" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={spring}>
                <div className="ld-drawer-head"><h3>{open.fields.name || "Lead"}</h3><button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(null)}><X size={16} /></button></div>
                <dl className="ld-fields">{Object.entries(open.fields).map(([k, v]) => <div key={k}><dt>{label(k)}</dt><dd>{v}</dd></div>)}
                  <div><dt>Page</dt><dd>{open.page_url || "—"}</dd></div><div><dt>Consent</dt><dd>{open.consent ? "Yes" : "No"}</dd></div></dl>
                {open.summary && <p className="ld-summary"><Sparkles size={14} /> {open.summary}</p>}
                <label className="pf-f"><span>Status</span>
                  <select value={open.status} onChange={(e) => patch(open, { status: e.target.value })}>{STATUSES.map(([s, l]) => <option key={s} value={s}>{l}</option>)}</select></label>
                <label className="pf-f"><span>Notes</span>
                  <textarea rows={3} defaultValue={open.notes} onBlur={(e) => e.target.value !== open.notes && patch(open, { notes: e.target.value })} placeholder="Called on Monday, wants weekend batch…" /></label>
                <h4 className="ld-conv-title">Conversation</h4>
                <div className="ld-conv">
                  {!open.conversation_id && <em>No chat before this inquiry.</em>}
                  {open.conversation_id && !conversation && <LoaderCircle size={16} className="spin" />}
                  {conversation?.messages?.map((m, i) => <div key={i} className={`ld-msg ${m.role}`}>{m.role === "assistant" ? <Markdown>{m.content}</Markdown> : m.content}</div>)}
                </div>
                <button type="button" className="rt-ghost adm-danger" onClick={() => remove(open)}><Trash2 size={14} /> Delete lead</button>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

// ------------------------------------------------------------------ emails

const PLACEHOLDERS = "{name}, {business}, and any form field key, e.g. {phone}, {interest}, {date}";

export function EmailsTab({ apiBase, agent, onAgent, onError }) {
  const [e, setE] = useState(agent.settings.emails);
  const [log, setLog] = useState(null);
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState(false);
  const set = (patch) => setE((old) => ({ ...old, ...patch }));
  const setFu = (patch) => setE((old) => ({ ...old, followup: { ...old.followup, ...patch } }));
  const loadLog = useCallback(() => api(apiBase, `/api/agents/${agent.id}/emails`).then(setLog).catch(() => setLog([])), [apiBase, agent.id]);
  useEffect(() => { loadLog(); }, [loadLog]);

  const save = async () => {
    setBusy("save");
    try {
      const updated = await api(apiBase, `/api/agents/${agent.id}`, json({ settings: { emails: e } }, "PATCH"));
      onAgent(updated);
      setE(updated.settings.emails);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (err) { onError(err.message); } finally { setBusy(""); }
  };
  const sendReport = async () => {
    setBusy("report");
    try { await api(apiBase, `/api/agents/${agent.id}/report/send`, { method: "POST" }); await loadLog(); }
    catch (err) { onError(err.message); } finally { setBusy(""); }
  };
  const Toggle = ({ checked, onChange, title, hint }) => (
    <label className="em-toggle">
      <span className="cz-switch"><input type="checkbox" checked={checked} onChange={(ev) => onChange(ev.target.checked)} /><span /></span>
      <span><strong>{title}</strong><em>{hint}</em></span>
    </label>
  );

  return (
    <div className="ag-panel">
      <div className="ag-panel-head">
        <div><h3>Email permissions</h3><p>Choose exactly what your agent may email. Everything you switch off stays off.</p></div>
        <motion.button type="button" className="rt-primary" onClick={save} disabled={Boolean(busy)} whileTap={{ scale: 0.97 }}>
          {busy === "save" ? <LoaderCircle size={16} className="spin" /> : saved ? <Check size={16} /> : <Mail size={16} />} {saved ? "Saved" : "Save"}
        </motion.button>
      </div>
      <Toggle checked={e.notify_owner} onChange={(v) => set({ notify_owner: v })} title="Email me about every new lead" hint="Instant alert with the details and an AI summary of the chat." />
      {e.notify_owner && <label className="pf-f em-indent"><span>Send alerts to (empty = your account email)</span><input type="email" value={e.owner_email} onChange={(ev) => set({ owner_email: ev.target.value })} placeholder="you@business.com" /></label>}
      <Toggle checked={e.visitor_confirmation} onChange={(v) => set({ visitor_confirmation: v })} title="Send the visitor a confirmation" hint="Only when they gave an email and ticked consent. Replies come to you." />
      {e.visitor_confirmation && (
        <div className="em-indent">
          <label className="pf-f"><span>Subject</span><input value={e.confirmation_subject} onChange={(ev) => set({ confirmation_subject: ev.target.value })} /></label>
          <label className="pf-f"><span>Message</span><textarea rows={5} value={e.confirmation_body} onChange={(ev) => set({ confirmation_body: ev.target.value })} /></label>
          <p className="em-hint">Placeholders: {PLACEHOLDERS}. An unsubscribe link is added automatically.</p>
        </div>
      )}
      <Toggle checked={e.send_documents} onChange={(v) => set({ send_documents: v })} title="Let visitors request your documents" hint="Brochures or price lists marked “Email to visitors” in Knowledge are attached to the confirmation." />
      <Toggle checked={e.followup.enabled} onChange={(v) => setFu({ enabled: v })} title="Send one follow-up" hint="If a lead is still New or Contacted after a few days. Sent once, never to unsubscribed people." />
      {e.followup.enabled && (
        <div className="em-indent">
          <label className="pf-f em-days"><span>After how many days?</span><input type="number" min={1} max={30} value={e.followup.days} onChange={(ev) => setFu({ days: Number(ev.target.value) || 3 })} /></label>
          <label className="pf-f"><span>Subject</span><input value={e.followup.subject} onChange={(ev) => setFu({ subject: ev.target.value })} /></label>
          <label className="pf-f"><span>Message</span><textarea rows={4} value={e.followup.body} onChange={(ev) => setFu({ body: ev.target.value })} /></label>
        </div>
      )}
      <div className="em-report">
        <div><strong>Lead report with Excel file</strong><em>Emailed to you with every lead attached.</em></div>
        <select value={e.report} onChange={(ev) => set({ report: ev.target.value })}><option value="off">Off</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
        <button type="button" className="rt-ghost" onClick={sendReport} disabled={Boolean(busy)}>{busy === "report" ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />} Send one now</button>
      </div>
      <h4 className="ld-conv-title">Email log</h4>
      {log === null && <LoaderCircle size={16} className="spin" />}
      {log?.length === 0 && <p className="ag-empty">No emails sent yet.</p>}
      {log?.length > 0 && (
        <div className="ld-wrap"><table className="ld-table">
          <thead><tr><th>When</th><th>Type</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
          <tbody>{log.map((m) => (
            <tr key={m.id}><td>{new Date(m.created_at).toLocaleString()}</td><td>{m.kind.replace("_", " ")}</td><td>{m.to}</td><td>{m.subject}</td>
              <td><span className={`em-st ${m.status}`} title={m.error}>{m.status === "logged" ? "logged (no email service)" : m.status}</span></td></tr>))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ unanswered inbox

export function InboxTab({ apiBase, agent, onError }) {
  const [items, setItems] = useState(null);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState("");
  const base = `/api/agents/${agent.id}/unanswered`;
  useEffect(() => { api(apiBase, base).then(setItems).catch((e) => { setItems([]); onError(e.message); }); }, [apiBase, base, onError]);
  const teach = async (item) => {
    setBusy(item.id);
    try {
      await api(apiBase, `${base}/${encodeURIComponent(item.id)}/answer`, json({ answer: answers[item.id] }));
      setItems((all) => all.filter((x) => x.id !== item.id));
    } catch (e) { onError(e.message); } finally { setBusy(""); }
  };
  const dismiss = async (item) => {
    try { await api(apiBase, `${base}/${encodeURIComponent(item.id)}`, { method: "DELETE" }); setItems((all) => all.filter((x) => x.id !== item.id)); }
    catch (e) { onError(e.message); }
  };
  return (
    <div className="ag-panel">
      <div className="ag-panel-head"><div><h3>Unanswered questions</h3><p>Visitors asked these and your agent didn't know. Answer once and it knows from now on.</p></div></div>
      {items === null && <LoaderCircle size={18} className="spin" />}
      {items?.length === 0 && <p className="ag-empty"><Check size={16} /> Nothing waiting. Your agent answered everything.</p>}
      <AnimatePresence initial={false}>
        {items?.map((item) => (
          <motion.div key={item.id} layout className="ib-item" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}>
            <div className="ib-q"><HelpCircle size={16} /><strong>{item.question}</strong><span className="ib-count">asked {item.count}×</span></div>
            <textarea rows={2} value={answers[item.id] || ""} onChange={(e) => setAnswers({ ...answers, [item.id]: e.target.value })} placeholder="Type the answer your agent should give…" />
            <div className="ib-actions">
              <button type="button" className="rt-primary" disabled={!answers[item.id]?.trim() || busy === item.id} onClick={() => teach(item)}>
                {busy === item.id ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />} Teach my agent</button>
              <button type="button" className="rt-ghost" onClick={() => dismiss(item)}>Dismiss</button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ analytics

export function AnalyticsTab({ apiBase, agent, onError }) {
  const [data, setData] = useState(null);
  useEffect(() => { api(apiBase, `/api/agents/${agent.id}/analytics?days=14`).then(setData).catch((e) => onError(e.message)); }, [apiBase, agent.id, onError]);
  if (!data) return <div className="ag-panel"><LoaderCircle size={18} className="spin" /></div>;
  const max = Math.max(1, ...data.series.map((d) => d.messages));
  const t = data.totals;
  const cards = [
    [MessageSquareText, "Messages (14 days)", t.messages, ""],
    [Inbox, "Leads (14 days)", t.leads, "mint"],
    [TrendingUp, "Chats that became leads", `${t.conversion}%`, "amber"],
    [Zap, "Answered free (no AI tokens)", `${t.saved_percent}%`, "ember"],
  ];
  return (
    <div className="ag-panel">
      <div className="ag-panel-head"><div><h3>Analytics</h3><p>Last 14 days. Daily limit: {data.daily_limit} visitor messages.</p></div></div>
      <div className="adm-stats">{cards.map(([Icon, label, value, tone], i) => (
        <motion.div key={label} className={`adm-stat ${tone}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <span className="adm-icon"><Icon size={18} /></span><strong>{value}</strong><em>{label}</em></motion.div>))}</div>
      <h4 className="ld-conv-title"><BarChart3 size={14} /> Messages per day</h4>
      <div className="an-chart" role="img" aria-label="Messages per day">
        {data.series.map((d, i) => (
          <div key={d.day} className="an-col" title={`${d.day}: ${d.messages} messages, ${d.cached} free, ${d.leads} leads`}>
            <motion.span className="an-bar" initial={{ height: 0 }} animate={{ height: `${(d.messages / max) * 100}%` }} transition={{ delay: i * 0.02, ...spring }}>
              {d.cached > 0 && <span className="an-free" style={{ height: `${(d.cached / Math.max(1, d.messages)) * 100}%` }} />}
            </motion.span>
            {d.leads > 0 && <span className="an-lead">{d.leads}</span>}
            <em>{d.day.slice(8)}</em>
          </div>))}
      </div>
      <p className="an-legend"><i className="lg-msg" /> AI answers <i className="lg-free" /> answered free (FAQ or cache) <i className="lg-lead" /> leads</p>
      <div className="an-two">
        <div>
          <h4 className="ld-conv-title">Leads by status</h4>
          {Object.entries(data.leads_by_status).map(([s, n]) => (
            <div key={s} className="an-row"><span className={`ld-status st-${s}`}>{s}</span><span className="an-track"><span style={{ width: `${(n / Math.max(1, ...Object.values(data.leads_by_status))) * 100}%` }} /></span><b>{n}</b></div>))}
        </div>
        <div>
          <h4 className="ld-conv-title">Top questions</h4>
          {data.top_questions.length === 0 && <p className="ag-empty">No questions yet.</p>}
          <ol className="an-top">{data.top_questions.map((q) => <li key={q.question}><span>{q.question}</span><b>{q.count}</b></li>)}</ol>
          {data.unanswered_open > 0 && <p className="an-unans"><StickyNote size={14} /> {data.unanswered_open} unanswered question{data.unanswered_open === 1 ? "" : "s"} waiting in the Inbox tab.</p>}
        </div>
      </div>
    </div>
  );
}

export { Bot };
