import { buildPresentationDotRotation } from "../lib/presentation-rotation";
import type { PresentationRotationItem } from "../lib/presentation-rotation";
import type { PresentationInstitution, PresentationProject } from "../lib/presentation-data";
import type { GeoLocation } from "../lib/institution-geo";

function geo(name: string): GeoLocation {
  return { city: name, country: "Test", continent: "Test", lat: name.length, lng: name.length * 2, confidence: "high" };
}

function visible(name: string): PresentationInstitution {
  return { name, geo: geo(name), participants: 1, teams: 1, students: 0 };
}

function project(id: string, lead: string | null, members: string[] = []): PresentationProject {
  const names = [...new Set([lead, ...members].filter(Boolean))] as string[];
  return {
    id,
    status: lead ? "draft" : "draft",
    isInProgress: true,
    projectTitle: id,
    teamName: id,
    problemStatement: null,
    screenshotUrl: null,
    demoUrl: null,
    demoVideoUrl: null,
    githubUrl: null,
    tags: [],
    audienceVotes: null,
    aiScore: null,
    awards: [],
    teamMembers: [],
    leadInstitution: lead,
    leadGeo: lead ? geo(lead) : null,
    institutions: names.map((name) => ({ name, geo: geo(name), role: name === lead ? "lead" : "member" })),
    contentSignalCount: 2,
  };
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function requireItem(item: PresentationRotationItem | undefined, message: string): PresentationRotationItem {
  if (!item) throw new Error(message);
  return item;
}

const visibleInstitutions = [visible("Lead Alpha"), visible("Member Beta"), visible("Shared Gamma"), visible("Round Robin")];
const projects = [
  project("alpha-project", "Lead Alpha", ["Member Beta"]),
  project("gamma-project", "Shared Gamma", []),
  project("rr-one", "Round Robin", []),
  project("rr-two", "Round Robin", []),
  project("fallback-one", null, []),
  project("fallback-two", null, []),
];

const first = buildPresentationDotRotation(projects, visibleInstitutions, "fixture", 0);
const second = buildPresentationDotRotation(projects, visibleInstitutions, "fixture", 1);

const firstInstitutions = first.map((item) => item.institution);
const geocoded = firstInstitutions.filter(Boolean);
assert(geocoded.length === new Set(geocoded).size, "every visible geocoded participant institution should appear once before repeat");
assert(new Set(geocoded).size === visibleInstitutions.length, "all visible institutions with eligible projects should appear");
assert(first[first.length - 1].reason === "fallback", "ungeocoded fallback bucket should appear after geocoded institutions");

const memberBeta = requireItem(first.find((item) => item.institution === "Member Beta"), "teammate-only institution should appear");
assert(memberBeta.project.id === "alpha-project", "teammate-only institution should be connected to its project");
assert(memberBeta.reason === "member", "teammate-only institution should be marked as member reason");
assert(memberBeta.featuredInstitution?.name === "Member Beta", "zoom target should equal featured teammate institution");
assert(memberBeta.featuredInstitution?.geo.lat === geo("Member Beta").lat, "featured institution should carry zoom coordinates");

const leadAlpha = requireItem(first.find((item) => item.institution === "Lead Alpha"), "lead institution should appear");
assert(leadAlpha.project.id === "alpha-project", "lead institution and teammate institution from same project should both appear");
assert(leadAlpha.reason === "lead", "lead institution should be marked lead");

const firstRoundRobin = first.find((item) => item.institution === "Round Robin")?.project.id;
const secondRoundRobin = second.find((item) => item.institution === "Round Robin")?.project.id;
assert(firstRoundRobin && secondRoundRobin && firstRoundRobin !== secondRoundRobin, "shared institution projects should round-robin across loops");

const fallback = first.find((item) => item.reason === "fallback");
assert(fallback?.featuredInstitution === null, "fallback items should not attempt map zoom");

const serialized = JSON.stringify(first);
for (const forbidden of ["@", "badge", "edit_", "token", "recovery", "owner", "verification"]) {
  assert(!serialized.toLowerCase().includes(forbidden), `rotation fixture should not expose ${forbidden}`);
}

console.log("presentation dot rotation fixture passed");
console.log(first.map((item) => `${item.institution ?? "fallback"}:${item.project.id}:${item.reason}`).join(" -> "));
console.log(second.map((item) => `${item.institution ?? "fallback"}:${item.project.id}:${item.reason}`).join(" -> "));
