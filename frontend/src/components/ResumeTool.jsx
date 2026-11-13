import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import {
  ArrowRight, Check, CheckCircle2, ClipboardPaste, Copy, Download, FileText, Lightbulb, Trash2,
  LoaderCircle, RotateCcw, Sparkles, Target, Upload, X, XCircle
} from "lucide-react";
import Orb from "./Orb";

const RESUME_ACCEPT = ".pdf,.docx,.txt,.md";
const STEPS = ["Reading your resume", "Matching job keywords", "Rewriting bullet points", "Building the ATS template"];

function ScoreRing({ value, label, size = 132, delay = 0 }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = useTransform(mv, (v) => circumference * (1 - v / 100));
  const tone = value >= 75 ? "good" : value >= 50 ? "ok" : "low";

  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.4, delay, ease: [0.2, 0.8, 0.2, 1] });
    return () => controls.stop();
  }, [value, delay, mv]);

  return (
    <div className={`score-ring tone-${tone}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} />
        <motion.circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className="ring-center">
        <motion.strong>{rounded}</motion.strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function KeywordList({ title, items, kind }) {
  if (!items.length) return null;
  return (
    <div className="kw-block">
      <div className="kw-title">{kind === "hit" ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {title} · {items.length}</div>
      <div className="kw-chips">
        {items.map((item, i) => (
          <motion.span
            key={item}
            className={`kw-chip ${kind}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.4 + i * 0.035 }}
          >{item}</motion.span>
        ))}
      </div>
    </div>
  );
}

