# Chatto deployment baseline

Inspection date: 2026-08-01. Inspection was read-only over `ssh horo`; no
service, configuration, data, or process was changed.

## Runtime

| Item | Observed value |
| --- | --- |
| Host | `horo` |
| OS | Debian GNU/Linux 13 (trixie), kernel `6.12.86+deb13-amd64` |
| Public hostname | `chatto.elvie.ad` |
| Public URL | `https://chatto.elvie.ad/chat/-/overview` |
| Chatto image/version | `ghcr.io/chattocorp/chatto:latest`, version `0.4.12` |
| Image digest | `sha256:ddb1c5079c9fb2544f582c59a8d85b3bf754c24d3f1f19e15bec0647db377bd` |
| Chatto source commit | `70fe404126f39a541d47bdebb0c346c9d27cfa77` |
| Install/repository path | `/home/george/Downloads/src/ai/agentpacs/chatto` |
| Compose project | `dockercompose` (Compose 5.1.4) |
| Service/process | Docker `dockercompose-chatto-1`; `/chatto start -c /config/chatto.toml` |
| Chatto PID at inspection | `1042497` (inside host process namespace) |
| Listener | `0.0.0.0:4000` |
| Reverse proxy/tunnel | Cloudflare Tunnel presents the public hostname; the exact host unit/config was not altered or exposed during this audit |

The compose stack also contains NATS and LiveKit. The active cloudflare overlay
publishes Chatto directly on port 4000 and does not run the bundled Caddy
service. Existing untracked Chatto repository files were left untouched.

## Storage and operations

Chatto has no container filesystem mount. Durable state is in the external NATS
JetStream volume `dockercompose_nats_data` (host volume under
`/var/lib/docker/volumes/`); the application event stream observed was `EVT`
with 44 messages. Runtime KV buckets include `ENCRYPTION_KEYS`,
`MEMORY_CACHE`, and `RUNTIME_STATE`. Values were not read.

The documented `chatto backup` command archives JetStream data, instance KV,
events, assets, per-space data, reactions, and bodies. Encryption keys are
excluded by default; `--include-keys` is sensitive and `--encrypt` is the
recommended protected form. `chatto restore` requires Chatto to be stopped
when using external NATS and supports conflict policies. This is operationally
viable but restore is disruptive and must be rehearsed in isolation.

## Authentication and APIs

The live discovery endpoint returned only:

```json
{"profile":{"name":"Chatto","version":"0.4.12"},"login":{"authorizeUrl":"/oauth/authorize"}}
```

Direct registration is disabled. No external provider was advertised. The
public API is ConnectRPC under `/api/connect/chatto.*.v1.*`; realtime is
`GET /api/realtime` with WebSocket upgrade. Operator APIs are on a configured
Unix socket and are root-equivalent; they must not be exposed through Vibe.

Public response headers include `cache-control: no-store`, `X-Frame-Options:
DENY`, and CSP `frame-ancestors 'none'`. A native iframe embed is therefore not
an available shortcut. `/health` currently returns the SPA shell rather than a
machine-readable health document; `/api/health` is not present. Health checks
for a pilot should use an explicit monitored endpoint or process-level check.

## Current operational warning

Chatto logs repeated LiveKit TLS handshake failures while listing rooms. Text
messaging may be independent, but calls/voice must be out of the C.2 pilot until
the LiveKit configuration is separately repaired and qualified.

## Licensing

The image declares `AGPL-3.0-or-later` and the source repository is Chatto's
public GitHub repository. Legal review is required before distributing a
modified frontend or exposing a network service with additional proprietary
integration code. This audit does not make a licensing determination.
