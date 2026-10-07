import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import type { VibyAgentAssertion } from "@/lib/viby";
import { adminSessionSigningSecret } from "@/lib/admin-session";

export const VERIFIED_ARTIFACT_COOKIE = "vibe_verified_artifact";

export type VerifiedArtifactType =
  | "project-summary"
  | "elevator-pitch"
  | "presentation-summary";

export interface VerifiedArtifactSignature {
  actorType: "agent";
  agentId: string;
  agentName: string;
  ownerDisplayName: string;
  ownerVibyId: string;
  assertionId: string;
  issuedAt: string | null;
  expiresAt: string | null;
}

export interface VerifiedArtifact {
  artifactId: string;
  artifactType: VerifiedArtifactType;
  title: string;
  content: string;
  generatedByAgentId: string;
  generatedByAgentName: string;
  ownerDisplayName: string;
  ownerVibyId: string;
  assertionId: string;
  sha256: string;
  createdAt: string;
  actionName: string;
  projectId: string;
  projectTitle: string;
  signature: VerifiedArtifactSignature;
}

export const VERIFIED_ARTIFACT_TYPES: Array<{
  type: VerifiedArtifactType;
  label: string;
  actionName: string;
  description: string;
}> = [
  {
    type: "project-summary",
    label: "Project Summary",
    actionName: "Project Summary Generation",
    description: "A concise project overview derived from the submission.",
  },
  {
    type: "elevator-pitch",
    label: "Elevator Pitch",
    actionName: "Elevator Pitch Generation",
    description: "A short pitch for quickly explaining the project.",
  },
  {
    type: "presentation-summary",
    label: "Presentation Summary",
    actionName: "Presentation Summary Generation",
    description: "A presentation-ready summary of the team, problem, and demo.",
  },
];

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload: string, secret?: string) {
  return createHmac("sha256", adminSessionSigningSecret(secret)).update(payload).digest("base64url");
}

