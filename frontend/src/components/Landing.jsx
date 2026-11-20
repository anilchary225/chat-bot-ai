import { useEffect, useId, useRef, useState } from "react";
import { animate, motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Code2,
  Mail,
  Sparkles,
  Target,
  X,
  ShieldCheck,
  Download,
  Menu,
  ArrowUp,
  SearchCheck,
  ChevronLeft,
  Phone,
  Video,
  MoreHorizontal,
  Plus,
  Image as ImageIcon,
  Mic,
  Heart,
  Signal,
  Wifi,
  BatteryFull,
  Bot,
  Instagram,
  MessageSquare,
  MessageCircle,
  FileText,
  Paperclip,
} from "./DrawingIcons";
import Orb3D from "./Orb3D";
import LandingAssistant from "./LandingAssistant";
import ZenoxiWordmark from "./ZenoxiWordmark";
import Aurora from "./Aurora";
import ThemeToggle from "./ThemeToggle";
import { API } from "../config";
import { installAuthFetch } from "../auth";
import "./Landing.css";

installAuthFetch(API);

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/ai-chat", label: "AI Chat", summary: "Ask questions, search the web, or work with your files.", actions: [
    { href: "/?app=true", label: "Open AI chat" },
  ] },
  { href: "/website-agent", label: "Website Agent", summary: "Build an assistant that answers questions from your website content.", actions: [
    { href: "/agents?app=true", label: "Open Agent Studio" },
  ] },
  { href: "/instagram", label: "Instagram", summary: "Start in Instagram DMs and send /web to continue in Zenoxi.", actions: [
    { href: "https://ig.me/m/zenoxi.ai", label: "Message on Instagram" },
    { href: "/?app=true", label: "Open AI chat" },
  ] },
  { href: "/whatsapp", label: "WhatsApp · Soon" },
  { href: "/resume-tools", label: "Resume Tools", summary: "Check your resume match, tailor a draft, and export it as a PDF.", actions: [
    { href: "/resume?app=true", label: "Open Resume Tools" },
  ] },
  { href: "/faq", label: "FAQ" },
];

const PUBLIC_PAGES = {
  "/ai-chat": { title: "AI chat for the things you’re working through", description: "Ask questions, explore ideas, search the web, and work with your documents in one conversation.", component: "chat" },
  "/website-agent": { title: "A helpful assistant for every website visit", description: "Give visitors an AI assistant that answers from your website and the knowledge you provide.", component: "agents" },
  "/instagram": { title: "Keep the conversation when you leave Instagram", description: "Chat with Zenoxi on Instagram, then send /web to continue the same conversation in the app.", component: "instagram" },
  "/whatsapp": { title: "WhatsApp chat is coming soon", description: "A preview of WhatsApp chat for Zenoxi. Availability will be announced when the feature is ready.", component: "whatsapp" },
  "/resume-tools": { title: "Make your next application clearer", description: "Review resume and job description alignment, tailor a draft, and export a clean PDF.", component: "resume" },
  "/faq": { title: "Frequently asked questions", description: "Answers about Zenoxi AI chat, resume tools, website agents, and continuing Instagram chats in the app.", component: "faq" },
};

export function isPublicLandingPath(pathname) {
  return Object.hasOwn(PUBLIC_PAGES, pathname.replace(/\/$/, ""));
}

