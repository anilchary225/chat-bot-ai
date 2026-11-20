import { useEffect, useRef } from "react";
import { API } from "../config";

const SITE_ASSISTANT_KEY = "agt_zenoxi_site_v1";

export default function LandingAssistant() {
  const mount = useRef(null);

  useEffect(() => {
    const container = mount.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = "/widget.js";
    script.async = true;
    script.dataset.agent = SITE_ASSISTANT_KEY;
    script.dataset.api = API;
    script.dataset.mount = "parent";
    container.appendChild(script);

    return () => container.replaceChildren();
  }, []);

  return <div ref={mount} />;
}
