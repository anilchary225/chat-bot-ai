// Session token for the signed-in user, attached to every request to the API.
const TOKEN = "zenoxi-token";

export function getToken() {
  try { return localStorage.getItem(TOKEN); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN, token);
    else localStorage.removeItem(TOKEN);
  } catch { /* storage blocked: session lasts for this tab only */ }
}

let installed = false;

/**
 * Wrap window.fetch so every call to our API carries the bearer token, and a
 * 401 (expired session) signs the user out everywhere in the app.
 */
export function installAuthFetch(apiBase) {
  if (installed) return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.startsWith(apiBase)) return original(input, init);
    const token = getToken();
    const headers = new Headers(init.headers || {});
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    const response = await original(input, { ...init, headers });
    if (response.status === 401 && token && !url.includes("/api/auth/")) {
      setToken(null);
      window.dispatchEvent(new Event("zenoxi:signed-out"));
    }
    return response;
  };
}
