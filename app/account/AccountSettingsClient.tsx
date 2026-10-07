"use client";

import { useMemo, useState } from "react";
import "./account.css";

interface SerializedAccountOverview {
  projects: Array<{
    submissionId: string;
    role: "owner" | "teammate";
    title: string | null;
    teamName: string;
    status: string;
  }>;
  profile: {
    name: string;
    email: string;
    createdAt: string;
    lastSignInAt: string | null;
  };
  participantProfile: {
    handle: string | null;
    displayName: string | null;
    headline: string | null;
    visibility: "private" | "public";
    discoverable: boolean;
    completeness: { completed: number; total: 6; label: string };
  };
  authentication: {
    hasPassword: boolean;
    hasViby: boolean;
    vibyDisplayName: string | null;
    providers: string[];
  };
  account: {
    status: "active" | "disabled";
    passwordChangeRequired: boolean;
    passwordChangedAt: string | null;
  };
  access: {
    isAdmin: boolean;
    isJudge: boolean;
    eventName: string | null;
  };
  sessions: Array<{
    id: string;
    current: boolean;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    device: string;
    locationHint: string | null;
  }>;
}

export default function AccountSettingsClient({
  overview,
}: {
  overview: SerializedAccountOverview;
}) {
  const [sessions, setSessions] = useState(overview.sessions);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function request(
    url: string,
    init: RequestInit,
    success: string,
  ) {
    setPending(url);
    setNotice(null);
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const body = await response.json().catch(() => ({})) as { error?: string; signedOut?: boolean };
    setPending(null);
    if (!response.ok) {
      setNotice({ tone: "error", text: body.error ?? "The change could not be saved." });
      return body;
    }
    setNotice({ tone: "success", text: success });
    if (body.signedOut) window.location.assign("/login");
    return body;
  }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setNotice({ tone: "error", text: "The new passwords do not match." });
      return;
    }
    const body = await request("/api/account/password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: String(form.get("currentPassword") ?? ""),
        newPassword,
      }),
    }, overview.authentication.hasPassword ? "Password changed." : "Password created.");
    if (!body.error) formElement.reset();
  }

  async function revokeSession(sessionId: string) {
    const body = await request("/api/account/sessions", {
      method: "POST",
      body: JSON.stringify({ action: "revoke", sessionId }),
    }, "Session revoked.");
    if (!body.error) {
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    }
  }

  async function revokeOtherSessions() {
    const body = await request("/api/account/sessions", {
      method: "POST",
      body: JSON.stringify({ action: "revoke_other" }),
    }, "Other sessions revoked.");
    if (!body.error) {
      setSessions((current) => current.filter((session) => session.current));
    }
  }

  async function signOutEverywhere() {
    await request("/api/account/sessions", {
      method: "POST",
      body: JSON.stringify({ action: "revoke_all" }),
    }, "All sessions revoked.");
  }

  const sessionLabel = useMemo(
    () => `${sessions.length} active session${sessions.length === 1 ? "" : "s"}`,
    [sessions.length],
  );

  return (
    <main className="account-page">
      <header className="account-page-header">
        <div>
          <h1>Account</h1>
          <p>Manage how you sign in, review active sessions, and understand your access.</p>
        </div>
        <span className="account-status">
          <span aria-hidden="true" />
          Account active
        </span>
      </header>

      {overview.account.passwordChangeRequired && (
        <div className="account-required-notice" role="status">
          <strong>Choose a new password before continuing.</strong>
          <span>Your temporary password has completed its job and cannot be retrieved again.</span>
        </div>
      )}
      {notice && (
        <div className={`account-toast account-toast-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </div>
      )}

      <section className="account-settings-card account-settings-card-wide" style={{ marginBottom: "1.25rem" }}>
        <header>
          <span className="account-card-icon" aria-hidden="true"><ProjectIcon /></span>
          <div>
            <h2>Project workspaces</h2>
            <p>Your active owner and teammate memberships.</p>
          </div>
        </header>
        {overview.projects.length === 0 ? <p className="account-help">No joined projects yet. <a href="/start">Start a project</a> or <a href="/account/projects">save or join one</a>.</p> : <div className="account-session-list">{overview.projects.map((project) => <div className="account-session-row" key={project.submissionId}><span className="account-session-device" aria-hidden="true"><ProjectIcon /></span><div><div className="account-session-title">{project.title || project.teamName} <span className="badge badge-default">{project.role === "owner" ? "Team lead" : "Teammate"}</span></div><p>{project.teamName} · {project.status}</p></div><a className="btn-secondary" href={`/projects/${encodeURIComponent(project.submissionId)}`}>Open workspace</a></div>)}</div>}
      </section>

      <div className="account-settings-grid">
        <SettingsCard
          title="Profile"
          description="Your identity across hackathons."
          icon={<ProfileIcon />}
        >
          <div className="account-profile-summary">
            <div className="account-profile-avatar" aria-hidden="true">{profileInitials(overview.participantProfile.displayName)}</div>
            <div className="account-profile-summary-copy">
              <strong>{overview.participantProfile.displayName || "Complete your profile"}</strong>
              <p>{overview.participantProfile.headline || "Build an identity that stays with you across hackathons."}</p>
              <span className={`badge ${overview.participantProfile.visibility === "public" ? "badge-success" : "badge-default"}`}>
                {overview.participantProfile.visibility === "public" ? "Public profile" : "Private profile"}
              </span>
            </div>
          </div>
          <div className="account-profile-completeness"><span>{overview.participantProfile.completeness.label}</span><div><i style={{ width: `${(overview.participantProfile.completeness.completed / overview.participantProfile.completeness.total) * 100}%` }} /></div></div>
          <p className="account-help">Your projects and published awards can appear here over time. Completing your profile is optional and never blocks participation.</p>
          {overview.participantProfile.visibility === "public" && overview.participantProfile.handle ? (
            <p className="account-profile-url"><span>{overview.participantProfile.discoverable ? "Public profile" : "Public, unlisted profile"}</span><a href={`/people/${encodeURIComponent(overview.participantProfile.handle)}`}>/people/{overview.participantProfile.handle}</a></p>
          ) : (
            <p className="account-profile-url account-profile-url-private">Only you can view your profile preview.</p>
          )}
          <div className="account-card-actions"><a className="btn-primary" href="/account/profile">{overview.participantProfile.completeness.completed === 0 ? "Complete profile" : "Edit profile"}</a><a className="btn-secondary" href="/account/profile/preview">Preview</a>{overview.participantProfile.visibility === "public" && overview.participantProfile.handle && <a className="btn-secondary" href={`/people/${encodeURIComponent(overview.participantProfile.handle)}`}>View profile</a>}</div>
          <div className="account-facts"><Fact label="Account email" value={overview.profile.email} /><Fact label="Account created" value={formatDate(overview.profile.createdAt)} /></div>
        </SettingsCard>

        <SettingsCard
          title="Password"
          description={overview.authentication.hasPassword
            ? "Change the password you use to sign in."
            : "Add a password without disconnecting Viby."}
          icon={<KeyIcon />}
        >
          <form onSubmit={updatePassword} className="account-form">
            {overview.authentication.hasPassword && (
              <label>
                <span>Current password</span>
                <input className="input" name="currentPassword" type="password" autoComplete="current-password" required />
              </label>
            )}
            <div className="account-field-pair">
              <label>
                <span>New password</span>
                <input className="input" name="newPassword" type="password" minLength={8} maxLength={128} autoComplete="new-password" required />
              </label>
              <label>
                <span>Confirm new password</span>
                <input className="input" name="confirmation" type="password" minLength={8} maxLength={128} autoComplete="new-password" required />
              </label>
            </div>
            <p className="account-help">Use 8–128 characters. Your existing password is never displayed.</p>
            <div className="account-facts">
              <Fact label="Password last changed" value={overview.account.passwordChangedAt ? formatDateTime(overview.account.passwordChangedAt) : "Not recorded"} />
            </div>
            <div className="account-card-actions">
              <button className="btn-primary" disabled={pending === "/api/account/password"} type="submit">
                {pending === "/api/account/password" ? "Updating…" : overview.authentication.hasPassword ? "Change password" : "Create password"}
              </button>
            </div>
          </form>
        </SettingsCard>

        <SettingsCard
          title="Recent sign-ins"
          description={`${sessionLabel}. Your current device is marked below; revoke anything you do not recognize.`}
          icon={<SessionsIcon />}
          wide
        >
          <div className="account-session-list">
            {sessions.map((session) => (
              <div className="account-session-row" key={session.id}>
                <span className="account-session-device" aria-hidden="true"><DeviceIcon /></span>
                <div>
                  <div className="account-session-title">
                    {session.device}
                    {session.current && <span className="badge badge-success">Current</span>}
                  </div>
                  <p>
                    Last active {formatDateTime(session.updatedAt)} · Expires {formatDate(session.expiresAt)}
                  </p>
                </div>
                {!session.current && (
                  <button className="btn-secondary" type="button" onClick={() => revokeSession(session.id)}>
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="account-card-actions account-session-actions">
            <button className="btn-secondary" type="button" disabled={sessions.length <= 1} onClick={revokeOtherSessions}>
              Revoke other sessions
            </button>
            <button className="btn-danger" type="button" onClick={signOutEverywhere}>
              Sign out everywhere
            </button>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Linked identity"
          description="Viby confirms identity; it never grants application access."
          icon={<LinkIcon />}
        >
          <div className="account-state-line">
            <span className={`account-state-mark ${overview.authentication.hasViby ? "is-active" : ""}`} aria-hidden="true">
              {overview.authentication.hasViby ? <CheckIcon /> : <LinkIcon />}
            </span>
            <div>
              <strong>{overview.authentication.hasViby ? "Viby linked" : "Not linked"}</strong>
              <p>{overview.authentication.hasViby
                ? overview.authentication.vibyDisplayName || "Identity connection active"
                : "Add Viby as another secure way to authenticate."}</p>
            </div>
          </div>
          {!overview.authentication.hasViby && (
            <div className="account-card-actions">
              <form action="/api/viby/link" method="post">
                <button className="btn-secondary" type="submit">Link identity</button>
              </form>
            </div>
          )}
        </SettingsCard>

        <SettingsCard
          title="Access"
          description="Access is assigned by an administrator and checked live."
          icon={<ShieldIcon />}
        >
          <div className="account-access-list">
            <AccessRow label="Signed-in account" active detail="Active" />
            <AccessRow label="Participant" active={overview.projects.length > 0} detail={overview.projects.length > 0 ? "Project membership" : "No project claimed yet"} />
            <AccessRow label="Administrator" active={overview.access.isAdmin} detail={overview.access.isAdmin ? "Active" : "Not granted"} />
            <AccessRow
              label="Judge"
              active={overview.access.isJudge}
              detail={overview.access.isJudge
                ? `Active${overview.access.eventName ? ` for ${overview.access.eventName}` : ""}`
                : "Not granted"}
            />
          </div>
        </SettingsCard>
      </div>
    </main>
  );
}

function SettingsCard({
  title,
  description,
  icon,
  wide = false,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`account-settings-card${wide ? " account-settings-card-wide" : ""}`}>
      <header>
        <span className="account-card-icon" aria-hidden="true">{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="account-card-body">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function AccessRow({ label, active, detail }: { label: string; active: boolean; detail: string }) {
  return (
    <div>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <span className={`badge ${active ? "badge-success" : "badge-default"}`}>
        {active ? "Active" : "Not granted"}
      </span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function profileInitials(displayName: string | null) {
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || "?";
}

const iconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" };
function ProfileIcon() { return <svg {...iconProps}><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" /><path d="M5.5 19c.8-3.3 3-5 6.5-5s5.7 1.7 6.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>; }
function KeyIcon() { return <svg {...iconProps}><circle cx="8.5" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.7" /><path d="M12 12h7m-2 0v3m-3-3v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>; }
function SessionsIcon() { return <svg {...iconProps}><rect x="4" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M9 20h6M12 16v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>; }
function DeviceIcon() { return <svg {...iconProps}><rect x="5" y="3" width="14" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.7" /><path d="M10 17h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>; }
function ProjectIcon() { return <svg {...iconProps}><path d="M4 6.5h6l1.5 2H20v9.5H4V6.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M4 10h16" stroke="currentColor" strokeWidth="1.7" /></svg>; }
function LinkIcon() { return <svg {...iconProps}><path d="M10 14l4-4M8.5 16.5l-1 1a3.5 3.5 0 01-5-5l3-3a3.5 3.5 0 015 0M15.5 7.5l1-1a3.5 3.5 0 015 5l-3 3a3.5 3.5 0 01-5 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>; }
function ShieldIcon() { return <svg {...iconProps}><path d="M12 3l7 3v5c0 4.6-2.6 7.8-7 10-4.4-2.2-7-5.4-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.7" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function CheckIcon() { return <svg {...iconProps}><path d="M5 12l4.2 4L19 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
