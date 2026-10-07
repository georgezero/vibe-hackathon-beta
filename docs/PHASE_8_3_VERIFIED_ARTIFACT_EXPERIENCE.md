# Phase 8.3 Verified Artifact Experience

Phase 8.3 turns Verified Agent Artifacts from a working demo into a clearer
admin experience.

## Canonical Viby Artifact Seal

Verified artifacts render through `components/viby/VibyArtifactSeal.tsx`.

Canonical visible format:

```text
+----------------------------------------------------------------------+
| -v- Demo Agent G1 (George One)                             |
| |i| Elevator Pitch Generation                                        |
| |b| Verified Identity - ast_d3d2                                     |
| -y- sha256:7171944a2615                                              |
+----------------------------------------------------------------------+
```

Rules:

- ASCII only.
- Fixed-width font.
- All seal rows are padded to equal width.
- Mobile scrolls horizontally instead of wrapping the seal.
- SHA-256 is truncated to 12 characters in the seal.
- Assertion ID is truncated to 8 characters in the seal.
- Full values remain in Technical Details.
- Copy/export uses the same shared seal helper.

## Artifact Lifecycle

```text
Admin chooses artifact type and project
-> Viby confirms a human-owned agent actor
-> Vibe verifies the Viby agent assertion server-side
-> Vibe generates artifact content
-> Vibe hashes final artifact text
-> Vibe signs the artifact payload
-> Vibe displays the artifact seal
-> Browser stores recent artifact tokens in sessionStorage
```

Artifacts are not persisted to the database in Phase 8.3. Recent history is
browser-session scoped and intended for local review during the admin session.

## Details Page

Route:

```text
/admin/verified-agent-artifacts/[artifactId]
```

The details page displays:

- artifact content
- canonical Viby seal
- copy/download controls
- full assertion ID
- full SHA-256
- full timestamp
- agent ID
- owner Viby ID
- actor type

Because there is no persistent storage yet, the details page needs the signed
artifact token from the current browser session or latest artifact cookie.

## Export Behavior

`Copy Artifact` copies:

```text
artifact content

canonical Viby seal
```

`Download .txt` exports the same content as a text file.

## Roadmap Placeholders

Visible but disabled future artifact types:

- Technical Review
- Product Review
- Architecture Summary
- Judge Evaluation

These do not add permissions, scoring, storage, or execution behavior.

## Smoke Test

1. Sign in to Vibe admin.
2. Open `/admin/verified-agent-artifacts`.
3. Choose a project and artifact type.
4. Click `Generate with Viby Agent`.
5. Choose an agent in Viby and allow consent.
6. Confirm Vibe shows `Verified Artifact Generated`.
7. Confirm the artifact content appears.
8. Confirm the canonical Viby seal appears.
9. Click `Copy Artifact` and confirm copied text includes content plus seal.
10. Click `Download .txt` and confirm a text artifact downloads.
11. Open `Open Details`.
12. Confirm technical details include full hash, assertion, agent, owner, and actor fields.
13. Return to the artifact page and confirm Recent Verified Artifacts includes the generated artifact.
14. Open the recent artifact row and confirm details reopen.
