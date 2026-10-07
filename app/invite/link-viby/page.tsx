import { cookies } from "next/headers";
import { NavPublic } from "@/components/NavPublic";
import {
  ACCOUNT_INVITATION_COOKIE,
  inspectAccountInvitation,
} from "@/lib/account-invitations";
import { invitationForLinkTransaction } from "@/lib/account-invitation-viby";
import {
  preparePendingVibyLink,
  VIBY_LINK_BINDING_COOKIE,
  VIBY_LINK_TOKEN_COOKIE,
} from "@/lib/viby-interactive-linking";
import "../accept/invitation.css";

export const dynamic = "force-dynamic";

export default async function InvitationLinkVibyPage() {
  const jar = await cookies();
  const invitationToken = jar.get(ACCOUNT_INVITATION_COOKIE)?.value ?? "";
  const token = jar.get(VIBY_LINK_TOKEN_COOKIE)?.value ?? "";
  const binding = jar.get(VIBY_LINK_BINDING_COOKIE)?.value ?? "";
  const invitation = await inspectAccountInvitation(invitationToken);
  if (!invitation || invitation.lifecycle !== "pending" || !token || !binding) {
    return <LinkShell title="Link request unavailable">Return to the invitation and start again.</LinkShell>;
  }
  const pending = await preparePendingVibyLink({
    operation: "admin_login",
    token,
    browserBinding: binding,
    userId: invitation.userId,
  });
  const bridge = pending ? await invitationForLinkTransaction(pending.id) : null;
  if (!pending || !bridge || bridge.invitationId !== invitation.id || bridge.userId !== invitation.userId) {
    return <LinkShell title="Link request unavailable">This request could not be matched safely to the invitation.</LinkShell>;
  }
  return (
    <LinkShell title="Link Viby identity">
      <p>You freshly confirmed an identity with Viby.</p>
      <div className="invitation-summary" style={{ margin: "1.25rem -1.5rem" }}>
        <div><span>Account</span><strong>{invitation.userName?.trim() || invitation.userEmail}</strong></div>
        <div><span>Email</span><strong>{invitation.userEmail}</strong></div>
        <div><span>Identity</span><strong>…{pending.vibySubjectHash.slice(-8)}</strong></div>
      </div>
      <p>This connects the verified identity to this invited account. Access comes only from the invitation and remains separate from authentication.</p>
      <div style={{ display: "flex", gap: "0.65rem", marginTop: "1.25rem" }}>
        <form action="/invite/link-viby/confirm" method="post"><button className="btn-primary" type="submit">Link and accept invitation</button></form>
        <form action="/invite/link-viby/cancel" method="post"><button className="btn-secondary" type="submit">Cancel</button></form>
      </div>
    </LinkShell>
  );
}

function LinkShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="min-h-screen"><NavPublic /><main className="invitation-page"><section className="invitation-panel" style={{ padding: "1.5rem" }}><h1 style={{ color: "var(--color-fg)", fontFamily: "var(--font-headline)", fontSize: "1.7rem", marginBottom: "0.65rem" }}>{title}</h1><div style={{ color: "var(--color-muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>{children}</div></section></main></div>;
}
