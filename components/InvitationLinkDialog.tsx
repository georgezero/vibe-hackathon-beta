"use client";

import { useEffect, useRef, useState } from "react";

type RosterOption = { id: string; name: string };

export function InvitationLinkDialog({
  open,
  onClose,
  submissionId,
  roster,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  submissionId: string;
  roster: RosterOption[];
  onCreated?: (invitation: { id: string; inviteUrl: string; expiresAt: string; intendedMemberId: string | null }) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState(roster[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button, select, input, [href], [tabindex]:not([tabindex='-1'])")].filter((element) => !element.hasAttribute("disabled"));
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
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  async function createInvitation() {
    setBusy(true);
    setError("");
    setCopied(false);
    const selectedId = roster.some((member) => member.id === selected) ? selected : roster[0]?.id ?? "";
    const response = await fetch("/api/submission-memberships/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, intendedMemberId: selectedId || null }),
    });
    const body = await response.json().catch(() => ({})) as { id?: string; inviteUrl?: string; expiresAt?: string; error?: string };
    setBusy(false);
    if (!response.ok || !body.inviteUrl || !body.id || !body.expiresAt) {
      setError(body.error ?? "The invitation could not be created.");
      return;
    }
    setLink(body.inviteUrl);
    setExpiresAt(body.expiresAt);
    onCreated?.({ id: body.id, inviteUrl: body.inviteUrl, expiresAt: body.expiresAt, intendedMemberId: selectedId || null });
  }

  async function copyInvitation() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const input = document.createElement("textarea");
      input.value = link;
      input.setAttribute("readonly", "true");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
  }

  const selectedId = roster.some((member) => member.id === selected) ? selected : roster[0]?.id ?? "";
  const selectedName = roster.find((member) => member.id === selectedId)?.name;
  return <div className="team-invite-dialog" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="team-invite-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="team-invite-title" tabIndex={-1}>
      <div className="team-invite-dialog-header">
        <div>
          <h2 id="team-invite-title">Invite a teammate</h2>
          <p className="team-invite-dialog-copy">Create a private link for a listed teammate. They will choose the account to use, sign in, and confirm before project access is added.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close invitation dialog">Close</button>
      </div>
      <div style={{ marginTop: "1rem" }}>
        <label className="label" htmlFor="team-invite-teammate">Teammate</label>
        {roster.length ? <select id="team-invite-teammate" className="input" value={selectedId} onChange={(event) => setSelected(event.target.value)} disabled={busy || Boolean(link)}>
          {roster.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select> : <p className="invitation-note">Add the teammate to the listed team first, then create their project-access link.</p>}
      </div>
      {!link && <div className="workspace-actions" style={{ marginTop: "1rem" }}><button type="button" className="btn-primary" onClick={() => void createInvitation()} disabled={busy || !roster.length}>{busy ? "Creating link…" : "Create invitation link"}</button><button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button></div>}
      {error && <p role="alert" className="badge badge-error" style={{ marginTop: ".85rem" }}>{error}</p>}
      {link && <div className="team-invite-link-ready" role="status" aria-live="polite"><strong>Invitation link ready</strong><p>{selectedName ? `Copy this private link and send it to ${selectedName}.` : "Copy this private link and send it only to the intended teammate."} It expires {new Date(expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.</p><div className="team-invite-link-actions"><button type="button" className="btn-primary" onClick={() => void copyInvitation()}>{copied ? "Link copied" : "Copy invitation link"}</button><button type="button" className="btn-secondary" onClick={onClose}>Done</button></div><details className="team-invite-link-details"><summary>Show private link</summary><input className="input" style={{ marginTop: ".5rem" }} readOnly value={link} aria-label="Private invitation link" onFocus={(event) => event.currentTarget.select()} /></details><p className="invitation-note" style={{ marginTop: ".65rem" }}>This link is private and expires. Anyone who has it can request access to this project.</p></div>}
    </div>
  </div>;
}
