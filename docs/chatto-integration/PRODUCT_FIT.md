# Product fit

Capabilities below are confirmed from the deployed API surface and Chatto
source/protocol definitions. No disposable Chatto account or room was created
during C.2A, so behavior that requires a live member session remains a C.2B
qualification item.

| Capability | Assessment | Evidence / qualification needed |
| --- | --- | --- |
| Private rooms | Supported | `RoomService.CreateRoom` with non-universal room; test discovery and membership isolation |
| Add/remove members | Supported | `AddMember`, `RemoveMember`, `ListMembers`; test access disappears immediately after removal |
| Text messages | Supported | `MessageService.CreateMessage` and room event/timeline APIs |
| Unread/read state | Supported | notification/read-state services and `MarkRoomAsRead` |
| Threads | Supported | `ThreadService` and message thread-root fields |
| Reactions | Supported | `MessageService.AddReaction` and reaction APIs |
| Presence | Supported | presence service and realtime channel; not needed for pilot success |
| Responsive/mobile UI | Bundled frontend exists | Qualify on disposable accounts in Chromium mobile; do not assume parity from source alone |
| Account switching/logout | Supported by Chatto session model | Test coordinated Vibe-to-Chatto OAuth logout; never share cookies |
| Room discovery/privacy | API authorization exists | Verify private rooms cannot be listed/read by non-members |
| Moderation | Supported | ban/unban, role/permission, and event-log APIs; define organizer scope explicitly |
| File uploads | Supported but deferred | asset upload/attachment services need a separate security review |
| Calls/voice | Not ready for pilot | live logs show repeated LiveKit TLS handshake failures |
| Retention policy | Not confirmed | identify and document message/asset retention before production data |
| Backup/restore | Tooling exists | rehearse encrypted backup and isolated restore; confirm key custody |

## Fit for the first use case

One private text room per claimed submission is a good bounded use case. It
uses mature primitives without requiring DMs, public channels, calls,
attachments, bots, or AI agents. Failure of Chatto must be isolated so draft
editing, login, judging, administration, and project browsing continue to work.

## UX options

1. **Standalone Chatto link (recommended for the spike):** smallest reversible
   surface, lowest frontend maintenance, and no iframe/CSP problem. The handoff
   and return link need careful UX, but Chatto upgrades remain independent.
2. **Branded Chatto frontend:** better visual continuity, but creates a fork or
   customization burden under AGPL and increases upgrade risk.
3. **Native Vibe UI over Chatto APIs:** best continuity but highest effort,
   realtime, accessibility, error-handling, and long-term API compatibility
   burden. Defer until the pilot proves demand.
