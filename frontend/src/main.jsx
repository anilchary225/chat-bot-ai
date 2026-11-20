import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig, motion, AnimatePresence } from "framer-motion";
import App from "./App";
import AuthScreen from "./components/AuthScreen";
import Landing, { isPublicLandingPath } from "./components/Landing";
import Orb from "./components/Orb";
import { API } from "./config";
import { getToken, installAuthFetch, setToken } from "./auth";
import "./styles.css";

installAuthFetch(API);

function requestsApp() {
  return new URLSearchParams(window.location.search).get("app") === "true";
}

function Root() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "checking";
    const params = new URLSearchParams(window.location.search);
    if (requestsApp() || params.get("signin") === "true" || params.get("signup") === "true") return "auth";
    return "landing";
  });

  useEffect(() => {
    const token = getToken();
    const publicFeatureRoute = isPublicLandingPath(window.location.pathname);
    const appRequested = requestsApp();
    if (!token) {
      setChecking(false);
      return;
    }
    fetch(`${API}/api/auth/me`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((u) => {
        setUser(u);
        setView(publicFeatureRoute && !appRequested ? "landing" : "app");
      })
      .catch((status) => {
        if (status === 401) setToken(null);
        setView(appRequested ? "auth" : "landing");
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const out = () => { setUser(null); setView("landing"); };
    window.addEventListener("zenoxi:signed-out", out);
    return () => window.removeEventListener("zenoxi:signed-out", out);
  }, []);

  const signOut = async () => {
    try { await fetch(`${API}/api/auth/logout`, { method: "POST" }); } catch { /* offline */ }
    setToken(null);
    setUser(null);
    setView("landing");
  };

  const handleSignIn = () => setView(user ? "app" : "auth");

  // If checking auth, show splash
  if (checking) {
    return (
      <MotionConfig reducedMotion="user">
        <motion.div key="splash" className="splash" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Orb size={88} state="thinking" />
        </motion.div>
      </MotionConfig>
    );
  }

  // If user is signed in, show app
  if (user && view === "app") {
    return (
      <MotionConfig reducedMotion="user">
        <motion.div key="app" className="root-fill" initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>
          <App user={user} onSignOut={signOut} />
        </motion.div>
      </MotionConfig>
    );
  }

  // Show auth screen
  if (view === "auth") {
    return (
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait">
          <motion.div key="auth" className="root-fill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <AuthScreen api={API} onSignedIn={(u) => { setUser(u); setView("app"); }} />
          </motion.div>
        </AnimatePresence>
      </MotionConfig>
    );
  }

  // Default: show landing page
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div key="landing" className="root-fill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <Landing onSignIn={handleSignIn} />
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><Root /></React.StrictMode>
);
