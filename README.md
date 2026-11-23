# AethexFlow Complete Independent Deploy v5.1

Frontend + single Edge Worker + Aethi Local Hub.

The site intent parser remains deterministic. D1 stores global site settings and their audit trail only. Chat history, copilot history, activity, and local task drafts stay in the user's browser storage; they are not written to D1.

---

## Layout

```
aethexflow-complete/
├── frontend/                 ← Vite + React app (fixed)
│   ├── src/aethex/...
│   ├── scripts/              ← Vite plugins, migrations, and preview helpers
│   ├── migrations/           ← shared app/auth schemas
│   ├── server/               ← server middleware
│   ├── package.json
│   └── vite.config.ts
├── workers/aethexflow-edge/  ← single Worker (AI + routing)
│   ├── worker.js
│   └── wrangler.toml
├── hub/
│   └── aethi_hub.py          ← local Windows hub v5
├── scripts/
│   └── deploy.sh
└── README.md
```

---

## Fake claims fixed

| Was | Now |
|-----|-----|
| `Enterprise • v4.3 Edge Production` | `Workspace` |
| Seeded "2 min ago Completed" log | Empty until real actions |
| "Pinned Production Modules" | "Pinned Tools" |
| Generic `Ready` status | `Browser` / `Local` (honest) |

---

## Deploy order

### 1. Edge Worker (AI backend)

```bash
cd workers/aethexflow-edge
npx wrangler deploy
npx wrangler secret put ADMIN_OWNER_KEY   # required for the Admin Gateway
```

The D1 binding for `aethexflow-production` is declared in `wrangler.toml`. The Admin Gateway requires a random `ADMIN_OWNER_KEY` of at least 32 characters, applies a five-attempt lockout, and uses the existing D1 `site_settings`, `site_updates`, `owner_audit`, and `auth_rate_limits` tables. It does not store user chats, attachments, or local device requests.

Test:
```bash
curl -sS https://aethexflow-edge.<account>.workers.dev/api/health
curl -sS -X POST https://aethexflow-edge.<account>.workers.dev/api/chat \
  -H 'content-type: application/json' -d '{"message":"ping"}'
```

### 2. Frontend (Pages)

```bash
cd frontend
npm install
npm run build
# Deploy dist/ (or Vite outDir) to Cloudflare Pages project
npx wrangler pages deploy dist --project-name=aethexflow-studio
```

Point worker `PAGES_ORIGIN` at your Pages URL, then redeploy worker:

```toml
# workers/aethexflow-edge/wrangler.toml [vars]
PAGES_ORIGIN = "https://aethexflow-studio.pages.dev"
APEX_DOMAIN  = "aethexflow.online"
```

### 3. Custom domain

Workers Triggers → Custom Domains:
- aethexflow.online
- www.aethexflow.online
- api.aethexflow.online

### 4. Local Hub

```bash
python hub/aethi_hub.py
```

Pair with 6-digit code from the site.

---

## Architecture

```
Browser
  → aethexflow-edge (1 Worker)
       /api/chat  → Workers AI (llama-3.3-70b)
       /api/admin/* → owner-checked site intent parser → D1
       /api/health, /api/owner/claims
       /*         → Pages static (frontend)
  → optional Aethi Hub 127.0.1.1:251
```

No multi-worker service bindings required for AI.

The Admin Gateway only applies recognized site-setting intents. Local device requests are not sent through a tunnel or stored in D1; they remain on the device until a supported local Hub action is explicitly connected.

---

## Owner truth check

```bash
curl -sS https://YOUR_WORKER/api/owner/claims \
  -H "X-Owner-Key: YOUR_KEY"
```

---

## Notes

- Frontend build scripts, migrations, and server middleware are included in this checkout.
- The frontend Vite config uses Nitro's Vercel preset while the deploy example above describes Cloudflare Pages static hosting. Align and verify the frontend deployment target before release.
- `ADMIN_OWNER_KEY` must be configured before the Admin Gateway can authenticate. There is no default passcode.
- Selecting Workspace or Online AI sends the current prompt, recent context, and attached files to that selected AI service for a reply. Select a local model in Settings to keep inference on the device.
