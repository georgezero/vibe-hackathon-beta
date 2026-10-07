# Realtime and revocation

The first delivery implementation uses authenticated Server-Sent Events with
a bounded 25-second stream, heartbeat/close framing, one-second server-side
membership rechecks, and a client polling fallback. The endpoint has no secret
query parameters and is same-origin only.

Membership revocation inserts a `membership_revoked` room event in the same
transaction as the membership state change. The next SSE poll closes the
stream with a revocation event. REST history, posting, unread, read-state, and
reconnect all independently resolve active membership and fail closed.

The disposable two-browser qualification measured the next history request as
HTTP 403 immediately after commit and observed the revoked UI state within the
five-second bound. This is a disposable result, not a production timing claim.
The controlled pilot must repeat the measurement with an explicitly approved
owner and teammate before enabling chat for that submission.
