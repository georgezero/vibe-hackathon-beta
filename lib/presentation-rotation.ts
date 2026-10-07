import type { PresentationInstitution, PresentationProject } from "@/lib/presentation-data";
import type { GeoLocation } from "@/lib/institution-geo";

export type PresentationRotationReason = "lead" | "member" | "fallback";

export interface FeaturedInstitution {
  id: string;
  name: string;
  displayName: string;
  geo: GeoLocation;
}

export interface PresentationRotationItem {
  institution: string | null;
  featuredInstitution: FeaturedInstitution | null;
  project: PresentationProject;
  reason: PresentationRotationReason;
}

function hash(input: string): number {
  let h = 0;
  for (const ch of input) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function deterministicShuffle<T>(items: T[], seed: string, key: (item: T) => string): T[] {
  return [...items].sort((a, b) => hash(`${seed}:${key(a)}`) - hash(`${seed}:${key(b)}`));
}

export function buildPresentationDotRotation(
  projects: PresentationProject[],
  visibleInstitutions: PresentationInstitution[],
  seed: string,
  loop = 0,
): PresentationRotationItem[] {
  const projectsByInstitution = new Map<string, PresentationProject[]>();

  for (const project of projects) {
    for (const inst of project.institutions) {
      if (!inst.geo) continue;
      const list = projectsByInstitution.get(inst.name) ?? [];
      if (!list.some((existing) => existing.id === project.id)) list.push(project);
      projectsByInstitution.set(inst.name, list);
    }
  }

  const dotOrder = deterministicShuffle(
    visibleInstitutions.filter((inst) => projectsByInstitution.has(inst.name)),
    `${seed}:visible-dots`,
    (inst) => inst.name,
  );

  const items: PresentationRotationItem[] = [];
  for (const inst of dotOrder) {
    const projectOrder = deterministicShuffle(projectsByInstitution.get(inst.name) ?? [], `${seed}:projects:${inst.name}`, (project) => project.id);
    const project = projectOrder[loop % Math.max(projectOrder.length, 1)];
    if (!project) continue;
    items.push({
      institution: inst.name,
      featuredInstitution: {
        id: inst.name,
        name: inst.name,
        displayName: inst.name,
        geo: inst.geo,
      },
      project,
      reason: project.leadInstitution === inst.name ? "lead" : "member",
    });
  }

  const fallback = projects.filter((project) => !project.institutions.some((inst) => inst.geo));
  const fallbackOrder = deterministicShuffle(fallback, `${seed}:fallback`, (project) => project.id);
  if (fallbackOrder.length > 0) {
    items.push({ institution: null, featuredInstitution: null, project: fallbackOrder[loop % fallbackOrder.length], reason: "fallback" });
  }

  return items;
}

export const buildPresentationInstitutionRotation = buildPresentationDotRotation;
