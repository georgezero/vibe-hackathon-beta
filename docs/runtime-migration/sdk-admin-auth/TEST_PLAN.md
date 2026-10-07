# Test Plan

## Runtime SDK contract

- exact `assertion_id` request serialization;
- Basic-auth credential handling without logging;
- deployed nested response parsing;
- human and agent typed payloads;
- exact expected-state equality;
- malformed and noncanonical state;
- expiry and replay statuses;
- wrong application/audience/mode;
- response size and redirect limits;
- fresh-verification launch parameters;
- logout route and return-path validation if supported.

Tests must execute the SDK against the real route orchestration, not inspect
source strings.

## Better Auth extension

- creates a session only for a server-resolved user;
- uses Better Auth's supported cookie writer;
- rotates an existing session;
- cannot be called with a browser-supplied user ID;
- rejects missing/expired/consumed provider proof;
- sign-out revokes the session and clears correct cookie scope;
- remains compatible with GitHub team-owner sessions;
- leaves judge sessions unchanged.

## Identity linking

- Viby-first existing link;
- Viby-first unlinked identity;
- logged-in Better Auth user linking;
- unauthorized user;
- same subject/same user idempotence;
- same subject/different user conflict;
- different subject/same user conflict;
- revoked link;
- expired pending link;
- callback and pending-link replay;
- concurrent link attempts on real SQLite and libSQL-compatible path;
- transaction rollback on every insert/update failure;
- request-supplied user identity ignored.

## Admin authorization

- Better Auth session without role: 403;
- role without active link under policy: 403;
- active link and role: allowed;
- revoked role/link: immediate denial on page and API;
- missing/invalid/expired session: 401 or login redirect;
- strict Origin tests unchanged;
- every admin route remains registered with `withAdminApi()`;
- server pages use the same principal resolver;
- no custom cookie claims can override the local user or role.

## Callback transactions

- exact flow/path/mode/actor binding;
- safe relative return path;
- missing and cross-tab state;
- multiple simultaneous tabs;
- atomic one-time consumption;
- timeout boundary with controlled clock;
- wrong initiating Better Auth session;
- project/artifact context cannot be overridden by query/body;
- ambiguous redemption network failure does not duplicate processing.

## Fresh verification

- fresh admin verification succeeds;
- a normal Runtime assertion cannot satisfy a fresh requirement;
- assurance expiry boundary;
- assurance bound to user and session;
- link/role/session revocation invalidates assurance;
- agent attribution remains non-fresh as registered;
- client flags cannot claim freshness.

## Agent and artifact

- agent assertion accepted for correct flow;
- human assertion rejected;
- wrong owner/delegation/mode/audience rejected;
- Runtime replay and application transaction replay rejected;
- agent callback creates no Better Auth session;
- artifact project/type from server state only;
- invalid project denied;
- artifact hash stable;
- exports and public pages omit private identifiers.

## Migration

- empty database;
- existing allowlisted admin with no local user;
- reviewed mapped admin;
- conflicting mappings;
- duplicate provider subject;
- interruption and idempotent rerun;
- backup creation/refusal/rollback;
- unknown runtime fails closed;
- local SQLite real-driver tests;
- remote libSQL path explicitly tested or explicitly refused.

## Security scans

- client and server bundles for secrets and provider identifiers;
- source maps;
- callback URLs and logs for assertions/state;
- event exports;
- secret scan;
- attribution scan;
- dependency audit for any SDK delivery change.

## Full validation

- focused auth and callback unit/integration tests;
- admin and judge route inventory;
- full unit suite;
- focused ESLint;
- clean standalone TypeScript check;
- production build;
- clean install;
- non-mutating local startup and health;
- guided browser matrix for GitHub-first, Viby-first, linking, logout, replay,
  fresh verification, agent attribution, and artifact provenance.

Do not run browser configuration that executes `db:push` against an operator
database.
