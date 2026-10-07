import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { getActiveEvent } from "@/lib/events";
import { listPeopleDirectory, type PeopleDirectoryQuery } from "@/lib/people-directory";
import ParticipantJourneyTracker from "@/components/ParticipantJourneyTracker";
import { ParticipantEmptyState } from "@/components/ParticipantEmptyState";
import MessageProfileButton from "@/components/MessageProfileButton";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function queryValue(value: string | string[] | undefined) {
  return first(value)?.trim() || "";
}

function directoryHref(result: { search: string; interest: string; institution: string }, page: number) {
  const params = new URLSearchParams();
  if (result.search) params.set("search", result.search);
  if (result.interest) params.set("interest", result.interest);
  if (result.institution) params.set("institution", result.institution);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/people${query ? `?${query}` : ""}`;
}

export default async function PeoplePage({ searchParams }: { searchParams: SearchParams }) {
  const principal = await resolveApplicationPrincipal(await headers());
  if (principal.status !== "authenticated") redirect("/login?returnTo=%2Fpeople");
  const params = await searchParams;
  const query: PeopleDirectoryQuery = {
    search: queryValue(params.search),
    interest: queryValue(params.interest),
    institution: queryValue(params.institution),
    page: queryValue(params.page),
  };
  const event = await getActiveEvent();
  const directory = await listPeopleDirectory(event.id, { ...query, viewerUserId: principal.principal.user.id });
  const account = applicationHeaderAccount({
    display_name: principal.principal.user.name?.trim() || principal.principal.user.email,
    roles: principal.principal.roles,
  });
  return (
    <div className="min-h-screen">
      <ParticipantJourneyTracker eventType="participant_people_viewed" context="people" destination="people" />
      <NavPublic authenticatedAccount={account} />
      <main className="people-directory-page mx-auto w-full max-w-7xl px-4 sm:px-6 py-12">
        {/* The directory is a participant-facing contact sheet: compact, typed, and useful at a glance. */}
        <header className="people-directory-header">
          <div>
            <p className="people-directory-eyebrow">{event.displayName || event.name}</p>
            <h1>People</h1>
            <p>Find builders, collaborators, and teams across {event.displayName || event.name}.</p>
          </div>
          <Link className="btn-secondary" href="/account/profile">Edit your profile</Link>
        </header>

        <form className="people-directory-filters" method="get" role="search">
          <label className="people-directory-search"><span>Search people</span><input className="input" name="search" type="search" placeholder="Name, institution, interest, or project" defaultValue={directory.search} /></label>
          <label><span>Interest</span><select className="input" name="interest" defaultValue={directory.interest}><option value="">All interests</option>{directory.interestOptions.map((interest) => <option key={interest} value={interest}>{interest}</option>)}</select></label>
          <label><span>Institution</span><select className="input" name="institution" defaultValue={directory.institution}><option value="">All institutions</option>{directory.institutionOptions.map((institution) => <option key={institution} value={institution}>{institution}</option>)}</select></label>
          <button className="btn-primary people-directory-filter-button" type="submit">Search</button>
          {(directory.search || directory.interest || directory.institution) && <Link className="people-directory-clear" href="/people">Clear</Link>}
        </form>

        <div className="people-directory-meta" aria-live="polite">
          <strong>{directory.total} {directory.total === 1 ? "person" : "people"}</strong>
          <span>{directory.search || directory.interest || directory.institution ? "matching your filters" : "in the participant directory"}</span>
        </div>

        {directory.cards.length > 0 ? (
          <div className="people-directory-grid">
            {directory.cards.map((person) => <PersonCard key={person.handle} person={person} />)}
          </div>
        ) : (
          directory.search || directory.interest || directory.institution
            ? <ParticipantEmptyState className="card people-directory-empty" title="No people match those filters." description="Try another name, institution, or interest." action={{ href: "/people", label: "View everyone", primary: false }} />
            : <ParticipantEmptyState className="card people-directory-empty" eyebrow="Participant directory" title="Participant profiles will appear here" description="Profiles are opt-in. Complete your profile and make it discoverable when you are ready to help collaborators find you." action={{ href: "/account/profile", label: "Complete your profile" }} />
        )}

        {directory.totalPages > 1 && <nav className="people-directory-pagination" aria-label="People pages">
          <Link className={`btn-secondary${directory.page <= 1 ? " people-directory-disabled" : ""}`} aria-disabled={directory.page <= 1} href={directory.page <= 1 ? directoryHref(directory, 1) : directoryHref(directory, directory.page - 1)}>Previous</Link>
          <span>Page {directory.page} of {directory.totalPages}</span>
          <Link className={`btn-secondary${directory.page >= directory.totalPages ? " people-directory-disabled" : ""}`} aria-disabled={directory.page >= directory.totalPages} href={directory.page >= directory.totalPages ? directoryHref(directory, directory.totalPages) : directoryHref(directory, directory.page + 1)}>Next</Link>
        </nav>}
      </main>
    </div>
  );
}

function PersonCard({ person }: { person: Awaited<ReturnType<typeof listPeopleDirectory>>["cards"][number] }) {
  return <article className="people-directory-card">
    <div className="people-directory-card-header">
      <div className="people-directory-avatar" aria-hidden="true">{person.initials}</div>
      <div className="people-directory-card-identity"><Link href={`/people/${encodeURIComponent(person.handle)}`}><h2>{person.displayName}</h2></Link>{person.headline && <p>{person.headline}</p>}{person.affiliation && <p className="people-directory-affiliation">{person.affiliation}</p>}</div>
    </div>
    {person.interests.length > 0 && <div className="people-directory-interests" aria-label="Interests">{person.interests.slice(0, 5).map((interest) => <span key={interest}>{interest}</span>)}</div>}
    {person.projects.length > 0 && <div className="people-directory-projects"><span className="people-directory-label">Building</span>{person.projects.map((project) => <Link key={project.projectId} href={`/project/${encodeURIComponent(project.projectId)}`}>{project.projectTitle}<small>{project.eventName}</small></Link>)}</div>}
    <div className="people-directory-actions">
      <Link className="people-directory-view" href={`/people/${encodeURIComponent(person.handle)}`}>View profile <span aria-hidden="true">→</span></Link>
      {!person.isSelf && <MessageProfileButton handle={person.handle} />}
    </div>
  </article>;
}
