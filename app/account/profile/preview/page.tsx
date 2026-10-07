import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NavPublic } from "@/components/NavPublic";
import ProfilePreview from "@/components/ProfilePreview";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { ensureOwnProfile, listPublicProfileAwards, listPublicProfileProjects, toProfileEditorData } from "@/lib/user-profiles";
import "../profile.css";

export const dynamic = "force-dynamic";

export default async function ProfilePreviewPage() {
  const principal = await resolveApplicationPrincipal(await headers());
  if (principal.status !== "authenticated") redirect("/login?returnTo=%2Faccount%2Fprofile%2Fpreview");
  const userId = principal.principal.user.id;
  const [profile, projects, awards] = await Promise.all([
    ensureOwnProfile(userId),
    listPublicProfileProjects(userId),
    listPublicProfileAwards(userId),
  ]);
  return (
    <div className="min-h-screen">
      <NavPublic authenticatedAccount={applicationHeaderAccount({ display_name: principal.principal.user.name?.trim() || principal.principal.user.email, roles: principal.principal.roles })} />
      <main className="profile-page">
        <header className="profile-page-header">
          <div><h1>Profile preview</h1><p>This is the safe public-facing view. Private projects, unpublished results, and internal judging data are never included.</p></div>
          <div className="profile-page-actions"><Link className="btn-secondary" href="/account">Account</Link><Link className="btn-primary" href="/account/profile">Edit profile</Link></div>
        </header>
        <ProfilePreview profile={{ ...toProfileEditorData(profile), projects: projects.map((project) => ({ projectId: project.projectId, projectTitle: project.projectTitle, teamName: project.teamName, eventSlug: project.eventSlug, eventName: project.eventName })), awards: awards.map((award) => ({ awardId: award.awardId, awardName: award.awardName, projectId: award.projectId, projectTitle: award.projectTitle, eventSlug: award.eventSlug, eventName: award.eventName })) }} />
      </main>
    </div>
  );
}
