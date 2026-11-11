import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig, motion } from "framer-motion";
import App from "./App";
import AuthScreen from "./components/AuthScreen";
import Orb from "./components/Orb";
import { API } from "./config";
import { getToken, installAuthFetch, setToken } from "./auth";
import "./styles.css";

installAuthFetch(API);

function Root() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => !!getToken());

  useEffect(() => {
    if (!getToken()) return;
    fetch(`${API}/api/auth/me`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(setUser)
      .catch((status) => { if (status === 401) setToken(null); })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const out = () => setUser(null);
    window.addEventListener("zenoxi:signed-out", out);
    return () => window.removeEventListener("zenoxi:signed-out", out);
  }, []);

  const signOut = async () => {
    try { await fetch(`${API}/api/auth/logout`, { method: "POST" }); } catch { /* offline */ }
    setToken(null);
    setUser(null);
  };

  return (
    <MotionConfig reducedMotion="user">
      {/* Keyed swap with enter animations only; a "wait" exit can stall when the
          outgoing screen re-renders mid-animation, leaving a blank page. */}
      {checking ? (
        <motion.div key="splash" className="splash" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Orb size={88} state="thinking" />
        </motion.div>
      ) : user ? (
        <motion.div key="app" className="root-fill" initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>
          <App user={user} onSignOut={signOut} />
        </motion.div>
      ) : (
        <motion.div key="auth" className="root-fill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
          <AuthScreen api={API} onSignedIn={setUser} />
        </motion.div>
      )}
    </MotionConfig>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><Root /></React.StrictMode>
);
