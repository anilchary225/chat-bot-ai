// Private chat keys this browser holds. Chats linked to WhatsApp/Instagram are
// private: they don't appear in the public list and need their key to open.
const STORE = "zenoxi-chat-keys";

function read() {
  try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; }
}

export function saveKey(chatId, key) {
  if (!chatId || !key) return;
  try { localStorage.setItem(STORE, JSON.stringify({ ...read(), [chatId]: key })); } catch { /* ignore */ }
}

export function forgetKey(chatId) {
  const keys = read();
  delete keys[chatId];
  try { localStorage.setItem(STORE, JSON.stringify(keys)); } catch { /* ignore */ }
}

/** Header for one chat's requests. */
export function keyHeaders(chatId, extra = {}) {
  const key = read()[chatId];
  return key ? { ...extra, "X-Chat-Key": key } : extra;
}

/** Header that lets the chat list include this browser's private chats. */
export function listHeaders() {
  const pairs = Object.entries(read()).slice(-50).map(([id, key]) => `${id}:${key}`);
  return pairs.length ? { "X-Chat-Keys": pairs.join(",") } : {};
}
