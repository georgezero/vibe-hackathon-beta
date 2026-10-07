# Implementation Phases

Every phase stops for review. A defect produces a bounded correction and a new
candidate; it does not broaden the live qualification run.

## Phase 1 — Audit and design

Deliverables:

- this reviewed plan;
- approved account-link and role policy;
- approved local-versus-Runtime logout behavior;
- approved fresh-verification maximum age;
- disposition plan for the protected P0.4 backup.

Exit: all decisions in `OPEN_DECISIONS.md` that affect schema or protocol are
resolved.

## Phase 2 — Runtime SDK compatibility gate

Runtime-owned, separately reviewed:

- correct request and response contracts;
- exact state comparison;
- typed human and agent results;
- fresh launch options;
- tested logout contract or explicit omission;
- behavioral route integration tests;
- immutable/versioned SDK delivery mechanism.

No registration or production deployment occurs automatically.

Exit: a deployed Runtime version remains backward compatible with the current
legacy application and passes SDK contract tests.

## Phase 3 — Better Auth foundation

Application-owned:

- prove a supported Better Auth custom provider/plugin endpoint;
- add central application principal and admin role resolution;
- protect both admin pages and APIs through the same resolver;
- preserve existing admin policy registry, Origin enforcement, judge auth, and
  team ownership.

Exit: Better Auth session issuance tests pass without private APIs or manual
cookie signing.

## Phase 4 — Identity-link schema and transactions

- additive identity-link and role schema;
- durable callback transactions;
- pending-link records;
- database uniqueness and concurrency tests;
- explicit, protected migration command;
- operator-reviewed mapping of existing admins.

Exit: old code remains compatible and all mappings are validated.

## Phase 5 — Runtime SDK integration

- add the reviewed SDK artifact;
- implement server-only adapter;
- retain legacy protocol behind a disabled-by-default rollback flag;
- add confidential credential configuration checks;
- do not yet issue Better Auth admin sessions in production.

Exit: local/disposable modern redemption tests cover human and agent assertions.

## Phase 6 — Dual-login and account linking

- Better Auth GitHub and Viby login choices;
- linked returning-user flow;
- authenticated link flow;
- unlinked pending flow;
- explicit conflicts, recovery, and logout.

Exit: full first-time and returning-user matrix passes.

## Phase 7 — Fresh verification and step-up

- request Runtime fresh verification;
- record session-bound assurance metadata;
- enforce approved age for admin entry and selected sensitive operations;
- test expired, reused, and non-fresh evidence.

Exit: Runtime owner and application owner approve evidence semantics.

## Phase 8 — Agent and artifact callback migration

- adopt typed SDK redemption without Better Auth session creation;
- preserve mode, actor, delegation, project, and artifact boundaries;
- decide preview versus durable artifact storage;
- separate artifact signing from legacy admin secret if still needed.

Exit: human/agent cross-use and replay tests pass.

## Phase 9 — Legacy admin-session retirement

- dual-read, new-write compatibility window;
- observe and clear legacy sessions;
- stop legacy acceptance;
- remove custom HMAC implementation and secret;
- retain rollback limits and audit history.

Exit: no legacy cookie issuance/use and no direct legacy Runtime redemption.

## Phase 10 — Qualification

- isolated disposable database;
- clean immutable release;
- automated security and integration matrix;
- guided human Viby and GitHub linking;
- multi-browser and multi-tab testing;
- privacy/log review;
- production non-interference review.

Exit: explicit GO with exact source and Runtime baselines.

## Phase 11 — Deployment

An additional deployment phase is justified because Runtime and application
changes have separate ownership.

1. deploy backward-compatible Runtime SDK/route correction;
2. provision/validate Vibe confidential credential and modern registration;
3. apply additive application schema in a maintenance window if required;
4. deploy application dual-read release;
5. enable new issuance;
6. retire legacy sessions after the compatibility deadline.

Exit: stable service, successful end-to-end flows, retained-log review, and
rollback window closure.
