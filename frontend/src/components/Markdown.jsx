import { memo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function CodeBlock({ node, children, ...props }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  const className = children?.props?.className || "";
  const lang = className.replace("language-", "") || "code";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref.current?.innerText || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-lang"><i /><i /><i /> {lang}</span>
        <button type="button" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre ref={ref} {...props}>{children}</pre>
    </div>
  );
}

function Link({ node, title, children, ...props }) {
  if (title === "zenoxi-cite") {
    return <a {...props} className="cite" target="_blank" rel="noopener noreferrer">{children}</a>;
  }
  return <a {...props} title={title} target="_blank" rel="noopener noreferrer">{children}</a>;
}

const components = { pre: CodeBlock, a: Link };

/** Turn "[2]" citations into links to the matching web source. */
function linkCitations(text, sources) {
  if (!sources?.length) return text;
  return text.replace(/\[(\d{1,2})\](?![(\[])/g, (match, n) => {
    const source = sources[Number(n) - 1];
    const url = source?.url.replace(/[()\s<>"]/g, (c) => encodeURIComponent(c));
    return source ? `[${n}](${url} "zenoxi-cite")` : match;
  });
}

function Markdown({ children, streaming, sources }) {
  return (
    <div className={`markdown-body ${streaming ? "streaming" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {linkCitations(children, sources)}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
