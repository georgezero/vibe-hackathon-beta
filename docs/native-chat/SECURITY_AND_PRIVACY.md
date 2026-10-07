# Security and privacy

- Better Auth is the only interactive session authority.
- Active explicit membership is the only room authorization source.
- Roster emails and matching account emails are never authorization.
- Invitation links are high-entropy bearer credentials represented in the
  database only by SHA-256 digests; they are single-use and expiring.
- Edit tokens, invitation tokens, passwords, cookies, assertions, and message
  bodies are excluded from generic audit metadata and logs.
- Messages are plain text, length-bounded, React-escaped, and not raw HTML.
- Client message IDs make retries idempotent and reject conflicting payloads.
- Administrators and judges do not receive room access from their roles.
- A revoked member loses new history, writes, unread state, reconnect, and SSE
  delivery on the next server authorization check. Rendered local content may
  remain in a browser until it is refreshed.

Pilot copy must warn: “Do not share patient information, passwords, private
edit tokens, or API keys.” The initial event policy should retain messages only
through the event and an explicitly approved bounded post-event period; no
end-to-end encryption claim is made.

## Workspace boundary

The C.5 workspace is private to active explicit submission memberships. Team
roster metadata, matching email addresses, administrator authorization, and
judge authorization do not grant access. Team pages show formal roster and
account memberships separately. Activity is an allowlisted projection of safe
project events; it does not expose login events, failed token attempts, raw
audit payloads, message bodies, or credentials. Preview and Status are
membership-gated and contain no Edit-token URLs.

For any real pilot, owners must consent to the pilot and users must accept the
participant warning before entering sensitive content. Operators may access
infrastructure, database, and encrypted backups under support/incident policy;
this is not end-to-end encryption. Revoking membership denies history, writes,
unread state, polling, reconnect, and SSE delivery on the next authorization
check.
