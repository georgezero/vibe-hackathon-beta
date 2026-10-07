# Phase 8 Verified Agent Artifacts

Phase 8 demonstrates a Viby-linked agent producing real Vibe artifacts with a
verifiable identity mark.

## Scope

Implemented demo:

- Admin-only page: `/admin/verified-agent-artifacts`
- Viby callback: `/admin/viby/artifact-callback`
- Artifact selector:
  - Project Summary
  - Elevator Pitch
  - Presentation Summary
- Output: simulated artifact text generated inside Vibe
- Verification: Vibe verifies a Viby agent assertion server-side, hashes the
  final artifact text, signs the artifact payload, and displays a Viby mark
- Framework helper: `lib/verifiedArtifacts.ts`

Not implemented:

- CLI pairing
- `~/.viby`
- local agent credentials
- production API keys
- autonomous agent execution
- team-token replacement
- agent permissions
- persistent artifact storage

## Flow

```text
Vibe admin
-> Verified Agent Artifacts
-> choose artifact type
-> choose project
-> Generate with Viby Agent
-> Viby /apps/vibe-hackathon/start?mode=agent-attribution
-> choose agent
-> consent
-> Viby returns assertionId
-> Vibe verifies assertion server-side
-> Vibe generates artifact text
-> Vibe computes sha256 hash
-> Vibe signs artifact payload
-> Vibe stores signed payload in a short-lived cookie
-> Vibe displays verification mark
```

## Artifact Fields

```text
artifactId
artifactType
title
content
generatedByAgentId
generatedByAgentName
ownerDisplayName
assertionId
sha256
createdAt
```

## Verification Mark

```text
+----------------------------------------------------------------------+
| -v- Demo Agent G1 (George One)                             |
| |i| Project Summary Generation                                       |
| |b| Verified Identity - ast_13f                                      |
| -y- sha256:9daa7b788944                                              |
+----------------------------------------------------------------------+
```

The visible mark is generated from one shared helper and rendered through
`components/viby/VibyArtifactSeal.tsx`:

```text
formatVerifiedArtifactMark()
```

Rules:

- Seal uses ASCII only.
- SHA-256 is truncated to the first 12 characters in the visible mark.
- Assertion ID is truncated to the first 8 characters in the visible mark.
- Seal rows are padded to equal width.
- Mobile scrolls horizontally instead of wrapping the seal.
- Full values remain available in Technical Details.
- The mark is rendered in a fixed-width font.

The signed artifact payload is transported back to the result page in a
short-lived `vibe_verified_artifact` cookie. This avoids large callback URLs and
does not persist artifacts.

Phase 8.3 adds session-scoped recent artifact history in browser
`sessionStorage`, an artifact details page, and copy/download export controls.
This is still not persistent database storage.

## Technical Details

The collapsible technical details panel includes:

- full assertion ID
- full SHA-256
- agent ID
- owner Viby ID
- issued time
- expires time
- actor type

## Security Boundary

Viby confirms the agent identity and human owner relationship.

Vibe Hackathon:

- verifies the assertion server-side
- decides whether to show the artifact
- owns the artifact text
- computes the artifact hash
- signs the display payload
- does not create an admin session from agent assertions
- does not grant agent permissions

## Smoke Test

1. Sign in to Vibe admin.
2. Open `/admin/verified-agent-artifacts`.
3. Choose `Project Summary`.
4. Choose a project.
5. Click `Generate with Viby Agent`.
6. In Viby, choose an agent such as George's Pi Agent.
7. Allow consent.
8. Confirm Vibe returns to the verified artifact page.
9. Confirm the page shows:
   - artifact text
   - agent display name
   - owner display name
   - `Project Summary Generation`
   - `sha256:<12-char hash>`
   - truncated Viby assertion ID
10. Repeat for `Elevator Pitch` and confirm the signature line says
    `Elevator Pitch Generation`.
11. Repeat for `Presentation Summary` and confirm the signature line says
    `Presentation Summary Generation`.
12. Expand Technical Details and confirm full hash/assertion/agent/owner fields
    are present.
13. Tamper with the `artifact` query value and confirm Vibe rejects the payload.
14. Repeat and deny consent in Viby; confirm no artifact is generated.
