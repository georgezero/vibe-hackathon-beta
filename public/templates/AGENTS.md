# AGENTS.md — [Your Project Name]

AI coding agent runbook. Everything an agent needs to understand, run, modify, and deploy this project.

---

## Understanding This Repo

[1–3 sentences describing what this project does and its core architecture. Be specific — mention the framework, database, and key external services.]

**Stack:** Next.js · TypeScript · SQLite (Drizzle) · Tailwind

---

## Install

```bash
npm install
cp .env.example .env.local
# Fill in .env.local with required values (see .env.example)
```

---

## Run Locally

```bash
npm run dev
# App available at http://localhost:3000
```

---

## Seed / Sample Data

```bash
npm run db:push    # Apply schema to local DB
npm run db:seed    # Load sample data (idempotent)
```

[Describe what sample data is loaded and any important notes about the data.]

---

## Test

```bash
npm test
# or
npm run test:e2e
```

[Describe test coverage and any important test patterns.]

---

## Architecture

```
src/
  app/          # Next.js App Router pages and API routes
  lib/          # Business logic, DB client, utilities
  components/   # Shared UI components
```

[Add a brief description of the key files or modules an agent should know about.]

Key files:
- `lib/db/schema.ts` — database schema
- `lib/db/seed.ts` — seed script
- `app/api/` — API routes

---

## Deploy

```bash
npm run build
npm run start
```

[Describe the production deploy target (Vercel, Railway, etc.) and any environment variables required.]

---

## Environment Variables

All required variables are in `.env.example`. Never commit `.env` or `.env.local`.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite file path or Turso connection string |
| `ANTHROPIC_API_KEY` | Required for AI review features |

---

## Agent Notes

[Any additional context an AI agent needs — quirks, known issues, what NOT to change, etc.]

- Do not modify `lib/db/schema.ts` without running `npm run db:push` after
- API routes use `Authorization: Bearer <token>` for auth
- All routes are server components by default; client components are named `*Client.tsx`

---

*Generated from the Vibe Hackathon AGENTS.md template.*
*See [docs/templates/VIBE_SUBMISSION_GUIDE.md](VIBE_SUBMISSION_GUIDE.md) for submission instructions.*
