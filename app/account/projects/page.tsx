import { headers } from "next/headers";
import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { NavPublic } from "@/components/NavPublic";
import { db } from "@/lib/db";
import {
  events,
  publicationAwards,
  publicationReleases,
  submissionMemberships,
  submissionOwners,
  submissions,
  teamMembers,
} from "@/lib/db/schema";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { computePrizeEligibility } from "@/lib/prize-eligibility";
import { computeSubmissionReadiness } from "@/lib/submission-readiness";
import { listLatestProjectActivityBySubmission, type ProjectActivityItem } from "@/lib/project-activity";
import { getChatUnreadCountsBySubmission } from "@/lib/native-chat";
import { eventPhase } from "@/lib/events";
import { getOwnProfile, getProfileCompleteness } from "@/lib/user-profiles";
import ParticipantFeedback from "@/components/ParticipantFeedback";
import ParticipantJourneyTracker from "@/components/ParticipantJourneyTracker";
import { ParticipantEmptyState } from "@/components/ParticipantEmptyState";
import {
  participantAttention,
  participantHomeSummary,
  participantNextAction,
  participantProjectLifecycle,
  sortParticipantProjects,
  type ParticipantAttention,
  type ParticipantProjectLifecycle,
} from "@/lib/participant-project-home";
import type { InferSelectModel } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Submission = InferSelectModel<typeof submissions>;
type TeamMember = InferSelectModel<typeof teamMembers>;
type Event = InferSelectModel<typeof events>;
type PublicationRelease = InferSelectModel<typeof publicationReleases>;

type ParticipantProjectSummary = {
  id: string;
  title: string;
  teamName: string;
  role: "owner" | "teammate";
  members: TeamMember[];
  readiness: ReturnType<typeof computeSubmissionReadiness>;
  prize: ReturnType<typeof computePrizeEligibility>;
  lifecycle: ParticipantProjectLifecycle;
  attention: ParticipantAttention | null;
  unread: number;
  activity: ProjectActivityItem | null;
  awardLabel: string | null;
  updatedAt: Date | null;
};

type ActiveMembershipRow = { submissionId: string; role: "owner" | "teammate" };

