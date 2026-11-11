import { useEffect, useRef, useState } from "react";
import {
  Bot, Plus, MessageSquare, Trash2, Send, PanelLeftClose,
  PanelLeftOpen, Sparkles, LoaderCircle, Copy, Check, AlertCircle, Menu, X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? "https://chat-bot-ai-ouc2.onrender.com"
  : "http://127.0.0.1:8000");

function App() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 700);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const deleteDialogRef = useRef(null);

  useEffect(() => {
    const breakpoint = window.matchMedia("(max-width: 700px)");
    const syncSidebar = () => setSidebarOpen(!breakpoint.matches);
    breakpoint.addEventListener("change", syncSidebar);
    return () => breakpoint.removeEventListener("change", syncSidebar);
  }, []);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteTarget && !dialog.open) dialog.showModal();
    if (!deleteTarget && dialog.open) dialog.close();
  }, [deleteTarget]);

  useEffect(() => {
    if (!sidebarOpen || window.innerWidth > 700) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sidebarOpen]);

  const refreshChats = async () => {
    const res = await fetch(`${API}/api/chats`);
    if (!res.ok) throw new Error("Could not load conversations");
    setChats(await res.json());
  };

  const loadMessages = async (id) => {
    setActiveId(id);
    setError("");
    if (window.innerWidth <= 700) setSidebarOpen(false);
    try {
      const res = await fetch(`${API}/api/chats/${id}/messages`);
      if (!res.ok) throw new Error();
      setMessages(await res.json());
    } catch {
      setError("Couldn't load that chat. Check your connection and try again.");
    }
  };

  useEffect(() => {
    refreshChats().catch(() => setError("Couldn't connect to Zenoxi. Check your connection and try again."));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const newChat = async () => {
    try {
      const res = await fetch(`${API}/api/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New chat" })
      });
      if (!res.ok) throw new Error();
      const chat = await res.json();
      setChats((old) => [chat, ...old]);
      setActiveId(chat.id);
      setMessages([]);
      setError("");
      if (window.innerWidth <= 700) setSidebarOpen(false);
      inputRef.current?.focus();
    } catch {
      setError("Couldn't start a chat. Check your connection and try again.");
    }
  };

  const removeChat = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API}/api/chats/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setChats((old) => old.filter((chat) => chat.id !== deleteTarget.id));
      if (activeId === deleteTarget.id) {
        setActiveId(null);
        setMessages([]);
      }
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
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
        const res = await fetch(`${API}/api/chats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New chat" })
        });
        if (!res.ok) throw new Error();
        const chat = await res.json();
        chatId = chat.id;
        setActiveId(chatId);
        setChats((old) => [chat, ...old]);
      } catch {
        setError("Couldn't start a chat. Check your connection and try again.");
        return;
      }
    }

    setInput("");
    setError("");
    setLoading(true);
    setMessages((old) => [...old, {
      id: `user-${Date.now()}`, role: "user", content: text
    }, {
      id: `assistant-${Date.now()}`, role: "assistant", content: "", pending: true
    }]);

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
          const event = JSON.parse(line);
          if (event.type === "token") {
            answer += event.content;
            setMessages((old) => {
              const copy = [...old];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: answer };
              return copy;
            });
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }

      await refreshChats();
      setMessages((old) => old.map((m) => m.pending ? { ...m, pending: false } : m));
    } catch (err) {
      setMessages((old) => old.filter((m) => !m.pending));
      setError(err.message || "Zenoxi couldn't get a reply. Try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const copyMessage = async (message, id) => {
    await navigator.clipboard.writeText(message);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const activeChat = chats.find((chat) => chat.id === activeId);

  return (
    <div className="app-shell">
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close conversations menu"
          tabIndex={sidebarOpen && window.innerWidth <= 700 ? 0 : -1}
          hidden={!sidebarOpen || window.innerWidth > 700}
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          id="conversation-sidebar"
          className={`sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
          aria-label="Conversations"
        >
        <div className="brand">
          <img className="brand-mark" src="/zenoxi-logo.png" alt="" aria-hidden="true" />
          {sidebarOpen && <div><strong>Zenoxi</strong><span>AI chat</span></div>}
          {sidebarOpen && (
            <button
              className="sidebar-close-mobile"
              type="button"
              aria-label="Close conversations menu"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <button className="new-chat-btn" type="button" onClick={newChat} aria-label="Start a new chat" title="Start a new chat">
          <Plus size={17} /> {sidebarOpen && "New chat"}
        </button>

        {sidebarOpen && (
          <>
            <div className="side-label">YOUR CONVERSATIONS</div>
            <div className="chat-list">
              {chats.map((chat) => (
                <div className={`chat-item-wrap ${activeId === chat.id ? "active" : ""}`} key={chat.id}>
                  <button
                    className="chat-item"
                    type="button"
                    onClick={() => loadMessages(chat.id)}
                    title={chat.title}
                    aria-current={activeId === chat.id ? "page" : undefined}
                  >
                    <MessageSquare size={16} aria-hidden="true" />
                    <span>{chat.title}</span>
                  </button>
                  <button
                    className="delete-chat"
                    type="button"
                    aria-label={`Delete ${chat.title}`}
                    title={`Delete ${chat.title}`}
                    onClick={() => setDeleteTarget(chat)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
              {chats.length === 0 && <p className="empty-history">Your chats will appear here.</p>}
            </div>
          </>
        )}

        <div className="sidebar-bottom">
          <div className="model-pill"><span className="status-dot" /> AI chat</div>
          <button
            className="collapse-btn"
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
            {sidebarOpen && "Collapse sidebar"}
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="menu-toggle"
              type="button"
              aria-label={sidebarOpen ? "Close conversations menu" : "Open conversations menu"}
              aria-expanded={sidebarOpen}
              aria-controls="conversation-sidebar"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="topbar-brand"><img src="/zenoxi-logo.png" alt="" aria-hidden="true" /> Zenoxi</span>
            <span className="current-chat-title">{activeChat?.title || "New chat"}</span>
          </div>
          <div className="topbar-status"><span className="status-dot" /> AI chat</div>
        </header>

        <section className="conversation">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon"><Sparkles size={25} /></div>
              <p className="eyebrow">YOUR AI CHAT</p>
              <h1>What would you like to ask?</h1>
              <p className="welcome-subtitle">Ask a question or start with one of these prompts.</p>
              <div className="suggestions">
                {[
                  "Explain a difficult topic in simple terms",
                  "Help me write a Python script",
                  "Suggest ideas for a small app"
                ].map((suggestion) => (
                  <button key={suggestion} onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}>
                    <Sparkles size={15} /> {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <article className={`message-row ${message.role}`} key={message.id}>
                  <div className={`avatar ${message.role}`}>
                    {message.role === "assistant" ? <Bot size={18} /> : "You"}
                  </div>
                  <div className="message-content">
                    <div className="message-author">{message.role === "assistant" ? "Zenoxi" : "You"}</div>
                    {message.pending && !message.content ? (
                      <div className="thinking"><LoaderCircle size={16} className="spin" /> Thinking...</div>
                    ) : message.role === "assistant" ? (
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      </div>
                    ) : <p className="user-text">{message.content}</p>}
                    {message.role === "assistant" && message.content && (
                      <button className="copy-btn" onClick={() => copyMessage(message.content, message.id)}>
                        {copied === message.id ? <Check size={14} /> : <Copy size={14} />}
                        {copied === message.id ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        {error && <div className="error-banner" role="alert"><AlertCircle size={17} /> {error}</div>}

        <form className="composer-wrap" onSubmit={send}>
          <div className="composer">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Message Zenoxi..."
              aria-label="Message Zenoxi"
              rows={1}
              disabled={loading}
            />
            <button className="send-btn" type="submit" aria-label="Send message" title="Send message" disabled={!input.trim() || loading}>
              {loading ? <LoaderCircle size={18} className="spin" /> : <Send size={18} />}
            </button>
          </div>
          <p className="disclaimer">Check important details before you rely on them.</p>
        </form>
      </main>

      <dialog
        className="delete-dialog"
        ref={deleteDialogRef}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        onCancel={(event) => { event.preventDefault(); setDeleteTarget(null); }}
        onClose={() => setDeleteTarget(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDeleteTarget(null);
        }}
      >
        <div className="delete-dialog-icon"><Trash2 size={20} /></div>
        <h2 id="delete-dialog-title">Delete this chat?</h2>
        <p id="delete-dialog-description">
        {deleteTarget ? `"${deleteTarget.title}" will be permanently deleted.` : "This chat will be permanently deleted."}
        </p>
        <div className="delete-dialog-actions">
          <button className="dialog-cancel" type="button" autoFocus onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="dialog-delete" type="button" onClick={removeChat}>Delete chat</button>
        </div>
      </dialog>
    </div>
  );
}

export default App;
