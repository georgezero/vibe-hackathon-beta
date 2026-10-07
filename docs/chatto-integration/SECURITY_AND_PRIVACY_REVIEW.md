# Security and privacy review

## Boundaries

Vibe remains the policy enforcement point. Chatto receives a minimum identity
projection and explicit room membership. Better Auth cookies are never shared
with Chatto, and Chatto must not read Vibe cookies. External handoff must use
allowlisted origins, OAuth state/PKCE or an equivalent supported mechanism, and
short-lived/revocable Chatto credentials.

Submission edit tokens, API keys, private repository links, and patient
information must not be pasted into Chatto. C.2B should add prominent room
copy and, if feasible, client/server secret-pattern warnings. Warnings are not
a substitute for access control or redaction.

## Risks and controls

| Risk | Required control before pilot |
| --- | --- |
| Email-based account collision | issuer/subject or durable Vibe-to-Chatto mapping only |
| Stale membership | Vibe revocation job plus Chatto `RemoveMember`; test existing sessions |
| Room enumeration | private/non-universal room; server-side membership check; negative tests |
| Token leakage | never put edit/API tokens in Chatto messages, URLs, logs, analytics, or screenshots |
| Cross-origin/CSRF | OAuth state + PKCE; Chatto CSRF contract for cookie writes; exact origin allowlist |
| WebSocket overreach | Chatto bearer/session authorization checked at upgrade and per event |
| Admin over-visibility | explicitly decide support/moderation role; no default admin access |
| XSS/link abuse | rely on Chatto sanitizer and link policy, then test hostile markdown/URLs |
| Attachments | defer; separately review upload limits, malware/privacy, and retention |
| Message retention | identify configured retention and deletion semantics before real data |
| Sensitive content | room policy, user warnings, moderation/audit access, incident procedure |
| Account disablement | revoke Chatto mapping and all room memberships promptly |
| Secret logs | scrub Chatto/Vibe proxy logs and error reports; run sensitive-output scans |

Chatto's current response headers prohibit framing (`X-Frame-Options: DENY` and
`frame-ancestors 'none'`), so an iframe is not acceptable without an explicit,
reviewed product/security change. Standalone navigation is safer for the spike.

## Moderation and privacy

Private team rooms contain potentially sensitive project discussions. Define
who may moderate, whether support can see room history, how deletion is audited,
and how a participant reports abuse. Do not silently grant all administrators
room access. Preserve Chatto event logs and Vibe membership audit events without
logging bearer credentials or submission edit tokens.
