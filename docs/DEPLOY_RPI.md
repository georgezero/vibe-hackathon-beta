# Deploy Vibe Hackathon on a Raspberry Pi

This guide deploys the app as a production Next.js service on a Raspberry Pi or similar Linux host, with an optional Cloudflare Tunnel hostname.

Assumptions:
- User is `george`.
- Repo path is `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`.
- Node.js and npm are installed.
- `cloudflared` is installed if using Cloudflare Tunnel.
- The app listens on port `3000`.

Replace `YOUR_HOSTNAME` with the public hostname, for example:

```txt
vibe-hackathon-dev.example.com
```

## 1. Clone the repo

```bash
ssh <machine>

mkdir -p ~/Downloads/src/ai/agentpacs
cd ~/Downloads/src/ai/agentpacs
git clone git@github.com:georgezero/vibe-hackathon-landing-dev.git vibe-hackathon
cd vibe-hackathon
```

If the repo already exists:

```bash
cd ~/Downloads/src/ai/agentpacs/vibe-hackathon
git pull --ff-only
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment

Create `.env.local`:

```bash
cat > .env.local <<'EOF_ENV'
NODE_ENV=production
DB_FILE_NAME=local.db
VIBE_HACKATHON_BASE_URL=https://YOUR_HOSTNAME
VIBY_BASE_URL=https://YOUR_VIBY_HOSTNAME
VIBY_APP_SLUG=vibe-hackathon
VIBE_ADMIN_VIBY_USER_IDS=replace-with-reviewed-viby-user-ids
VIBE_ADMIN_SESSION_SECRET=replace-with-random-admin-session-secret-at-least-32-characters
VIBE_JUDGE_SESSION_SECRET=replace-with-independent-random-judge-session-secret-at-least-32-characters
BETTER_AUTH_SECRET=replace-with-random-32-byte-secret
BETTER_AUTH_URL=https://YOUR_HOSTNAME
NEXT_PUBLIC_BETTER_AUTH_URL=https://YOUR_HOSTNAME
VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=false
AI_JUDGE_MODE=mock
EOF_ENV
```

Important:
- Use exact `NODE_ENV=production`. Missing, empty, test, or unknown runtime
  values still enforce production-safe admin rules and never enable seed or
  development login behavior.
- `VIBE_HACKATHON_BASE_URL` must match the public URL used by Cloudflare/Vercel/etc.
- `VIBE_ADMIN_VIBY_USER_IDS` must contain the exact reviewed organizer identities.
- `VIBE_ADMIN_SESSION_SECRET` must be an independent random value of at least 32 characters.
- `VIBE_JUDGE_SESSION_SECRET` must be a different server-only random value of
  at least 32 characters. It signs 12-hour judge sessions and never falls back
  to the admin or Better Auth secret.
- Keep `VIBE_ENABLE_ADMIN_DEV_FALLBACK` unset or false in production.
- `BETTER_AUTH_SECRET` is required even when GitHub OAuth is disabled.
- `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=false` enables badge/email team ownership with no GitHub OAuth setup.
- If `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=true`, also set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- External AI eval prompts, curl commands, import URLs, and submission done-page prompts use this value.
- Judge login and every judge mutation also require this exact canonical origin.

## 4. Create or update the database

```bash
npm run db:push
```

Seed data as needed:

```bash
# Minimal real/demo seed
npm run db:seed

# Full simulation dataset
npm run db:seed:sim

