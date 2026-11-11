# Render Free backend

`render.yaml` defines a free Render web service for the FastAPI backend. Create it from the Render Dashboard by selecting **New > Blueprint** and connecting this GitHub repository. During setup, provide `MONGODB_URI` as a secret environment variable; do not add it to this repository.

After creation, set the Vercel project's Production environment variable `VITE_API_URL` to the service's `https://<service>.onrender.com` URL, then redeploy the frontend.

## Ollama Cloud

The Render Blueprint configures the backend to call Ollama Cloud at `https://ollama.com` with the `gemma4:31b` cloud model. Render cannot reach Ollama on your computer at `127.0.0.1:11434`.

Before chatting, create an Ollama API key and add it to the Render service as the secret environment variable `OLLAMA_API_KEY`. Keep the key in Render; never put it in frontend code or commit it to Git. The cloud model name and API availability follow Ollama's current account limits and plans.

The Render Free service can take about a minute to wake after being idle. It still requires a working `MONGODB_URI` to start.
