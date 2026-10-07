/**
 * seed-media — wipes DB and seeds 5 projects covering every media scenario.
 *
 * Purpose: permanent regression dataset for screenshot gallery, thumbnail
 * navigation, lightbox, video embeds, and legacy screenshotUrl compatibility.
 *
 * Run via: npm run db:seed:media
 *
 * Projects:
 *   A  — 5 screenshots + YouTube embed
 *   B  — 5 screenshots + Loom embed
 *   C  — 5 screenshots + Vimeo embed
 *   D  — 5 screenshots + unsupported video URL (tests fallback link)
 *   E  — screenshotUrl only, no screenshotUrls[], no video (legacy compat)
 */

import { db } from "./index";
import {
  submissions, teamMembers, judges, judgeAssignments,
  humanScores, aiReviews, aiJudgeRuns, audienceVotes, submissionOwners, teamOwners, teams,
  events, reproductionRuns,
} from "./schema";
import { nanoid } from "nanoid";

const EVENT_ID = "evt_vibe_2025";

// ── Stable image URLs ─────────────────────────────────────────────────────────
// picsum.photos/seed/{seed}/1280/720 → deterministic 16:9 crop, no auth needed.

function pics(seed: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    `https://picsum.photos/seed/${seed}_${i + 1}/1280/720`
  );
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const MEDIA_SUBMISSIONS = [
  {
    id: "sub_media_a",
    editToken: "edit_media_a_token_000",
    projectTitle: "RadVision AI — Screenshot Gallery + YouTube",
    teamName: "Gallery Team Alpha",
    contactEmail: "alpha@media-test.dev",
    problemStatement:
      "AI-assisted radiology report generation that cuts review time by 60%. " +
      "This project tests the screenshot gallery hero with five images and a YouTube demo video embed.",
    targetUsers: "radiologists, residents, radiology departments",
    demoUrl: "https://example.com/demo-a",
    githubUrl: "https://github.com/example/radvision-ai",
    demoVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    screenshotUrls: pics("media_a", 5),
    screenshotUrl: pics("media_a", 5)[0],
    tags: ["radiology", "AI", "NLP"],
    license: "MIT",
    agentHarnesses: ["Claude Code"],
    agentModels: ["claude-opus-4-5"],
    budgetTier: "api_10_to_50",
    estimatedHumanHours: 8,
    estimatedAgentHours: 32,
    audienceVotes: 11,
    members: [
      { name: "Alex Chen", email: "alex.chen@northbay.edu", badgeNumber: "NB-10421", affiliation: "North Bay University", degrees: "MD", isStudentTrainee: true },
      { name: "Maya Rodriguez", email: "maya.rodriguez@northbay.edu", badgeNumber: "NB-10422", affiliation: "North Bay University", degrees: "MS", isStudentTrainee: true },
    ],
  },
  {
    id: "sub_media_b",
    editToken: "edit_media_b_token_000",
    projectTitle: "PathScan Pro — Screenshot Gallery + Loom",
    teamName: "Gallery Team Beta",
    contactEmail: "beta@media-test.dev",
    problemStatement:
      "Automated pathology slide analysis with GPT-4 Vision and Claude. " +
      "This project tests the screenshot gallery with five images and a Loom video embed.",
    targetUsers: "pathologists, lab technicians, research institutions",
    demoUrl: "https://example.com/demo-b",
    githubUrl: "https://github.com/example/pathscan-pro",
    demoVideoUrl: "https://www.loom.com/share/6d3c2738f064438182a72818e571cecd",
    screenshotUrls: pics("media_b", 5),
    screenshotUrl: pics("media_b", 5)[0],
    tags: ["pathology", "vision", "automation"],
    license: "MIT",
    agentHarnesses: ["Cursor"],
    agentModels: ["gpt-4o", "claude-opus-4-5"],
    budgetTier: "multiple_paid_subscriptions",
    estimatedHumanHours: 10,
    estimatedAgentHours: 28,
    audienceVotes: 18,
    members: [
      { name: "Sam Park", email: "sam.park@metrohealth.org", badgeNumber: "MH-22011", affiliation: "MetroHealth", degrees: "PhD", isStudentTrainee: false },
      { name: "Jordan Lee", email: "jordan.lee@metrohealth.org", badgeNumber: "MH-22012", affiliation: "MetroHealth", degrees: "MD", isStudentTrainee: false },
      { name: "Nina Shah", email: "nina.shah@case.edu", badgeNumber: "", affiliation: "Case Western Reserve University", degrees: "BS", isStudentTrainee: true },
    ],
  },
  {
    id: "sub_media_c",
    editToken: "edit_media_c_token_000",
    projectTitle: "ImagingFlow — Screenshot Gallery + Vimeo",
    teamName: "Gallery Team Gamma",
    contactEmail: "gamma@media-test.dev",
    problemStatement:
      "DICOM workflow automation that integrates with PACS and EHR systems. " +
      "This project tests the screenshot gallery with five images and a Vimeo video embed.",
    targetUsers: "PACS admins, radiology IT, workflow engineers",
    demoUrl: "https://example.com/demo-c",
    githubUrl: "https://github.com/example/imagingflow",
    demoVideoUrl: "https://vimeo.com/76979871",
    screenshotUrls: pics("media_c", 5),
    screenshotUrl: pics("media_c", 5)[0],
    tags: ["PACS", "DICOM", "workflow"],
    license: "Apache-2.0",
    agentHarnesses: ["Aider", "Claude Code"],
    agentModels: ["claude-sonnet-4-6"],
    budgetTier: "api_under_10",
    estimatedHumanHours: 6,
    estimatedAgentHours: 40,
    audienceVotes: 10,
    members: [
      { name: "Priya Nair", email: "priya.nair@pacs-lab.org", badgeNumber: "PL-33001", affiliation: "PACS Lab", degrees: "MS", isStudentTrainee: false },
      { name: "Tom Walsh", email: "tom.walsh@cityhospital.org", badgeNumber: "CH-33881", affiliation: "City Hospital", degrees: "RT(R)", isStudentTrainee: false },
      { name: "Aisha Mensah", email: "aisha.mensah@cityhospital.org", badgeNumber: "CH-33882", affiliation: "City Hospital", degrees: "MD", isStudentTrainee: true },
      { name: "Leo Martin", email: "leo.martin@pacs-lab.org", badgeNumber: "PL-33002", affiliation: "PACS Lab", degrees: "BS", isStudentTrainee: true },
    ],
  },
  {
    id: "sub_media_d",
    editToken: "edit_media_d_token_000",
    projectTitle: "ClinicalNotes AI — Gallery + Unsupported Video",
    teamName: "Gallery Team Delta",
    contactEmail: "delta@media-test.dev",
    problemStatement:
      "LLM-powered clinical note summarization for busy clinicians. " +
      "This project tests the screenshot gallery with five images and an unsupported video " +
      "URL — verifies the 'Open Demo Video →' fallback link renders instead of an embed.",
    targetUsers: "clinicians, hospital administrators, health IT teams",
    demoUrl: "https://example.com/demo-d",
    githubUrl: "https://github.com/example/clinicalnotes-ai",
    demoVideoUrl: "https://www.dropbox.com/s/abc123def456/demo.mp4?dl=0",
    screenshotUrls: pics("media_d", 5),
    screenshotUrl: pics("media_d", 5)[0],
    tags: ["NLP", "clinical notes", "LLM"],
    license: "MIT",
    agentHarnesses: ["GitHub Copilot"],
    agentModels: ["gpt-4o"],
    budgetTier: "standard_subscription",
    estimatedHumanHours: 14,
    estimatedAgentHours: 18,
    audienceVotes: 8,
    members: [
      { name: "Dana Kim", email: "dana.kim@westlake.ai", badgeNumber: "WL-55101", affiliation: "Westlake AI Institute", degrees: "PhD", isStudentTrainee: false },
      { name: "Omar Haddad", email: "omar.haddad@westlake.ai", badgeNumber: "WL-55102", affiliation: "Westlake AI Institute", degrees: "MS", isStudentTrainee: true },
      { name: "Grace Lin", email: "grace.lin@countyhealth.org", badgeNumber: "CO-77114", affiliation: "County Health System", degrees: "MD", isStudentTrainee: false },
      { name: "Miles Carter", email: "miles.carter@countyhealth.org", badgeNumber: "", affiliation: "County Health System", degrees: "MPH", isStudentTrainee: true },
      { name: "Rina Patel", email: "rina.patel@westlake.ai", badgeNumber: "WL-55103", affiliation: "Westlake AI Institute", degrees: "BS", isStudentTrainee: true },
    ],
  },
  {
    id: "sub_media_e",
    editToken: "edit_media_e_token_000",
    projectTitle: "MedSummarizer — Legacy screenshotUrl Only",
    teamName: "Gallery Team Epsilon",
    contactEmail: "epsilon@media-test.dev",
    problemStatement:
      "Automated medical literature summarization using RAG + Claude. " +
      "This project tests backward compatibility: only screenshotUrl is set, " +
      "screenshotUrls[] is null, and there is no demo video. " +
      "The hero should still render from screenshotUrl via resolveScreenshotUrls().",
    targetUsers: "researchers, clinicians, medical students",
    demoUrl: "https://example.com/demo-e",
    githubUrl: "https://github.com/example/medsummarizer",
    demoVideoUrl: null,
    screenshotUrls: null,
    screenshotUrl: "https://picsum.photos/seed/media_e_legacy/1280/720",
    tags: ["RAG", "summarization", "research"],
    license: "MIT",
    agentHarnesses: ["Claude Code"],
    agentModels: ["claude-opus-4-5"],
    budgetTier: "api_under_10",
    estimatedHumanHours: 12,
    estimatedAgentHours: 20,
    audienceVotes: 6,
    members: [
      { name: "Yuki Tanaka", email: "yuki.tanaka@harbor.edu", badgeNumber: "HU-88101", affiliation: "Harbor University", degrees: "MD, PhD", isStudentTrainee: false },
      { name: "Marco Santos", email: "marco.santos@harbor.edu", badgeNumber: "HU-88102", affiliation: "Harbor University", degrees: "MS", isStudentTrainee: false },
      { name: "Emily Ross", email: "emily.ross@harbor.edu", badgeNumber: "HU-88103", affiliation: "Harbor University", degrees: "BS", isStudentTrainee: true },
      { name: "Tariq Ali", email: "tariq.ali@regionalrad.org", badgeNumber: "RR-10991", affiliation: "Regional Radiology Associates", degrees: "MD", isStudentTrainee: true },
      { name: "Sofia Nguyen", email: "sofia.nguyen@regionalrad.org", badgeNumber: "", affiliation: "Regional Radiology Associates", degrees: "MS", isStudentTrainee: true },
      { name: "Ben Miller", email: "ben.miller@harbor.edu", badgeNumber: "HU-88104", affiliation: "Harbor University", degrees: "PhD", isStudentTrainee: false },
    ],
  },
];

