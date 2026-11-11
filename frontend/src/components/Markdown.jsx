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

function Markdown({ children, streaming }) {
  return (
    <div className={`markdown-body ${streaming ? "streaming" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>{children}</ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
