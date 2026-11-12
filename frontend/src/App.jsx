import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence, LayoutGroup, MotionConfig, motion, useMotionValue, useSpring
} from "framer-motion";
import {
  Plus, MessageSquare, Trash2, ArrowUp, PanelLeftClose, PanelLeftOpen, LoaderCircle,
  Copy, Check, AlertCircle, Menu, X, Sun, Moon, Search, Lightbulb, Code2, Rocket, PenLine, ArrowDown, Globe, Info, Paperclip, Upload, Briefcase, LogOut, Bot, ShieldCheck
} from "lucide-react";
import Orb from "./components/Orb";
import Aurora from "./components/Aurora";
import Markdown from "./components/Markdown";
import Sources from "./components/Sources";
import ResumeTool from "./components/ResumeTool";
import AgentStudio from "./components/AgentStudio";
import AdminPanel from "./components/AdminPanel";
import ContinueOn from "./components/ContinueOn";
import { forgetKey, keyHeaders, listHeaders, saveKey } from "./chatKeys";
import { AttachmentChip, ACCEPT, MAX_FILE_BYTES, isSupported } from "./components/Attachments";

import { API } from "./config";

const MOBILE_QUERY = "(max-width: 700px)";
const spring = { type: "spring", stiffness: 380, damping: 32 };
const softSpring = { type: "spring", stiffness: 220, damping: 26 };

const SUGGESTIONS = [
  { icon: Lightbulb, title: "Explain it simply", text: "Explain a difficult topic in simple terms", tone: "ember" },
  { icon: Code2, title: "Write some code", text: "Help me write a Python script", tone: "amber" },
  { icon: Rocket, title: "Spark an idea", text: "Suggest ideas for a small app", tone: "sky" },
  { icon: PenLine, title: "Polish my words", text: "Rewrite this paragraph so it sounds clearer", tone: "mint" }
];
const VERBS = ["explain", "build", "write", "plan", "debug", "imagine"];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function groupChats(chats) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = start.getTime();
  const yesterday = today - 86400000;
  const week = today - 6 * 86400000;
  const groups = { Today: [], Yesterday: [], "This week": [], Earlier: [] };
  chats.forEach((chat) => {
    const t = new Date(chat.updated_at || chat.created_at || Date.now()).getTime();
    if (t >= today) groups.Today.push(chat);
    else if (t >= yesterday) groups.Yesterday.push(chat);
    else if (t >= week) groups["This week"].push(chat);
    else groups.Earlier.push(chat);
  });
  return Object.entries(groups).filter(([, list]) => list.length);
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => setMobile(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}

function TiltCard({ children, onClick, tone, index }) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });
  const ref = useRef(null);

  const onMove = (event) => {
    if (event.pointerType !== "mouse") return;
    const box = ref.current.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width;
    const py = (event.clientY - box.top) / box.height;
    ry.set((px - 0.5) * 12);
    rx.set((0.5 - py) * 12);
    ref.current.style.setProperty("--mx", `${px * 100}%`);
    ref.current.style.setProperty("--my", `${py * 100}%`);
  };
  const reset = () => { rx.set(0); ry.set(0); };

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`suggestion tone-${tone}`}
      style={{ rotateX: srx, rotateY: sry }}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...softSpring, delay: 0.35 + index * 0.07 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}

function Welcome({ onPick, name }) {
  const [verb, setVerb] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setVerb((v) => (v + 1) % VERBS.length), 2200);
    return () => clearInterval(id);
  }, []);
  const first = (name || "").split(" ")[0];
  const words = `${greeting()}${first ? `, ${first}` : ""}.`.split(" ");

  return (
    <div className="welcome">
      <motion.div
        className="welcome-orb"
        initial={{ opacity: 0, scale: 0.6, filter: "blur(12px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
      >
        <Orb size={112} track />
      </motion.div>

      <h1>
        <span className="greeting">
          {words.map((word, i) => (
            <motion.span
              key={word + i}
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
            >{word}&nbsp;</motion.span>
          ))}
        </span>
        <motion.span
          className="headline"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.5 }}
        >
          What should we{" "}
          <span className="verb-slot">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={VERBS[verb]}
                className="verb"
                initial={{ y: "70%", opacity: 0, filter: "blur(6px)" }}
                animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                exit={{ y: "-70%", opacity: 0, filter: "blur(6px)" }}
                transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
              >{VERBS[verb]}</motion.span>
            </AnimatePresence>
          </span>
          {" "}today?
        </motion.span>
      </h1>

      <motion.p
        className="welcome-subtitle"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
      >
        Ask anything, or start with one of these.
      </motion.p>

      <div className="suggestions">
        {SUGGESTIONS.map(({ icon: Icon, title, text, tone }, index) => (
          <TiltCard key={text} tone={tone} index={index} onClick={() => onPick(text)}>
            <span className="suggestion-icon"><Icon size={17} /></span>
            <span className="suggestion-copy">
              <strong>{title}</strong>
              <span>{text}</span>
            </span>
            <ArrowUp className="suggestion-arrow" size={15} aria-hidden="true" />
          </TiltCard>
        ))}
      </div>
    </div>
  );
}