const MEDIA_JUDGES = [
  {
    id: "judge_media_ada",
    name: "Ada Patel",
    email: "ada.patel@media-test.dev",
  },
  {
    id: "judge_media_ben",
    name: "Ben Okafor",
    email: "ben.okafor@media-test.dev",
  },
  {
    id: "judge_media_cleo",
    name: "Cleo Stein",
    email: "cleo.stein@media-test.dev",
  },
];

const SCORE_BASELINES = {
  sub_media_a: 9,
  sub_media_b: 8,
  sub_media_c: 8,
  sub_media_d: 7,
  sub_media_e: 6,
} as const;

const AI_BASELINES = {
  sub_media_a: { overall: 91, presentation: 89, agent: 90, docs: 88, repro: 88, deploy: 86 },
  sub_media_b: { overall: 88, presentation: 86, agent: 86, docs: 85, repro: 84, deploy: 82 },
  sub_media_c: { overall: 96, presentation: 90, agent: 91, docs: 89, repro: 86, deploy: 85 },
  sub_media_d: { overall: 84, presentation: 85, agent: 99, docs: 98, repro: 94, deploy: 90 },
  sub_media_e: { overall: 82, presentation: 97, agent: 84, docs: 82, repro: 78, deploy: 76 },
} as const;

const PENDING_REVIEWS = new Set([
  "judge_media_ada:sub_media_e",
  "judge_media_ben:sub_media_d",
  "judge_media_cleo:sub_media_b",
]);

