# Load balancing with nginx

Run several copies of the Zenoxi API behind nginx, so traffic is shared and one crashed copy doesn't take the
service down.

```
            ┌──────────────┐     least_conn      ┌─────────┐
 Internet → │    nginx     │ ──────────────────► │  api1   │ ┐
   :80/443  │ rate limits, │ ──────────────────► │  api2   │ ├─► MongoDB Atlas, OpenRouter, …
            │ streaming,   │ ──────────────────► │  api3   │ ┘
            │ failover     │                     └─────────┘
            └──────────────┘
```

## When to use it

- **Render free plan:** not possible (one instance only, and no custom proxy). Keep using Render as is.
- **Render paid plans** have their own load balancer: increase the instance count in **Settings → Scaling**; you don't
  need this nginx setup.
- **Your own server** (for example Oracle Cloud's Always Free 4-core VM, or any VPS): use this folder.

## Run it

1. Install Docker with the Compose plugin on the server and clone the repository.
2. Create `backend/.env` with the production settings (see [Configuration](../../docs/CONFIGURATION.md)).
3. From the repository root:
   ```bash
   docker compose -f deploy/nginx/docker-compose.yml up -d --build
   ```
4. Check: `curl http://<server-ip>/api/health` and `curl http://<server-ip>/nginx-health`.
5. Point the frontend's `VITE_API_URL` (and `PUBLIC_API_URL`, and the Meta webhook URLs) at the new address.

**HTTPS:** put Cloudflare (free) in front of the server, or add a TLS `server` block with Let's Encrypt
certificates (certbot). Meta webhooks and Google sign-in require HTTPS.

## What the nginx config does

| Setting | Why |
|---|---|
| `least_conn` upstream with 3 servers | Sends each request to the least busy copy; good for long streaming answers. |
| `max_fails=3 fail_timeout=15s` | A failing copy is skipped for 15 seconds. |
| `proxy_buffering off` | Chat answers stream token by token instead of arriving all at once. |
| `proxy_read_timeout 300s` | AI answers and resume tailoring can take a while. |
| `client_max_body_size 12m` | Allows 10 MB uploads. |
| `limit_req` zones | Per-IP limits: 15 requests/s for the app, 5/s for the public widget API. |
| `X-Real-IP` header | The backend's own rate limits see the visitor's real IP. |
| gzip for JSON only | Never compresses `application/x-ndjson` streams (that would break streaming). |
| `keepalive 32` | Reuses connections to the backends. |

## Running several copies safely

The backend keeps no state in memory, so any copy can serve any request:
- Sessions, rate limits, answer cache, link codes and chats are all in MongoDB.
- Scheduled jobs (lead reports, follow-up emails) take a lock in MongoDB for each 30-minute slot, so they run **once**
  even with three copies.

To change the number of copies, add or remove `apiN` services in `docker-compose.yml` and the matching `server`
lines in `nginx.conf`. Each copy uses roughly 150–250 MB of RAM.
