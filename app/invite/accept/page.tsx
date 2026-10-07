import { cookies, headers } from "next/headers";
import { NavPublic } from "@/components/NavPublic";
import {
  ACCOUNT_INVITATION_COOKIE,
  inspectAccountInvitation,
} from "@/lib/account-invitations";
import InvitationAcceptanceClient from "./InvitationAcceptanceClient";
import "./invitation.css";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InvitationAcceptancePage() {
  const token = (await cookies()).get(ACCOUNT_INVITATION_COOKIE)?.value ?? "";
  const [invitation, session] = await Promise.all([
    inspectAccountInvitation(token),
    headers().then((requestHeaders) => auth.api.getSession({ headers: requestHeaders })),
  ]);
  return (
    <div className="min-h-screen">
      <NavPublic />
      <main className="invitation-page">
        {session?.user?.id && invitation?.lifecycle === "pending" ? (
          <section className="invitation-panel invitation-state-panel">
            <span className="invitation-mark" aria-hidden="true"><InviteIcon /></span>
            <h1>Sign out before accepting</h1>
            <p>An invitation creates or connects a different account. Sign out first so accounts are never switched or merged silently.</p>
            <form action="/invite/logout" method="post"><button className="btn-primary" type="submit">Sign out and continue</button></form>
          </section>
        ) : !invitation ? (
          <section className="invitation-panel invitation-state-panel">
            <span className="invitation-mark" aria-hidden="true"><InviteIcon /></span>
            <h1>Invitation unavailable</h1>
            <p>This invitation link is invalid or no longer available. Ask an administrator for a new invitation.</p>
          </section>
        ) : invitation.lifecycle !== "pending" ? (
          <section className="invitation-panel invitation-state-panel">
            <span className="invitation-mark" aria-hidden="true"><InviteIcon complete={invitation.lifecycle === "accepted"} /></span>
            <h1>{invitation.lifecycle === "accepted" ? "Invitation already accepted" : invitation.lifecycle === "expired" ? "Invitation expired" : "Invitation revoked"}</h1>
            <p>{invitation.lifecycle === "accepted" ? "Sign in with the account you already created." : "Ask an administrator to issue a new invitation."}</p>
            {invitation.lifecycle === "accepted" && <a className="btn-primary" href="/account">Continue to sign in</a>}
          </section>
        ) : (
          <InvitationAcceptanceClient
            name={invitation.userName?.trim() || invitation.userEmail}
            email={invitation.userEmail}
            expiresAt={invitation.expiresAt.toISOString()}
            administratorAccess={invitation.grantAdmin}
            judgeAccess={invitation.grantJudge}
          />
        )}
      </main>
    </div>
  );
}

function InviteIcon({ complete = false }: { complete?: boolean }) {
  return complete
    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