function rubricScores(submissionId: string, judgeIndex: number, submissionIndex: number) {
  const base = SCORE_BASELINES[submissionId as keyof typeof SCORE_BASELINES] ?? 7;
  const judgeBias = judgeIndex === 0 ? 0 : judgeIndex === 1 ? 1 : -1;
  const projectWobble = (submissionIndex % 3) - 1;
  const clamp = (value: number) => Math.max(1, Math.min(10, value));

  return {
    problemSelection: clamp(base + judgeBias),
    productUsefulness: clamp(base + projectWobble),
    functionality: clamp(base + (judgeIndex === 1 ? 1 : 0)),
    uxDesign: clamp(base + (judgeIndex === 2 ? 1 : 0)),
    aiCollaboration: clamp(base + judgeBias + projectWobble),
    originality: clamp(base + (submissionIndex === 0 ? 1 : 0)),
    maintainability: clamp(base + (judgeIndex === 1 ? 1 : -1)),
    presentationClarity: clamp(base + (judgeIndex === 2 ? 1 : 0)),
  };
}

function recommendationFor(avg: number) {
  if (avg >= 8.75) return "strong-yes";
  if (avg >= 7.25) return "yes";
  if (avg >= 5.75) return "maybe";
  return "no";
}

// ── Wipe + seed ───────────────────────────────────────────────────────────────

