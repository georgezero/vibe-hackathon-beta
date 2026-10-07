import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { ensureOwnProfile, listPublicProfileAwards, listPublicProfileProjects, toProfileEditorData } from "@/lib/user-profiles";
import ProfileEditorClient from "./ProfileEditorClient";
import "./profile.css";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const principal = await resolveApplicationPrincipal(await headers());
  if (principal.status !== "authenticated") redirect("/login?returnTo=%2Faccount%2Fprofile");
  const userId = principal.principal.user.id;
  const [profile, projects, awards] = await Promise.all([
    ensureOwnProfile(userId),
    listPublicProfileProjects(userId),
    listPublicProfileAwards(userId),
  ]);
  return (
    <div className="min-h-screen">
      <NavPublic authenticatedAccount={applicationHeaderAccount({ display_name: principal.principal.user.name?.trim() || principal.principal.user.email, roles: principal.principal.roles })} />
      <ProfileEditorClient
        initialProfile={toProfileEditorData(profile)}
        projects={projects.map((project) => ({ projectId: project.projectId, projectTitle: project.projectTitle, teamName: project.teamName, eventSlug: project.eventSlug, eventName: project.eventName }))}
        awards={awards.map((award) => ({ awardId: award.awardId, awardName: award.awardName, projectId: award.projectId, projectTitle: award.projectTitle, eventSlug: award.eventSlug, eventName: award.eventName }))}
      />
    </div>
  );
}
