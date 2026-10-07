# Vibe Hackathon Beta

A competition platform for AI-assisted hackathons: project submissions, team workspaces, human judging, reproducibility reviews, audience voting, published awards, and event administration.

The application uses Next.js 16, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM, Better Auth, and SQLite. This guide uses a persistent local SQLite database for both development and deployment.

## Install and run locally

Requirements: Node.js 22 LTS, npm, Git, and a Linux/macOS environment. If installation needs to compile `better-sqlite3`, install Python 3 and your platform's C/C++ build tools (`build-essential` on Debian/Ubuntu, Xcode Command Line Tools on macOS).

```bash
git clone git@github.com:georgezero/vibe-hackathon-beta.git
cd vibe-hackathon-beta
npm ci
cp .env.example .env.local
openssl rand -hex 32
```

Put the generated secret in `.env.local`, and set these values:

```dotenv
BETTER_AUTH_SECRET=replace_with_the_generated_secret
BETTER_AUTH_URL=http://localhost:3000
VIBE_HACKATHON_BASE_URL=http://localhost:3000
VIBE_JUDGE_EVENT_ID=evt_kentucky_vibes
AI_JUDGE_MODE=mock
```

Create the Kentucky/Bluegrass demo database, then start the application:

```bash
npm run db:seed:kentucky
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Public pages read the database; a fresh checkout needs the seed or a separately initialized event. No external AI API key is needed for the demo.

## Seed the fake Kentucky / Bluegrass projects

`db:seed:kentucky` creates the current schema from scratch and runs the existing deterministic Kentucky Vibes fixture generator. It activates `evt_kentucky_vibes`, with fake teams, participants, judges, assignments, completed scorecards, reproducibility reviews, finalists, and private team chat fixtures. It does not copy an existing event database.

Project titles cycle through **Bluegrass Workflow Atlas**, **Derby Signal Studio**, **Cumberland Care Compass**, **Riverbend Report Relay**, and **Appalachian Imaging Loop**. Institutions include Bluegrass Medical Center, Cumberland Imaging Institute, Derby Health Labs, Riverbend University Hospital, and Appalachian AI Collaborative.

| Profile | Projects | Accounts | Judges | Completed evaluations |
| --- | ---: | ---: | ---: | ---: |
| `small` | 10 | 25 | 6 | 25 |
| `realistic` (default) | 75 | 150 | 30 | 250 |
| `stress` | 100 | 200 | 50 | 300 |

```bash
# Default: 75 projects, deterministic seed 20260802
npm run db:seed:kentucky

# Alternative: a new, smaller database
DB_FILE_NAME="$PWD/data/kentucky-small.sqlite" \
  npm run db:seed:kentucky -- --profile small --seed 20260802
```

The command refuses to replace any existing database. To create another demo, choose a new `DB_FILE_NAME`; do not rerun it over a live event. The default database is `local.db`. For a custom path, also set `DB_FILE_NAME` in the application's environment. CLI scripts read exported environment variables; they do not automatically load `.env.local`.

Keep `VIBE_JUDGE_EVENT_ID=evt_kentucky_vibes` when running this dataset. Fake artifact URLs use `.example.invalid`, so demos, repositories, and screenshots are placeholders. Some projects remain drafts, some reviews remain incomplete, audience voting starts disabled, and winners start unpublished. Fewer than the total project count therefore appear in the public gallery. Native team chat is off unless `VIBE_NATIVE_TEAM_CHAT_ENABLED=true` is configured.

The seed prints the path to a private `data/credentials/kentucky-*.json` file containing synthetic owner, teammate, and judge logins. These accounts can sign in at `/login`; judge authorizations are already scoped to the Kentucky event. The file is mode `0600` and Git ignores the whole `data/` directory. The seed does not create an administrator; provision one below.

Advanced snapshot, simulation, and restore workflows are documented in [Event database operations](docs/runbooks/EVENT_DATABASE_OPERATIONS.md). The older `db:event:seed:kentucky-vibes` command expects an existing snapshot; use `db:seed:kentucky` for a clean checkout.

## Create an administrator

Password authentication is supported without a Viby deployment. Provision an application administrator against the intended SQLite file. This command requires an absolute database path and an operator-owned password file with mode `0600`.

```bash
export DB_FILE_NAME="$PWD/local.db"
admin_password_file="$(mktemp)"
chmod 600 "$admin_password_file"
# Type the administrator's password and press Enter (input is hidden).
read -r -s -p 'Administrator password: ' admin_password
printf '\n'
printf '%s\n' "$admin_password" > "$admin_password_file"
unset admin_password

VIBE_ADMIN_PROVISION_CONFIRM="PROVISION_PASSWORD_ADMIN:$DB_FILE_NAME:admin@example.com" \
  npm run admin:provision-password -- \
  --email admin@example.com --name 'Event Administrator' \
  --password-file "$admin_password_file"
rm "$admin_password_file"
```

Run this example in **Bash** (`read -p` differs in other shells). Replace `admin@example.com` with your actual administrator email in both places. Sign in at `/login`, then open `/admin/dashboard`. Provisioning retains existing credentials; it is not a password reset command.

Viby login is optional. To enable it, configure `VIBY_BASE_URL`, `VIBY_APP_SLUG`, an independent `VIBY_CALLBACK_STATE_SECRET`, and reviewed admin/staff allowlists in the environment. GitHub OAuth is also optional; when enabled, configure `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and the callback `https://YOUR_DOMAIN/api/auth/callback/github`.

## Deploy on a Linux server

Use a persistent server or container volume for SQLite, with one application instance sharing the database. The following Debian/Ubuntu example installs the application under `/srv/vibe-hackathon-beta`, runs it on loopback port 3000, and uses an HTTPS reverse proxy. Replace `YOUR_DOMAIN` and all secrets before building. Run repository and npm commands as your deployment user, not root.

