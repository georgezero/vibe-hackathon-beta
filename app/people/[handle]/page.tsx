import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import ProfilePreview from "@/components/ProfilePreview";
import MessageProfileButton from "@/components/MessageProfileButton";
import { getBaseUrl } from "@/lib/base-url";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { getPublicProfileByHandle, getPublicProfilePageByHandle, ownsProfileHandle } from "@/lib/user-profiles";
import "../../account/profile/profile.css";
import ParticipantJourneyTracker from "@/components/ParticipantJourneyTracker";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ handle: string }> };

const genericMetadata: Metadata = {
  title: "Participant profile · Vibe Hackathon",
  description: "Participant profiles from Vibe Hackathon.",
  robots: { index: false, follow: false },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getPublicProfileByHandle(handle);
  if (!profile) return genericMetadata;
  const canonical = `${getBaseUrl()}/people/${encodeURIComponent(profile.handle)}`;
  return {
    title: `${profile.displayName} · Vibe Hackathon`,
    description: profile.headline || `${profile.displayName}'s participant profile on Vibe Hackathon.`,
    alternates: { canonical },
    openGraph: {
      title: `${profile.displayName} · Vibe Hackathon`,
      description: profile.headline || `${profile.displayName}'s participant profile on Vibe Hackathon.`,
      url: canonical,
      type: "profile",
    },
  };
}

export default async function PublicParticipantProfilePage({ params }: Props) {
  const { handle } = await params;
  const profile = await getPublicProfilePageByHandle(handle);
  if (!profile) notFound();
  const principal = await resolveApplicationPrincipal(await headers());
  const isOwner = principal.status === "authenticated"
    ? await ownsProfileHandle(principal.principal.user.id, profile.handle)
    : false;
  // Every discoverable, active other-person profile is messageable. The
  // conversation endpoint remains the server-side authority for self, block,
  // and account-state safety checks.
  const canMessage = principal.status === "authenticated" && !isOwner;

  return (
    <div className="min-h-screen">
      {principal.status === "authenticated" && <ParticipantJourneyTracker eventType="participant_profile_viewed" context="people" destination="people" />}
      <NavPublic />
      <main className="profile-page profile-public-page">
        <header className="profile-page-header profile-public-page-header">
          <div>
            <p className="profile-public-eyebrow">Participant profile</p>
            <h1>{profile.displayName}</h1>
            <p>Projects and published recognition from Vibe Hackathon.</p>
          </div>
          <div className="profile-page-actions">
            <Link className="btn-secondary" href="/projects">Projects</Link>
            {isOwner && <Link className="btn-secondary" href="/account/profile">Edit profile</Link>}
            {canMessage && <MessageProfileButton handle={profile.handle} />}
          </div>
        </header>
        <ProfilePreview
          mode="public"
          profile={{
            handle: profile.handle,
            displayName: profile.displayName,
            headline: profile.headline,
            bio: profile.bio,
            affiliation: profile.affiliation,
            degrees: profile.degrees,
            websiteUrl: profile.websiteUrl,
            githubUrl: profile.githubUrl,
            linkedinUrl: profile.linkedinUrl,
            interests: profile.interests,
            visibility: "public",
            projects: profile.projects,
            awards: profile.awards,
          }}
        />
      </main>
    </div>
  );
}