async function wipeTables() {
  await db.delete(audienceVotes);
  await db.delete(reproductionRuns);
  await db.delete(aiJudgeRuns);
  await db.delete(aiReviews);
  await db.delete(humanScores);
  await db.delete(judgeAssignments);
  await db.delete(teamMembers);
  await db.delete(submissionOwners);
  await db.delete(teamOwners);
  await db.delete(judges);
  await db.delete(submissions);
  await db.delete(teams);
  await db.delete(events);
}

async function seedMedia() {
  console.log("Seeding media showcase dataset...");

  await wipeTables();

  // Event
  await db.insert(events).values({
    id: EVENT_ID,
    name: "Vibe Hackathon 2026",
    slug: "vibe-hackathon-2026",
    displayName: "RSNA 2026",
    logoUrl: "https://www.rsna.org/-/media/images/rsna/annual-meeting/2026/rsna_2026_logo_color_fin.png",
    tagline: "Vibe coding competition for agentic devs in Radiology",
    isActive: true,
    audienceVotingEnabled: true,
    audienceAwardCount: 1,
    audienceVotesPerPerson: 1,
    audienceResultsVisible: true,
    audienceVotingMode: "human",
    audienceIdentityMethod: "badge",
    winnersPublishedAt: new Date(),
    showJudgeChoice: true,
    showPeoplesChoice: true,
    showAIChoice: true,
    showSpecialAwards: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Submissions
  for (const sub of MEDIA_SUBMISSIONS) {
    const teamId = `team_${sub.id.replace("sub_", "")}`;
    const owner = sub.members[0];
    await db.insert(teams).values({
      id: teamId,
      eventId: EVENT_ID,
      name: sub.teamName,
      contactEmail: sub.contactEmail,
      affiliation: owner.affiliation,
      description: `${sub.teamName} seeded media demo team with ${sub.members.length} registered attendee${sub.members.length === 1 ? "" : "s"}.`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(submissions).values({
      id: sub.id,
      teamId,
      eventId: EVENT_ID,
      editToken: sub.editToken,
      status: "finalized",
      teamName: sub.teamName,
      contactEmail: sub.contactEmail,
      projectTitle: sub.projectTitle,
      problemStatement: sub.problemStatement,
      targetUsers: sub.targetUsers,
      demoUrl: sub.demoUrl,
      githubUrl: sub.githubUrl,
      demoVideoUrl: sub.demoVideoUrl,
      screenshotUrl: sub.screenshotUrl,
      screenshotUrls: sub.screenshotUrls,
      tags: sub.tags,
      license: sub.license,
      agentHarnesses: sub.agentHarnesses,
      agentModels: sub.agentModels,
      budgetTier: sub.budgetTier,
      estimatedHumanHours: sub.estimatedHumanHours,
      estimatedAgentHours: sub.estimatedAgentHours,
      createdAt: new Date(),
      submittedAt: new Date(),
      finalizedAt: new Date(),
    });

    // Team members
    for (let i = 0; i < sub.members.length; i++) {
      const member = sub.members[i];
      await db.insert(teamMembers).values({
        id: nanoid(),
        teamId,
        submissionId: sub.id,
        name: member.name,
        email: member.email,
        badgeNumber: member.badgeNumber,
        badgeVerificationStatus: "unchecked",
        affiliation: member.affiliation,
        degrees: member.degrees,
        isStudentTrainee: member.isStudentTrainee,
        role: i === 0 ? "Owner" : null,
        order: i,
      });
    }

    // Audience votes
    for (let i = 0; i < sub.audienceVotes; i++) {
      await db.insert(audienceVotes).values({
        id: nanoid(),
        submissionId: sub.id,
        sessionFingerprint: `media_seed_${sub.id}_${i}`,
        createdAt: new Date(),
      });
    }

    const ai = AI_BASELINES[sub.id as keyof typeof AI_BASELINES];
    await db.insert(aiReviews).values({
      id: `ai_review_${sub.id}`,
      submissionId: sub.id,
      complianceCheck: "pass",
      repoReview: `Media seed deterministic review for ${sub.projectTitle}.\n✓ README.md\n✓ LICENSE\n✓ .env.example\n✓ vibe.json\n✓ screenshot evidence`,
      demoValidation: "live",
      screenshotValidation: "valid",
      agentsMdEvaluation: "AGENTS.md present with setup, run, architecture, and agent workflow notes.",
      promptStrategyEvaluation: "Prompt and agent workflow evidence documented for demo judging.",
      reliabilityNotes: `Reproducibility: ${ai.repro}/100 | Deployment: ${ai.deploy}/100. Seeded deterministic evidence for winner demos.`,
      generatedScore: ai.overall,
      generatedRationale: `Overall: ${ai.overall}/100. Repo, media, and agent-native evidence are complete enough for demo judging.`,
      suggestedQuestions: ["Does the public demo remain available during the event?", "What tradeoffs were made during agent-assisted development?"],
      scoringDetails: {
        repository_score: ai.overall,
        documentation_score: ai.docs,
        reproducibility_score: ai.repro,
        deployment_score: ai.deploy,
        agent_readiness_score: ai.agent,
        checks: {
          agents_md_exists: true,
          vibe_json_exists: true,
          prompts_md_exists: sub.id !== "sub_media_e",
          readme_exists: true,
          license_exists: true,
        },
      },
      status: "complete",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(aiJudgeRuns).values({
      id: `ai_run_${sub.id}_mock_consensus`,
      submissionId: sub.id,
      eventId: EVENT_ID,
      modelProvider: "mock",
      modelName: "media-seed-consensus-v1",
      status: "complete",
      startedAt: new Date(),
      completedAt: new Date(),
      inputSummary: `Seeded organizer AI evaluation for ${sub.projectTitle}.`,
      rawResponseJson: {
        seeded: true,
        purpose: "media dataset winners and AI eval demo",
      },
      scoresJson: {
        overall_score: ai.overall,
        presentation_score: ai.presentation,
        product_score: Math.max(1, ai.overall - 2),
        technical_score: Math.max(1, ai.overall - 1),
        reproducibility_score: ai.repro,
      },
      rationale: `Seeded AI consensus run for demo winners. Overall ${ai.overall}/100, presentation ${ai.presentation}/100.`,
      costEstimate: 0,
      tokenEstimate: 2400,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Judges, assignments, and scorecards for judging shortcut demos.
  for (let judgeIndex = 0; judgeIndex < MEDIA_JUDGES.length; judgeIndex++) {
    const judge = MEDIA_JUDGES[judgeIndex];
    await db.insert(judges).values({
      id: judge.id,
      token: `judge_${nanoid(32)}`,
      name: judge.name,
      email: judge.email,
      createdAt: new Date(),
    });

    for (let submissionIndex = 0; submissionIndex < MEDIA_SUBMISSIONS.length; submissionIndex++) {
      const sub = MEDIA_SUBMISSIONS[submissionIndex];
      await db.insert(judgeAssignments).values({
        id: `assign_${judge.id}_${sub.id}`,
        judgeId: judge.id,
        submissionId: sub.id,
        createdAt: new Date(),
      });

      if (PENDING_REVIEWS.has(`${judge.id}:${sub.id}`)) continue;

      const scores = rubricScores(sub.id, judgeIndex, submissionIndex);
      const values = Object.values(scores);
      const avg = values.reduce((sum, score) => sum + score, 0) / values.length;

      await db.insert(humanScores).values({
        id: `score_${judge.id}_${sub.id}`,
        submissionId: sub.id,
        judgeId: judge.id,
        ...scores,
        privateNotes: `${judge.name} demo review for ${sub.projectTitle}. Seeded for keyboard shortcut testing.`,
        recommendation: recommendationFor(avg),
        completed: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  console.log(`Media seed complete: ${MEDIA_SUBMISSIONS.length} projects, ${MEDIA_JUDGES.length} judges, published demo winners.`);
  console.log("");
  console.log("Scenario coverage:");
  console.log("  A  sub_media_a — 5 screenshots + YouTube  (https://www.youtube.com/watch?v=dQw4w9WgXcQ)");
  console.log("  B  sub_media_b — 5 screenshots + Loom     (https://www.loom.com/share/6d3c2738f064438182a72818e571cecd)");
  console.log("  C  sub_media_c — 5 screenshots + Vimeo    (https://vimeo.com/76979871)");
  console.log("  D  sub_media_d — 5 screenshots + unsupported video (Dropbox fallback link)");
  console.log("  E  sub_media_e — screenshotUrl only, no screenshotUrls[], no video (legacy compat)");
  console.log("");
  console.log("Validate at:");
  console.log("  /projects");
  console.log("  /project/sub_media_a  through  /project/sub_media_e");
  console.log("  /winners");
  console.log("");
  console.log("Judge credentials were generated randomly and were not logged.");
  console.log("Use the documented private credential-rotation workflow before judge testing.");
}

if (
  process.argv[1]?.endsWith("seed-media.ts") ||
  process.argv[1]?.endsWith("/seed-media")
) {
  seedMedia().catch(console.error);
}
