import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence, LayoutGroup, MotionConfig, motion, useMotionValue, useSpring
} from "framer-motion";
import {
  Plus, MessageSquare, Trash2, ArrowUp, PanelLeftClose, PanelLeftOpen, LoaderCircle,
  Copy, Check, AlertCircle, Menu, X, Sun, Moon, Search, Lightbulb, Code2, Rocket, PenLine, ArrowDown
} from "lucide-react";
import Orb from "./components/Orb";
import Aurora from "./components/Aurora";
import Markdown from "./components/Markdown";

const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? "https://chat-bot-ai-ouc2.onrender.com"
  : "http://127.0.0.1:8000");

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

function Welcome({ onPick }) {
  const [verb, setVerb] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setVerb((v) => (v + 1) % VERBS.length), 2200);
    return () => clearInterval(id);
  }, []);
  const words = `${greeting()}.`.split(" ");

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

function App() {
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
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

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
    const res = await fetch(`${API}/api/chats`);
    if (!res.ok) throw new Error("Could not load conversations");
    setChats(await res.json());
  };

  useEffect(() => {
    refreshChats().catch(() => setError("Couldn't connect to Zenoxi. Check your connection and try again."));
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
    setError("");
    setAtBottom(true);
    if (isMobile) setSidebarOpen(false);
    try {
      const res = await fetch(`${API}/api/chats/${id}/messages`);
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
      setMessages([]);
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
      const res = await fetch(`${API}/api/chats/${target.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setChats((old) => old.filter((chat) => chat.id !== target.id));
      if (activeId === target.id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch {
      setError("Couldn't delete that conversation. Try again.");
    }
  };

  const send = async (event) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
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
    setError("");
    setLoading(true);
    setAtBottom(true);
    const stamp = Date.now();
    setMessages((old) => [...old,
      { id: `user-${stamp}`, role: "user", content: text },
      { id: `assistant-${stamp}`, role: "assistant", content: "", pending: true }
    ]);

    try {
      const res = await fetch(`${API}/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text })
      });
      if (!res.ok || !res.body) throw new Error("AI request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

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
            setMessages((old) => {
              const copy = [...old];
              copy[copy.length - 1] = { ...copy[copy.length - 1], content: answer };
              return copy;
            });
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
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
  }, [chats, query]);
  const grouped = useMemo(() => groupChats(filtered), [filtered]);
  const expanded = sidebarOpen || isMobile;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const orbState = loading ? (lastAssistant?.content ? "streaming" : "thinking") : "idle";

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
            <div className="model-pill" title="Zenoxi is online">
              <span className="status-dot" />
              {expanded && <span>Online · AI chat</span>}
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

        <main className="main-panel">
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
                  key={activeChat?.title || "new"}
                  className="current-chat-title"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {activeChat?.title || "New conversation"}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="topbar-actions">
              <AnimatePresence>
                {loading && (
                  <motion.div
                    className="live-chip"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <span className="eq"><i /><i /><i /><i /></span>
                    {orbState === "thinking" ? "Thinking" : "Writing"}
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

          <section className="conversation" ref={scrollRef} onScroll={onScroll}>
            <AnimatePresence mode="wait" initial={false}>
              {messages.length === 0 ? (
                <motion.div
                  key="welcome"
                  exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
                  transition={{ duration: 0.25 }}
                >
                  <Welcome onPick={(text) => { setInput(text); inputRef.current?.focus(); }} />
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
                            {isAssistant && <div className="message-author">Zenoxi</div>}
                            {message.pending && !message.content ? (
                              <div className="thinking">
                                <span className="shimmer">Thinking</span>
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
                              <Markdown streaming={isLive}>{message.content}</Markdown>
                            ) : (
                              <p className="user-bubble">{message.content}</p>
                            )}
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
                  placeholder="Message Zenoxi…"
                  aria-label="Message Zenoxi"
                  rows={1}
                  disabled={loading}
                />
                <motion.button
                  className="send-btn"
                  type="submit"
                  aria-label="Send message"
                  title="Send message"
                  disabled={!input.trim() || loading}
                  whileHover={input.trim() && !loading ? { scale: 1.06 } : undefined}
                  whileTap={input.trim() && !loading ? { scale: 0.9, rotate: -8 } : undefined}
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
