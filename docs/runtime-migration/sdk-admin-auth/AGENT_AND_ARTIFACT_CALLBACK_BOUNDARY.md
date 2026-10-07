# Agent and Artifact Callback Boundary

## Classification

| Callback | Purpose | Better Auth session creation |
| --- | --- | --- |
| `/admin/viby/callback` | Human admin authentication/step-up | Yes, only after link and role checks |
| `/admin/viby/agent-callback` | Attribute an action to a registered human-owned agent | Never |
| `/admin/viby/artifact-callback` | Produce provenance for a specific project artifact | Never |

Agent and artifact callbacks are not alternate login endpoints.

## Runtime responsibilities

For both provenance callbacks, Runtime must establish:

- application audience;
- `agent-attribution` mode;
- agent subject type;
- agent identifier;
- verified owner identifier;
- approved delegation relationship;
- assertion issue/expiry;
- single redemption and replay rejection.

The corrected SDK should expose a typed agent result. Vibe should not reconstruct
the Runtime protocol envelope.

## Vibe responsibilities

Vibe must establish:

- the callback transaction was initiated by the correct application flow;
- the initiating Better Auth admin session is still valid where required;
- the project and artifact type came from server-side transaction state;
- the action is permitted by Vibe policy;
- the project exists and is in an eligible state;
- the resulting audit/provenance record contains only intended public fields.

The Runtime owner's identity does not automatically receive a Vibe role.

## Browser versus machine callbacks

The current flows are browser-mediated. The launch starts from a protected admin
page and returns to a browser callback. Better Auth may be required to initiate
and view the result, but the callback's proof is state plus Runtime redemption.

If a future machine callback is required, it needs a separate authenticated
API contract. Do not reuse browser cookies, query-state cookies, or admin
callback endpoints.

## Artifact storage

The current implementation signs a short-lived artifact payload into an
HttpOnly cookie scoped to `/admin/verified-agent-artifacts`.

Modernization should decide whether this is merely a preview or a durable
provenance record:

- Preview: keep it short-lived, clear on completion, and do not claim durable
  provenance.
- Durable record: store an application-owned record with project, action,
  agent/owner stable identifiers, Runtime assertion metadata needed for audit,
  hash, timestamp, and revocation semantics. Never store the assertion ID,
  client secret, callback state, cookie, or portrait/biometric data.

The artifact signing key should be independent of a retired admin-session HMAC
secret.

## Required validation

- human payload rejected by agent callback;
- agent payload rejected by admin callback;
- wrong mode or audience rejected;
- wrong project or artifact transaction rejected;
- replay rejected at Runtime and as an already-consumed Vibe transaction;
- expired assertion rejected;
- callback cannot redirect outside the canonical application origin;
- agent callback does not establish or elevate a Better Auth session;
- logs contain no assertion IDs, credentials, state tokens, cookies, or
  sensitive identity payloads.
