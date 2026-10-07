# Participant workspace

Claiming a submission is optional for starting or completing a draft. A claimed
submission provides a durable Better Auth workspace with:

- Overview, Team, Team Chat, Activity, Preview, Results, and Status views;
- owner or teammate membership controls;
- readiness and submission-state visibility;
- My Projects access without repeatedly entering the private Edit token.

Formal roster entries are not account access. A teammate must accept an explicit
expiring invitation while signed in. Email matches do not grant membership.
Administrators and judges do not receive private project workspace or Team Chat
access from their roles.

## Keep the social surfaces distinct

Global **Messages** are private Direct Messages between authenticated active
accounts. People-directory visibility is the discovery boundary, and every
discoverable non-self person has a Message action. The recipient does not need
to be signed in or online when a sender starts a conversation. Existing
conversations remain durable subject to self, disabled-account, and block
protections.

Project **Team Chat** is different: it is private to an accepted project owner
or teammate and is authorized by project membership. A participant may use
Messages or event **Community** without owning or joining a project, but neither
surface grants access to a private project workspace.

Do not share patient information, passwords, private Edit tokens, invitation
links, or API keys. Direct Messages and Team Chat are retained under their
respective event policies; user deletion creates a tombstone rather than
silently erasing history. The system does not claim end-to-end encryption.

Outbound email is not available. Invitation links are private, expiring, and
must be copied directly to the intended teammate. Losing the Edit token remains
covered by the existing non-email recovery contract until a separate recovery
channel is approved.

Team Chat availability can still be rollout-scoped for an individual project;
the workspace reports that state without changing the membership boundary.