export function sha256(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function truncateHash(hash: string) {
  return hash.slice(0, 12);
}

export function truncateAssertionId(assertionId: string) {
  return assertionId.slice(0, 8);
}

export function normalizeArtifactType(value: string | null | undefined): VerifiedArtifactType {
  const normalized = value?.replace(/_/g, "-");
  return VERIFIED_ARTIFACT_TYPES.some((item) => item.type === normalized)
    ? normalized as VerifiedArtifactType
    : "project-summary";
}

export function artifactTypeConfig(type: VerifiedArtifactType) {
  return VERIFIED_ARTIFACT_TYPES.find((item) => item.type === type) ?? VERIFIED_ARTIFACT_TYPES[0];
}

export function generateArtifactContent(input: {
  artifactType: VerifiedArtifactType;
  projectTitle: string;
  teamName: string;
  problemStatement: string | null;
  targetUsers: string | null;
  agentDisplayName: string;
}) {
  const title = input.projectTitle || "Untitled project";
  const audience = input.targetUsers ? ` for ${input.targetUsers}` : "";
  const problem = input.problemStatement
    ? input.problemStatement.replace(/\s+/g, " ").trim()
    : "The artifact was generated from the available Vibe Hackathon submission metadata.";

  if (input.artifactType === "elevator-pitch") {
    return `${title} helps${audience || " teams and stakeholders"} move faster by turning a hackathon idea into a concrete working demo. Built by ${input.teamName}, it focuses on a practical problem: ${problem} ${input.agentDisplayName} prepared this concise elevator pitch as a verified attribution demo.`;
  }

  if (input.artifactType === "presentation-summary") {
    return `${input.teamName} will present ${title} as a Vibe Hackathon project focused on${audience || " a clearly defined user group"}. The presentation should explain the problem, show the working demo, and describe how AI-assisted development shaped the build. Summary basis: ${problem} ${input.agentDisplayName} prepared this presentation summary as a verified attribution demo.`;
  }

  return `${title} by ${input.teamName} addresses${audience} a practical workflow identified during the hackathon. ${problem} ${input.agentDisplayName} prepared this concise project summary as a verified attribution demo.`;
}

export function createVerifiedArtifact(input: {
  assertion: VibyAgentAssertion;
  artifactType?: VerifiedArtifactType;
  projectId: string;
  projectTitle: string;
  teamName: string;
  problemStatement: string | null;
  targetUsers: string | null;
  createdAt?: Date;
}): VerifiedArtifact {
  const artifactType = input.artifactType ?? "project-summary";
  const config = artifactTypeConfig(artifactType);
  const content = generateArtifactContent({
    artifactType,
    projectTitle: input.projectTitle,
    teamName: input.teamName,
    problemStatement: input.problemStatement,
    targetUsers: input.targetUsers,
    agentDisplayName: input.assertion.agentDisplayName,
  });
  const createdAt = (input.createdAt ?? new Date()).toISOString();

  return {
    artifactId: randomUUID(),
    artifactType,
    title: config.label,
    content,
    generatedByAgentId: input.assertion.agentId,
    generatedByAgentName: input.assertion.agentDisplayName,
    ownerDisplayName: input.assertion.ownerDisplayName,
    ownerVibyId: input.assertion.ownerVibyUserId,
    assertionId: input.assertion.assertionId,
    sha256: sha256(content),
    createdAt,
    actionName: config.actionName,
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    signature: {
      actorType: "agent",
      agentId: input.assertion.agentId,
      agentName: input.assertion.agentDisplayName,
      ownerDisplayName: input.assertion.ownerDisplayName,
      ownerVibyId: input.assertion.ownerVibyUserId,
      assertionId: input.assertion.assertionId,
      issuedAt: input.assertion.issuedAt,
      expiresAt: input.assertion.expiresAt,
    },
  };
}

export function encodeVerifiedArtifact(artifact: VerifiedArtifact, secret?: string) {
  const payload = base64url(JSON.stringify(artifact));
  return `${payload}.${signPayload(payload, secret)}`;
}

export function decodeVerifiedArtifact(value: string, secret?: string): VerifiedArtifact | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as VerifiedArtifact;
    if (!parsed.artifactId || !parsed.title || !parsed.content) return null;
    if (normalizeArtifactType(parsed.artifactType) !== parsed.artifactType) return null;
    if (!parsed.generatedByAgentId || !parsed.generatedByAgentName || !parsed.ownerDisplayName) return null;
    if (!parsed.assertionId || !parsed.sha256 || !parsed.createdAt || !parsed.actionName) return null;
    if (!parsed.signature || parsed.signature.actorType !== "agent") return null;
    if (sha256(parsed.content) !== parsed.sha256) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatVerifiedArtifactMark(artifact: VerifiedArtifact) {
  return formatVibyArtifactSealText(artifact);
}

const VIBY_ARTIFACT_SEAL_MIN_WIDTH = 70;

function sealLine(content: string, width: number) {
  return `| ${content.padEnd(width - 2)} |`;
}

export function formatVibyArtifactSealText(artifact: VerifiedArtifact) {
  const rows = [
    `-v- ${artifact.generatedByAgentName} (${artifact.ownerDisplayName})`,
    `|i| ${artifact.actionName}`,
    "|b| Verified Identity - confirmed by Viby",
    `-y- sha256:${truncateHash(artifact.sha256)}`,
  ];
  const width = Math.max(
    VIBY_ARTIFACT_SEAL_MIN_WIDTH,
    ...rows.map((line) => line.length + 2),
  );

  return [
    `+${"-".repeat(width)}+`,
    ...rows.map((line) => sealLine(line, width)),
    `+${"-".repeat(width)}+`,
  ].join("\n");
}

export function formatVerifiedArtifactExport(artifact: VerifiedArtifact) {
  return `${artifact.content}\n\n${formatVibyArtifactSealText(artifact)}`;
}

// Compatibility names for the Phase 8.0 implementation.
export type VerifiedAgentArtifact = VerifiedArtifact;
export const artifactHash = sha256;
export const generateArtifactText = generateArtifactContent;
export const createVerifiedAgentArtifact = createVerifiedArtifact;
export const encodeVerifiedAgentArtifact = encodeVerifiedArtifact;
export const decodeVerifiedAgentArtifact = decodeVerifiedArtifact;
export const formatVibySignatureBlock = formatVerifiedArtifactMark;
