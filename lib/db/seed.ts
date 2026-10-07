import { db } from "./index";
import {
  submissions,
  teamMembers,
  judges,
  judgeAssignments,
  humanScores,
  aiReviews,
  audienceVotes,
  submissionOwners,
  teamOwners,
  teams,
  events,
  reproductionRuns,
} from "./schema";
import { MOCK_SUBMISSIONS, MOCK_JUDGES, MOCK_HUMAN_SCORES, MOCK_AI_REVIEWS } from "../mock-data";
import { nanoid } from "nanoid";

export async function seed() {
  console.log("Seeding database...");

  // Clear all tables (order matters for FK constraints)
  await db.delete(audienceVotes);
  await db.delete(reproductionRuns);
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

  const eventId = "evt_vibe_2025";
  await db.insert(events).values({
    id: eventId,
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
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Insert submissions
  for (const sub of MOCK_SUBMISSIONS) {
    await db.insert(submissions).values({
      id: sub.id,
      eventId,
      editToken: sub.editToken,
      status: sub.status,
      teamName: sub.teamName,
      contactEmail: sub.contactEmail,
      projectTitle: sub.projectTitle,
      problemStatement: sub.problemStatement,
      targetUsers: sub.targetUsers,
      demoUrl: sub.demoUrl,
      githubUrl: sub.githubUrl,
      screenshotUrl: sub.screenshotUrl,
      readmeUrl: sub.readmeUrl,
      agentsMdUrl: sub.agentsMdUrl,
      promptStrategyUrl: sub.promptStrategyUrl,
      sampleDataDescription: sub.sampleDataDescription,
      setupInstructions: sub.setupInstructions,
      deployInstructions: sub.deployInstructions,
      knownLimitations: sub.knownLimitations,
      aiToolsUsed: sub.aiToolsUsed,
      tags: sub.tags,
      createdAt: new Date(sub.createdAt),
      submittedAt: sub.submittedAt ? new Date(sub.submittedAt) : null,
    });

    // Insert team members
    for (let i = 0; i < sub.members.length; i++) {
      await db.insert(teamMembers).values({
        id: nanoid(),
        submissionId: sub.id,
        name: sub.members[i].name,
        role: sub.members[i].role,
        order: i,
      });
    }

    // Insert audience votes (one row per vote)
    for (let i = 0; i < sub.audienceVotes; i++) {
      await db.insert(audienceVotes).values({
        id: nanoid(),
        submissionId: sub.id,
        sessionFingerprint: `seed_${sub.id}_${i}`,
        createdAt: new Date(sub.createdAt),
      });
    }
  }

  // Insert judges
  for (const judge of MOCK_JUDGES) {
    await db.insert(judges).values({
      id: judge.id,
      token: `judge_${nanoid(32)}`,
      name: judge.name,
      email: judge.email,
      createdAt: new Date(),
    });

    for (const submissionId of judge.assignedSubmissionIds) {
      await db.insert(judgeAssignments).values({
        id: nanoid(),
        judgeId: judge.id,
        submissionId,
        createdAt: new Date(),
      });
    }
  }

  // Insert human scores
  for (const score of MOCK_HUMAN_SCORES) {
    await db.insert(humanScores).values({
      id: nanoid(),
      submissionId: score.submissionId,
      judgeId: score.judgeId,
      problemSelection: score.problemSelection,
      productUsefulness: score.productUsefulness,
      functionality: score.functionality,
      uxDesign: score.uxDesign,
      aiCollaboration: score.aiCollaboration,
      originality: score.originality,
      maintainability: score.maintainability,
      presentationClarity: score.presentationClarity,
      privateNotes: score.privateNotes,
      recommendation: score.recommendation,
      completed: score.completed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Insert AI reviews
  for (const review of MOCK_AI_REVIEWS) {
    await db.insert(aiReviews).values({
      id: nanoid(),
      submissionId: review.submissionId,
      complianceCheck: review.complianceCheck,
      repoReview: review.repoReview,
      demoValidation: review.demoValidation,
      screenshotValidation: review.screenshotValidation,
      agentsMdEvaluation: review.agentsMdEvaluation,
      promptStrategyEvaluation: review.promptStrategyEvaluation,
      reliabilityNotes: review.reliabilityNotes,
      generatedScore: review.generatedScore,
      generatedRationale: review.generatedRationale,
      suggestedQuestions: review.suggestedQuestions,
      status: review.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  console.log("Seed complete.");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("/seed")) {
  seed().catch(console.error);
}