export default async function MyProjectsPage({ searchParams }: { searchParams: Promise<{ claimed?: string; claim?: string; joined?: string }> }) {
  const principal = await resolveApplicationPrincipal(await headers());
  if (principal.status !== "authenticated") {
    return <div className="min-h-screen"><NavPublic /><main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6"><section className="card workspace-empty"><h1>Sign in to view My Projects</h1><p>Projects saved to your account appear here, ready for your next step.</p><div className="workspace-actions" style={{ justifyContent: "center" }}><Link className="btn-primary" href="/login?returnTo=%2Faccount%2Fprojects">Sign in</Link></div></section></main></div>;
  }

  const userId = principal.principal.user.id;
  const [membershipRows, ownerRows] = await Promise.all([
    db.select({ submissionId: submissionMemberships.submissionId, role: submissionMemberships.role })
      .from(submissionMemberships)
      .where(and(eq(submissionMemberships.userId, userId), eq(submissionMemberships.status, "active"))),
    db.select({ submissionId: submissionOwners.submissionId }).from(submissionOwners).where(eq(submissionOwners.userId, userId)),
  ]);
  const roleBySubmission = new Map<string, "owner" | "teammate">((membershipRows as ActiveMembershipRow[]).map((row) => [row.submissionId, row.role]));
  for (const row of ownerRows) if (!roleBySubmission.has(row.submissionId)) roleBySubmission.set(row.submissionId, "owner");
  const ids = [...roleBySubmission.keys()];
  let rows: Submission[] = [];
  let members: TeamMember[] = [];
  if (ids.length) {
    [rows, members] = await Promise.all([
      db.select().from(submissions).where(inArray(submissions.id, ids)),
      db.select().from(teamMembers).where(inArray(teamMembers.submissionId, ids)),
    ]);
  }

  const eventIds = [...new Set(rows.map((row) => row.eventId).filter((id): id is string => Boolean(id)))];
  const eventRows: Event[] = eventIds.length ? await db.select().from(events).where(inArray(events.id, eventIds)) : [];
  const releaseRows: PublicationRelease[] = eventIds.length ? await db.select().from(publicationReleases).where(inArray(publicationReleases.eventId, eventIds)) : [];
  const awardRows: Array<{ submissionId: string; label: string }> = ids.length
    ? await db.select({ submissionId: publicationAwards.submissionId, label: publicationAwards.label }).from(publicationAwards).where(and(inArray(publicationAwards.submissionId, ids), eq(publicationAwards.status, "active")))
    : [];
  const [activityBySubmission, unreadBySubmission] = await Promise.all([
    listLatestProjectActivityBySubmission(ids),
    getChatUnreadCountsBySubmission({ userId, submissionIds: ids }),
  ]);
  const eventById = new Map(eventRows.map((event) => [event.id, event]));
  const releaseByEvent = new Map(releaseRows.map((release) => [release.eventId, release]));
  const awardBySubmission = new Map<string, string>();
  for (const award of awardRows) if (!awardBySubmission.has(award.submissionId)) awardBySubmission.set(award.submissionId, award.label);

  const summaries = rows.map((row): ParticipantProjectSummary => {
    const projectMembers = members.filter((member) => member.submissionId === row.id);
    const readiness = computeSubmissionReadiness(row, projectMembers.map((member) => ({ name: member.name, badgeNumber: member.badgeNumber, isStudentTrainee: member.isStudentTrainee })));
    const prize = computePrizeEligibility(projectMembers.map((member) => ({ name: member.name, badgeNumber: member.badgeNumber, isStudentTrainee: member.isStudentTrainee })));
    const draftLike = (row.status as string) === "draft" || (row.status as string) === "ready";
    const attention = draftLike ? participantAttention(readiness) : null;
    const event = row.eventId ? eventById.get(row.eventId) : undefined;
    const release = row.eventId ? releaseByEvent.get(row.eventId) : undefined;
    const lifecycle = participantProjectLifecycle({
      submissionStatus: row.status,
      readinessStatus: readiness.status,
      eventStage: event ? eventPhase(event) : null,
      publicationStatus: release?.status ?? null,
      attention,
    });
    return {
      id: row.id,
      title: row.projectTitle?.trim() || row.teamName || "Untitled project",
      teamName: row.teamName,
      role: roleBySubmission.get(row.id) ?? "owner",
      members: projectMembers,
      readiness,
      prize,
      lifecycle,
      attention,
      unread: unreadBySubmission.get(row.id) ?? 0,
      activity: activityBySubmission.get(row.id) ?? null,
      awardLabel: awardBySubmission.get(row.id) ?? null,
      updatedAt: activityBySubmission.get(row.id)?.occurredAt ?? row.createdAt,
    };
  });
  const projects = sortParticipantProjects<ParticipantProjectSummary>(summaries);
  const summary = participantHomeSummary(projects.map((project) => project.lifecycle));
  const query = await searchParams;
  const ownProfile = await getOwnProfile(userId);
  const profileCompleteness = ownProfile ? getProfileCompleteness(ownProfile) : null;
  const profileNeedsSetup = !profileCompleteness || profileCompleteness.completed < profileCompleteness.total;

  return <div className="min-h-screen"><ParticipantJourneyTracker eventType="participant_my_projects_viewed" context="my_projects" destination="my_projects" /><NavPublic authenticatedAccount={{ displayName: principal.principal.user.name?.trim() || principal.principal.user.email, roles: principal.principal.roles }} /><main className="projects-home mx-auto w-full px-4 py-12 sm:px-6">
    <header className="projects-home-header"><div><p className="projects-home-eyebrow">Participant home</p><h1>My Projects</h1><p>Pick up where you left off.</p>{summary.total > 0 && <p className="projects-home-summary">{summary.total} {summary.total === 1 ? "project" : "projects"}{summary.attention > 0 ? ` · ${summary.attention} needs attention` : ""}</p>}</div><Link className="btn-primary" href="/start">Start a project</Link></header>
    {query.claimed && <div role="status" className="projects-notice is-success">Project saved to My Projects.</div>}
    {query.joined && <div role="status" className="projects-notice is-success">You joined the project team.</div>}
    {query.claim && <div role="status" className="projects-notice is-warning">That project could not be saved. Check the private project details and try again.</div>}
    {projects.length === 0 ? <EmptyProjectsState /> : <>
      <div className="projects-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
      <div className="projects-secondary-actions"><Link className="btn-secondary" href="/start">Start another project</Link></div>
      <section className="projects-explore" aria-label="Explore the event"><div><p className="projects-section-kicker">Beyond your projects</p><h2>Explore the event</h2><p>Meet participants and find the event-wide conversation.</p></div><div className="projects-explore-links"><Link href="/people">People <span aria-hidden="true">→</span></Link><Link href="/community">Community <span aria-hidden="true">→</span></Link></div></section>
    </>}
    <MyProjectsProfilePrompt profile={ownProfile} completeness={profileCompleteness} needsSetup={profileNeedsSetup} />
    <ParticipantFeedback context="my_projects" />
  </main></div>;
}

function EmptyProjectsState() {
  return <ParticipantEmptyState className="card projects-empty" eyebrow="Your work starts here" title="No projects yet" description="Start a project or join a team to see your work here. You can begin without an account and save it later." action={{ href: "/start", label: "Start a project" }} secondaryAction={{ href: "/claim", label: "Save an existing project" }} />;
}

