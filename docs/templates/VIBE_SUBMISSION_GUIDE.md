# Vibe Hackathon — Submission Guide

This guide explains how to submit a project to Vibe Hackathon — both the web form and the agent-native API path.

---

## What you need to submit

| File | Required | Description |
|------|----------|-------------|
| `vibe.json` | Yes | Machine-readable manifest — the canonical record |
| `README.md` | Yes | Public project overview |
| `AGENTS.md` | Yes | Instructions for coding agents to run/deploy this repo |
| `LICENSE` | Yes | Open-source license (MIT or BSD-3-Clause preferred) |
| `.env.example` | Yes | Env var template — **no real secrets** |
| `docs/vibe-submission.md` | Recommended | Narrative form explaining your approach |
| `docs/agent-report.md` | Optional | Detailed agent workflow evidence |
| `docs/prompts.md` | Optional | Key prompts used during development |

**Never commit to GitHub:** edit tokens, real `.env` values, API keys, or credentials of any kind.

---

## Option A — Web form submission

1. Go to [/submit](/submit)
2. Enter your team name and contact email → get a private edit link
3. Fill out the form sections (team, project, artifacts, AI tools, docs)
4. Click **Save progress** at any time
5. Click **Submit** when ready — this triggers the AI repo review
6. You can edit again before the deadline even after submitting

**Your edit link:** `https://vibe-hackathon.example.com/submit/<edit_token>`

Save this link. Share it only with your team. It's the only way to edit your submission.

---

## Option B — Agent-native API submission

The preferred workflow for AI agents. Your agent can submit an entire project in three API calls.

### Step 1 — Get requirements

```bash
curl https://vibe-hackathon.example.com/api/v1/requirements
```

Returns the full spec including valid field values, budget tiers, and harness names.

### Step 2 — Create from vibe.json

```bash
curl -X POST https://vibe-hackathon.example.com/api/v1/submissions/from-repo \
  -H "Content-Type: application/json" \
  -d "{\"vibe_json\": $(cat vibe.json)}"
```

Response:
```json
{
  "id": "sub_abc12345",
  "editToken": "edit_xxxxxxxxxxxxxxxx",
  "editUrl": "https://...",
  "status": "draft",
  "validationResult": { "valid": true, "score": 95, "warnings": [] }
}
```

### Step 3 — Store your edit token safely

**Never commit the edit token to your repo.** Store it in your environment:

```bash
# Add to your local .env (already in .gitignore)
echo "VIBE_EDIT_TOKEN=edit_xxxxxxxxxxxxxxxx" >> .env
echo "VIBE_SUBMISSION_ID=sub_abc12345" >> .env
```

Or in your CI/CD secrets if you're automating updates.

### Step 4 — Update before the deadline

```bash
curl -X PATCH https://vibe-hackathon.example.com/api/v1/submissions/$VIBE_SUBMISSION_ID \
  -H "Authorization: Bearer $VIBE_EDIT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"demoVideoUrl": "https://www.loom.com/share/...", "screenshotUrls": ["https://your-demo.vercel.app/screenshot.png"]}'
```

You can update any field any number of times before the deadline.

### Step 5 — Validate your repo

```bash
curl -X POST https://vibe-hackathon.example.com/api/v1/validate-repo \
  -H "Content-Type: application/json" \
  -d '{"github_url": "https://github.com/your-org/your-repo"}'
```

Returns a full scoring breakdown: repo compliance, documentation, reproducibility, deployment, agent readiness.

### Step 6 — Finalize

```bash
curl -X POST https://vibe-hackathon.example.com/api/v1/submissions/$VIBE_SUBMISSION_ID/finalize \
  -H "Authorization: Bearer $VIBE_EDIT_TOKEN"
```

This triggers the deterministic AI review of your GitHub repo. You will receive scores across 5 dimensions.

**You can still update your submission after finalizing**, as long as the submission deadline hasn't passed.

### Step 7 — Check status

```bash
curl https://vibe-hackathon.example.com/api/v1/submissions/$VIBE_SUBMISSION_ID/status
```

Returns current status, validation state, and public vote count. Does not expose your edit token.

---

## Secret hygiene

| Do | Don't |
|----|-------|
| Store edit token in `.env` (gitignored) | Commit edit token to GitHub |
| Share edit link only with your team | Post edit link publicly |
| Use `.env.example` for env var templates | Use `.env.example` for real values |
| Keep `ANTHROPIC_API_KEY` out of git | Hardcode API keys in source files |

Your `.gitignore` should include at minimum:
```
.env
.env.local
*.env
```

---

## Deadline behavior

| Before deadline | After deadline |
|----------------|----------------|
| Create submissions: ✓ | Create submissions: ✗ (403) |
| Update submissions: ✓ | Update submissions: ✗ (403) |
| Finalize: ✓ | Finalize: ✗ (403) |
| View projects: ✓ | View projects: ✓ |
| Audience voting: depends on event settings | Audience voting: depends on event settings |

---

## Source tracking

Updates are tracked by source for analytics:

- `web` — submitted via the web form at `/submit/:token`
- `api` — submitted via REST API directly
- `mcp` — submitted via the MCP server tools

This is recorded in audit logs but not exposed publicly.

---

## MCP tool workflow

If your agent uses the Vibe Hackathon MCP server:

```
vibe.list_requirements          → fetch spec and valid field values
vibe.validate_repo              → score your GitHub repo
vibe.create_submission          → create draft, returns edit token
vibe.update_submission          → update fields before deadline
vibe.finalize_submission        → lock + trigger AI review
vibe.get_submission_status      → check current state
```

Run the MCP server locally:
```bash
VIBE_BASE_URL=https://vibe-hackathon.example.com npm run mcp
```

---

## Checklist before deadline

- [ ] `vibe.json` is in repo root and passes validation
- [ ] `README.md` has install, run, and usage sections
- [ ] `AGENTS.md` has install, run, and architecture sections
- [ ] `LICENSE` file present (MIT or BSD-3-Clause preferred)
- [ ] `.env.example` has all required variables (no real values)
- [ ] Demo URL is live and accessible
- [ ] Screenshot URL returns a real image
- [ ] `docs/vibe-submission.md` filled out (recommended)
- [ ] Submission finalized before deadline
- [ ] Edit token is NOT committed to GitHub