```bash
sudo apt-get update
sudo apt-get install -y git build-essential python3 nginx openssl
# Install Node.js 22 LTS, then verify node --version and npm --version.
sudo install -d -o "$USER" -g "$(id -gn)" /srv/vibe-hackathon-beta
git clone git@github.com:georgezero/vibe-hackathon-beta.git /srv/vibe-hackathon-beta
cd /srv/vibe-hackathon-beta
npm ci
mkdir -p data
cp .env.example .env.production.local
chmod 600 .env.production.local
# Run twice: use a different generated value for each secret below.
openssl rand -hex 32
openssl rand -hex 32
```

Edit `.env.production.local`:

```dotenv
DB_FILE_NAME=/srv/vibe-hackathon-beta/data/event.sqlite
BETTER_AUTH_SECRET=replace_with_first_generated_secret
BETTER_AUTH_URL=https://YOUR_DOMAIN
VIBE_HACKATHON_BASE_URL=https://YOUR_DOMAIN
VIBE_ADMIN_SESSION_SECRET=replace_with_second_generated_secret
VIBE_JUDGE_EVENT_ID=evt_kentucky_vibes
AI_JUDGE_MODE=mock
VIBE_ENABLE_ADMIN_DEV_FALLBACK=false
```

The canonical URL must be an HTTPS origin without a path or trailing slash. Next.js loads `.env.production.local` for production builds and startup. Use explicit environment variables for CLI database commands:

```bash
# For a DEMO deployment with fake projects only:
DB_FILE_NAME=/srv/vibe-hackathon-beta/data/event.sqlite \
  VIBE_EVENT_SIMULATION=1 npm run db:seed:kentucky

# Provision an administrator using the previous section, with this DB_FILE_NAME.
export DB_FILE_NAME=/srv/vibe-hackathon-beta/data/event.sqlite
npm run build
```

For a real event, initialize an empty database instead of seeding fake projects:

```bash
DB_FILE_NAME=/srv/vibe-hackathon-beta/data/event.sqlite \
  VIBE_DB_BOOTSTRAP_CONFIRM='CREATE CURRENT SCHEMA DATABASE /srv/vibe-hackathon-beta/data/event.sqlite' \
  npm run db:migrate -- --bootstrap
```

Then provision an administrator, create/configure the actual event in Event Settings, set `VIBE_JUDGE_EVENT_ID` to that event's ID, and build. The real-event bootstrap and demo seed are alternatives; each requires a new database target.

Create `/etc/systemd/system/vibe-hackathon-beta.service` (replace `DEPLOY_USER` and verify the npm path with `command -v npm`):

```ini
[Unit]
Description=Vibe Hackathon Beta
After=network.target

[Service]
Type=simple
User=DEPLOY_USER
WorkingDirectory=/srv/vibe-hackathon-beta
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000
Restart=on-failure
RestartSec=5
UMask=0077

[Install]
WantedBy=multi-user.target
```

If Node/npm were installed through a version manager, supply their absolute paths and a `PATH` containing the Node binary directory in the service. Systemd does not load your interactive shell configuration.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vibe-hackathon-beta
curl --fail http://127.0.0.1:3000/api/health
```

Point your domain's DNS at the server. Use this Nginx site as the initial port-80 proxy, then obtain a TLS certificate using your normal certificate workflow (for example, Certbot's Nginx integration). The public site must use HTTPS, matching the configured canonical origin.

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

Save the site in `/etc/nginx/sites-available/vibe-hackathon-beta`, enable it in `sites-enabled`, check `sudo nginx -t`, and reload Nginx. On Debian/Ubuntu, the remaining steps can be:

```bash
sudo ln -s /etc/nginx/sites-available/vibe-hackathon-beta /etc/nginx/sites-enabled/vibe-hackathon-beta
sudo nginx -t
sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
curl --fail https://YOUR_DOMAIN/api/health
```

Verify `/projects`, `/status`, `/presentation`, administrator login, and a seeded judge login. `/winners` stays empty until results are published. View service logs with `sudo journalctl -u vibe-hackathon-beta -n 100 --no-pager`.

Persist `data/event.sqlite` across releases. Back up through the authenticated admin Export tab or the SQLite online snapshot tools; copying a live SQLite file without its WAL can miss writes. Stop the service before upgrades that modify the database. Existing installations use `npm run db:migrate` with `DB_FILE_NAME` and `VIBE_DB_MIGRATION_CONFIRM="MIGRATE ALL DATABASE /absolute/path/to/event.sqlite"`, followed by `npm run build` and a service restart. Snapshot/restore commands have their own exact confirmations; see the database operations guide.

Do not use ephemeral/serverless filesystem storage for this SQLite deployment. The application also has a libSQL/Turso adapter, but the bootstrap, Kentucky seed, and password provisioning commands in this guide target local SQLite.

## Useful commands and documentation

```bash
npm run lint
npm test
npm run validate:presentation-rotation
npm run db:studio
```

- [Participant guide](docs/participants/GETTING_STARTED.md)
- [Judge guide](docs/judging/JUDGE_GUIDE.md)
- [Administrator guide](docs/admin/ADMIN_GUIDE.md)
- [Event-day operations](docs/runbooks/EVENT_DAY_OPERATIONS.md)
- [Submission requirements](docs/SUBMISSION_SPEC_v1.md)
- [MCP tools](docs/MCP.md)

Official rankings combine completed human judging (70%) with deterministic AI reproducibility scoring (30%). Audience voting remains a separate People's Choice result. Private contact details, badge numbers, edit tokens, and credentials are excluded from public pages and APIs.
