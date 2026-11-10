import { useEffect, useRef, useState } from "react";
import {
  Bot, Plus, MessageSquare, Trash2, Send, PanelLeftClose,
  PanelLeftOpen, Sparkles, LoaderCircle, Copy, Check, AlertCircle
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const refreshChats = async () => {
    const res = await fetch(`${API}/api/chats`);
    if (!res.ok) throw new Error("Could not load conversations");
    setChats(await res.json());
  };

  const loadMessages = async (id) => {
    setActiveId(id);
    setError("");
    const res = await fetch(`${API}/api/chats/${id}/messages`);
    if (!res.ok) throw new Error("Could not load messages");
    setMessages(await res.json());
  };

  useEffect(() => {
    refreshChats().catch(() => setError("Backend unavailable. Start the FastAPI server."));
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
      inputRef.current?.focus();
    } catch {
      setError("Could not create a conversation. Check the backend.");
    }
  };

  const removeChat = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    try {
      const res = await fetch(`${API}/api/chats/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setChats((old) => old.filter((chat) => chat.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch {
      setError("Could not delete this conversation.");
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
        setError("Could not create a conversation.");
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
      setError(err.message || "Something went wrong while generating a response.");
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
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
        <div className="brand">
          <div className="brand-mark"><Bot size={21} /></div>
          {sidebarOpen && <div><strong>VAC AI</strong><span>Personal AI chat</span></div>}
        </div>

        <button className="new-chat-btn" onClick={newChat}>
          <Plus size={17} /> {sidebarOpen && "New chat"}
        </button>

        {sidebarOpen && (
          <>
            <div className="side-label">YOUR CONVERSATIONS</div>
            <div className="chat-list">
              {chats.map((chat) => (
                <button
                  className={`chat-item ${activeId === chat.id ? "active" : ""}`}
                  key={chat.id}
                  onClick={() => loadMessages(chat.id)}
                  title={chat.title}
                >
                  <MessageSquare size={16} />
                  <span>{chat.title}</span>
                  <span className="delete-chat" onClick={(e) => removeChat(chat.id, e)}>
                    <Trash2 size={14} />
                  </span>
                </button>
              ))}
              {chats.length === 0 && <p className="empty-history">Your chats will appear here.</p>}
            </div>
          </>
        )}

        <div className="sidebar-bottom">
          <div className="model-pill"><span className="status-dot" /> Qwen · Local model</div>
          <button className="collapse-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
            {sidebarOpen && "Collapse sidebar"}
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-title">
            <span className="mobile-brand"><Bot size={18} /> VAC AI</span>
            <span>{activeChat?.title || "New conversation"}</span>
          </div>
          <div className="topbar-status"><span className="status-dot" /> Local AI</div>
        </header>

        <section className="conversation">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon"><Sparkles size={25} /></div>
              <p className="eyebrow">YOUR PRIVATE AI SPACE</p>
              <h1>What can I help you with?</h1>
              <p className="welcome-subtitle">Ask a question, explore an idea, or work through a problem.</p>
              <div className="suggestions">
                {[
                  "Explain how artificial intelligence works",
                  "Help me learn Python programming",
                  "Give me ideas for a software project"
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
                    <div className="message-author">{message.role === "assistant" ? "VAC AI" : "You"}</div>
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

        {error && <div className="error-banner"><AlertCircle size={16} /> {error}</div>}

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
              placeholder="Message VAC AI..."
              rows={1}
              disabled={loading}
            />
            <button className="send-btn" type="submit" disabled={!input.trim() || loading}>
              {loading ? <LoaderCircle size={18} className="spin" /> : <Send size={18} />}
            </button>
          </div>
          <p className="disclaimer">VAC AI can make mistakes. Verify important information.</p>
        </form>
      </main>
    </div>
  );
}

export default App;