# Mixed real + simulation data
npm run db:seed:mixed
```

Do not copy a live SQLite `local.db` between machines while the app is running. If you must copy DB files, stop the service first and include WAL/SHM files or checkpoint SQLite. The safer default is to run `npm run db:push` and seed locally.

For existing event databases, be careful with `npm run db:push`: it may detect destructive changes and ask for confirmation. Do not force destructive migrations on a deployed event DB without a backup. Prefer additive schema updates that preserve existing submissions, deterministic AI reviews, LLM AI evals, human scores, and audience votes.

## 5. Build production app

```bash
npm run build
```

## 6. Create the Next.js user service

Create a systemd user service:

```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/vibe-hackathon.service <<'EOF_SERVICE'
[Unit]
Description=Vibe Hackathon Next.js production server
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/george/Downloads/src/ai/agentpacs/vibe-hackathon
Environment=NODE_ENV=production
ExecStart=/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/node_modules/.bin/next start -H 0.0.0.0 -p 3000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF_SERVICE
```

Enable and start it:

```bash
systemctl --user daemon-reload
systemctl --user enable vibe-hackathon.service
systemctl --user restart vibe-hackathon.service
```

Enable lingering so the user service starts after reboot before login:

```bash
loginctl enable-linger george
```

Check service status:

```bash
systemctl --user status vibe-hackathon.service
curl -I http://localhost:3000
```

## 7. Configure Cloudflare Tunnel

Login if needed:

```bash
cloudflared tunnel login
```

Create a named tunnel:

```bash
cloudflared tunnel create vibe-hackathon-dev
cloudflared tunnel route dns vibe-hackathon-dev YOUR_HOSTNAME
```

Get the tunnel ID:

```bash
TUNNEL_ID=$(cloudflared tunnel list | awk '$2 == "vibe-hackathon-dev" {print $1; exit}')
echo "$TUNNEL_ID"
```

Create tunnel config. Name the file descriptively — e.g. `vibe-hackathon-dev-SHORTNAME.yml` where SHORTNAME reflects the domain:

```bash
mkdir -p ~/.cloudflared

cat > ~/.cloudflared/vibe-hackathon-dev-SHORTNAME.yml <<EOF_TUNNEL
tunnel: ${TUNNEL_ID}
credentials-file: /home/george/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: YOUR_HOSTNAME
    service: http://localhost:3000
  - service: http_status:404
EOF_TUNNEL
```

## 8. Create the Cloudflare Tunnel user service

Name the service to match the config file:

```bash
cat > ~/.config/systemd/user/vibe-hackathon-cloudflared-SHORTNAME.service <<'EOF_SERVICE'
[Unit]
Description=Cloudflare tunnel for Vibe Hackathon
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cloudflared tunnel --config /home/george/.cloudflared/vibe-hackathon-dev-SHORTNAME.yml run
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF_SERVICE
```

Enable and start it:

```bash
systemctl --user daemon-reload
systemctl --user enable vibe-hackathon-cloudflared-SHORTNAME.service
systemctl --user restart vibe-hackathon-cloudflared-SHORTNAME.service
```

Check tunnel status:

```bash
systemctl --user status vibe-hackathon-cloudflared-SHORTNAME.service
curl -I https://YOUR_HOSTNAME
```

DNS may take a minute to resolve after `cloudflared tunnel route dns`.

## 9. Common operations

Update an existing deployment without replacing the local DB:

```bash
cd ~/Downloads/src/ai/agentpacs/vibe-hackathon
git pull --ff-only
npm install
npm run build
systemctl --user restart vibe-hackathon.service
```

Do not run seed commands on a live/staging event unless the goal is to reset data.

Restart app:

```bash
systemctl --user restart vibe-hackathon.service
```

Restart tunnel (substitute your SHORTNAME):

```bash
systemctl --user restart vibe-hackathon-cloudflared-SHORTNAME.service
```

Follow app logs:

```bash
journalctl --user -u vibe-hackathon.service -f
```

Follow tunnel logs:

```bash
journalctl --user -u vibe-hackathon-cloudflared-SHORTNAME.service -f
```

Check active processes on port 3000:

```bash
lsof -i :3000
```

If a manual `nohup`, `npm run start`, or `next start` process is squatting on port 3000, stop that process and restart the service:

```bash
kill <pid>
systemctl --user restart vibe-hackathon.service
```

## 10. Health and release checks

```bash
curl http://localhost:3000/api/health
curl https://YOUR_HOSTNAME/api/health
```

Admin release routes:

```txt
/admin/dashboard/demo-checklist
/admin/dashboard/release-checklist
/admin/dashboard/event-settings
/admin/dashboard/winners
```

Portable event bundle:

Download it from the authenticated admin Export tab. The export API requires a
signed organizer session and current Viby allowlist, so a bare curl request is
rejected.
