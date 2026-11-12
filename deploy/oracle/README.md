# Oracle Always Free backend deployment

> **Legacy:** this describes an older Zenoxi that ran Ollama models. The backend now uses OpenRouter, so these
> instructions no longer match the code. Use [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md) instead.

This setup runs the FastAPI backend and Ollama on the same Oracle VM. Ollama is only reachable on the private Docker network; Caddy publishes the API over HTTPS. Ollama's model files and Caddy's certificates are stored in persistent Docker volumes.

## 1. Create the VM

In Oracle Cloud, create an Ubuntu 24.04 ARM VM using the Always Free Ampere A1 shape. Allocate up to 2 OCPUs and 12 GB RAM if Oracle offers that capacity in your home region, and use a persistent boot volume. Assign a reserved public IPv4 address so the DNS record stays stable.

In the VM's subnet security rules, allow inbound TCP 80 and 443 from `0.0.0.0/0`. Allow SSH (TCP 22) only from your own public IP. Do not open ports 8000 or 11434. Also add corresponding ingress rules to Ubuntu's firewall if it is enabled.

Oracle can report out-of-capacity for free shapes. If that happens, try again later or use another eligible availability domain in your home region.

## 2. Point a free hostname at the VM

Create a free DuckDNS hostname and point it at the VM's reserved public IP. Use that hostname for `API_DOMAIN`; Caddy will request and renew HTTPS certificates automatically after ports 80 and 443 are reachable.

## 3. Install Docker Compose

SSH into the VM and install Docker Engine and the Docker Compose plugin by following Docker's official Ubuntu installation instructions:

<https://docs.docker.com/engine/install/ubuntu/>

Clone this repository on the VM, then run these commands from its root:

```bash
cp deploy/oracle/.env.example deploy/oracle/.env
nano deploy/oracle/.env
docker compose --env-file deploy/oracle/.env -f deploy/oracle/docker-compose.yml up -d --build
```

Set `API_DOMAIN` to your DuckDNS hostname. Set `MONGODB_URI` to the app's Atlas connection string. In Atlas Network Access, allow the VM's reserved public IP. Keep `deploy/oracle/.env` private; it contains the database credential.

The first startup downloads `qwen3.5:0.8b` into a persistent volume and may take a few minutes. Check startup with:

```bash
docker compose --env-file deploy/oracle/.env -f deploy/oracle/docker-compose.yml ps
docker compose --env-file deploy/oracle/.env -f deploy/oracle/docker-compose.yml logs -f backend ollama model-init caddy
```

Verify the API at `https://<API_DOMAIN>/api/health`.

## 4. Connect Vercel to the backend

In the Vercel project's Production environment variables, set:

```text
VITE_API_URL=https://<API_DOMAIN>
```

Redeploy the frontend. The backend's `FRONTEND_ORIGIN` must match the deployed Vercel frontend origin exactly. The example uses `https://chat-bot-ai-anil-charys-projects.vercel.app`.

## Notes

- This is a small hobby deployment. Oracle Always Free capacity may be unavailable, and OCI may reclaim instances it classifies as idle.
- CPU-only inference works for this small model but can be slower than local GPU inference.
- Configure authentication and rate limits before sharing the app widely; the current MVP does not provide user accounts or per-user chat isolation.
- Back up MongoDB Atlas data separately. The Ollama volume contains downloaded model files, not chat history.
