import { motion } from "framer-motion";
import { AlertCircle, FileCode2, FileSpreadsheet, FileText, LoaderCircle, X } from "lucide-react";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TEXT_EXT = [
  "txt", "md", "markdown", "csv", "tsv", "json", "log", "xml", "yaml", "yml", "html", "htm", "css",
  "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "h", "cs", "go", "rs", "rb", "php", "sql", "sh", "ini", "toml"
];
const EXTENSIONS = ["pdf", "docx", ...TEXT_EXT];
export const ACCEPT = EXTENSIONS.map((ext) => `.${ext}`).join(",");

const ext = (name = "") => name.split(".").pop().toLowerCase();
export const isSupported = (name) => EXTENSIONS.includes(ext(name));

function iconFor(kind) {
  if (["csv", "tsv"].includes(kind)) return FileSpreadsheet;
  if (["pdf", "docx", "txt", "md", "markdown"].includes(kind)) return FileText;
  return FileCode2;
}

function detail(item) {
  if (item.status === "uploading") return "Reading…";
  if (item.status === "error") return item.error;
  const kind = (item.kind || ext(item.filename)).toUpperCase();
  return item.pages ? `${kind} · ${item.pages} page${item.pages === 1 ? "" : "s"}` : kind;
}

/** File chip used in the composer (removable) and on sent messages (compact). */
export function AttachmentChip({ item, onRemove, compact = false }) {
  const kind = item.kind || ext(item.filename);
  const Icon = item.status === "error" ? AlertCircle : iconFor(kind);
  return (
    <motion.div
      layout
      className={`file-chip ${item.status} ${compact ? "compact" : ""}`}
      initial={{ opacity: 0, scale: 0.85, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
      title={item.status === "error" ? `${item.filename}: ${item.error}` : item.filename}
    >
      <span className={`file-icon kind-${kind}`}>
        {item.status === "uploading" ? <LoaderCircle size={15} className="spin" /> : <Icon size={15} />}
      </span>
      <span className="file-text">
        <span className="file-name">{item.filename}</span>
        <span className="file-meta">{detail(item)}</span>
      </span>
      {onRemove && (
        <button type="button" className="file-remove" aria-label={`Remove ${item.filename}`} onClick={onRemove}>
          <X size={13} />
        </button>
      )}
      {item.status === "uploading" && <span className="file-progress" />}
    </motion.div>
  );
}
