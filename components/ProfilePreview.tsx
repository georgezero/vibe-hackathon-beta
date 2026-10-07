
import Link from "next/link";

export type ProfilePreviewModel = {
  handle: string | null;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  affiliation: string | null;
  degrees: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  interests: string[];
  visibility: "private" | "public";
  projects: Array<{
    projectId: string;
    projectTitle: string;
    teamName: string;
    eventSlug: string;
    eventName: string;
  }>;
  awards: Array<{
    awardId: string;
    awardName: string;
    projectId: string;
    projectTitle: string;
    eventSlug: string;
    eventName: string;
  }>;
};

export type ProfilePresentationMode = "preview" | "public";

function initials(displayName: string | null) {
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || "?";
}

function safeLinkLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

export default function ProfilePreview({
  profile,
  mode = "preview",
}: {
  profile: ProfilePreviewModel;
  mode?: ProfilePresentationMode;
}) {
  const displayName = profile.displayName || "Your name";
  const hasIdentity = Boolean(profile.displayName || profile.headline || profile.affiliation || profile.bio || profile.interests.length);
  const links = [
    profile.websiteUrl ? { label: "Website", url: profile.websiteUrl } : null,
    profile.githubUrl ? { label: "GitHub", url: profile.githubUrl } : null,
    profile.linkedinUrl ? { label: "LinkedIn", url: profile.linkedinUrl } : null,
  ].filter((link): link is { label: string; url: string } => Boolean(link));

  return (
    <article className="profile-preview-card" aria-label={mode === "public" ? "Participant profile" : "Profile preview"}>
      <div className="profile-preview-status">
        <span className="profile-preview-status-dot" aria-hidden="true" />
        {mode === "public" ? "Public profile" : profile.visibility === "public" ? "Public profile preview" : "Private profile preview"}
      </div>
      <header className="profile-preview-header">
        <div className="profile-avatar profile-avatar-large" aria-hidden="true">{initials(profile.displayName)}</div>
        <div className="profile-preview-identity">
          <h2>{displayName}</h2>
          {(profile.headline || profile.affiliation || profile.degrees) && (
            <p>{[profile.headline, profile.affiliation, profile.degrees].filter(Boolean).join(" · ")}</p>
          )}
          {profile.handle && <span className="profile-preview-handle">/people/{profile.handle}</span>}
        </div>
      </header>

      {!hasIdentity && (
        <p className="profile-preview-empty">Complete your profile to tell other participants what you&apos;re interested in and what you&apos;re building.</p>
      )}
      {profile.bio && <section className="profile-preview-section"><h3>About</h3><p className="profile-preview-bio">{profile.bio}</p></section>}
      {profile.interests.length > 0 && <section className="profile-preview-section"><h3>Interests</h3><div className="profile-preview-tags">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div></section>}
      {links.length > 0 && <nav className="profile-preview-links" aria-label="Profile links">{links.map((link) => <a href={link.url} key={link.label} target="_blank" rel="noreferrer">{link.label}<span aria-hidden="true">↗</span><small>{safeLinkLabel(link.url)}</small></a>)}</nav>}

      {profile.projects.length > 0 && <section className="profile-preview-section"><div className="profile-preview-section-heading"><h3>Projects</h3><span>{profile.projects.length}</span></div><div className="profile-preview-list">{profile.projects.map((project) => <div className="profile-preview-list-item" key={`${project.eventSlug}-${project.projectId}`}><strong>{project.projectTitle}</strong><span>{project.eventName} · {project.teamName}</span><Link href={`/project/${encodeURIComponent(project.projectId)}`} className="profile-preview-list-link">View project <span aria-hidden="true">→</span></Link></div>)}</div></section>}
      {profile.awards.length > 0 && <section className="profile-preview-section"><div className="profile-preview-section-heading"><h3>Awards</h3><span>{profile.awards.length}</span></div><div className="profile-preview-list">{profile.awards.map((award) => <div className="profile-preview-list-item" key={`${award.eventSlug}-${award.awardId}`}><strong>{award.awardName}</strong><span>{award.projectTitle} · {award.eventName}</span><Link href={`/project/${encodeURIComponent(award.projectId)}`} className="profile-preview-list-link">View project <span aria-hidden="true">→</span></Link></div>)}</div></section>}
      {mode === "preview" && profile.visibility === "private" && <p className="profile-preview-note">Only you can view this profile right now. Your team and project access are unchanged.</p>}
      {mode === "preview" && profile.visibility === "public" && !profile.handle && <p className="profile-preview-note">Choose a profile address before making this profile public.</p>}
      {mode === "preview" && profile.handle && profile.visibility === "public" && <span className="profile-preview-public-link">Public profile address: /people/{profile.handle}</span>}
    </article>
  );
}