function MyProjectsProfilePrompt({ profile, completeness, needsSetup }: {
  profile: Awaited<ReturnType<typeof getOwnProfile>>;
  completeness: ReturnType<typeof getProfileCompleteness> | null;
  needsSetup: boolean;
}) {
  const isPublic = profile?.visibility === "public" && Boolean(profile.handle);
  const isDiscoverable = isPublic && profile?.discoverable;
  const title = needsSetup ? "Complete your profile" : isDiscoverable ? "Your public profile" : isPublic ? "Join the People directory" : "Your profile is ready";
  const copy = needsSetup
    ? "Help teammates and other participants learn more about you."
    : isDiscoverable
      ? "Published projects and awards can build your portfolio over time."
      : isPublic
        ? "Let other participants discover your work and interests in People search."
        : "Preview your profile now, then publish it whenever you are ready.";
  const href = needsSetup ? "/account/profile" : isDiscoverable ? `/people/${encodeURIComponent(profile?.handle ?? "")}` : isPublic ? "/account/profile" : "/account/profile/preview";
  const action = needsSetup ? "Complete profile" : isDiscoverable ? "View profile" : isPublic ? "Directory settings" : "Preview profile";
  return <section className="profile-project-prompt" aria-label="Profile shortcut"><div className="profile-project-prompt-copy"><strong>{title}</strong><p>{copy}{completeness && needsSetup ? ` ${completeness.label}.` : ""}</p></div><div className="profile-project-prompt-actions"><Link className="btn-secondary" href={href}>{action}</Link></div></section>;
}

function ProjectCard({ project }: { project: ParticipantProjectSummary }) {
  const { lifecycle, attention } = project;
  const nextAction = participantNextAction(lifecycle, attention);
  const workspaceHref = `/projects/${encodeURIComponent(project.id)}`;
  const nextHref = nextAction.destination === "team" ? `${workspaceHref}/team` : nextAction.destination === "results" ? `${workspaceHref}/results` : workspaceHref;
  const statusCopy = attention?.detail ?? lifecycleCopy(lifecycle, project.awardLabel);
  const stateClass = lifecycle === "Needs attention" ? "is-attention" : lifecycle === "Ready to submit" ? "is-ready" : lifecycle === "Results available" ? "is-results" : "";
  return <article className={`project-card ${stateClass}`}>
    <div className="project-card-top"><div className="project-card-heading"><div className="project-card-status-row"><span className="project-card-state" data-state={stateClass || "default"}><span className="project-card-state-dot" aria-hidden="true" />{lifecycle}</span><span className="badge badge-default">{project.role === "owner" ? "Team lead" : "Teammate"}</span></div><h2 className="project-card-title">{project.title}</h2><p className="project-card-team">{project.teamName}</p></div><span className="project-card-team-size">{project.members.length} {project.members.length === 1 ? "person" : "people"}</span></div>
    <div className="project-card-status-copy"><strong>{lifecycle === "Needs attention" ? attention?.label : lifecycle === "Results available" ? (project.awardLabel ?? "Results available") : lifecycle}</strong><p>{statusCopy}</p></div>
    {project.readiness.status !== "finalized" && <div className="project-card-progress"><span className="project-card-progress-label">Project readiness</span><span className="project-card-progress-value">{project.readiness.completionPercent}%</span></div>}
    {project.readiness.status !== "finalized" && <div className="project-progress-bar" aria-label={`${project.readiness.completionPercent}% project readiness`}><div className="project-progress-fill" style={{ width: `${project.readiness.completionPercent}%` }} /></div>}
    <div className="project-card-facts">{project.prize.eligibleForPrize && <span className="badge badge-success">Team eligible</span>}{project.unread > 0 ? <span className="badge badge-accent" aria-label={`${project.unread} unread Team Chat messages`}>Team Chat · {project.unread} unread</span> : <span className="badge badge-default">Team Chat</span>}{project.activity && <time className="project-card-updated" dateTime={project.activity.occurredAt.toISOString()}>Updated {formatRelativeDate(project.activity.occurredAt)}</time>}</div>
    <div className="project-card-actions"><Link className="btn-primary" href={nextHref}>{nextAction.label}</Link>{nextAction.destination !== "workspace" && <Link className="btn-secondary" href={workspaceHref}>Open workspace</Link>}{(lifecycle === "Ready to submit" || lifecycle === "Submitted" || lifecycle === "Judging" || lifecycle === "Results pending") && <Link className="btn-secondary" href={`${workspaceHref}/preview`}>Preview</Link>}{project.unread > 0 && <Link className="btn-secondary" href={`${workspaceHref}/messages`}>Read Team Chat</Link>}</div>
  </article>;
}

function lifecycleCopy(lifecycle: ParticipantProjectLifecycle, awardLabel: string | null) {
  switch (lifecycle) {
    case "Draft": return "Keep adding details before you submit.";
    case "Ready to submit": return "Your project is ready to submit.";
    case "Submitted": return "Your project is ready for judging.";
    case "Judging": return "Judging is in progress.";
    case "Results pending": return "Results will appear here when organizers publish them.";
    case "Results available": return awardLabel ? "Your published result is ready." : "Your published result is ready to view.";
    case "Needs attention": return "Open the project to see what to do next.";
  }
}

function formatRelativeDate(date: Date) {
  const delta = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(delta / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
