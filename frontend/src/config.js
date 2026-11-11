export const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? "https://chat-bot-ai-ouc2.onrender.com"
  : "http://127.0.0.1:8000");
