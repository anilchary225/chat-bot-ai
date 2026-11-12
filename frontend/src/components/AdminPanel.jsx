import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Ban, Bot, CheckCircle2, Inbox, LoaderCircle, MessageSquareText, RefreshCw, ShieldCheck, Users } from "lucide-react";

async function get(apiBase, path, options) {
  const res = await fetch(`${apiBase}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
  return data;
}

function Stat({ icon: Icon, label, value, tone, delay }) {
  return (
    <motion.div className={`adm-stat ${tone || ""}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <span className="adm-icon"><Icon size={18} /></span>
      <strong>{value ?? "…"}</strong>
      <em>{label}</em>
    </motion.div>
  );
}

/** Platform admin view: usage across all agents, with the ability to disable abusive ones. */
export default function AdminPanel({ apiBase, onError }) {
  const [overview, setOverview] = useState(null);
  const [agents, setAgents] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const [o, a] = await Promise.all([get(apiBase, "/api/admin/overview"), get(apiBase, "/api/admin/agents")]);
      setOverview(o);
      setAgents(a);
    } catch (e) {
      onError(e.message);
    }
  }, [apiBase, onError]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (agent) => {
    setBusy(agent.id);
    try {
      await get(apiBase, `/api/admin/agents/${agent.id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disabled: !agent.disabled }),
      });
      await load();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="adm">
      <div className="adm-head">
        <div><span className="rt-badge"><ShieldCheck size={14} /> Admin</span><h1>Platform overview</h1>
          <p>Only you can see this page. Daily message limit per agent: {overview?.daily_message_limit ?? "…"}.</p></div>
        <button type="button" className="rt-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      <div className="adm-stats">
        <Stat icon={Users} label="Users" value={overview?.users} delay={0} />
        <Stat icon={Bot} label="Agents" value={overview && `${overview.agents_live}/${overview.agents}`} tone="ember" delay={0.05} />
        <Stat icon={MessageSquareText} label="Visitor messages today" value={overview?.messages_today} tone="amber" delay={0.1} />
        <Stat icon={Inbox} label="Leads today / total" value={overview && `${overview.leads_today} / ${overview.leads_total}`} tone="mint" delay={0.15} />
        <Stat icon={Ban} label="Disabled agents" value={overview?.agents_disabled} delay={0.2} />
      </div>
      <div className="ag-panel">
        <div className="ag-panel-head"><div><h3>All agents</h3><p>Newest first.</p></div></div>
        {agents === null && <LoaderCircle className="spin" size={18} />}
        {agents?.length === 0 && <p className="ag-empty">No agents yet.</p>}
        {agents?.length > 0 && (
          <div className="ld-wrap"><table className="ld-table">
            <thead><tr><th>Agent</th><th>Owner</th><th>Domains</th><th>Status</th><th>Today</th><th>Leads</th><th /></tr></thead>
            <tbody>{agents.map((a) => (
              <tr key={a.id} className={a.disabled ? "adm-off" : ""}>
                <td><strong>{a.name}</strong><br /><em>{a.business_name}</em></td>
                <td>{a.owner_email || "—"}</td>
                <td>{a.allowed_domains.join(", ") || "—"}</td>
                <td>{a.disabled ? <span className="ag-pill off">Disabled</span> : <span className={`ag-pill ${a.status}`}>{a.status === "live" ? "● Live" : "Draft"}</span>}</td>
                <td>{a.messages_today}</td>
                <td>{a.leads}</td>
                <td><button type="button" className={a.disabled ? "rt-ghost" : "rt-ghost adm-danger"} disabled={busy === a.id} onClick={() => toggle(a)}>
                  {busy === a.id ? <LoaderCircle size={14} className="spin" /> : a.disabled ? <CheckCircle2 size={14} /> : <Ban size={14} />} {a.disabled ? "Enable" : "Disable"}
                </button></td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
