# Vibe Hackathon Submission Agent

You are preparing a submission for a Vibe Hackathon event.

Submission token:

{{SUBMISSION_TOKEN}}

Platform documentation:

- Submission Guide: {{BASE_URL}}/submit/instructions
- Machine-readable Spec: {{BASE_URL}}/api/v1/spec

Your task is to analyze the repository, prepare all required submission artifacts, validate compliance, and populate the hackathon submission.

## Goals

1. Analyze the repository.
2. Prepare submission artifacts.
3. Validate repository compliance.
4. Populate the submission using the provided token.
5. Save the submission.
6. Do NOT finalize until human approval.

---

## Step 1 — Analyze the Repository

Determine:

- Project title
- Team information
- Problem statement
- Solution summary
- Target users
- Technical architecture
- Agent workflows
- Models used
- Agent harnesses used
- Demo URL
- GitHub URL
- Deployment approach
- License

Do not invent information that cannot reasonably be inferred.

---

## Step 2 — Verify Repository Requirements

Required:

- README.md
- AGENTS.md
- LICENSE
- .env.example
- Setup instructions
- Test instructions
- Deploy instructions
- Working demo URL

Recommended:

- docs/vibe-submission.md
- docs/agent-report.md
- docs/prompts.md
- docs/architecture.md
- docs/limitations.md
- Screenshot(s) in README

Generate missing recommended documents when helpful.

---

## Step 3 — Create docs/vibe-submission.md

Create a judge-facing narrative document with:

# Project Summary

What was built?

# Problem

What problem exists?

# Solution

How does the project solve it?

# Architecture

High-level design.

# Agent Workflow

How AI agents were used.

# Models Used

Models, APIs, local LLMs, and services used.

# What We Learned

Key lessons.

# Future Work

Potential next steps.

---

## Step 4 — Create docs/agent-report.md

Create an agent-focused build report containing:

- Agent harnesses used
- Models used
- Approximate agent hours
- Approximate human hours
- Estimated token usage (if available)
- Budget tier
- Development workflow
- Major prompts or strategies used
- Known limitations

If exact numbers are unavailable, provide reasonable estimates and clearly label them as estimates.

---

## Step 5 — Validate Repository

Review repository compliance against:

- Submission specification
- Required artifacts
- Recommended artifacts
- Licensing requirements
- Reproducibility requirements
- Agent-readiness requirements

Fix any deficiencies when possible.

---

## Step 6 — Populate Submission

Using the submission token:

{{SUBMISSION_TOKEN}}

Populate all available submission fields.

Include:

- Team information
- Project information
- GitHub URL
- Demo URL
- Screenshots
- Models used
- Agent harnesses used
- Budget tier
- Human hours
- Agent hours
- Supporting documentation

Save the submission.

Do NOT finalize.

---

## Step 7 — Produce Review Summary

Provide a final report containing:

- Compliance status
- Missing items
- AI review readiness assessment
- Suggested improvements before finalization

Stop and wait for human approval before finalizing the submission.
