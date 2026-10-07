"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Person {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  status: "active" | "disabled";
  passwordChangeRequired: boolean;
  passwordChangedAt: string | null;
  sessionCount: number;
  linkedViby: boolean;
  authenticationMethods: Array<"password" | "github" | "viby">;
  adminAccess: boolean;
  judgeAccess: boolean;
  judgeAuthorizationId: string | null;
  judgeProfileId: string | null;
  invitation: {
    id: string;
    status: "pending" | "accepted" | "expired" | "revoked";
    expiresAt: string;
    createdAt: string;
  } | null;
  recentAudit: Array<{ action: string; createdAt: string; result: string | null }>;
}

interface JudgeProfile {
  id: string;
  name: string;
  email: string;
  available: boolean;
}

type Confirmation = {
  title: string;
  body: string;
  action: string;
  destructive?: boolean;
  run: () => Promise<void>;
};

export default function PeopleAccessClient({
  initialPeople,
  judgeProfiles,
  currentUserId,
  eventName,
  recentAuthentication,
}: {
  initialPeople: Person[];
  judgeProfiles: JudgeProfile[];
  currentUserId: string;
  eventName: string;
  recentAuthentication: boolean;
}) {
  const router = useRouter();
  const createDialog = useRef<HTMLDialogElement>(null);
  const passwordDialog = useRef<HTMLDialogElement>(null);
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  const [people, setPeople] = useState(initialPeople);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "admin" | "judge" | "disabled" | "password" | "unlinked">("all");
  const [sort, setSort] = useState<"name" | "created" | "activity">("name");
  const [selected, setSelected] = useState<Person | null>(null);
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);
  const [oneTimeInvitation, setOneTimeInvitation] = useState<string | null>(null);
  const [credentialEmail, setCredentialEmail] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const closePersonSheet = useCallback(() => setSelected(null), []);

  const visiblePeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return people
      .filter((person) =>
        (!normalized
          || person.name.toLowerCase().includes(normalized)
          || person.email.toLowerCase().includes(normalized))
        && (
          filter === "all"
          || (filter === "admin" && person.adminAccess)
          || (filter === "judge" && person.judgeAccess)
          || (filter === "disabled" && person.status === "disabled")
          || (filter === "password" && person.passwordChangeRequired)
          || (filter === "unlinked" && !person.linkedViby)
        )
      )
      .sort((left, right) => {
        if (sort === "created") return Date.parse(right.createdAt) - Date.parse(left.createdAt);
        if (sort === "activity") return Date.parse(right.lastSignInAt ?? "1970-01-01") - Date.parse(left.lastSignInAt ?? "1970-01-01");
        return left.name.localeCompare(right.name);
      });
  }, [filter, people, query, sort]);

  const totals = useMemo(() => ({
    active: people.filter((person) => person.status === "active").length,
    admins: people.filter((person) => person.adminAccess).length,
    judges: people.filter((person) => person.judgeAccess).length,
  }), [people]);

  function openCreate() {
    setNotice(null);
    createDialog.current?.showModal();
  }

  function closeCreate() {
    createDialog.current?.close();
  }

  function updateLocal(userId: string, patch: Partial<Person>) {
    setPeople((current) => current.map((person) =>
      person.userId === userId ? { ...person, ...patch } : person
    ));
    setSelected((current) =>
      current?.userId === userId ? { ...current, ...patch } : current
    );
  }

  async function api(
    userId: string,
    method: "PATCH" | "POST",
    body: Record<string, unknown>,
  ) {
    setPending(true);
    setNotice(null);
    const response = await fetch(`/api/admin/people/${encodeURIComponent(userId)}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({})) as {
      error?: string;
      temporaryPassword?: string;
    };
    setPending(false);
    if (!response.ok) {
      setNotice({ tone: "error", text: result.error ?? "The account change failed." });
      throw new Error(result.error ?? "Account change failed.");
    }
    return result;
  }

  async function createPerson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const grantJudge = form.get("grantJudge") === "on";
    const provisionMode = form.get("provisionMode") === "temporary_password" ? "temporary_password" : "invitation";
    setPending(true);
    setNotice(null);
    const response = await fetch("/api/admin/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        grantAdmin: form.get("grantAdmin") === "on",
        grantJudge,
        provisionMode,
        judgeProfileId: grantJudge ? String(form.get("judgeProfileId") ?? "") : null,
      }),
    });
    const result = await response.json().catch(() => ({})) as {
      error?: string;
      userId?: string;
      temporaryPassword?: string;
      invitationId?: string;
      invitationLink?: string;
      expiresAt?: string;
    };
    setPending(false);
    if (!response.ok || !result.userId || (provisionMode === "invitation" ? !result.invitationLink || !result.invitationId : !result.temporaryPassword)) {
      setNotice({ tone: "error", text: result.error ?? "The account could not be created." });
      return;
    }
    const name = String(form.get("name"));
    const email = String(form.get("email")).toLowerCase();
    setPeople((current) => [...current, {
      userId: result.userId!,
      name,
      email,
      createdAt: new Date().toISOString(),
      lastSignInAt: null,
      status: "active",
      passwordChangeRequired: provisionMode === "temporary_password",
      passwordChangedAt: null,
      sessionCount: 0,
      linkedViby: false,
      authenticationMethods: provisionMode === "temporary_password" ? ["password"] : [],
      adminAccess: provisionMode === "temporary_password" && form.get("grantAdmin") === "on",
      judgeAccess: provisionMode === "temporary_password" && grantJudge,
      judgeAuthorizationId: null,
      judgeProfileId: provisionMode === "temporary_password" && grantJudge ? String(form.get("judgeProfileId")) : null,
      invitation: provisionMode === "invitation" ? {
        id: result.invitationId!,
        status: "pending",
        createdAt: new Date().toISOString(),
        expiresAt: result.expiresAt!,
      } : null,
      recentAudit: [],
    }]);
    setCredentialEmail(email);
    setOneTimePassword(result.temporaryPassword ?? null);
    setOneTimeInvitation(result.invitationLink ?? null);
    formElement.reset();
    closeCreate();
    passwordDialog.current?.showModal();
  }

  function ask(confirmationValue: Confirmation) {
    setConfirmation(confirmationValue);
    confirmationDialog.current?.showModal();
  }

  async function runConfirmation() {
    if (!confirmation) return;
    try {
      await confirmation.run();
      confirmationDialog.current?.close();
      setConfirmation(null);
    } catch {
      confirmationDialog.current?.close();
    }
  }

  async function saveName(name: string) {
    if (!selected) return;
    await api(selected.userId, "PATCH", { operation: "update_name", name });
    updateLocal(selected.userId, { name });
    setNotice({ tone: "success", text: "Profile updated." });
  }

  function setEnabled(enabled: boolean) {
    if (!selected) return;
    const self = selected.userId === currentUserId;
    ask({
      title: enabled ? "Enable this account?" : self ? "Disable your own account?" : "Disable this account?",
      body: enabled
        ? "The account will be allowed to authenticate again. Existing authorizations remain unchanged."
        : "All active sessions will be revoked immediately. Authorization history remains intact.",
      action: enabled ? "Enable account" : "Disable account",
      destructive: !enabled,
      run: async () => {
        await api(selected.userId, "PATCH", {
          operation: "set_enabled",
          enabled,
          confirmSelf: self,
        });
        updateLocal(selected.userId, { status: enabled ? "active" : "disabled" });
        setNotice({ tone: "success", text: enabled ? "Account enabled." : "Account disabled and sessions revoked." });
      },
    });
  }

  function setAdmin(granted: boolean) {
    if (!selected) return;
    const self = selected.userId === currentUserId;
    ask({
      title: granted ? "Grant administrator access?" : self ? "Remove your own administrator access?" : "Revoke administrator access?",
      body: granted
        ? "This grants live access to administrator operations. It does not affect judge access."
        : "Administrator access will stop on the next authorization check. Other access remains independent.",
      action: granted ? "Grant administrator" : "Revoke administrator",
      destructive: !granted,
      run: async () => {
        await api(selected.userId, "PATCH", {
          operation: "set_admin",
          granted,
          confirmSelf: self,
        });
        updateLocal(selected.userId, { adminAccess: granted });
        setNotice({ tone: "success", text: granted ? "Administrator access granted." : "Administrator access revoked." });
      },
    });
  }

  async function applyJudge(granted: boolean, judgeProfileId?: string) {
    if (!selected) return;
    await api(selected.userId, "PATCH", {
      operation: "set_judge",
      granted,
      judgeProfileId: judgeProfileId || null,
    });
    updateLocal(selected.userId, {
      judgeAccess: granted,
      judgeProfileId: granted ? judgeProfileId ?? null : null,
      judgeAuthorizationId: granted ? selected.judgeAuthorizationId : null,
    });
    setNotice({ tone: "success", text: granted ? "Judge access granted." : "Judge access revoked." });
  }

  function setJudge(granted: boolean, judgeProfileId?: string) {
    if (granted) {
      void applyJudge(true, judgeProfileId);
      return;
    }
    ask({
      title: "Revoke judge access?",
      body: "Judge access will stop on the next authorization check. Assignments and scores remain intact.",
      action: "Revoke judge",
      destructive: true,
      run: () => applyJudge(false),
    });
  }

  function resetPassword() {
    if (!selected) return;
    const self = selected.userId === currentUserId;
    ask({
      title: self ? "Reset your own password?" : "Reset password?",
      body: "A new temporary password will replace the previous password and must be changed at the next sign in. Active sessions remain valid.",
      action: "Generate temporary password",
      destructive: self,
      run: async () => {
        const result = await api(selected.userId, "POST", {
          operation: "reset_password",
          confirmSelf: self,
        });
        if (!result.temporaryPassword) throw new Error("Missing temporary password.");
        updateLocal(selected.userId, {
          passwordChangeRequired: true,
          authenticationMethods: Array.from(new Set([...selected.authenticationMethods, "password"])),
        });
        setCredentialEmail(selected.email);
        setOneTimePassword(result.temporaryPassword);
        setOneTimeInvitation(null);
        passwordDialog.current?.showModal();
      },
    });
  }

  function revokeSessions() {
    if (!selected) return;
    ask({
      title: "Revoke all sessions?",
      body: "Every active session for this account will stop working. The person must sign in again.",
      action: "Revoke sessions",
      destructive: true,
      run: async () => {
        await api(selected.userId, "PATCH", { operation: "revoke_sessions" });
        updateLocal(selected.userId, { sessionCount: 0 });
        setNotice({ tone: "success", text: "All sessions revoked." });
      },
    });
  }

  function closePasswordDialog() {
    setOneTimePassword(null);
    setOneTimeInvitation(null);
    setCredentialEmail("");
    passwordDialog.current?.close();
    router.refresh();
  }

  async function copyPassword() {
    const value = oneTimePassword ?? oneTimeInvitation;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setNotice({ tone: "success", text: oneTimePassword ? "Temporary password copied." : "Invitation link copied." });
  }

  function changeInvitation(action: "revoke" | "expire" | "regenerate") {
    if (!selected?.invitation) return;
    const labels = {
      revoke: ["Revoke invitation?", "The current link will stop working immediately.", "Revoke invitation"],
      expire: ["Expire invitation now?", "The current link will be treated as expired immediately.", "Expire invitation"],
      regenerate: ["Regenerate invitation?", "The current link will stop working and a new one will be shown once.", "Regenerate link"],
    } as const;
    ask({
      title: labels[action][0], body: labels[action][1], action: labels[action][2], destructive: action !== "regenerate",
      run: async () => {
        setPending(true);
        const response = await fetch(`/api/admin/invitations/${encodeURIComponent(selected.invitation!.id)}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
        });
        const result = await response.json().catch(() => ({})) as { error?: string; invitationLink?: string; expiresAt?: string };
        setPending(false);
        if (!response.ok) throw new Error(result.error ?? "Invitation change failed.");
        updateLocal(selected.userId, { invitation: {
          ...selected.invitation!,
          status: action === "revoke" ? "revoked" : action === "expire" ? "expired" : "pending",
          expiresAt: result.expiresAt ?? selected.invitation!.expiresAt,
        } });
        if (result.invitationLink) {
          setCredentialEmail(selected.email);
          setOneTimePassword(null);
          setOneTimeInvitation(result.invitationLink);
          passwordDialog.current?.showModal();
        }
        setNotice({ tone: "success", text: action === "regenerate" ? "New invitation ready." : `Invitation ${action === "expire" ? "expired" : "revoked"}.` });
      },
    });
  }

  return (
    <main className="people-page">
      <header className="people-header">
        <div>
          <h1>People &amp; Access</h1>
          <p>Provision accounts and manage independent administrator and judge access.</p>
        </div>
        <button className="btn-primary" type="button" onClick={openCreate} disabled={!recentAuthentication}>
          <AddPersonIcon />
          Create account
        </button>
      </header>

      {!recentAuthentication && (
        <div className="people-reauth" role="alert">
          <div>
            <strong>Recent administrator authentication required</strong>
            <span>Sign out and sign back in before changing accounts or access.</span>
          </div>
          <form action="/logout" method="post">
            <button className="btn-secondary" type="submit">Sign in again</button>
          </form>
        </div>
      )}
      {notice && <div className={`people-toast people-toast-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</div>}

      <section className="people-summary" aria-label="Access summary">
        <Summary label="Accounts" value={people.length} detail={`${totals.active} active`} />
        <Summary label="Administrators" value={totals.admins} detail="Independent grant" />
        <Summary label="Judges" value={totals.judges} detail={eventName} />
      </section>

      <section className="people-console">
        <div className="people-toolbar">
          <label className="people-search">
            <SearchIcon />
            <span className="sr-only">Search people</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" />
          </label>
          <div className="people-toolbar-selects">
            <label>
              <span className="sr-only">Sort people</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                <option value="name">Name</option>
                <option value="created">Newest</option>
                <option value="activity">Recent activity</option>
              </select>
            </label>
          </div>
        </div>
        <div className="people-quick-filters" aria-label="Filter people">
          {([
            ["all", "All"], ["admin", "Administrators"], ["judge", "Judges"],
            ["disabled", "Disabled"], ["password", "Needs password change"], ["unlinked", "Not linked to Viby"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <p className="people-result-count" aria-live="polite">{visiblePeople.length} {visiblePeople.length === 1 ? "person" : "people"}</p>

        {visiblePeople.length ? (
          <div className="people-table-wrap">
            <table className="people-table">
              <thead><tr><th>Person</th><th>Authentication</th><th>Access</th><th>Activity</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {visiblePeople.map((person) => (
                  <tr key={person.userId}>
                    <td>
                      <div className="people-person-cell">
                        <Avatar name={person.name} />
                        <div>
                          <strong>{person.name}</strong>
                          <span>{person.email}</span>
                          {person.status === "disabled" && <span className="badge badge-error">Disabled</span>}
                          {person.invitation?.status === "pending" && <span className="badge badge-warning">Invited</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <MethodBadges methods={person.authenticationMethods} />
                      <div className="people-auth-indicators">
                        <span>{person.linkedViby ? "Viby linked" : "Viby not linked"}</span>
                        <span>{person.authenticationMethods.includes("password") ? "Password set" : "No password"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="people-access-badges">
                        {person.adminAccess && <span className="badge badge-accent">Administrator</span>}
                        {person.judgeAccess && <span className="badge badge-2">Judge</span>}
                        {!person.adminAccess && !person.judgeAccess && <span className="people-none">No protected access</span>}
                      </div>
                    </td>
                    <td><div className="people-activity"><strong>{person.lastSignInAt ? formatDate(person.lastSignInAt) : "Never signed in"}</strong><span>Created {formatDate(person.createdAt)}</span></div></td>
                    <td><button className="btn-ghost" type="button" onClick={() => setSelected(person)}>Manage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="people-empty">
            <SearchIcon />
            <strong>No people match this view</strong>
            <span>Try a different search or access filter.</span>
            <button className="btn-secondary" type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button>
          </div>
        )}
      </section>

      {selected && (
        <PersonSheet
          person={selected}
          currentUserId={currentUserId}
          eventName={eventName}
          judgeProfiles={judgeProfiles}
          pending={pending || !recentAuthentication}
          notice={notice}
          onClose={closePersonSheet}
          onSaveName={saveName}
          onSetEnabled={setEnabled}
          onSetAdmin={setAdmin}
          onSetJudge={setJudge}
          onResetPassword={resetPassword}
          onRevokeSessions={revokeSessions}
          onChangeInvitation={changeInvitation}
        />
      )}

      <dialog className="people-dialog" ref={createDialog} onCancel={closeCreate} aria-labelledby="create-account-dialog-title">
        <form onSubmit={createPerson}>
          <DialogHeader titleId="create-account-dialog-title" title="Add a person" description="Invite someone to create their sign-in, or use a temporary password as a fallback." onClose={closeCreate} />
          <div className="people-dialog-body">
            <label><span>Name</span><input className="input" name="name" maxLength={100} required autoFocus /></label>
            <label><span>Email</span><input className="input" name="email" type="email" required /></label>
            <fieldset className="people-provision-picker">
              <legend>How should they get started?</legend>
              <label><input name="provisionMode" type="radio" value="invitation" defaultChecked /><span><strong>Create invitation link</strong><small>Create a secure, single-use link valid for seven days.</small></span></label>
              <label><input name="provisionMode" type="radio" value="temporary_password" /><span><strong>Generate temporary password</strong><small>Fallback for a person who cannot use an invitation link.</small></span></label>
            </fieldset>
            <fieldset className="people-access-picker">
              <legend>Initial access</legend>
              <label><input name="grantAdmin" type="checkbox" /><span><strong>Administrator</strong><small>Manage the event and application access.</small></span></label>
              <JudgeAccessChoice judgeProfiles={judgeProfiles} />
            </fieldset>
          </div>
          <div className="people-dialog-actions">
            <button className="btn-ghost" type="button" onClick={closeCreate}>Cancel</button>
            <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create"}</button>
          </div>
        </form>
      </dialog>

      <dialog className="people-dialog people-password-dialog" ref={passwordDialog} onCancel={(event) => { event.preventDefault(); closePasswordDialog(); }} aria-labelledby="temporary-password-dialog-title">
        <div>
          <DialogHeader titleId="temporary-password-dialog-title" title={oneTimeInvitation ? "Invitation ready" : "Temporary password"} description={`Share this securely with ${credentialEmail}. It will not be shown again.`} onClose={closePasswordDialog} />
          <div className="people-dialog-body">
            {notice && <div className={`people-toast people-toast-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</div>}
            <div className="people-password-value">
              <code>{oneTimePassword ?? oneTimeInvitation}</code>
              <button className="btn-secondary" type="button" onClick={copyPassword}>Copy {oneTimeInvitation ? "link" : "password"}</button>
            </div>
            <p className="people-password-note">{oneTimeInvitation ? "Only a secure hash of this link is stored. Regenerating it invalidates this copy." : "The person must choose a new password at first sign in. Only its secure hash was stored."}</p>
          </div>
          <div className="people-dialog-actions">
            <button className="btn-primary" type="button" onClick={closePasswordDialog}>I saved it</button>
          </div>
        </div>
      </dialog>

      <dialog className="people-dialog people-confirm-dialog" ref={confirmationDialog} onCancel={() => setConfirmation(null)} aria-labelledby="confirmation-dialog-title">
        <div>
          <DialogHeader titleId="confirmation-dialog-title" title={confirmation?.title ?? "Confirm change"} description={confirmation?.body ?? ""} onClose={() => { setConfirmation(null); confirmationDialog.current?.close(); }} />
          <div className="people-dialog-actions">
            <button className="btn-ghost" type="button" onClick={() => { setConfirmation(null); confirmationDialog.current?.close(); }}>Cancel</button>
            <button className={confirmation?.destructive ? "btn-danger" : "btn-primary"} type="button" disabled={pending} onClick={runConfirmation}>
              {pending ? "Saving…" : confirmation?.action ?? "Confirm"}
            </button>
          </div>
        </div>
      </dialog>
    </main>
  );
}

