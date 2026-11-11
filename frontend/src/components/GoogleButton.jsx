import { useEffect, useRef, useState } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT = "https://accounts.google.com/gsi/client";
let loader;

function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  loader ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { loader = null; reject(new Error("Couldn't load Google sign-in.")); };
    document.head.appendChild(script);
  });
  return loader;
}

export const googleEnabled = Boolean(CLIENT_ID);

/**
 * Google's official "Continue with Google" button (Google Identity Services).
 * Calls onCredential with the signed ID token for the backend to verify.
 */
export default function GoogleButton({ onCredential, onError, text = "continue_with" }) {
  const slot = useRef(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;
    loadGoogle()
      .then(() => {
        if (cancelled || !slot.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => callback.current(response.credential),
          ux_mode: "popup",
          use_fedcm_for_prompt: true,
        });
        const dark = document.documentElement.dataset.theme === "dark";
        slot.current.innerHTML = "";
        window.google.accounts.id.renderButton(slot.current, {
          type: "standard",
          theme: dark ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text,
          logo_alignment: "center",
          width: Math.min(slot.current.offsetWidth || 360, 400),
        });
      })
      .catch((err) => { setFailed(true); onError?.(err.message); });
    return () => { cancelled = true; };
  }, [text, onError]);

  if (!CLIENT_ID) return null;
  return (
    <div className="google-slot">
      <div ref={slot} className="google-btn" />
      {failed && <p className="auth-error">Google sign-in couldn't load. Use the email code instead.</p>}
    </div>
  );
}
