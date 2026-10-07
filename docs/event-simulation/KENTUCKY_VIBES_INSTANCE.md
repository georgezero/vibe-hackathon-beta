# Kentucky Vibes isolated instance (E.1)

## Instance boundary

Kentucky Vibes runs as a separate user service and never replaces the live
event process.

| item | current event | Kentucky Vibes |
| --- | --- | --- |
| service | `vibe-hackathon.service` | `kentucky-vibes.service` |
| release | `/opt/vibe-hackathon/releases/a70edc283261-d4r-publication-20260803T005500Z` | same immutable application release |
| port | `3000` | `3010` (local only) |
| qualification URL | `https://vibe-hackathon-dev.ggg.ad` | `https://127.0.0.1:3240` through the TLS proxy |
| database | canonical `local.db` | `/opt/vibe-hackathon/instances/kentucky-vibes/data/active.sqlite` |
| event | `evt_vibe_2025` | `evt_kentucky_vibes` / `kentucky-vibes` |

The TLS proxy is the existing local qualification helper
`scripts/c6-https-proxy.mjs`; it binds only to loopback. No Cloudflare route,
Chatto process, or Viby process was changed. Outbound mail is disabled and the
isolated environment uses Better Auth password sign-in with a fake/unreachable
Viby URL and no synthetic Viby identity links.

The immutable source is
`/opt/vibe-hackathon/database-snapshots/kentucky-vibes-base-realistic-20260802-20260803T022500Z.sqlite`
(SHA-256 `097a3f47d5d5ac946472741cf622b9a237b891d31ac23491806e142ac2179122`).
The writable clone was staged and atomically created, then migrated twice. Its
post-migration checksum was `1596bd1d3d6fb9b48664d372ef64faa3f45176e12a730dcaec92688d5373c3aa`.
The final WAL-safe qualification snapshot is
`/opt/vibe-hackathon/database-snapshots/kentucky-vibes-e1-qualified-20260803T031000Z.sqlite`
(SHA-256 `fc99add53310b92988c26cdc1ce72962f1f0ce1e6471ee4ad951c9c9f2ef53c2`).

## Service controls

```sh
systemctl --user start kentucky-vibes.service
systemctl --user stop kentucky-vibes.service
systemctl --user restart kentucky-vibes.service
systemctl --user status kentucky-vibes.service --no-pager -l
curl -k https://127.0.0.1:3240/api/health
```

The proxy is controlled independently:

```sh
systemctl --user start kentucky-vibes-https-proxy.service
systemctl --user stop kentucky-vibes-https-proxy.service
```

The service was qualified with PID `3346239` after the final restart and
restart count `0`; production remained PID `2987399`, restart count `0`. The
final state after automated qualification is both Kentucky services stopped.

## Database and session isolation

The service environment is mode `0600` at
`/opt/vibe-hackathon/instances/kentucky-vibes/.env`. It selects the writable
clone, `evt_kentucky_vibes`, a distinct Better Auth base URL, distinct secrets,
and host-only secure cookies. The browser observed
`__Secure-better-auth.session_token` with domain `127.0.0.1`, `Secure`, and
`HttpOnly`; the current event uses its own host-only production cookie. No
cookie domain spans both hosts and logout state is independent.

The cloned file retains two historical, non-synthetic Viby link rows inherited
from the preserved source snapshot. They belong to preserved current-event
users, not Kentucky Vibes users; synthetic users have no Viby links, the
isolated Viby flow is disabled, and event-scoped queries expose only
`evt_kentucky_vibes`. A future hardened fixture build may omit those inherited
historical rows entirely before external sharing.

## Final state

No public hostname was approved or created. Results remain calculated and
unpublished. Synthetic persona credentials are outside the repository under
`credentials/personas.json`, mode `0600`; they are removed or rotated when the
instance is stopped for the final time.
