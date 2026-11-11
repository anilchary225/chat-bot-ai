import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, MessageCircle, Smartphone, X } from "lucide-react";
import { keyHeaders, saveKey } from "../chatKeys";

function useCountdown(expiresAt) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(expiresAt) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return left;
}

/** "Continue on WhatsApp / Instagram" popover for the open chat. */
export default function ContinueOn({ api, chatId, channels, onLinked }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const panelRef = useRef(null);
  const left = useCountdown(data?.expires_at);

  useEffect(() => { setOpen(false); setData(null); }, [chatId]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === "Escape" || (event.type === "pointerdown" && !panelRef.current?.contains(event.target))) setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => { window.removeEventListener("keydown", close); window.removeEventListener("pointerdown", close); };
  }, [open]);

  const getCode = async () => {
    setError("");
    setData(null);
    try {
      const res = await fetch(`${api}/api/chats/${chatId}/link-code`, { method: "POST", headers: keyHeaders(chatId) });
      if (!res.ok) throw new Error();
      const json = await res.json();
      saveKey(chatId, json.key);
      setData(json);
      onLinked?.();
    } catch {
      setError("Couldn't create a link code. Try again.");
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && (!data || left === 0)) getCode();
  };

  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 1500); } catch { /* ignore */ }
  };

  const noneEnabled = data && !data.whatsapp.enabled && !data.instagram.enabled;
  const mm = String(Math.floor(left / 60)).padStart(1, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="continue-on" ref={panelRef}>
      <motion.button
        type="button"
        className={`continue-btn ${channels?.length ? "linked" : ""}`}
        onClick={toggle}
        aria-expanded={open}
        whileTap={{ scale: 0.94 }}
        title="Continue this chat on WhatsApp, Instagram or another device"
      >
        <Smartphone size={15} />
        <span className="continue-label">{channels?.length ? "Linked" : "Continue on…"}</span>
        {channels?.map((c) => <i key={c} className={`ch-dot ch-${c}`} />)}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="continue-panel"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <div className="cp-head">
              <strong>Continue this chat anywhere</strong>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            {error && <p className="cp-error">{error}</p>}
            {!data && !error && <p className="cp-loading"><LoaderCircle size={15} className="spin" /> Creating a link code…</p>}
            {data && (
              <>
                <p className="cp-text">Send this code to Zenoxi and the same conversation continues there. Everything stays in sync.</p>
                <motion.div className="cp-code" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                  {data.code.split("").map((ch, i) => (
                    <motion.span key={i} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}>{ch}</motion.span>
                  ))}
                </motion.div>
                <p className="cp-expiry">{left > 0 ? `Expires in ${mm}:${ss}` : <button type="button" className="cp-link" onClick={getCode}>Code expired. Get a new one</button>}</p>
                <div className="cp-apps">
                  {data.whatsapp.enabled && (
                    <a className="cp-app whatsapp" href={data.whatsapp.url} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={17} /> <span><strong>Open WhatsApp</strong><em>"link {data.code}" is pre-filled</em></span>
                    </a>
                  )}
                  {data.instagram.enabled && (
                    <a className="cp-app instagram" href={data.instagram.url} target="_blank" rel="noopener noreferrer"
                       onClick={() => copy(`link ${data.code}`, "ig")}>
                      <MessageCircle size={17} /> <span><strong>Open Instagram DM</strong><em>{copied === "ig" ? "Copied: paste and send" : `Send: link ${data.code}`}</em></span>
                    </a>
                  )}
                  {noneEnabled && <p className="cp-text">WhatsApp and Instagram aren't connected on the server yet. See README → Messaging apps.</p>}
                </div>
                <p className="cp-note">On another computer or phone? Just sign in, and this chat is already there.</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