function DesktopNav() {
  const [active, setActive] = useState(null);
  const navigation = useRef(null);
  const closeTimer = useRef(null);
  const id = useId();

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!active) return;
    function closeOutside(event) {
      if (!navigation.current?.contains(event.target)) setActive(null);
    }
    function onEscape(event) {
      if (event.key !== "Escape") return;
      const nav = navigation.current;
      if (nav?.contains(document.activeElement)) {
        nav.querySelector('[aria-expanded="true"]')?.focus();
      }
      setActive(null);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [active]);

  return (
    <nav ref={navigation} className="nav-links" aria-label="Main navigation">
      {NAV_LINKS.map(({ href, label, summary, actions }, index) => {
        if (!actions) return <a key={href} href={href} className="nav-link" onPointerEnter={() => setActive(null)} onClick={() => setActive(null)}>{label}</a>;
        const isOpen = active === href;
        const panelId = `${id}-${index}`;
        return (
          <div
            className="nav-menu-item"
            key={href}
            onPointerEnter={(event) => {
              if (event.pointerType !== "mouse") return;
              window.clearTimeout(closeTimer.current);
              setActive(href);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse" && !event.currentTarget.querySelector(":focus-visible")) {
                closeTimer.current = window.setTimeout(() => {
                  setActive((current) => current === href ? null : current);
                }, 120);
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setActive((current) => current === href ? null : current);
            }}
          >
            <a
              className="nav-link nav-disclosure"
              href={href}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onFocus={(event) => {
                if (event.currentTarget.matches(":focus-visible")) setActive(href);
              }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown") return;
                event.preventDefault();
                setActive(href);
              }}
            >
              {label}<span className="nav-disclosure-chevron" aria-hidden="true" />
            </a>
            <div id={panelId} className="nav-drop" data-open={isOpen} aria-hidden={!isOpen}>
              <div className="nav-drop-inner">
                <div className="nav-drop-copy"><strong>{label}</strong><p>{summary}</p></div>
                <div className="nav-drop-actions">
                  {actions.map((action, actionIndex) => (
                    <a key={action.href} href={action.href} tabIndex={isOpen ? undefined : -1} className={`btn ${actionIndex === 0 ? "btn-primary" : "btn-ghost"}`} onClick={() => setActive(null)}>
                      {action.label}<ArrowRight size={15} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function NavBar({ onSignIn }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <motion.header
      className="landing-nav"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="nav-inner">
        <a href="/" className="nav-brand" aria-label="Zenoxi home">
          <ZenoxiWordmark className="nav-title" />
        </a>
        <DesktopNav />
        <div className="nav-actions">
          <ThemeToggle className="theme-toggle-nav" />
          <button className="btn btn-ghost" onClick={onSignIn}>Sign in</button>
          <button className="btn btn-primary" onClick={onSignIn}>Get started</button>
          <button className="nav-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {menuOpen && <nav className="nav-mobile-menu" aria-label="Mobile navigation">
        {NAV_LINKS.map(({ href, label }) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
        <button type="button" className="btn btn-ghost" onClick={() => { setMenuOpen(false); onSignIn(); }}>Sign in / Create account</button>
      </nav>}
    </motion.header>
  );
}

const SAMPLE_RESUME_MATCH = {
  matched: ["React", "TypeScript"],
  missing: ["Testing"],
};

function SampleResume({ className }) {
  return (
    <div className={`sample-paper ${className}`} aria-hidden="true">
      <div className="sample-paper-title"><strong>Resume</strong><small>Match your experience to the role</small></div>
      <div className="sample-paper-profile">
        <div className="sample-paper-avatar"><Briefcase size={18} /></div>
        <div className="sample-paper-lines"><span /><span /><span /></div>
      </div>
      <div className="sample-paper-section">
        <strong>Experience</strong>
        <div className="sample-paper-lines"><span /><span /><span /><span /></div>
      </div>
      <div className="sample-paper-section">
        <strong>Skills</strong>
        <div className="sample-paper-lines"><span /><span /><span /></div>
      </div>
      <div className="sample-paper-section">
        <strong>Education</strong>
        <div className="sample-paper-lines"><span /><span /></div>
      </div>
    </div>
  );
}

function Hero({ onSignIn }) {
  const reduce = useReducedMotion();

  return (
    <motion.section className="landing-hero" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true">
        <Aurora energy={0} />
      </div>
      <div className="hero-content">
        <motion.div
          className="hero-visual"
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 40 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="hero-product-scene" role="group" aria-label="Previews of Zenoxi’s resume tools and website agent">
            <article className="hero-preview-card hero-resume-sheet" tabIndex={0} aria-label="Sample resume">
              <SampleResume className="hero-resume-page" />
            </article>
            <div className="hero-preview-side">
              <article className="hero-preview-card hero-agent-card" tabIndex={0} aria-label="Website assistant preview">
                <div className="hero-agent-head"><div><strong><ZenoxiWordmark /></strong><span className="hero-agent-description">Website assistant</span></div><span className="hero-agent-dot" /></div>
                <div className="hero-agent-message visitor">Where can I find the product guide?</div>
                <div className="hero-agent-message assistant">I can help you find the right page. What are you looking for?</div>
                <div className="hero-agent-input">Ask a question… <ArrowRight size={16} /></div>
              </article>
              <article className="hero-preview-card hero-match-card" tabIndex={0} aria-label="Resume match preview">
                <strong><SearchCheck size={17} /> Match details</strong>
                <span>Skills and experience</span>
                <div className="sample-paper-lines" aria-hidden="true"><span /><span /></div>
                <span>Keywords to review</span>
                <div className="sample-paper-lines" aria-hidden="true"><span /></div>
              </article>
            </div>
          </div>
        </motion.div>
        <motion.div
          className="hero-text"
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 30 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <h1 id="hero-title" className="hero-headline">
            One workspace for <span className="gradient-text">AI chat</span>, <span className="gradient-text">resume tools</span>, and <span className="gradient-text">website agents</span>
          </h1>
          <p className="hero-subtitle">
            Chat with Zenoxi, continue Instagram conversations in the app, review resume matches, and add an AI assistant to your website.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" onClick={onSignIn}>
              <Sparkles size={18} /> Explore Zenoxi
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth' })}>
              See how it works
            </button>
          </div>
          <p className="hero-trust">
            <ShieldCheck size={14} /> AI chat · Resume tools · Website agents
          </p>
        </motion.div>
      </div>
      <motion.div
        className="hero-scroll-hint"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        aria-hidden="true"
      >
        <ArrowUp size={22} />
      </motion.div>
    </motion.section>
  );
}

function SectionWrapper({ id, children, className = "" }) {
  const reduce = useReducedMotion();

  return (
    <section id={id} className={`landing-section section-${id} ${className}`} aria-labelledby={`${id}-title`}>
      <motion.div
        className="section-content"
        initial={reduce ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.7 }}
      >
        {children}
      </motion.div>
    </section>
  );
}

function ChatSection({ standalone = false }) {
  const Heading = standalone ? "h1" : "h2";
  return (
    <SectionWrapper id="chat">
      <div className="section-grid">
        <div className="section-text">
          <span className="section-kicker"><Sparkles size={14} /> AI Chat</span>
          <Heading id="chat-title" className="section-title">Chat that thinks with you</Heading>
          <p className="section-desc">
            Zenoxi chat streams answers, searches the web when you ask, and reads files you attach.
            Continue Instagram conversations in Zenoxi with <code>/web</code>. WhatsApp chat is coming soon.
          </p>
          <ul className="feature-list">
            <li><CheckCircle2 size={18} /> Streaming responses with live thinking indicator</li>
            <li><CheckCircle2 size={18} /> Web search toggle for live answers</li>
            <li><CheckCircle2 size={18} /> Upload PDFs, Word docs, code, CSVs — up to 10 MB</li>
            <li><CheckCircle2 size={18} /><span>Send <code>/web</code> in Instagram to continue the conversation in Zenoxi.</span></li>
            <li><CheckCircle2 size={18} /> Light & dark themes, keyboard shortcuts, reduced motion</li>
          </ul>
        </div>
        <div className="section-visual">
          <div className="chat-preview" role="img" aria-label="Zenoxi chat interface preview">
            <div className="chat-preview-header">
              <div className="preview-title"><ZenoxiWordmark /></div>
            </div>
            <div className="chat-preview-messages">
              <div className="preview-msg user">
                <div className="msg-bubble">Can you help me understand this React concept?</div>
              </div>
              <div className="preview-msg assistant">
                <div className="msg-avatar"><Orb3D size={24} state="thinking" /></div>
                <div className="msg-bubble">Sure. Share the part you’re working on, and I’ll walk through it with you.</div>
              </div>
              <div className="preview-msg user">
                <div className="msg-bubble">Can I continue this chat on Instagram?</div>
              </div>
              <div className="preview-msg assistant">
                <div className="msg-avatar"><Orb3D size={24} state="streaming" /></div>
                <div className="msg-bubble">Send <code>/web</code> in Instagram to continue that conversation in the Zenoxi app.</div>
              </div>
            </div>
            <div className="chat-preview-composer">
              <div className="composer-dots"><span /><span /><span /></div>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

function AgentsSection({ standalone = false }) {
  const Heading = standalone ? "h1" : "h2";
  return (
    <SectionWrapper id="agents">
      <div className="section-grid reverse">
        <div className="section-text">
          <span className="section-kicker"><Bot size={14} /> Website Agents</span>
          <Heading id="agents-title" className="section-title">An AI assistant for your website</Heading>
          <p className="section-desc">
            Tell Zenoxi about your business in a quick chat. It builds an assistant that answers visitors from your knowledge and collects inquiries — then you add it to your site with one line of code.
          </p>
          <ul className="feature-list">
            <li><CheckCircle2 size={18} /> Interview flow builds your business profile automatically</li>
            <li><CheckCircle2 size={18} /> Add website pages, documents, FAQs, and notes as knowledge</li>
            <li><CheckCircle2 size={18} /> Customizable widget: colors, avatar, language, position</li>
            <li><CheckCircle2 size={18} /> Lead capture forms with email notifications</li>
            <li><CheckCircle2 size={18} /> Add the widget to your site with a short embed snippet</li>
          </ul>
        </div>
        <div className="section-visual">
          <div className="agent-preview" role="group" aria-label="Example website agent widget">
            <div className="agent-widget-preview">
              <div className="widget-header">
                <div className="widget-avatar"><Orb3D size={36} state="idle" /></div>
                <div className="widget-info">
                  <strong>Acme Assistant</strong>
                  <span>Website assistant</span>
                </div>
              </div>
              <div className="widget-messages">
                <div className="wmsg bot">Hi, I'm Zenoxi, your Acme assistant. How can I help?</div>
                <div className="wmsg user">What are your pricing plans?</div>
                <div className="wmsg bot">I can help visitors find information from the business’s website and knowledge sources.</div>
              </div>
              <div className="widget-suggestions">
                <button type="button">Product details</button>
                <button type="button">Common questions</button>
              </div>
              <div className="widget-composer">
                <input type="text" placeholder="Ask me anything…" readOnly />
              </div>
            </div>
            <div className="agent-embed-code">
              <span className="embed-label">Embed code</span>
              <code>{'<script src="https://zenoxi.vercel.app/widget.js" data-agent="YOUR_AGENT_ID" async></script>'}</code>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

function InstagramSection({ standalone = false }) {
  const Heading = standalone ? "h1" : "h2";
  return (
    <SectionWrapper id="instagram">
      <div className="section-grid">
        <div className="section-text">
          <span className="section-kicker"><Instagram size={14} /> Instagram Integration</span>
          <Heading id="instagram-title" className="section-title">Continue Instagram chats in Zenoxi</Heading>
          <p className="section-desc">
            Chat with Zenoxi in Instagram DMs. When you need the full workspace — files, web search, history — send <code>/web</code> and get a private link that opens the same conversation here.
          </p>
          <div className="insta-flow">
            <div className="flow-step">
              <span className="step-num">1</span>
              <div>
                <strong>Chat in Instagram</strong>
                <p>Message Zenoxi on Instagram like any contact.</p>
              </div>
            </div>
            <div className="flow-step">
              <span className="step-num">2</span>
              <div>
                <strong>Send <code>/web</code></strong>
                <p>Zenoxi replies with a one-time secure link.</p>
              </div>
            </div>
            <div className="flow-step">
              <span className="step-num">3</span>
              <div>
                <strong>Open in Zenoxi</strong>
                <p>Same conversation, full tools: files, search, history.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="section-visual">
          <div className="insta-preview" role="img" aria-label="Instagram to Zenoxi handoff preview">
            <div className="phone-mockup" aria-label="iPhone 18 Pro Max Instagram DM preview">
              <div className="phone-screen">
                <div className="iphone-top">
                  <div className="iphone-status"><span>9:41</span><span className="iphone-status-icons"><Signal size={12} /><Wifi size={13} /><BatteryFull size={16} /></span></div>
                  <div className="phone-dynamic-island"><span /><i /></div>
                </div>
                <div className="ig-header">
                  <ChevronLeft size={23} />
                  <span className="ig-header-avatar"><Orb3D size={32} state="idle" /></span>
                  <span className="ig-header-name"><strong>zenoxi.ai</strong><small><ZenoxiWordmark /></small></span>
                  <Phone size={19} /><Video size={20} /><MoreHorizontal size={20} />
                </div>
                <div className="ig-chat">
                  <div className="ig-chat-date">Today 9:41 AM</div>
                  <div className="ig-msg user"><div className="ig-bubble">Can you help tailor my resume for a job?</div></div>
                  <div className="ig-msg bot"><div className="ig-avatar"><Orb3D size={23} state="idle" /></div><div className="ig-bubble">Yes. Send /web to open this chat in Zenoxi, where you can upload your resume.</div></div>
                  <div className="ig-msg user"><div className="ig-bubble ig-command">/web</div></div>
                  <div className="ig-msg bot special"><div className="ig-avatar"><Orb3D size={23} state="idle" /></div><div className="ig-bubble ig-link-card"><span>zenoxi.vercel.app</span><strong>Continue in Zenoxi <ArrowRight size={13} /></strong></div></div>
                </div>
                <div className="ig-composer"><Plus size={19} /><div className="ig-compose-field"><span>Message...</span><Mic size={17} /><ImageIcon size={17} /><Heart size={17} /></div></div>
                <div className="iphone-home-indicator" aria-hidden="true"><span /></div>
              </div>
            </div>
            <div className="handoff-app-preview">
              <div className="handoff-app-screen">
                <div className="handoff-window-controls" aria-hidden="true"><span /><span /><span /></div>
                <div className="handoff-app-header">
                  <ZenoxiWordmark />
                  <span className="handoff-app-source"><Instagram size={12} /> Via Instagram</span>
                </div>
                <div className="handoff-app-messages">
                  <div className="handoff-app-user">Can you help tailor my resume for a job?</div>
                  <div className="handoff-app-reply">Upload your resume here and we’ll pick up from where we left off.</div>
                </div>
                <div className="handoff-app-composer"><Paperclip size={14} /><span>Message Zenoxi</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

function WhatsAppSection({ standalone = false }) {
  const Heading = standalone ? "h1" : "h2";
  return (
    <SectionWrapper id="whatsapp">
      <div className="section-grid">
        <div className="section-text">
          <span className="section-kicker"><MessageCircle size={14} /> WhatsApp</span>
          <Heading id="whatsapp-title" className="section-title">Pick up the same chat, right where you are</Heading>
          <p className="section-desc">
            WhatsApp chat is on the way. We’re preparing another place to keep your conversations with Zenoxi moving.
          </p>
          <p className="whatsapp-coming-note"><span className="coming-indicator" /> Coming soon</p>
        </div>
        <div className="section-visual">
          <div className="wa-preview" role="img" aria-label="Illustration of a Zenoxi WhatsApp conversation continuing in the app">
            <div className="wa-topbar"><span className="wa-back">‹</span><span><strong><ZenoxiWordmark /></strong><small>AI assistant</small></span><MessageCircle size={19} /></div>
            <div className="wa-chat">
              <div className="wa-date">Today</div>
              <div className="wa-message wa-in">Can we keep this conversation going?</div>
              <div className="wa-message wa-out">WhatsApp chat is coming soon to Zenoxi.</div>
              <div className="wa-time">A new way to chat with Zenoxi</div>
            </div>
            <div className="wa-composer"><span>Message</span><span className="wa-send">➤</span></div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

function ResumeScorePreview() {
  const report = useRef(null);
  const inView = useInView(report, { once: true, amount: 0.35 });
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const animation = animate(0, 1, { duration: 1.15, ease: "easeOut", onUpdate: setProgress });
    return () => animation.stop();
  }, [inView, reduce]);

  const portion = reduce ? 1 : progress;
  const overall = Math.round(72 * portion);

  return (
    <div ref={report} className="resume-score-preview" aria-label="Example scores: ATS match 72 out of 100, keywords 67%, format 85%" role="img">
      <div className="resume-score-row">
        <div className="score-ring-preview">
          <svg viewBox="0 0 120 120" className="score-svg" aria-hidden="true">
            <circle className="score-track" cx="60" cy="60" r="50" />
            <circle className="score-value" cx="60" cy="60" r="50" pathLength="100" strokeDasharray={`${72 * portion} 100`} opacity={portion > 0 ? 1 : 0} />
          </svg>
          <div className="score-center"><strong>{overall}</strong><span>of 100</span></div>
        </div>
        <strong>ATS match</strong>
      </div>
      <div className="score-breakdown">
        {[["Keywords", 67], ["Format", 85]].map(([label, score]) => (
          <div className="score-metric" key={label}>
            <div className="score-bar"><span>{label}</span><strong>{Math.round(score * portion)}%</strong></div>
            <div className="score-meter" aria-hidden="true"><span style={{ width: `${score * portion}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResumeSection({ standalone = false }) {
  const Heading = standalone ? "h1" : "h2";
  return (
    <SectionWrapper id="resume">
      <div className="section-grid reverse">
        <div className="section-text">
          <span className="section-kicker"><Briefcase size={14} /> Resume Tools</span>
          <Heading id="resume-title" className="section-title">ATS match analysis & tailored resumes</Heading>
          <p className="section-desc">
            Upload your resume and paste a job description. Zenoxi scores keyword coverage, checks formatting against common ATS rules, and rewrites your resume to match the role — without inventing experience you don't have.
          </p>
          <ul className="feature-list resume-benefits">
            {[
              ["Analyze match", "Review keyword alignment and seven resume formatting checks."],
              ["Tailor with a job description", "Focus a resume draft on the role using your experience."],
              ["Tailor without one", "Create a general resume draft without a job post."],
              ["Export your draft", "Download a one-page PDF or Word document."],
              ["Remove your files", "Clear the uploaded resume and generated draft when finished."],
            ].map(([title, detail], index) => <motion.li
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
            ><CheckCircle2 size={18} /><span><strong>{title}</strong><span>{detail}</span></span></motion.li>)}
          </ul>
          <p className="section-disclaimer">
            <ShieldCheck size={14} /> ATS match scores are estimates to help you review alignment. Employers use different screening systems and criteria.
          </p>
        </div>
        <div className="section-visual">
          <div className="resume-preview" role="group" aria-labelledby="resume-preview-title">
            <header className="resume-preview-header">
              <span className="resume-preview-icon"><FileText size={18} /></span>
              <strong id="resume-preview-title">Resume review</strong>
              <span className="resume-preview-example">Example</span>
            </header>
            <div className="resume-preview-grid">
              <div className="resume-preview-report">
                <ResumeScorePreview />
                <div className="resume-keywords">
                  <div>
                    <span className="kw-title">Matched</span>
                    <div className="kw-chips">
                      {SAMPLE_RESUME_MATCH.matched.map((skill) => <span className="kw-chip hit" key={skill}>{skill}</span>)}
                    </div>
                  </div>
                  <div>
                    <span className="kw-title">To review</span>
                    <div className="kw-chips">
                      {SAMPLE_RESUME_MATCH.missing.map((skill) => <span className="kw-chip miss" key={skill}>{skill}</span>)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="resume-preview-document">
                <span className="resume-preview-format">A4 PDF</span>
                <SampleResume className="resume-paper-mini" />
              </div>
            </div>
            <div className="resume-preview-footer">
              <span><Download size={15} /> PDF and Word export</span>
              <a href="/resume?app=true" className="btn btn-ghost">Open Resume Tools <ArrowRight size={15} /></a>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

function HowItWorks({ standalone = false }) {
  const steps = [
    { num: "01", title: "Create an account", desc: "Sign in with an email code or Google." },
    { num: "02", title: "Pick a tool", desc: "Chat, build a website agent, or tailor a resume." },
    { num: "03", title: "Get results", desc: "Streaming answers, tailored PDF, live widget code." },
    { num: "04", title: "Take it anywhere", desc: "Continue Instagram chats in Zenoxi. WhatsApp chat is coming soon." },
  ];

  return (
    <SectionWrapper id="how" className={`how-section${standalone ? " standalone-how" : ""}`}>
      <div className="section-header">
        <span className="section-kicker"><Target size={14} /> How It Works</span>
        {standalone ? <h1 id="how-title" className="section-title">Four steps to working smarter</h1> : <h2 id="how-title" className="section-title">Four steps to working smarter</h2>}
      </div>
      <div className="steps-grid">
        {steps.map((step, i) => (
          <motion.article
            key={step.num}
            className="step-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
          >
            <span className="step-number">{step.num}</span>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </motion.article>
        ))}
      </div>
    </SectionWrapper>
  );
}

function FAQSection({ standalone = false }) {
  const [openQuestion, setOpenQuestion] = useState(null);
  const faqId = useId();
  const questions = [
    { question: "What can I do with Zenoxi?", answer: "Use AI chat, analyze and tailor resumes, build a website assistant, and continue Instagram conversations in the Zenoxi app with /web." },
    { question: "Does a resume match score guarantee an interview?", answer: "No. The score is an estimate to help you review how a resume aligns with a job description. Employers use different screening systems and hiring criteria." },
    { question: "Can I tailor a resume without a job description?", answer: "Yes. You can create a general resume draft, or provide a job description for a role-focused draft." },
    { question: "How does the website assistant answer visitors?", answer: "It uses the website and business information configured for that agent to respond to visitor questions. You can also add supporting knowledge sources in the agent setup." },
    { question: "What does /web do in Instagram?", answer: "Send /web in your Instagram conversation to get a link that continues that conversation in the Zenoxi app." },
  ];

  return (
    <SectionWrapper id="faq" className={`faq-section${standalone ? " standalone-faq" : ""}`}>
      <div className="faq-layout">
        <div className="faq-heading">
          <span className="section-kicker"><MessageSquare size={14} /> Common questions</span>
          {standalone ? <h1 id="faq-title" className="section-title">Frequently asked questions</h1> : <h2 id="faq-title" className="section-title">A few things to know.</h2>}
          <p className="section-desc">Quick answers about Zenoxi’s tools and how they work.</p>
        </div>
        <div className="faq-list">
          {questions.map(({ question, answer }, index) => {
            const isOpen = openQuestion === index;
            const answerId = `${faqId}-answer-${index}`;
            return (
              <div className="faq-item" key={question}>
                <h3 className="faq-question">
                  <button type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenQuestion(isOpen ? null : index)}>
                    {question}<span aria-hidden="true">+</span>
                  </button>
                </h3>
                <div id={answerId} className="faq-answer" data-open={isOpen} aria-hidden={!isOpen}>
                  <div className="faq-answer-inner"><p>{answer}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}

function FinalCTA({ onSignIn }) {
  return (
    <SectionWrapper id="cta" className="cta-section">
      <div className="cta-content">
        <motion.div
          className="cta-orb"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
        >
          <Orb3D size={96} state="idle" track />
        </motion.div>
        <motion.h2
          className="cta-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Ready to think clearer?
        </motion.h2>
        <motion.p
          className="cta-desc"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Explore AI chat, resume tools, Instagram chat continuity, and website agents in one place.
        </motion.p>
        <motion.div
          className="cta-buttons"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button className="btn btn-primary btn-lg" onClick={onSignIn}>
            <Sparkles size={18} /> Get started
          </button>
          <button className="btn btn-ghost btn-lg" onClick={onSignIn}>Sign in</button>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

function Footer() {
  return (
    <footer className="landing-footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-brand">
          <a href="/" className="footer-logo" aria-label="Zenoxi home">
            <ZenoxiWordmark />
          </a>
          <p>AI chat, resume tools, and website agents in one workspace.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <div className="footer-column">
            <strong>Product</strong>
            <a href="/ai-chat">AI Chat</a>
            <a href="/website-agent">Website Agents</a>
            <a href="/instagram">Instagram</a>
            <a href="/whatsapp">WhatsApp · Coming soon</a>
            <a href="/resume-tools">Resume Tools</a>
          </div>
          <div className="footer-column">
            <strong>Company</strong>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="/data-deletion">Data Deletion</a>
          </div>
          <div className="footer-column">
            <strong>Connect</strong>
            <a href="mailto:vadlaanilchary225@gmail.com"><Mail size={16} /> Email</a>
            <a href="https://github.com/anilchary225/chat-bot-ai" target="_blank" rel="noopener noreferrer"><Code2 size={16} /> GitHub</a>
          </div>
        </nav>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Zenoxi. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

const DIRECTORY_ICONS = { chat: MessageSquare, agent: Bot, resume: FileText, instagram: Instagram, whatsapp: MessageCircle };

function renderDirectoryIcon(kind) {
  const Icon = DIRECTORY_ICONS[kind];
  return <Icon size={19} />;
}

function FeatureDirectory() {
  const items = [
    { href: "/ai-chat", kind: "chat", title: "AI chat", text: "Think through questions, search the web, and work with your files." },
    { href: "/website-agent", kind: "agent", title: "Website agent", text: "Help visitors find answers from your website and business knowledge.", preview: "Where’s the product guide?" },
    { href: "/resume-tools", kind: "resume", title: "Resume tools", text: "Review job match, tailor a draft, and create a PDF.", preview: "Resume preview" },
    { href: "/instagram", kind: "instagram", title: "Instagram chat", text: "Continue the same conversation in Zenoxi when you send /web.", preview: "Continue in Zenoxi" },
    { href: "/whatsapp", kind: "whatsapp", title: "WhatsApp chat", text: "Another way to chat with Zenoxi.", upcoming: true },
  ];
  return (
    <section id="features" className="feature-directory" aria-labelledby="features-title">
      <div className="feature-directory-heading"><h2 id="features-title">Choose what you need today.</h2></div>
      <div className="feature-directory-grid">
        {items.map(({ href, kind, title, text, preview, upcoming }) => <a
          className={`feature-directory-item directory-${kind}`}
          href={href}
          key={href}
        >
          <span className="directory-top">
            <span className="directory-icon">{renderDirectoryIcon(kind)}</span>
            <ArrowRight className="directory-arrow" size={18} aria-hidden="true" />
          </span>
          <span className="directory-copy">
            <strong>{title}{upcoming && <span className="coming-soon-badge">Coming soon</span>}</strong>
            <span>{text}</span>
          </span>
          {kind === "chat" && <span className="directory-chat-demo" aria-hidden="true">
            <span className="directory-chat-question">Can you summarize this guide?</span>
            <span className="directory-chat-answer"><FileText size={17} /><span>Here are the key points from your file.</span></span>
          </span>}
          {preview && <span className="directory-mini-preview" aria-hidden="true">
            {kind === "instagram" && <code>/web</code>}
            {kind === "resume" && <FileText size={15} />}
            {preview}
          </span>}
        </a>)}
      </div>
    </section>
  );
}

const FEATURE_DETAILS = {
  chat: {
    kicker: "A little more room to think",
    title: "One chat, useful ways to work",
    intro: "Move between questions, documents, and the web without losing the thread.",
    cards: [
      { icon: SearchCheck, title: "Look things up", preview: "Search the web with sources", text: "Turn on web search when you want current information with sources to review." },
      { icon: FileText, title: "Bring your documents", preview: "project-guide.pdf", text: "Attach supported files and ask questions about what they contain." },
      { icon: Instagram, title: "Pick up where you left off", preview: "/web", text: "Send /web in an Instagram chat to continue that conversation in Zenoxi." },
    ],
  },
  agents: {
    kicker: "Set up around your business",
    title: "Answers shaped by your knowledge",
    intro: "Give the agent context, check how it responds, then add it to your website when you’re ready.",
    cards: [
      { icon: FileText, title: "Add useful context", preview: "Website pages and FAQs", text: "Use your website, business profile, notes, FAQs, or uploaded knowledge sources." },
      { icon: MessageSquare, title: "Try real questions", preview: "What are your opening hours?", text: "Test answers in the agent dashboard and refine the information it can use." },
      { icon: Code2, title: "Add the website widget", preview: "<script …>", text: "Configure the look and allowed domains, then use the provided embed snippet." },
    ],
  },
  instagram: {
    kicker: "A simple handoff",
    title: "Your conversation keeps its context",
    intro: "Start in Instagram. Move into Zenoxi only when you need the full workspace.",
    cards: [
      { icon: Instagram, title: "Start in DMs", text: "Ask Zenoxi a question in Instagram.", preview: "Can you help with my resume?" },
      { icon: ArrowRight, title: "Send /web", text: "Send the command to get a private link to your conversation.", preview: "/web" },
      { icon: MessageSquare, title: "Continue in the app", text: "Open the link and pick up the same chat in Zenoxi.", preview: "Conversation continued" },
    ],
  },
  whatsapp: {
    kicker: "While we prepare it",
    title: "Explore the channels available today",
    intro: "WhatsApp chat is not available yet. You can use these Zenoxi experiences now.",
    cards: [
      { icon: Instagram, title: "Instagram chat", preview: "Continue from Instagram DMs", text: "Chat with Zenoxi in Instagram and use /web to continue in the app.", href: "/instagram", link: "See Instagram chat" },
      { icon: Sparkles, title: "AI chat", preview: "Ask a question with a file", text: "Ask questions, search the web, and work with supported documents.", href: "/ai-chat", link: "Explore AI chat" },
      { icon: Briefcase, title: "Resume tools", preview: "Resume match and export", text: "Review a resume match, tailor a draft, and export a document.", href: "/resume-tools", link: "Explore resume tools" },
    ],
  },
  resume: {
    kicker: "From review to a ready draft",
    title: "A practical resume workflow",
    intro: "Use your own experience as the source, then review the draft before you export it.",
    cards: [
      { icon: SearchCheck, title: "Review the match", preview: "Skills and keywords", text: "Compare resume keywords and formatting checks with a job description." },
      { icon: FileText, title: "Tailor your draft", preview: "Role-focused draft", text: "Focus your resume on a role or create a general draft without a job post." },
      { icon: Download, title: "Check and export", preview: "PDF or Word", text: "Review the changes, then download a PDF or Word document. Scores are estimates." },
    ],
  },
};

function FeatureDetails({ component }) {
  const details = FEATURE_DETAILS[component];
  if (!details) return null;
  return (
    <section className="feature-details-section" aria-labelledby="feature-details-title">
      <div className="feature-details-inner">
        <div className="feature-details-heading">
          <span className="section-kicker"><Sparkles size={14} /> {details.kicker}</span>
          <h2 id="feature-details-title">{details.title}</h2>
          <p>{details.intro}</p>
        </div>
        <div className="feature-details-grid" data-feature={component}>
          {details.cards.map(({ icon: Icon, title, text, href, link, preview }) => {
            const Card = href ? "a" : "article";
            const PreviewText = preview === "/web" || preview.startsWith("<") ? "code" : "span";
            return (
              <Card className="feature-detail-card" href={href} key={title}>
                <div className="feature-card-preview" aria-hidden="true">
                  <Icon size={21} />
                  <PreviewText>{preview}</PreviewText>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                {link && <span className="feature-detail-link">{link} <ArrowRight size={15} /></span>}
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Landing({ onSignIn }) {
  const page = PUBLIC_PAGES[window.location.pathname.replace(/\/$/, "")];
  useEffect(() => {
    const title = page ? `${page.title} | Zenoxi` : "Zenoxi — AI Chat, Resume Tools & Website Agents";
    const description = page?.description || "Explore Zenoxi: AI chat, resume ATS match analysis and tailoring, Instagram chat continuity, and website AI agents.";
    document.title = title;
    document.documentElement.classList.add("has-landing-page");
    document.body.style.overflow = "auto";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", description);
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute("content", "https://zenoxi.vercel.app/zenoxi-logo.png");
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", `${window.location.origin}${window.location.pathname}`);
    return () => {
      document.documentElement.classList.remove("has-landing-page");
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className={`landing-page${page ? " feature-route" : ""}`}>
      <Aurora energy={0} />
      <NavBar onSignIn={onSignIn} />
      <main className="landing-main">
        {page ? <>
          {page.component === "chat" && <ChatSection standalone />}
          {page.component === "agents" && <AgentsSection standalone />}
          {page.component === "instagram" && <InstagramSection standalone />}
          {page.component === "whatsapp" && <WhatsAppSection standalone />}
          {page.component === "resume" && <ResumeSection standalone />}
          {page.component === "faq" && <FAQSection standalone />}
          <FeatureDetails component={page.component} />
          <FinalCTA onSignIn={onSignIn} />
        </> : <>
          <Hero onSignIn={onSignIn} />
          <FeatureDirectory />
          <HowItWorks />
          <FAQSection />
          <FinalCTA onSignIn={onSignIn} />
        </>}
      </main>
      <Footer />
      <LandingAssistant />
    </div>
  );
}
