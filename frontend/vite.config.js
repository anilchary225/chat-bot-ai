import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function serveLegalPages(server) {
  server.middlewares.use((request, _response, next) => {
    const page = request.url?.match(/^\/(privacy|terms|data-deletion)\/?(\?.*)?$/);
    if (page && (request.method === "GET" || request.method === "HEAD")) {
      request.url = `/${page[1]}.html${page[2] ?? ""}`;
    }
    next();
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "zenoxi-legal-pages",
      configureServer: serveLegalPages,
      configurePreviewServer: serveLegalPages,
    },
  ],
  server: { host: "127.0.0.1", port: 5173 }
});
