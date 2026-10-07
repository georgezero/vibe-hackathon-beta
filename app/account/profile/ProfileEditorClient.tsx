"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProfilePreview, { type ProfilePreviewModel } from "@/components/ProfilePreview";
import type { ProfileEditorData } from "@/lib/user-profiles";
import { calculateProfileCompleteness } from "@/lib/profile-completeness";

type EditorProfile = ProfileEditorData;
type Notice = { tone: "success" | "error"; text: string } | null;

function initials(displayName: string | null) {
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || "?";
}

function previewModel(profile: EditorProfile, projects: ProfilePreviewModel["projects"], awards: ProfilePreviewModel["awards"]): ProfilePreviewModel {
  return { ...profile, projects, awards };
}

export default function ProfileEditorClient({
  initialProfile,
  projects,
  awards,
}: {
  initialProfile: EditorProfile;
  projects: ProfilePreviewModel["projects"];
  awards: ProfilePreviewModel["awards"];
}) {
  const [profile, setProfile] = useState<EditorProfile>(initialProfile);
  const [saved, setSaved] = useState<EditorProfile>(initialProfile);
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [interestInput, setInterestInput] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [lastValidHandle, setLastValidHandle] = useState(initialProfile.handle);
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);
  const progress = useMemo(() => calculateProfileCompleteness(profile), [profile]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function setField<K extends keyof EditorProfile>(field: K, value: EditorProfile[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
    setNotice(null);
  }

  function updateHandle(value: string) {
    setField("handle", value || null);
    setHandleError(null);
    if (!value) {
      setLastValidHandle(null);
      return;
    }
    const candidate = value.normalize("NFKC").trim().toLowerCase();
    if (candidate.length >= 3 && candidate.length <= 30 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate)) {
      setLastValidHandle(candidate);
    }
  }

  function addInterest() {
    const value = interestInput.trim();
    if (!value) return;
    if (value.length > 40) {
      setNotice({ tone: "error", text: "Interests must be 40 characters or fewer." });
      return;
    }
    if (profile.interests.some((interest) => interest.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setInterestInput("");
      return;
    }
    if (profile.interests.length >= 12) {
      setNotice({ tone: "error", text: "You can add up to 12 interests." });
      return;
    }
    setField("interests", [...profile.interests, value]);
    setInterestInput("");
  }

  function handleInterestKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addInterest();
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const body = await response.json().catch(() => ({})) as { error?: string; code?: string; profile?: EditorProfile };
    setSaving(false);
    if (!response.ok) {
      if (body.code === "invalid_handle" || body.code === "reserved_handle" || body.code === "handle_taken") {
        setHandleError(body.error ?? "Check your profile address and try again.");
      }
      setNotice({ tone: "error", text: body.error ?? "Profile update failed." });
      return;
    }
    if (body.profile) {
      setProfile(body.profile);
      setSaved(body.profile);
      setLastValidHandle(body.profile.handle);
    } else {
      setSaved(profile);
    }
    setNotice({ tone: "success", text: "Your profile is saved." });
  }

  return (
    <main className="profile-page">
      <header className="profile-page-header">
        <div>
          <h1>Your profile</h1>
          <p>Build an identity that stays with you across hackathons. Your projects and published awards can appear here over time.</p>
        </div>
        <div className="profile-page-actions">
          <Link className="btn-secondary" href="/account">Back to Account</Link>
          <button className="btn-secondary" type="button" onClick={() => setPreviewOpen((open) => !open)}>{previewOpen ? "Edit profile" : "Preview profile"}</button>
        </div>
      </header>

      {notice && <div className={`account-toast account-toast-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</div>}

      {previewOpen ? (
        <div className="profile-layout">
          <div>
            <ProfilePreview profile={previewModel(profile, projects, awards)} />
            <div className="profile-preview-back"><button className="btn-primary" type="button" onClick={() => setPreviewOpen(false)}>Continue editing</button></div>
          </div>
          <aside className="profile-editor-side-note"><strong>This is the public view</strong><p>Private projects, unpublished results, judge details, and internal event data stay out of this preview.</p><button className="btn-secondary" type="button" onClick={() => setPreviewOpen(false)}>Edit profile</button></aside>
        </div>
      ) : (
        <form className="profile-layout" onSubmit={save}>
          <div className="profile-editor-card">
            <section className="profile-editor-section">
              <h2>Identity</h2>
              <p>Use the name and short description you want teammates and future collaborators to recognize.</p>
              <div className="profile-identity-row">
                <div className="profile-avatar profile-avatar-editor" aria-hidden="true">{initials(profile.displayName)}</div>
                <div><strong>{profile.displayName || "Add your display name"}</strong><p>Initials are generated from your display name.</p></div>
              </div>
              <div className="profile-form-grid">
                <div className="profile-form-field profile-form-field-full"><label htmlFor="profile-display-name">Display name</label><input id="profile-display-name" className="input" value={profile.displayName ?? ""} onChange={(event) => setField("displayName", event.target.value || null)} maxLength={100} placeholder="Maya Rivera" /><span className="profile-field-help">This is the name people will see on your profile. Changes here won’t alter information already submitted with a team.</span></div>
                <div className="profile-form-field"><label htmlFor="profile-handle">Profile address</label><input id="profile-handle" className={`input${handleError ? " profile-input-error" : ""}`} value={profile.handle ?? ""} onChange={(event) => updateHandle(event.target.value)} maxLength={30} placeholder="maya-rivera" autoComplete="off" aria-invalid={Boolean(handleError)} aria-describedby={handleError ? "profile-handle-error" : "profile-handle-help"} />{handleError ? <span id="profile-handle-error" className="profile-field-error" role="alert">{handleError}</span> : <span id="profile-handle-help" className="profile-field-help">3–30 lowercase letters, numbers, or hyphens.</span>}</div>
                <div className="profile-form-field"><span className="profile-form-label">Address preview</span><div className="profile-address-preview"><span>vibe-hackathon</span><strong>/people/{lastValidHandle || "your-handle"}</strong></div><span className="profile-field-help">{profile.visibility === "private" ? "You can reserve this address now and publish your profile when you’re ready." : "This will be your public profile address when you make your profile public."}</span></div>
                <div className="profile-form-field profile-form-field-full"><label htmlFor="profile-headline">Headline</label><input id="profile-headline" className="input" value={profile.headline ?? ""} onChange={(event) => setField("headline", event.target.value || null)} maxLength={160} placeholder="Radiologist building practical AI tools" /></div>
              </div>
            </section>

            <section className="profile-editor-section">
              <h2>About</h2>
              <p>Give people a little context about what you build and care about.</p>
              <div className="profile-form-grid">
                <div className="profile-form-field"><label htmlFor="profile-affiliation">Affiliation / institution</label><input id="profile-affiliation" className="input" value={profile.affiliation ?? ""} onChange={(event) => setField("affiliation", event.target.value || null)} maxLength={160} placeholder="Weill Cornell Medicine" /></div>
                <div className="profile-form-field"><label htmlFor="profile-degrees">Degrees / title</label><input id="profile-degrees" className="input" value={profile.degrees ?? ""} onChange={(event) => setField("degrees", event.target.value || null)} maxLength={120} placeholder="MD · Clinical informatics" /></div>
                <div className="profile-form-field profile-form-field-full"><label htmlFor="profile-bio">Bio</label><textarea id="profile-bio" className="textarea" value={profile.bio ?? ""} onChange={(event) => setField("bio", event.target.value || null)} maxLength={2000} placeholder="Tell people what you are exploring, building, or learning." /><span className="profile-char-count">{(profile.bio ?? "").length}/2000</span></div>
              </div>
            </section>

            <section className="profile-editor-section">
              <h2>Links and interests</h2>
              <p>Share a few useful signposts. We never fetch these links while you edit.</p>
              <div className="profile-form-grid">
                <div className="profile-form-field"><label htmlFor="profile-website">Website</label><input id="profile-website" className="input" type="url" value={profile.websiteUrl ?? ""} onChange={(event) => setField("websiteUrl", event.target.value || null)} placeholder="https://example.com" /></div>
                <div className="profile-form-field"><label htmlFor="profile-github">GitHub</label><input id="profile-github" className="input" type="url" value={profile.githubUrl ?? ""} onChange={(event) => setField("githubUrl", event.target.value || null)} placeholder="https://github.com/you" /></div>
                <div className="profile-form-field"><label htmlFor="profile-linkedin">LinkedIn</label><input id="profile-linkedin" className="input" type="url" value={profile.linkedinUrl ?? ""} onChange={(event) => setField("linkedinUrl", event.target.value || null)} placeholder="https://linkedin.com/in/you" /></div>
                <div className="profile-form-field profile-form-field-full"><label htmlFor="profile-interest">Interests</label><div className="profile-interests">{profile.interests.map((interest) => <span className="profile-interest" key={interest}>{interest}<button type="button" aria-label={`Remove ${interest}`} onClick={() => setField("interests", profile.interests.filter((item) => item !== interest))}>×</button></span>)}<input id="profile-interest" className="profile-interest-input" value={interestInput} onChange={(event) => setInterestInput(event.target.value)} onKeyDown={handleInterestKeyDown} onBlur={() => { if (interestInput.trim()) addInterest(); }} placeholder={profile.interests.length < 12 ? "Type an interest and press Enter" : "Maximum reached"} disabled={profile.interests.length >= 12} /></div><span className="profile-field-help">Up to 12 interests. Press Enter or comma to add.</span></div>
              </div>
            </section>

            <section className="profile-editor-section">
              <h2>Visibility</h2>
              <p>Choose deliberately. Changing this never changes project access, team membership, judging, or Viby.</p>
              <div className="profile-visibility-options">
                <label className="profile-visibility-option"><input type="radio" name="visibility" checked={profile.visibility === "private"} onChange={() => setProfile((current) => ({ ...current, visibility: "private", discoverable: false }))} /><span><strong>Private</strong><span>Only you can view your profile. Your existing team and project access is unaffected.</span></span></label>
                <label className="profile-visibility-option"><input type="radio" name="visibility" checked={profile.visibility === "public"} onChange={() => setField("visibility", "public")} /><span><strong>Public</strong><span>Anyone with your profile link can view your profile and published project history.</span></span></label>
              </div>
              <div className="profile-discovery-option">
                <label className="profile-discovery-checkbox"><input type="checkbox" checked={profile.discoverable} disabled={profile.visibility !== "public"} onChange={(event) => setField("discoverable", event.target.checked)} /><span><strong>Show my profile in People search</strong><span>Let other participants discover your name, interests, and public project references.</span></span></label>
                <p className="profile-field-help">Your profile must be public before it can appear in the People directory.</p>
              </div>
            </section>

            <footer className="profile-form-footer">
              <span className="profile-save-state">{dirty ? "Unsaved changes" : "All changes saved"}</span>
              <div className="profile-form-footer-actions"><button className="btn-secondary" type="button" onClick={() => setPreviewOpen(true)}>Preview profile</button><button className="btn-primary" type="submit" disabled={saving || !dirty}>{saving ? "Saving…" : "Save changes"}</button></div>
            </footer>
          </div>
          <aside className="profile-editor-side-note"><div className="profile-completeness"><div className="profile-completeness-row"><strong>Profile setup</strong><span>{progress.label}</span></div><div className="profile-completeness-track"><span style={{ width: `${(progress.completed / progress.total) * 100}%` }} /></div></div><strong>Why complete this?</strong><p>Your durable profile can follow you across hackathons. Published projects and awards may appear here later; completing it is optional and never blocks participation.</p><Link className="btn-secondary" href="/account/projects">View your projects</Link></aside>
        </form>
      )}
    </main>
  );
}
