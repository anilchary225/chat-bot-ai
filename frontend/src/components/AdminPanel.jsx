import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, Ban, BarChart3, Bot, CheckCircle2, Clock, Inbox, KeyRound, LayoutDashboard, LoaderCircle, Mail,
  MailWarning, MessageSquareText, Play, RefreshCw, Search, Server, ShieldCheck, Sparkles, Trash2, UserCheck, Users, X, XCircle,
} from "lucide-react";

const spring = { type: "spring", stiffness: 340, damping: 30 };
const TABS = [
  ["overview", "Overview", LayoutDashboard],
  ["users", "Users", Users],
  ["agents", "Agents", Bot],
  ["emails", "Emails", Mail],
  ["system", "System", Server],
];

async function call(apiBase, path, options = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
  return data;
}

function ago(iso) {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
}

function Stat({ icon: Icon, label, value, sub, tone, delay = 0 }) {
  return (
    <motion.div className={`adm-stat ${tone || ""}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <span className="adm-icon"><Icon size={18} /></span>
      <strong>{value ?? "…"}</strong>
      <em>{label}</em>
      {sub && <small>{sub}</small>}
    </motion.div>
  );
}

function Loading() {
  return <div className="adm-loading"><LoaderCircle size={18} className="spin" /> Loading…</div>;
}

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

// ---------------------------------------------------------------- overview

const METRICS = [
  ["visitor_messages", "Visitor messages"],
  ["chat_messages", "Chat messages"],
  ["users", "New users"],
  ["leads", "Leads"],
];

function Overview({ apiBase, onError, goTo }) {
  const [o, setO] = useState(null);
  const [metric, setMetric] = useState("visitor_messages");
  const load = useCallback(() => call(apiBase, "/api/admin/overview").then(setO).catch((e) => onError(e.message)), [apiBase, onError]);
  useEffect(() => { load(); }, [load]);
  if (!o) return <Loading />;
  const max = Math.max(1, ...o.series.map((d) => d[metric]));
  const total = o.series.reduce((n, d) => n + d[metric], 0);
  return (
    <>
      <div className="adm-stats adm-six">
        <Stat icon={Users} label="Users" value={o.users} sub={`+${o.users_today} today · ${o.active_today} signed in today`} delay={0} />
        <Stat icon={MessageSquareText} label="Chats" value={o.chats} sub={`${o.chat_messages_today} messages today`} tone="amber" delay={0.04} />
        <Stat icon={Bot} label="Live agents" value={`${o.agents_live}/${o.agents}`} sub={o.agents_disabled ? `${o.agents_disabled} disabled` : "none disabled"} tone="ember" delay={0.08} />
        <Stat icon={Inbox} label="Leads" value={o.leads_total} sub={`${o.leads_today} today`} tone="mint" delay={0.12} />
        <Stat icon={BarChart3} label="Visitor messages today" value={o.messages_today} sub={`limit ${o.daily_message_limit} per agent`} delay={0.16} />
        <Stat icon={Sparkles} label="Answered free (14 days)" value={`${o.saved_percent_14d}%`} sub={`${o.free_answers_today} free today, no AI tokens`} tone="mint" delay={0.2} />
      </div>
      {o.emails_failed_today > 0 && (
        <button type="button" className="adm-alert" onClick={() => goTo("emails")}>
          <MailWarning size={16} /> {o.emails_failed_today} email{o.emails_failed_today === 1 ? "" : "s"} failed today. Open the email log →
        </button>
      )}
      {o.users_blocked > 0 && <p className="adm-note"><Ban size={14} /> {o.users_blocked} blocked user{o.users_blocked === 1 ? "" : "s"}.</p>}
      <div className="ag-panel">
        <div className="ag-panel-head">
          <div><h3>Last 14 days</h3><p>{total} {METRICS.find(([k]) => k === metric)[1].toLowerCase()} in total · busiest day {max === 1 && total === 0 ? 0 : max}.</p></div>
          <div className="ld-chips">
            {METRICS.map(([k, l]) => <button key={k} type="button" className={metric === k ? "on" : ""} onClick={() => setMetric(k)}>{l}</button>)}
          </div>
        </div>
        <div className="an-chart" role="img" aria-label={`${METRICS.find(([k]) => k === metric)[1]} per day`}>
          {o.series.map((d, i) => (
            <div key={d.day} className="an-col" title={`${d.day}: ${d[metric]}`}>
              <motion.span className="an-bar" initial={{ height: 0 }} animate={{ height: `${(d[metric] / max) * 100}%` }} transition={{ delay: i * 0.02, ...spring }}>
                {metric === "visitor_messages" && d.free_answers > 0 && <span className="an-free" style={{ height: `${(d.free_answers / Math.max(1, d.visitor_messages)) * 100}%` }} />}
              </motion.span>
              <em>{d.day.slice(8)}</em>
            </div>
          ))}
        </div>
        {metric === "visitor_messages" && <p className="an-legend"><i className="lg-msg" /> answered by AI <i className="lg-free" /> answered free (FAQ or cache)</p>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- users

function UserDrawer({ apiBase, userId, onClose, onChanged, onError }) {
  const [u, setU] = useState(null);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState("");
  const [asking, setAsking] = useState(false);
  const load = useCallback(() => call(apiBase, `/api/admin/users/${userId}`).then(setU).catch((e) => { onError(e.message); onClose(); }), [apiBase, userId, onError, onClose]);
  useEffect(() => { load(); }, [load]);

  const block = async () => {
    setBusy("block");
    try {
      await call(apiBase, `/api/admin/users/${userId}/block`, { method: "POST", body: JSON.stringify({ blocked: !u.blocked }) });
      await load(); onChanged();
    } catch (e) { onError(e.message); } finally { setBusy(""); }
  };
  const remove = async () => {
    setBusy("delete");
    try {
      await call(apiBase, `/api/admin/users/${userId}`, { method: "DELETE" });
      onChanged(); onClose();
    } catch (e) { onError(e.message); setBusy(""); }
  };

  return (
    <motion.div className="modal-backdrop ld-drawer-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.aside className="ld-drawer" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={spring}>
        <div className="ld-drawer-head"><h3>{u?.name || "User"}</h3><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={16} /></button></div>
        {!u ? <Loading /> : (
          <>
            <p className="adm-sub">{u.email} {u.is_admin && <span className="adm-badge admin">Admin</span>} {u.google && <span className="adm-badge">Google</span>} {u.blocked && <span className="adm-badge off">Blocked</span>}</p>
            <dl className="ld-fields">
              <div><dt>Joined</dt><dd>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</dd></div>
              <div><dt>Last sign-in</dt><dd>{ago(u.last_login)}</dd></div>
              <div><dt>Chats</dt><dd>{u.chats}</dd></div>
              <div><dt>Messages</dt><dd>{u.messages}</dd></div>
              <div><dt>Documents</dt><dd>{u.documents}</dd></div>
              <div><dt>Active sessions</dt><dd>{u.sessions}</dd></div>
            </dl>
            <h4 className="ld-conv-title"><Bot size={14} /> Website agents ({u.agent_list.length})</h4>
            {u.agent_list.length === 0 ? <p className="ag-empty">No agents.</p> : (
              <ul className="adm-list">{u.agent_list.map((a) => (
                <li key={a.id}><span><strong>{a.business_name}</strong><em>{a.name}</em></span>
                  <span>{a.disabled ? <span className="ag-pill off">Disabled</span> : <span className={`ag-pill ${a.status}`}>{a.status === "live" ? "● Live" : "Draft"}</span>} <b>{a.leads} leads</b></span></li>))}
              </ul>
            )}
            <h4 className="ld-conv-title"><MessageSquareText size={14} /> Recent chats</h4>
            {u.recent_chats.length === 0 ? <p className="ag-empty">No chats.</p> : (
              <ul className="adm-list">{u.recent_chats.map((c) => (
                <li key={c.id}><span><strong>{c.title}</strong><em>{c.channels.join(", ") || "web"}</em></span><span>{ago(c.updated_at)}</span></li>))}
              </ul>
            )}
            {!u.is_admin && (
              <div className="adm-actions">
                <button type="button" className={u.blocked ? "rt-ghost" : "rt-ghost adm-danger"} disabled={!!busy} onClick={block}>
                  {busy === "block" ? <LoaderCircle size={14} className="spin" /> : u.blocked ? <UserCheck size={14} /> : <Ban size={14} />} {u.blocked ? "Unblock" : "Block"}
                </button>
                <p className="adm-hint">{u.blocked ? "Unblocking lets them sign in again and restarts agents that the block paused." : "Blocking signs them out everywhere, stops sign-in and pauses their agents."}</p>
                {!asking ? (
                  <button type="button" className="rt-ghost adm-danger" onClick={() => setAsking(true)}><Trash2 size={14} /> Delete account and data</button>
                ) : (
                  <div className="adm-confirm">
                    <p><AlertTriangle size={14} /> This permanently deletes the account, {u.chats} chat{u.chats === 1 ? "" : "s"}, {u.agent_list.length} agent{u.agent_list.length === 1 ? "" : "s"} and all their leads. It can't be undone. Type <b>{u.email}</b> to confirm.</p>
                    <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={u.email} aria-label="Type the email to confirm" />
                    <div>
                      <button type="button" className="rt-ghost" onClick={() => { setAsking(false); setConfirm(""); }}>Cancel</button>
                      <button type="button" className="adm-delete" disabled={confirm.trim().toLowerCase() !== u.email.toLowerCase() || !!busy} onClick={remove}>
                        {busy === "delete" ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />} Delete forever
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </motion.aside>
    </motion.div>
  );
}

function UsersTab({ apiBase, onError }) {
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [more, setMore] = useState(false);
  const load = useCallback(() => {
    call(apiBase, `/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setData).catch((e) => onError(e.message));
  }, [apiBase, q, onError]);
  useEffect(() => { load(); }, [load]);
  const loadMore = async () => {
    setMore(true);
    try {
      const next = await call(apiBase, `/api/admin/users?skip=${data.users.length}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      setData((d) => ({ ...d, users: [...d.users, ...next.users] }));
    } catch (e) { onError(e.message); } finally { setMore(false); }
  };
  const close = useCallback(() => setOpen(null), []);
  return (
    <div className="ag-panel">
      <div className="ld-filters">
        <p className="adm-sub">{data ? `${data.total} user${data.total === 1 ? "" : "s"}` : "…"}</p>
        <label className="adm-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email…" /></label>
      </div>
      {!data ? <Loading /> : data.users.length === 0 ? <p className="ag-empty">No users found.</p> : (
        <div className="ld-wrap"><table className="ld-table">
          <thead><tr><th>User</th><th>Joined</th><th>Last sign-in</th><th>Chats</th><th>Agents</th><th>Status</th></tr></thead>
          <tbody>{data.users.map((u) => (
            <tr key={u.id} className={`adm-click ${u.blocked ? "adm-off" : ""}`} onClick={() => setOpen(u.id)}>
              <td><div className="adm-user"><span className="adm-av">{u.picture ? <img src={u.picture} alt="" referrerPolicy="no-referrer" /> : u.name[0]?.toUpperCase()}</span>
                <span><strong>{u.name}</strong><em>{u.email}</em></span></div></td>
              <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
              <td>{ago(u.last_login)}</td>
              <td>{u.chats}</td>
              <td>{u.agents}</td>
              <td>{u.is_admin ? <span className="adm-badge admin">Admin</span> : u.blocked ? <span className="adm-badge off">Blocked</span> : <span className="adm-badge ok">Active</span>}</td>
            </tr>))}
          </tbody>
        </table></div>
      )}
      {data && data.users.length < data.total && (
        <button type="button" className="rt-ghost adm-more" disabled={more} onClick={loadMore}>{more ? <LoaderCircle size={14} className="spin" /> : null} Load more</button>
      )}
      {createPortal(<AnimatePresence>{open && <UserDrawer apiBase={apiBase} userId={open} onClose={close} onChanged={load} onError={onError} />}</AnimatePresence>, document.body)}
    </div>
  );
}

// ---------------------------------------------------------------- agents

const AGENT_FILTERS = [["", "All"], ["live", "Live"], ["draft", "Draft"], ["disabled", "Disabled"]];

function AgentsTab({ apiBase, onError }) {
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    call(apiBase, `/api/admin/agents?${params}`).then(setRows).catch((e) => onError(e.message));
  }, [apiBase, q, status, onError]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (a) => {
    setBusy(a.id);
    try {
      await call(apiBase, `/api/admin/agents/${a.id}/status`, { method: "POST", body: JSON.stringify({ disabled: !a.disabled }) });
      load();
    } catch (e) { onError(e.message); } finally { setBusy(""); }
  };
  return (
    <div className="ag-panel">
      <div className="ld-filters">
        <div className="ld-chips">{AGENT_FILTERS.map(([k, l]) => <button key={k} type="button" className={status === k ? "on" : ""} onClick={() => setStatus(k)}>{l}</button>)}</div>
        <label className="adm-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search business, agent or domain…" /></label>
      </div>
      {!rows ? <Loading /> : rows.length === 0 ? <p className="ag-empty">No agents found.</p> : (
        <div className="ld-wrap"><table className="ld-table">
          <thead><tr><th>Agent</th><th>Owner</th><th>Domains</th><th>Status</th><th>Today</th><th>7 days</th><th>Leads</th><th /></tr></thead>
          <tbody>{rows.map((a) => (
            <tr key={a.id} className={a.disabled ? "adm-off" : ""}>
              <td><strong>{a.business_name}</strong><br /><em>{a.name}</em>{a.own_ai_key && <><br /><span className="adm-badge keep"><KeyRound size={11} /> Own AI key</span></>}</td>
              <td>{a.owner_email || "—"}</td>
              <td>{a.allowed_domains.join(", ") || "—"}</td>
              <td>{a.disabled
                ? <span className="ag-pill off" title={a.disabled_reason === "owner_blocked" ? "Paused because the owner is blocked" : "Disabled by admin"}>{a.disabled_reason === "owner_blocked" ? "Owner blocked" : "Disabled"}</span>
                : <span className={`ag-pill ${a.status}`}>{a.status === "live" ? "● Live" : "Draft"}</span>}</td>
              <td>{a.messages_today}<br /><em>{a.emails_today} emails</em></td>
              <td>{a.messages_7d}<br /><em>{a.free_7d} free</em></td>
              <td>{a.leads}</td>
              <td><button type="button" className={a.disabled ? "rt-ghost" : "rt-ghost adm-danger"} disabled={busy === a.id || a.disabled_reason === "owner_blocked"} onClick={() => toggle(a)}>
                {busy === a.id ? <LoaderCircle size={14} className="spin" /> : a.disabled ? <CheckCircle2 size={14} /> : <Ban size={14} />} {a.disabled ? "Enable" : "Disable"}
              </button></td>
            </tr>))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- emails

const EMAIL_FILTERS = [["", "All"], ["failed", "Failed"], ["sent", "Sent"], ["logged", "Logged only"], ["skipped", "Skipped"]];

function EmailsTab({ apiBase, onError }) {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState(null);
  useEffect(() => {
    setRows(null);
    call(apiBase, `/api/admin/emails${status ? `?status=${status}` : ""}`).then(setRows).catch((e) => onError(e.message));
  }, [apiBase, status, onError]);
  const ipProblem = useMemo(() => rows?.some((r) => r.status === "failed" && /ip address|authorised_ips/i.test(r.error)), [rows]);
  return (
    <div className="ag-panel">
      <div className="ld-filters">
        <div className="ld-chips">{EMAIL_FILTERS.map(([k, l]) => <button key={k} type="button" className={status === k ? "on" : ""} onClick={() => setStatus(k)}>{l}</button>)}</div>
        <p className="adm-sub">Latest 200 emails sent by website agents.</p>
      </div>
      {ipProblem && (
        <p className="adm-alert static"><MailWarning size={16} /> Brevo is rejecting emails from an unrecognised IP. In Brevo → Security → Authorised IPs, turn the allow-list off (Render's IPs change).</p>
      )}
      {!rows ? <Loading /> : rows.length === 0 ? <p className="ag-empty">No emails yet.</p> : (
        <div className="ld-wrap"><table className="ld-table">
          <thead><tr><th>When</th><th>Agent</th><th>Type</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
          <tbody>{rows.map((m) => (
            <tr key={m.id}>
              <td title={m.created_at}>{ago(m.created_at)}</td>
              <td>{m.agent}</td>
              <td>{(m.kind || "").replace(/_/g, " ")}</td>
              <td>{m.to}</td>
              <td>{m.subject}</td>
              <td><span className={`adm-badge ${m.status === "failed" ? "off" : m.status === "sent" ? "ok" : ""}`}>{m.status}</span>
                {m.error && <><br /><em className="adm-err">{m.error}</em></>}</td>
            </tr>))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- system

function SystemTab({ apiBase, onError }) {
  const [s, setS] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const load = useCallback(() => call(apiBase, "/api/admin/system").then(setS).catch((e) => onError(e.message)), [apiBase, onError]);
  useEffect(() => { load(); }, [load]);
  const run = async () => {
    setRunning(true);
    try {
      const r = await call(apiBase, "/api/admin/jobs/run", { method: "POST" });
      setResult(r.result); load();
    } catch (e) { onError(e.message); } finally { setRunning(false); }
  };
  if (!s) return <Loading />;
  return (
    <div className="adm-sys">
      <div className="ag-panel">
        <div className="ag-panel-head"><div><h3>Services</h3><p>What's configured on the server (values are never shown).</p></div></div>
        <ul className="adm-checks">{s.checks.map((c) => (
          <li key={c.name} className={c.ok ? "ok" : "warn"}>
            {c.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}<span><strong>{c.name}</strong><em>{c.detail}</em></span>
          </li>))}
        </ul>
      </div>
      <div className="ag-panel">
        <div className="ag-panel-head"><div><h3>Scheduled jobs</h3><p>Lead reports and follow-up emails.</p></div>
          <button type="button" className="rt-ghost" disabled={running} onClick={run}>{running ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />} Run now</button></div>
        <dl className="ld-fields">
          <div><dt>Last run</dt><dd><Clock size={13} /> {s.jobs.last_run ? ago(s.jobs.last_run) : "Not yet"}</dd></div>
          <div><dt>Started by</dt><dd>{{ loop: "Server loop", cron: "cron-job.org", admin: "You (Run now)" }[s.jobs.source] || "—"}</dd></div>
          <div><dt>Reports sent</dt><dd>{(result || s.jobs.result).reports ?? 0}</dd></div>
          <div><dt>Follow-ups sent</dt><dd>{(result || s.jobs.result).followups ?? 0}</dd></div>
        </dl>
        {result && <p className="adm-note"><CheckCircle2 size={14} /> Done: {result.reports} reports and {result.followups} follow-ups sent.</p>}
      </div>
      <div className="ag-panel">
        <div className="ag-panel-head"><div><h3>Limits and access</h3><p>Change these in Render → Environment.</p></div></div>
        <dl className="ld-fields">
          <div><dt>Messages / agent / day</dt><dd>{s.limits.agent_daily_messages}</dd></div>
          <div><dt>With own AI key</dt><dd>{s.limits.agent_daily_messages_own_key}</dd></div>
          <div><dt>Emails / agent / day</dt><dd>{s.limits.agent_daily_emails}</dd></div>
          <div><dt>API version</dt><dd>{s.version}</dd></div>
          <div className="wide"><dt>Admins</dt><dd>{s.admins.join(", ")}</dd></div>
        </dl>
      </div>
    </div>
  );
}

/** Platform admin dashboard (only for emails in ADMIN_EMAILS). */
export default function AdminPanel({ apiBase, onError }) {
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return TABS.some(([k]) => k === t) ? t : "overview";
  });
  const [refresh, setRefresh] = useState(0);
  const goTo = useCallback((t) => setTab(t), []);
  useEffect(() => {
    if (window.location.pathname === "/admin") {
      window.history.replaceState(null, "", tab === "overview" ? "/admin" : `/admin?tab=${tab}`);
    }
  }, [tab]);
  const props = { apiBase, onError, goTo };
  return (
    <div className="adm">
      <div className="adm-head">
        <div><span className="rt-badge"><ShieldCheck size={14} /> Admin</span><h1>Platform admin</h1>
          <p>Only admins can see this page.</p></div>
        <button type="button" className="rt-ghost" onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={15} /> Refresh</button>
      </div>
      <div className="ag-tabs adm-tabs" role="tablist">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
            {tab === key && <motion.span layoutId="adm-tab" className="ag-tab-bg" transition={spring} />}
            <span><Icon size={15} /> {label}</span>
          </button>
        ))}
      </div>
      <motion.div key={`${tab}-${refresh}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="adm-body">
        {tab === "overview" && <Overview {...props} />}
        {tab === "users" && <UsersTab {...props} />}
        {tab === "agents" && <AgentsTab {...props} />}
        {tab === "emails" && <EmailsTab {...props} />}
        {tab === "system" && <SystemTab {...props} />}
      </motion.div>
    </div>
  );
}
