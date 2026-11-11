import { motion } from "framer-motion";
import { Globe } from "lucide-react";

/** Animated row of web sources used for an answer. */
export default function Sources({ sources }) {
  return (
    <div className="sources" aria-label="Sources">
      <div className="sources-label"><Globe size={12} /> Sources</div>
      <div className="sources-row">
        {sources.map((source, index) => (
          <motion.a
            key={source.url}
            className="source-chip"
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.title}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24, delay: index * 0.06 }}
            whileHover={{ y: -2 }}
          >
            <span className="source-num">{index + 1}</span>
            <span className="source-text">
              <span className="source-domain">{source.domain}</span>
              <span className="source-title">{source.title}</span>
            </span>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
