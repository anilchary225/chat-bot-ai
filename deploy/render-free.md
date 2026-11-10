# Render Free backend

`render.yaml` defines a free Render web service for the FastAPI backend. Create it from the Render Dashboard by selecting **New > Blueprint** and connecting this GitHub repository. During setup, provide `MONGODB_URI` as a secret environment variable; do not add it to this repository.

After creation, set the Vercel project's Production environment variable `VITE_API_URL` to the service's `https://<service>.onrender.com` URL, then redeploy the frontend.

## Ollama limitation

The service defaults to `OLLAMA_BASE_URL=http://127.0.0.1:11434`, which points to the Render instance itself. Render Free gives a web service 512 MB RAM, spins it down after 15 minutes of inactivity, and does not provide a persistent disk. It cannot host this app's local Ollama model. For replies to work, configure `OLLAMA_BASE_URL` to an Ollama API that Render can reach. A temporary Cloudflare Quick Tunnel can expose Ollama running on your Mac for a demo, but its hostname changes, your Mac must stay online, and Quick Tunnels are intended for testing.

Once `OLLAMA_BASE_URL` points to an available model endpoint, verify `GET /api/health` and send a chat message. The Render free service can take about a minute to wake after being idle.