function Checks({ checks }) {
  return (
    <ul className="ats-checks">
      {checks.map((check, i) => (
        <motion.li
          key={check.id}
          className={check.ok ? "ok" : "bad"}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 + i * 0.06 }}
        >
          {check.ok ? <Check size={15} /> : <X size={15} />}
          <span>
            <strong>{check.label}</strong>
            {check.detail && <em> · {check.detail}</em>}
            {!check.ok && <small>{check.tip}</small>}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

function dates(item) {
  return item.start && item.end ? `${item.start} - ${item.end}` : item.start || item.end || "";
}

const Sep = () => <span className="rp-sep">◇</span>;

function joinWith(items, render = (x) => x) {
  return items.flatMap((item, i) => (i ? [<Sep key={`s${i}`} />, <span key={i}>{render(item)}</span>] : [<span key={i}>{render(item)}</span>]));
}

/** On-screen preview of the same one-page template the PDF/DOCX use. */
function ResumePaper({ resume, layout }) {
  const c = resume.contact;
  const first = [c.phone, c.location, c.note].filter(Boolean);
  const second = [c.email, c.linkedin, c.github, c.website].filter(Boolean);
  const href = (v) => (/^https?:\/\//.test(v) ? v : v.includes("@") ? `mailto:${v}` : `https://${v}`);
  return (
    <motion.article
      className="resume-paper"
      initial={{ opacity: 0, y: 30, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.2 }}
    >
      {layout && (
        <span className={`rp-fit ${layout.one_page ? "ok" : "warn"}`}>
          {layout.one_page ? `Fits on 1 page${layout.scale < 1 ? ` · scaled to ${Math.round(layout.scale * 100)}%` : ""}` : "Longer than 1 page: trim some text"}
        </span>
      )}
      <header>
        <h2>{(resume.name || "Your Name").toUpperCase()}</h2>
        {resume.headline && <p>{resume.headline}</p>}
        {first.length > 0 && <p>{joinWith(first)}</p>}
        {second.length > 0 && <p className="rp-links">{joinWith(second, (v) => <a href={href(v)} target="_blank" rel="noopener noreferrer">{v}</a>)}</p>}
      </header>
      {resume.summary && (<section><h3>{resume.summary_title || "Summary"}</h3><p className="rp-just">{resume.summary}</p></section>)}
      {resume.education.length > 0 && (
        <section>
          <h3>Education</h3>
          {resume.education.map((e, i) => (
            <div key={i} className="rp-item">
              <div className="rp-row"><span><strong>{e.degree}</strong>{e.school && `, ${e.school}`}{e.location && `, ${e.location}`}</span><span>{dates(e)}</span></div>
              {e.score && <p className="rp-muted">{e.score}</p>}
            </div>
          ))}
        </section>
      )}
      {resume.skills.length > 0 && (
        <section>
          <h3>Skills</h3>
          <div className="rp-skills">
            {resume.skills.map((g, i) => (
              <div key={i}><strong>{g.group}</strong><span>{g.items.join(", ")}</span></div>
            ))}
          </div>
        </section>
      )}
      {resume.experience.length > 0 && (
        <section>
          <h3>Experience</h3>
          {resume.experience.map((job, i) => (
            <div key={i} className="rp-item">
              <div className="rp-row"><strong>{job.title}</strong><span>{dates(job)}</span></div>
              {(job.company || job.location) && <div className="rp-row"><span>{job.company}</span><em>{job.location}</em></div>}
              <ul>{job.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
            </div>
          ))}
        </section>
      )}
      {resume.projects.length > 0 && (
        <section>
          <h3>Projects</h3>
          {resume.projects.map((p, i) => (
            <p key={i} className="rp-item rp-just">
              <strong>{p.name.replace(/\.$/, "")}.</strong>{" "}
              {p.tech && <em>Tech: {p.tech}. </em>}{p.description}
            </p>
          ))}
        </section>
      )}
      {resume.activities?.length > 0 && (
        <section><h3>Extra-Curricular Activities</h3>
          <ul>{resume.activities.map((a, i) => <li key={i}><strong>{a.title}</strong>{a.detail && ` — ${a.detail}`}</li>)}</ul>
        </section>
      )}
      {resume.certifications.length > 0 && (
        <section><h3>Certifications</h3>
          <ul>{resume.certifications.map((c2, i) => <li key={i}><strong>{c2.name}</strong>{c2.issuer && ` — ${c2.issuer}`}</li>)}</ul>
        </section>
      )}
      {resume.personal?.length > 0 && (
        <section><h3>Personal</h3>
          {resume.personal.map((p, i) => <p key={i}><strong>{p.label}:</strong> {p.value}</p>)}
        </section>
      )}
    </motion.article>
  );
}

export default function ResumeTool({ api }) {
  const [mode, setMode] = useState("file");
  const [file, setFile] = useState(null);
  const [pasted, setPasted] = useState("");
  const [jd, setJd] = useState("");
  const [stage, setStage] = useState("input"); // input | analyzing | analyzed | tailoring | done
  const [analysis, setAnalysis] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [over, setOver] = useState(false);
  const [downloading, setDownloading] = useState("");
  const fileRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (stage !== "tailoring") return undefined;
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2600);
    return () => clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (stage === "analyzed" || stage === "done") {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [stage]);

  const hasResume = mode === "file" ? !!file : pasted.trim().length >= 50;
  const canAnalyze = hasResume && jd.trim().length >= 30 && stage !== "analyzing" && stage !== "tailoring";
  const canTailorGeneral = hasResume && stage !== "analyzing" && stage !== "tailoring";

  const pickFile = (f) => {
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "txt", "md"].includes(ext)) { setError("Use a PDF, Word (.docx) or text resume."); return; }
    if (f.size > 10 * 1024 * 1024) { setError("Resume files can be up to 10 MB."); return; }
    setError("");
    setFile(f);
  };

  const runAnalyze = async () => {
    if (!canAnalyze) return;
    setStage("analyzing");
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("job_description", jd.trim());
      if (mode === "file") form.append("file", file);
      else form.append("resume_text", pasted.trim());
      const res = await fetch(`${api}/api/resume/analyze`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Couldn't analyze this resume.");
      setAnalysis(data.analysis);
      setResumeText(data.resume_text);
      setStage("analyzed");
    } catch (err) {
      setError(err.message || "Couldn't analyze this resume.");
      setStage("input");
    }
  };

  const runTailor = async () => {
    setStage("tailoring");
    setError("");
    try {
      const res = await fetch(`${api}/api/resume/tailor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: resumeText, job_description: jd.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Couldn't generate the resume.");
      setResult(data);
      setStage("done");
    } catch (err) {
      setError(err.message || "Couldn't generate the resume.");
      setStage("analyzed");
    }
  };

  const runGeneralTailor = async () => {
    if (!canTailorGeneral) return;
    setStage("tailoring");
    setError("");
    setAnalysis(null);
    setResult(null);
    try {
      const form = new FormData();
      if (mode === "file") form.append("file", file);
      else form.append("resume_text", pasted.trim());
      const res = await fetch(`${api}/api/resume/tailor-general`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Couldn't generate the resume.");
      setResult(data);
      setStage("done");
    } catch (err) {
      setError(err.message || "Couldn't generate the resume.");
      setStage("input");
    }
  };

  const download = async (format) => {
    setDownloading(format);
    try {
      const res = await fetch(`${api}/api/resume/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: result.resume })
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(result.resume.name || "resume").replace(/[^A-Za-z0-9]+/g, "_")}_ATS_Resume.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(`Couldn't create the ${format.toUpperCase()} file. Try again.`);
    } finally {
      setDownloading("");
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const reset = () => {
    setStage("input"); setAnalysis(null); setResult(null); setError(""); setFile(null); setPasted(""); setJd("");
  };

  return (
    <div className="resume-tool">
      <motion.div className="rt-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <span className="rt-badge"><Target size={14} /> Resume ATS Match</span>
        <h1>Tailor your resume to <span className="rt-grad">any job</span></h1>
        <p>Tailor your resume to a specific job description or create a general ATS-friendly draft without one. Zenoxi keeps your experience grounded in the resume you provide.</p>
      </motion.div>

      <div className="rt-inputs">
        <motion.div className="rt-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <div className="rt-card-head">
            <strong><FileText size={16} /> Your resume</strong>
            <div className="rt-tabs" role="tablist">
              {[["file", "Upload"], ["paste", "Paste"]].map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={mode === key} className={mode === key ? "on" : ""} onClick={() => setMode(key)}>
                  {mode === key && <motion.span layoutId="rt-tab" className="rt-tab-bg" />}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          {mode === "file" ? (
            <div
              className={`rt-drop ${over ? "over" : ""} ${file ? "has-file" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); pickFile(e.dataTransfer.files[0]); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
            >
              <input ref={fileRef} type="file" accept={RESUME_ACCEPT} hidden onChange={(e) => { pickFile(e.target.files[0]); e.target.value = ""; }} />
              <AnimatePresence mode="wait">
                {file ? (
                  <motion.div key="file" className="rt-file" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                    <span className="file-icon kind-pdf"><FileText size={18} /></span>
                    <span><strong>{file.name}</strong><em>{(file.size / 1024).toFixed(0)} KB · click to change</em></span>
                  </motion.div>
                ) : (
                  <motion.div key="empty" className="rt-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.span className="drop-icon" animate={{ y: [0, -5, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
                      <Upload size={22} />
                    </motion.span>
                    <strong>Drop your resume here</strong>
                    <span>PDF, Word (.docx) or text · up to 10 MB</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <textarea className="rt-text" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste your resume text here…" aria-label="Resume text" />
          )}
        </motion.div>

        <motion.div className="rt-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <div className="rt-card-head">
            <strong><ClipboardPaste size={16} /> Job description</strong>
            <span className="rt-count">{jd.trim().split(/\s+/).filter(Boolean).length} words</span>
          </div>
          <textarea className="rt-text" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job description: responsibilities, requirements, nice-to-haves…" aria-label="Job description" />
        </motion.div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p className="rt-error" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <XCircle size={15} /> {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="rt-actions">
        <motion.button type="button" className="rt-primary" disabled={!canAnalyze} onClick={runAnalyze} whileHover={canAnalyze ? { scale: 1.03 } : undefined} whileTap={canAnalyze ? { scale: 0.97 } : undefined}>
          {stage === "analyzing" ? <LoaderCircle size={17} className="spin" /> : <Target size={17} />}
          {stage === "analyzing" ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze match"}
        </motion.button>
        <motion.button type="button" className="rt-secondary" disabled={!canTailorGeneral} onClick={runGeneralTailor} whileHover={canTailorGeneral ? { scale: 1.03 } : undefined} whileTap={canTailorGeneral ? { scale: 0.97 } : undefined}>
          {stage === "tailoring" && !analysis ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}
          {stage === "tailoring" && !analysis ? "Building resume…" : "Tailor without a job description"}
        </motion.button>
        {(analysis || file || jd) && stage !== "tailoring" && (
          <button type="button" className="rt-ghost" onClick={reset}><RotateCcw size={15} /> Start over</button>
        )}
      </div>

      <div ref={resultsRef} />
      <AnimatePresence mode="wait">
        {analysis && stage !== "done" && (
          <motion.section key="analysis" className="rt-results" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="rt-score-row">
              <ScoreRing value={analysis.score} label="match" />
              <div className="rt-score-text">
                <h2>{analysis.score >= 75 ? "Strong match" : analysis.score >= 50 ? "Decent match, room to improve" : "Low match for this job"}</h2>
                <p>Keywords {analysis.keyword_score}% · Format {analysis.format_score}%</p>
                <p className="rt-note">An estimate based on keyword coverage and common ATS formatting rules. Every company's ATS scores a little differently.</p>
              </div>
            </div>
            <KeywordList title="Matched keywords" items={analysis.matched} kind="hit" />
            <KeywordList title="Missing keywords" items={analysis.missing} kind="miss" />
            <Checks checks={analysis.checks} />

            {stage === "tailoring" ? (
              <motion.div className="rt-working" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Orb size={64} state="thinking" />
                <div>
                  <AnimatePresence mode="wait">
                    <motion.strong key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                      {STEPS[step]}…
                    </motion.strong>
                  </AnimatePresence>
                  <span>This can take up to a minute on free models.</span>
                </div>
              </motion.div>
            ) : (
              <motion.button type="button" className="rt-primary rt-big" onClick={runTailor} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Sparkles size={18} /> Generate tailored ATS resume <ArrowRight size={17} />
              </motion.button>
            )}
          </motion.section>
        )}

        {stage === "done" && result && (
          <motion.section key="done" className="rt-results" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            {result.mode === "general" ? (
              <div className="rt-score-text rt-general-result">
                <h2>Your general resume draft is ready</h2>
                <p>No job description was used, so this result has no job-match score. Add a job description to check role-specific keyword coverage.</p>
                <p className="rt-note">Use “Clear resume data” to remove the uploaded or pasted resume and generated draft from this page. A PDF you downloaded stays in your device’s downloads.</p>
                <div className="rt-download">
                  <motion.button type="button" className="rt-primary" onClick={() => download("pdf")} disabled={!!downloading} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    {downloading === "pdf" ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />} Download PDF
                  </motion.button>
                  <button type="button" className="rt-ghost" onClick={() => download("docx")} disabled={!!downloading}>
                    {downloading === "docx" ? <LoaderCircle size={15} className="spin" /> : <FileText size={15} />} Word (.docx)
                  </button>
                  <button type="button" className="rt-ghost" onClick={copyText}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy text"}</button>
                  <button type="button" className="rt-ghost" onClick={reset}><Trash2 size={15} /> Clear resume data</button>
                </div>
              </div>
            ) : <div className="rt-compare">
              <ScoreRing value={result.before.score} label="before" size={112} />
              <motion.span className="rt-arrow" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}><ArrowRight size={22} /></motion.span>
              <ScoreRing value={result.after.score} label="after" size={112} delay={0.6} />
              <div className="rt-score-text">
                <h2>Your tailored resume is ready</h2>
                <p>Keywords {result.before.keyword_score}% → {result.after.keyword_score}% · Format {result.before.format_score}% → {result.after.format_score}%</p>
                <div className="rt-download">
                  <motion.button type="button" className="rt-primary" onClick={() => download("pdf")} disabled={!!downloading} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    {downloading === "pdf" ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />} Download PDF
                  </motion.button>
                  <button type="button" className="rt-ghost" onClick={() => download("docx")} disabled={!!downloading}>
                    {downloading === "docx" ? <LoaderCircle size={15} className="spin" /> : <FileText size={15} />} Word (.docx)
                  </button>
                  <button type="button" className="rt-ghost" onClick={copyText}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy text"}</button>
                  <button type="button" className="rt-ghost" onClick={() => setStage("analyzed")}><RotateCcw size={15} /> Back</button>
                  <button type="button" className="rt-ghost" onClick={reset}><Trash2 size={15} /> Clear resume data</button>
                </div>
              </div>
            </div>}

            <div className="rt-two">
              {result.resume.changes.length > 0 && (
                <div className="rt-panel">
                  <h3><CheckCircle2 size={16} /> Changes applied</h3>
                  <ul>{result.resume.changes.map((c, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>{c}</motion.li>
                  ))}</ul>
                </div>
              )}
              {(result.resume.suggestions.length > 0 || (result.mode !== "general" && result.after.missing.length > 0)) && (
                <div className="rt-panel warn">
                  <h3><Lightbulb size={16} /> {result.mode === "general" ? "Details to review" : "Add only if true"}</h3>
                  <p>{result.mode === "general" ? "Review these suggestions and add details only when they accurately describe your experience:" : "These job keywords aren't backed by your current resume, so Zenoxi didn't add them. If you have this experience, add it in your own words:"}</p>
                  <div className="kw-chips">
                    {[...new Set([...result.resume.suggestions, ...(result.mode === "general" ? [] : result.after.missing)])].slice(0, 14).map((s) => <span key={s} className="kw-chip miss">{s}</span>)}
                  </div>
                </div>
              )}
            </div>

            <ResumePaper resume={result.resume} layout={result.layout} />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
