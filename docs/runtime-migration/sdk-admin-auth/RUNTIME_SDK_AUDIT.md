# Deployed Runtime SDK Audit

## Deployed source

The production Runtime was inspected read-only on moofi.

- service: `viby-runtime-keit-ai.service`
- source root: `/home/george/Downloads/src/ai/faceblur/viby-runtime-apps`
- working directory: `web`
- branch: `phase-9-runtime-connected-apps`
- commit: `172963e82110fad2d5336e2d73847f429906beb9`
- subject: `viby-runtime: document dual-protocol compatibility`
- Runtime web version: `0.1.0`
- source SDK: `web/lib/viby-client/index.ts`

The SDK is source code inside the Runtime repository. It is not a versioned npm
dependency consumed by Vibe or ri0.

## Public surface at the deployed commit

`web/lib/viby-client/index.ts` exports:

- `VibyClient`
- `createVibyClient()`
- `createVibyClientFromEnv()`
- `beginLogin()`
- `validateCallbackParams()`
- `redeemAssertion()`
- `logoutUrl()`
- `createLoginState()`
- `verifyLoginState()`
- `parseVibyEnvVars()`
- `validateVibyClientConfig()`

Configuration uses `VIBY_BASE_URL`, `VIBY_CLIENT_ID`,
`VIBY_CLIENT_SECRET`, and `CALLBACK_URL` or `APP_URL`.

The SDK is server-only, uses a confidential Basic-auth client credential,
limits redemption responses, and disables automatic redirect following.

## Runtime-owned behavior

The deployed Runtime's `web/lib/identity/assertion-redemption.ts`:

- validates assertion identifier syntax;
- binds the assertion to the registered application and audience;
- validates mode and callback registration;
- checks expiry;
- atomically sets `consumed_at`;
- returns 409 for replay;
- returns 410 for expiry;
- emits a non-secret audit event.

`web/lib/identity/client-credentials.ts` generates 256-bit random client
secrets, stores a peppered HMAC digest and hint, supports expiry/revocation, and
uses constant-time digest comparison.

Fresh verification is supported by the Runtime start page through
`freshIdentity=1` and equivalent launch flags. It is not represented in the
SDK's `BeginLoginOptions`.

## Blocking compatibility defects

### Request field mismatch

The SDK's `redeemAssertion()` sends:

```json
{ "assertionId": "..." }
```

The deployed route `web/app/api/identity/assertions/redeem/route.ts` accepts
only:

```json
{ "assertion_id": "..." }
```

The SDK therefore receives `400 invalid_assertion_id`.

### Response-shape mismatch

The deployed route returns a nested envelope containing `assertion`, `user`,
`identity`, and `payload`. The SDK looks for top-level `user_id`, `mode`,
`issued_at`, and related fields. Even after correcting the request field, the
SDK would return `missing_user_id`.

### State comparison defect

`validateCallbackParams(params, expectedState)` does not compare the incoming
state to `expectedState`. It only checks that the incoming state has a valid
HMAC under the client secret. A different previously generated state can pass.

The SDK state is also stateless: it has no expiry field, server-side
transaction record, or atomic consumed marker.

### Runtime-mode fail-open default

SDK HTTPS enforcement defaults to `NODE_ENV === "production"`. A missing or
unknown runtime value therefore disables the default HTTPS requirement. Vibe
must pass an explicit production-safe setting, and a corrected SDK should adopt
an explicit fail-closed runtime policy.

### Missing Vibe launch and payload capabilities

`BeginLoginOptions` cannot express:

- `freshIdentity`;
- launch context;
- preferred actor;
- explicit agent selection.

`AssertionPayload` models a human at top level and does not model the deployed
agent-attribution payload. It cannot safely replace
`verifyVibyAgentAttributionAssertion()` as written.

### Logout helper mismatch

`logoutUrl()` returns `/identity/logout`. No such deployed route was found.
The Runtime has an interactive `/logout` page whose behavior is client-side and
does not implement the SDK's `return_to` contract.

## Test quality

`web/scripts/check-connected-app-dx.ts` checks that SDK symbols and documentation
strings exist. It does not execute request serialization, response parsing,
state equality, expiry, or logout routing.

`web/scripts/check-assertion-protocol-compatibility.ts` tests the Runtime
redemption core directly, not the SDK client against the route. This explains
why the client/route mismatch can coexist with passing Runtime checks.

No behavioral SDK unit test was found for the incompatible paths above.

## Registration compatibility

The live `vibe-hackathon` registration is active and retains the qualified
legacy flow:

- modes: `admin`, `agent-attribution`;
- production callbacks:
  `/admin/viby/callback`, `/admin/viby/agent-callback`,
  `/admin/viby/artifact-callback`;
- legacy GET enabled;
- modern POST disabled by the qualified registration contract.

At audit time it had zero active confidential client credentials. Modern SDK
redemption therefore cannot authenticate even after SDK code corrections.

## Required Runtime-owned prerequisite

Before Vibe adopts this SDK, the Runtime owner should produce a versioned,
tested client artifact or an immutable vendored source revision that:

1. uses the deployed request and response contract;
2. compares exact callback state and supports durable caller consumption;
3. exposes fresh-verification and launch-context options;
4. returns a typed human/agent assertion union without weakening audience,
   mode, actor, or delegation checks;
5. defines a real logout route contract;
6. fails closed for HTTPS under missing/unknown runtime configuration;
7. has route-level integration tests;
8. is deployed compatibly before Vibe switches protocols.

The Runtime registration must then receive a Vibe-specific confidential
credential and explicitly permit the modern redemption protocol. That is a
coordinated Runtime operation, not an application migration side effect.