function PersonSheet({
  person,
  currentUserId,
  eventName,
  judgeProfiles,
  pending,
  notice,
  onClose,
  onSaveName,
  onSetEnabled,
  onSetAdmin,
  onSetJudge,
  onResetPassword,
  onRevokeSessions,
  onChangeInvitation,
}: {
  person: Person;
  currentUserId: string;
  eventName: string;
  judgeProfiles: JudgeProfile[];
  pending: boolean;
  notice: { tone: "success" | "error"; text: string } | null;
  onClose: () => void;
  onSaveName: (name: string) => Promise<void>;
  onSetEnabled: (enabled: boolean) => void;
  onSetAdmin: (granted: boolean) => void;
  onSetJudge: (granted: boolean, judgeProfileId?: string) => void;
  onResetPassword: () => void;
  onRevokeSessions: () => void;
  onChangeInvitation: (action: "revoke" | "expire" | "regenerate") => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState(person.name);
  const [judgeProfileId, setJudgeProfileId] = useState(person.judgeProfileId ?? "");
  const isSelf = person.userId === currentUserId;
  const availableProfiles = judgeProfiles.filter((profile) =>
    profile.available || profile.id === person.judgeProfileId
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(document.querySelectorAll<HTMLElement>(
      ".people-page > :not(.people-sheet-layer):not(dialog)",
    ));
    document.body.style.overflow = "hidden";
    background.forEach((element) => { element.inert = true; });
    closeButton.current?.focus();

    function handleKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const sheet = closeButton.current?.closest<HTMLElement>(".people-sheet");
      const focusable = Array.from(sheet?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
      ) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyboard);
    return () => {
      document.removeEventListener("keydown", handleKeyboard);
      document.body.style.overflow = previousOverflow;
      background.forEach((element) => { element.inert = false; });
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="people-sheet-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="people-sheet" role="dialog" aria-modal="true" aria-labelledby="person-sheet-title">
        <header className="people-sheet-header">
          <div className="people-sheet-identity">
            <Avatar name={person.name} large />
            <div><h2 id="person-sheet-title">{person.name}</h2><p>{person.email}</p></div>
          </div>
          <button ref={closeButton} className="btn-ghost people-icon-button" type="button" onClick={onClose} aria-label="Close person details"><CloseIcon /></button>
        </header>
        <div className="people-sheet-scroll">
          {isSelf && <div className="people-self-note">This is your account. Self-affecting changes require an extra confirmation.</div>}
          <section className="people-sheet-section">
            <h3>Profile</h3>
            <label><span>Display name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <button className="btn-secondary" type="button" disabled={pending || name.trim() === person.name} onClick={() => onSaveName(name)}>Save name</button>
          </section>
          <section className="people-sheet-section">
            {notice && <div className={`people-toast people-toast-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</div>}
            <div className="people-section-heading"><div><h3>Access</h3><p>Sign-in methods do not change access.</p></div></div>
            <AccessToggle label="Administrator" description="Full event administration." active={person.adminAccess} disabled={pending} onChange={() => onSetAdmin(!person.adminAccess)} />
            <div className="people-judge-control">
              <AccessToggle label="Judge" description={`Judge access for ${eventName}.`} active={person.judgeAccess} disabled={pending || (!person.judgeAccess && !judgeProfileId)} onChange={() => {
                if (person.judgeAccess) void onSetJudge(false);
                else if (judgeProfileId) void onSetJudge(true, judgeProfileId);
              }} />
              {!person.judgeAccess && (
                <label>
                  <span>Judge profile</span>
                  <select value={judgeProfileId} onChange={(event) => setJudgeProfileId(event.target.value)}>
                    <option value="">Choose an explicit profile</option>
                    {availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.email}</option>)}
                  </select>
                </label>
              )}
            </div>
          </section>
          <section className="people-sheet-section">
            <h3>Authentication</h3>
            <MethodBadges methods={person.authenticationMethods} />
            <div className="people-auth-facts">
              <span><strong>Viby identity</strong>{person.linkedViby ? "Linked" : "Not linked"}</span>
              <span><strong>Password</strong>{person.authenticationMethods.includes("password") ? "Configured" : "Not configured"}</span>
              <span><strong>Last changed</strong>{person.passwordChangedAt ? formatDate(person.passwordChangedAt) : "Not recorded"}</span>
            </div>
            {person.passwordChangeRequired && <p className="people-inline-warning">Password change required at next sign in.</p>}
          </section>
          <section className="people-sheet-section">
            <div className="people-section-heading"><div><h3>Sessions</h3><p>{person.sessionCount} active session{person.sessionCount === 1 ? "" : "s"}.</p></div></div>
            <button className="btn-secondary" type="button" disabled={pending || person.sessionCount === 0} onClick={onRevokeSessions}>Invalidate sessions</button>
          </section>
          <section className="people-sheet-section">
            <div className="people-section-heading"><div><h3>Audit</h3><p>Recent account and access activity.</p></div></div>
            {person.recentAudit.length ? <ol className="people-audit-list">{person.recentAudit.map((event, index) => <li key={`${event.action}-${event.createdAt}-${index}`}><strong>{auditLabel(event.action)}</strong><span>{formatDateTime(event.createdAt)}</span></li>)}</ol> : <p className="people-none">No recent account activity.</p>}
          </section>
          {person.invitation && (
            <section className="people-sheet-section">
              <div className="people-section-heading"><div><h3>Invitation</h3><p>Created {formatDate(person.invitation.createdAt)} · expires {formatDate(person.invitation.expiresAt)}</p></div><span className={`badge ${person.invitation.status === "pending" ? "badge-warning" : person.invitation.status === "accepted" ? "badge-success" : "badge-default"}`}>{person.invitation.status}</span></div>
              {person.invitation.status !== "accepted" && person.invitation.status !== "revoked" && <div className="people-inline-actions"><button className="btn-secondary" type="button" disabled={pending} onClick={() => onChangeInvitation("regenerate")}>Regenerate link</button>{person.invitation.status === "pending" && <button className="btn-secondary" type="button" disabled={pending} onClick={() => onChangeInvitation("expire")}>Expire now</button>}<button className="btn-danger" type="button" disabled={pending} onClick={() => onChangeInvitation("revoke")}>Revoke</button></div>}
            </section>
          )}
          <section className="people-sheet-section">
            <h3>Actions</h3>
            <div className="people-inline-actions"><button className="btn-secondary" type="button" disabled={pending} onClick={onResetPassword}>Reset password</button></div>
          </section>
          <section className="people-sheet-section people-danger-section">
            <h3>Account status</h3>
            <p>{person.status === "active" ? "Disable sign-in and revoke active sessions." : "Restore this account’s ability to sign in."}</p>
            <button className={person.status === "active" ? "btn-danger" : "btn-secondary"} type="button" disabled={pending} onClick={() => onSetEnabled(person.status !== "active")}>
              {person.status === "active" ? "Disable account" : "Enable account"}
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
}

function JudgeAccessChoice({ judgeProfiles }: { judgeProfiles: JudgeProfile[] }) {
  const [enabled, setEnabled] = useState(false);
  return (
    <>
      <label><input name="grantJudge" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span><strong>Judge</strong><small>Event-scoped judging access.</small></span></label>
      {enabled && <label className="people-judge-profile"><span>Judge profile</span><select name="judgeProfileId" required><option value="">Choose an explicit profile</option>{judgeProfiles.filter((profile) => profile.available).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.email}</option>)}</select></label>}
    </>
  );
}

function AccessToggle({ label, description, active, disabled, onChange }: { label: string; description: string; active: boolean; disabled: boolean; onChange: () => void }) {
  return <div className="people-access-toggle"><div><strong>{label}</strong><span>{description}</span></div><button type="button" role="switch" aria-checked={active} aria-label={`${active ? "Revoke" : "Grant"} ${label} access`} className={`people-switch ${active ? "is-on" : ""}`} disabled={disabled} onClick={onChange}><span /></button></div>;
}

function Summary({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return <span className={`people-avatar ${large ? "is-large" : ""}`} aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "A"}</span>;
}
function MethodBadges({ methods }: { methods: Person["authenticationMethods"] }) {
  return <div className="people-methods">{methods.length ? methods.map((method) => <span className="badge badge-default" key={method}>{method === "password" ? "Password" : method === "viby" ? "Viby" : "GitHub"}</span>) : <span className="people-none">No sign-in method</span>}</div>;
}
function DialogHeader({ titleId, title, description, onClose }: { titleId: string; title: string; description: string; onClose: () => void }) {
  return <header className="people-dialog-header"><div><h2 id={titleId}>{title}</h2><p>{description}</p></div><button className="btn-ghost people-icon-button" type="button" onClick={onClose} aria-label="Close dialog"><CloseIcon /></button></header>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function auditLabel(value: string) {
  return value.replace(/^account_/, "").replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}
function AddPersonIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" /><path d="M3 19c.7-3.3 2.7-5 6-5s5.3 1.7 6 5M18 8v6M15 11h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>; }
function SearchIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" /><path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>; }
function CloseIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>; }