function App({ user, onSignOut }) {
  const isMobile = useIsMobile();
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia(MOBILE_QUERY).matches);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("zenoxi-theme")
        || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    } catch { return "dark"; }
  });
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [query, setQuery] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [view, setView] = useState("chat");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragDepth = useRef(0);
  const [webSearch, setWebSearch] = useState(() => {
    try { return localStorage.getItem("zenoxi-web") === "1"; } catch { return false; }
  });
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem("zenoxi-web", webSearch ? "1" : "0"); } catch { /* ignore */ }
  }, [webSearch]);

  // Composer border glow follows streaming energy
  const energy = loading ? 1 : 0;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("zenoxi-theme", theme); } catch { /* ignore */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#faf7f2" : "#0b0a09");
  }, [theme]);

  useEffect(() => { setSidebarOpen(!isMobile); }, [isMobile]);

  useEffect(() => {
    if (!sidebarOpen || !isMobile) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKey = (event) => { if (event.key === "Escape") setSidebarOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [sidebarOpen, isMobile]);

  useEffect(() => {
    if (!deleteTarget) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setDeleteTarget(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTarget]);

  useEffect(() => {
    if (!error) return undefined;
    const id = setTimeout(() => setError(""), 7000);
    return () => clearTimeout(id);
  }, [error]);

  // Auto-grow composer
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const refreshChats = async () => {
    const res = await fetch(`${API}/api/chats`, { headers: listHeaders() });
    if (!res.ok) throw new Error("Could not load conversations");
    setChats(await res.json());
  };

  useEffect(() => {
    // A private link from WhatsApp/Instagram ("/web") looks like /?chat=ID&key=KEY.
    const params = new URLSearchParams(window.location.search);
    const linkedId = params.get("chat");
    if (linkedId && params.get("key")) {
      saveKey(linkedId, params.get("key"));
      window.history.replaceState(null, "", window.location.pathname);
      loadMessages(linkedId);
    }
    refreshChats().catch(() => setError("Couldn't connect to Zenoxi. Check your connection and try again."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = (behavior = "smooth") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useEffect(() => {
    if (atBottom && messages.length) scrollToBottom(loading ? "auto" : "smooth");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const loadMessages = async (id) => {
    setActiveId(id);
    setView("chat");
    setAttachments([]);
    setError("");
    setAtBottom(true);
    if (isMobile) setSidebarOpen(false);
    try {
      const res = await fetch(`${API}/api/chats/${id}/messages`, { headers: keyHeaders(id) });
      if (!res.ok) throw new Error();
      setMessages(await res.json());
    } catch {
      setError("Couldn't load that chat. Check your connection and try again.");
    }
  };

  const createChat = async () => {
    const res = await fetch(`${API}/api/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New chat" })
    });
    if (!res.ok) throw new Error();
    const chat = await res.json();
    setChats((old) => [chat, ...old]);
    setActiveId(chat.id);
    return chat;
  };

  const newChat = async () => {
    try {
      await createChat();
      setView("chat");
      setMessages([]);
      setAttachments([]);
      setError("");
      if (isMobile) setSidebarOpen(false);
      inputRef.current?.focus();
    } catch {
      setError("Couldn't start a chat. Check your connection and try again.");
    }
  };

  const newChatRef = useRef(newChat);
  newChatRef.current = newChat;
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        newChatRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const removeChat = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`${API}/api/chats/${target.id}`, { method: "DELETE", headers: keyHeaders(target.id) });
      if (!res.ok) throw new Error();
      forgetKey(target.id);
      setChats((old) => old.filter((chat) => chat.id !== target.id));
      if (activeId === target.id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch {
      setError("Couldn't delete that conversation. Try again.");
    }
  };

  const patchAttachment = (key, patch) =>
    setAttachments((old) => old.map((a) => (a.key === key ? { ...a, ...patch } : a)));

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let chatId = activeId;
    if (!chatId) {
      try {
        chatId = (await createChat()).id;
      } catch {
        setError("Couldn't start a chat. Check your connection and try again.");
        return;
      }
    }
    files.forEach(async (file, i) => {
      const key = `${Date.now()}-${i}-${file.name}`;
      const base = { key, filename: file.name, size: file.size };
      if (!isSupported(file.name)) {
        setAttachments((old) => [...old, { ...base, status: "error", error: "Unsupported file type" }]);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setAttachments((old) => [...old, { ...base, status: "error", error: "Larger than 10 MB" }]);
        return;
      }
      setAttachments((old) => [...old, { ...base, status: "uploading" }]);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${API}/api/chats/${chatId}/documents`, { method: "POST", body: form, headers: keyHeaders(chatId) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Couldn't read this file");
        patchAttachment(key, { status: "ready", ...data });
      } catch (err) {
        patchAttachment(key, { status: "error", error: err.message || "Upload failed" });
      }
    });
  };

  const removeAttachment = async (item) => {
    setAttachments((old) => old.filter((a) => a.key !== item.key));
    if (item.status === "ready" && activeId) {
      fetch(`${API}/api/chats/${activeId}/documents/${item.id}`, { method: "DELETE", headers: keyHeaders(activeId) }).catch(() => {});
    }
  };

  const onDragEnter = (event) => {
    if (view !== "chat" || !event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragging(false);
  };
  const onDrop = (event) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!loading) uploadFiles(event.dataTransfer.files);
  };

  const readyFiles = attachments.filter((a) => a.status === "ready");
  const uploading = attachments.some((a) => a.status === "uploading");
  const canSend = (input.trim() || readyFiles.length > 0) && !loading && !uploading;

  const send = async (event) => {
    event?.preventDefault();
    if (!canSend) return;
    const text = input.trim() || (readyFiles.length > 1
      ? "Please read the attached files and give me a short summary of each."
      : "Please read the attached file and give me a short summary.");
    const sentFiles = readyFiles.map(({ id, filename, kind, pages }) => ({ id, filename, kind, pages }));
    let chatId = activeId;

    if (!chatId) {
      try {
        chatId = (await createChat()).id;
      } catch {
        setError("Couldn't start a chat. Check your connection and try again.");
        return;
      }
    }

    setInput("");
    setAttachments([]);
    setError("");
    setLoading(true);
    setAtBottom(true);
    const stamp = Date.now();
    setMessages((old) => [...old,
      { id: `user-${stamp}`, role: "user", content: text, attachments: sentFiles },
      { id: `assistant-${stamp}`, role: "assistant", content: "", pending: true, stage: webSearch ? "searching" : "thinking", sources: [] }
    ]);

    try {
      const res = await fetch(`${API}/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: keyHeaders(chatId, { "Content-Type": "application/json" }),
        body: JSON.stringify({ content: text, web_search: webSearch, attachment_ids: sentFiles.map((f) => f.id) })
      });
      if (!res.ok || !res.body) throw new Error("AI request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      const patchLast = (patch) => setMessages((old) => {
        const copy = [...old];
        copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
        return copy;
      });

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === "token") {
            answer += evt.content;
            patchLast({ content: answer });
          } else if (evt.type === "status") {
            patchLast({ stage: evt.stage });
          } else if (evt.type === "sources") {
            patchLast({ sources: evt.sources, stage: "thinking" });
          } else if (evt.type === "notice") {
            patchLast({ notice: evt.message, stage: "thinking" });
          } else if (evt.type === "error") {
            throw new Error(evt.message);
          }
        }
      }

      await refreshChats();
      setMessages((old) => old.map((m) => (m.pending ? { ...m, pending: false } : m)));
    } catch (err) {
      setMessages((old) => old.filter((m) => !m.pending));
      setError(err.message || "Zenoxi couldn't get a reply. Try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const copyMessage = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  const activeChat = chats.find((chat) => chat.id === activeId);

  // Live sync: linked chats can get new messages from WhatsApp/Instagram.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => {
    if (!activeId || view !== "chat" || loading || !activeChat?.private) return undefined;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`${API}/api/chats/${activeId}/messages`, { headers: keyHeaders(activeId) });
        if (!res.ok) return;
        const fresh = await res.json();
        const current = messagesRef.current;
        if (fresh.length !== current.length || fresh.at(-1)?.content !== current.at(-1)?.content) {
          setMessages(fresh);
          refreshChats().catch(() => {});
        }
      } catch { /* offline: try again next tick */ }
    };
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, view, loading, activeChat?.private]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
  }, [chats, query]);
  const grouped = useMemo(() => groupChats(filtered), [filtered]);
  const expanded = sidebarOpen || isMobile;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const orbState = loading ? (lastAssistant?.content ? "streaming" : "thinking") : "idle";
  const searching = loading && !lastAssistant?.content && lastAssistant?.stage === "searching";

  const sidebarAnimate = isMobile
    ? { x: sidebarOpen ? 0 : "-105%" }
    : { x: 0, width: sidebarOpen ? 280 : 78 };

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <Aurora energy={energy} />

        <AnimatePresence>
          {isMobile && sidebarOpen && (
            <motion.button
              key="backdrop"
              className="sidebar-backdrop"
              type="button"
              aria-label="Close conversations menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        <motion.aside
          id="conversation-sidebar"
          className={`sidebar ${expanded ? "is-open" : "is-closed"}`}
          aria-label="Conversations"
          initial={false}
          animate={sidebarAnimate}
          transition={spring}
        >
          <div className="brand">
            <Orb size={40} state={orbState} />
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  className="brand-text"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <strong>Zenoxi</strong>
                  <span>your thinking partner</span>
                </motion.div>
              )}
            </AnimatePresence>
            {isMobile && (
              <button className="icon-btn sidebar-close-mobile" type="button" aria-label="Close conversations menu" onClick={() => setSidebarOpen(false)}>
                <X size={20} />
              </button>
            )}
          </div>

          <motion.button
            className="new-chat-btn"
            type="button"
            onClick={newChat}
            aria-label="Start a new chat"
            title="Start a new chat"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
          >
            <motion.span className="new-chat-plus" whileHover={{ rotate: 90 }} transition={spring}>
              <Plus size={18} />
            </motion.span>
            {expanded && <span>New chat</span>}
            {expanded && <kbd>⌘K</kbd>}
          </motion.button>

          <motion.button
            type="button"
            className={`tool-btn ${view === "resume" ? "active" : ""}`}
            onClick={() => { setView("resume"); if (isMobile) setSidebarOpen(false); }}
            aria-label="Open Resume ATS Match"
            title="Resume ATS Match"
            whileHover={{ x: expanded ? 2 : 0 }}
            whileTap={{ scale: 0.96 }}
          >
            <span className="tool-icon"><Briefcase size={16} /></span>
            {expanded && <span className="tool-text"><strong>Resume ATS Match</strong><em>Tailor to a job</em></span>}
          </motion.button>

          <motion.button
            type="button"
            className={`tool-btn tool-agents ${view === "agents" ? "active" : ""}`}
            onClick={() => { setView("agents"); if (isMobile) setSidebarOpen(false); }}
            aria-label="Open Website Agents"
            title="Website Agents"
            whileHover={{ x: expanded ? 2 : 0 }}
            whileTap={{ scale: 0.96 }}
          >
            <span className="tool-icon"><Bot size={16} /></span>
            {expanded && <span className="tool-text"><strong>Website Agents</strong><em>AI assistant for your site</em></span>}
          </motion.button>

          {user.is_admin && (
            <motion.button
              type="button"
              className={`tool-btn tool-admin ${view === "admin" ? "active" : ""}`}
              onClick={() => { setView("admin"); if (isMobile) setSidebarOpen(false); }}
              aria-label="Open admin dashboard"
              title="Admin"
              whileHover={{ x: expanded ? 2 : 0 }}
              whileTap={{ scale: 0.96 }}
            >
              <span className="tool-icon"><ShieldCheck size={16} /></span>
              {expanded && <span className="tool-text"><strong>Admin</strong><em>Platform overview</em></span>}
            </motion.button>
          )}

          {expanded && (
            <>
              <label className="search">
                <Search size={15} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search chats"
                  aria-label="Search chats"
                />
              </label>

              <div className="chat-list">
                <LayoutGroup>
                  {grouped.map(([label, list]) => (
                    <div className="chat-group" key={label}>
                      <div className="side-label">{label}</div>
                      <AnimatePresence initial={false}>
                        {list.map((chat) => {
                          const active = activeId === chat.id;
                          return (
                            <motion.div
                              layout
                              key={chat.id}
                              className={`chat-item-wrap ${active ? "active" : ""}`}
                              initial={{ opacity: 0, x: -16, height: 0 }}
                              animate={{ opacity: 1, x: 0, height: "auto" }}
                              exit={{ opacity: 0, x: -24, height: 0, transition: { duration: 0.2 } }}
                              transition={softSpring}
                            >
                              {active && <motion.div layoutId="active-chat" className="active-pill" transition={spring} />}
                              <button
                                className="chat-item"
                                type="button"
                                onClick={() => loadMessages(chat.id)}
                                title={chat.title}
                                aria-current={active ? "page" : undefined}
                              >
                                <MessageSquare size={15} aria-hidden="true" />
                                <span>{chat.title}</span>
                                {chat.channels?.map((c) => <i key={c} className={`ch-dot ch-${c}`} title={`Linked to ${c}`} />)}
                              </button>
                              <button
                                className="delete-chat"
                                type="button"
                                aria-label={`Delete ${chat.title}`}
                                title={`Delete ${chat.title}`}
                                onClick={() => setDeleteTarget(chat)}
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  ))}
                </LayoutGroup>
                {chats.length === 0 && <p className="empty-history">Your chats will appear here.</p>}
                {chats.length > 0 && filtered.length === 0 && <p className="empty-history">No chats match “{query}”.</p>}
              </div>
            </>
          )}

          <div className="sidebar-bottom">
            <div className="user-pill" title={user.email}>
              <span className="user-avatar">
                {user.picture
                  ? <img src={user.picture} alt="" referrerPolicy="no-referrer" />
                  : (user.name || user.email).trim()[0]?.toUpperCase()}
              </span>
              {expanded && (
                <span className="user-text"><strong>{user.name}</strong><em>{user.email}</em></span>
              )}
              {expanded && (
                <button type="button" className="user-logout" onClick={onSignOut} aria-label="Sign out" title="Sign out">
                  <LogOut size={15} />
                </button>
              )}
            </div>
            {!isMobile && (
              <button
                className="collapse-btn"
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
                {sidebarOpen && <span>Collapse</span>}
              </button>
            )}
          </div>
        </motion.aside>

        <main
          className="main-panel"
          onDragEnter={onDragEnter}
          onDragOver={(event) => { if (dragging) event.preventDefault(); }}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <AnimatePresence>
            {dragging && (
              <motion.div
                className="drop-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="drop-card"
                  initial={{ scale: 0.9, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95 }}
                  transition={spring}
                >
                  <motion.span
                    className="drop-icon"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Upload size={26} />
                  </motion.span>
                  <strong>Drop files to add them</strong>
                  <span>PDF, Word, TXT, Markdown, CSV, JSON or code · up to 10 MB</span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          <header className="topbar">
            <div className="topbar-title">
              {isMobile && (
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Open conversations menu"
                  aria-expanded={sidebarOpen}
                  aria-controls="conversation-sidebar"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu size={20} />
                </button>
              )}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={view !== "chat" ? view : activeChat?.title || "new"}
                  className="current-chat-title"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {{ resume: "Resume ATS Match", agents: "Website Agents", admin: "Admin" }[view] || activeChat?.title || "New conversation"}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="topbar-actions">
              {view === "chat" && activeId && (
                <ContinueOn
                  api={API}
                  chatId={activeId}
                  channels={activeChat?.channels}
                  onLinked={() => refreshChats().catch(() => {})}
                />
              )}
              <AnimatePresence>
                {loading && view === "chat" && (
                  <motion.div
                    className="live-chip"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <span className="eq"><i /><i /><i /><i /></span>
                    {searching ? "Searching" : orbState === "thinking" ? "Thinking" : "Writing"}
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.button
                className="icon-btn theme-toggle"
                type="button"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                whileTap={{ scale: 0.88 }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={theme}
                    initial={{ rotate: -120, opacity: 0, scale: 0.5 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 120, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.25 }}
                    style={{ display: "grid" }}
                  >
                    {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </div>
          </header>

          {view === "resume" ? (
            <section className="conversation tool-view">
              <ResumeTool api={API} />
            </section>
          ) : view === "agents" ? (
            <section className="conversation tool-view">
              <AgentStudio apiBase={API} onError={setError} />
            </section>
          ) : view === "admin" && user.is_admin ? (
            <section className="conversation tool-view">
              <AdminPanel apiBase={API} onError={setError} />
            </section>
          ) : (<>
          <section className="conversation" ref={scrollRef} onScroll={onScroll}>
            <AnimatePresence mode="wait" initial={false}>
              {messages.length === 0 ? (
                <motion.div
                  key="welcome"
                  exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
                  transition={{ duration: 0.25 }}
                >
                  <Welcome name={user.name} onPick={(text) => { setInput(text); inputRef.current?.focus(); }} />
                </motion.div>
              ) : (
                <motion.div
                  key={`list-${activeId}`}
                  className="message-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <AnimatePresence initial={false}>
                    {messages.map((message) => {
                      const isAssistant = message.role === "assistant";
                      const isLive = message === lastAssistant && loading;
                      return (
                        <motion.article
                          key={message.id}
                          layout="position"
                          className={`message-row ${message.role}`}
                          initial={{ opacity: 0, y: 18, scale: 0.98, filter: "blur(6px)" }}
                          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={softSpring}
                        >
                          {isAssistant && (
                            <div className="avatar">
                              <Orb size={34} still={!isLive} state={isLive ? orbState : "idle"} />
                            </div>
                          )}
                          <div className="message-content">
                            {isAssistant && (
                              <div className="message-author">
                                Zenoxi
                                {message.channel && message.channel !== "web" && <span className={`via via-${message.channel}`}>via {message.channel === "whatsapp" ? "WhatsApp" : "Instagram"}</span>}
                              </div>
                            )}
                            {message.pending && !message.content ? (
                              <div className="thinking">
                                {message.stage === "searching" && <Globe size={15} className="thinking-globe" />}
                                <span className="shimmer">
                                  {message.stage === "searching" ? "Searching the web" : message.sources?.length ? `Reading ${message.sources.length} sources` : "Thinking"}
                                </span>
                                <span className="dots">
                                  {[0, 1, 2].map((i) => (
                                    <motion.i
                                      key={i}
                                      animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                                    />
                                  ))}
                                </span>
                              </div>
                            ) : isAssistant ? (
                              <Markdown streaming={isLive} sources={message.sources}>{message.content}</Markdown>
                            ) : (
                              <div className="user-stack">
                                {message.attachments?.length > 0 && (
                                  <div className="bubble-files">
                                    {message.attachments.map((file) => (
                                      <AttachmentChip key={file.id} item={{ ...file, status: "ready" }} compact />
                                    ))}
                                  </div>
                                )}
                                <p className="user-bubble">{message.content}</p>
                                {message.channel && message.channel !== "web" && (
                                  <span className={`via via-${message.channel}`}>sent from {message.channel === "whatsapp" ? "WhatsApp" : "Instagram"}</span>
                                )}
                              </div>
                            )}
                            {isAssistant && message.notice && (
                              <p className="message-notice"><Info size={13} /> {message.notice}</p>
                            )}
                            {isAssistant && message.sources?.length > 0 && <Sources sources={message.sources} />}
                            {isAssistant && message.content && !isLive && (
                              <motion.div className="message-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <button className="copy-btn" type="button" onClick={() => copyMessage(message.content, message.id)}>
                                  <AnimatePresence mode="wait" initial={false}>
                                    <motion.span
                                      key={copied === message.id ? "y" : "n"}
                                      initial={{ scale: 0.4, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0.4, opacity: 0 }}
                                      style={{ display: "grid" }}
                                    >
                                      {copied === message.id ? <Check size={14} /> : <Copy size={14} />}
                                    </motion.span>
                                  </AnimatePresence>
                                  {copied === message.id ? "Copied" : "Copy"}
                                </button>
                              </motion.div>
                            )}
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <AnimatePresence>
            {!atBottom && messages.length > 0 && (
              <motion.button
                className="jump-btn"
                type="button"
                aria-label="Jump to latest message"
                initial={{ opacity: 0, y: 12, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.8 }}
                onClick={() => scrollToBottom()}
              >
                <ArrowDown size={16} />
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div
                className="error-banner"
                role="alert"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={spring}
              >
                <AlertCircle size={17} />
                <span>{error}</span>
                <button type="button" aria-label="Dismiss error" onClick={() => setError("")}><X size={15} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <form className="composer-wrap" onSubmit={send}>
            <motion.div
              className={`composer ${loading ? "is-loading" : ""}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...softSpring, delay: 0.2 }}
            >
              <div className="composer-inner">
                <AnimatePresence initial={false}>
                  {attachments.length > 0 && (
                    <motion.div
                      className="composer-files"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <AnimatePresence initial={false}>
                        {attachments.map((item) => (
                          <AttachmentChip key={item.key} item={item} onRemove={() => removeAttachment(item)} />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  hidden
                  onChange={(event) => { uploadFiles(event.target.files); event.target.value = ""; }}
                />
                <motion.button
                  type="button"
                  className="attach-btn"
                  aria-label="Attach files"
                  title="Attach files (PDF, Word, text, CSV, code)"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  whileTap={{ scale: 0.88, rotate: -20 }}
                >
                  <Paperclip size={17} />
                </motion.button>
                <motion.button
                  type="button"
                  className={`web-toggle ${webSearch ? "on" : ""}`}
                  aria-pressed={webSearch}
                  aria-label="Search the web for answers"
                  title={webSearch ? "Web search on: answers use live results" : "Web search off"}
                  onClick={() => setWebSearch((v) => !v)}
                  whileTap={{ scale: 0.92 }}
                  layout
                >
                  <motion.span
                    style={{ display: "grid" }}
                    animate={webSearch ? { rotate: 360 } : { rotate: 0 }}
                    transition={webSearch ? { duration: 8, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
                  >
                    <Globe size={16} />
                  </motion.span>
                  <span className="web-label">Web</span>
                </motion.button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={readyFiles.length ? "Ask about your file…" : webSearch ? "Search the web…" : "Message Zenoxi…"}
                  aria-label="Message Zenoxi"
                  rows={1}
                  disabled={loading}
                />
                <motion.button
                  className="send-btn"
                  type="submit"
                  aria-label="Send message"
                  title="Send message"
                  disabled={!canSend}
                  whileHover={canSend ? { scale: 1.06 } : undefined}
                  whileTap={canSend ? { scale: 0.9, rotate: -8 } : undefined}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={loading ? "load" : "send"}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -12, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ display: "grid" }}
                    >
                      {loading ? <LoaderCircle size={18} className="spin" /> : <ArrowUp size={19} strokeWidth={2.4} />}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.div>
            <p className="disclaimer">
              <span><kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line</span>
              <span className="disclaimer-sep">·</span>
              <span>Check important details before relying on them.</span>
            </p>
          </form>
          </>)}
        </main>

        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              className="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}
            >
              <motion.div
                className="delete-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-dialog-title"
                aria-describedby="delete-dialog-description"
                initial={{ opacity: 0, y: 30, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={spring}
              >
                <motion.div
                  className="delete-dialog-icon"
                  initial={{ rotate: -20, scale: 0.6 }}
                  animate={{ rotate: [0, -12, 10, -6, 0], scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  <Trash2 size={20} />
                </motion.div>
                <h2 id="delete-dialog-title">Delete this chat?</h2>
                <p id="delete-dialog-description">“{deleteTarget.title}” will be permanently deleted.</p>
                <div className="delete-dialog-actions">
                  <button className="dialog-cancel" type="button" autoFocus onClick={() => setDeleteTarget(null)}>Cancel</button>
                  <button className="dialog-delete" type="button" onClick={removeChat}>Delete chat</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

export default App;
