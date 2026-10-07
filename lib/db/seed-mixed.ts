/**
 * seed-mixed — wipes DB and seeds with both the original 8 mock entries
 * AND the 10 radiology simulation games (18 total).
 * Run via: npm run db:seed:mixed
 */
import { db } from "./index";
import { MOCK_SUBMISSIONS, MOCK_JUDGES, MOCK_HUMAN_SCORES, MOCK_AI_REVIEWS } from "../mock-data";
import { nanoid } from "nanoid";
import {
  submissions, teamMembers, judges, judgeAssignments,
  humanScores, aiReviews, audienceVotes,
} from "./schema";
import {
  wipeTables,
  seedEvent,
  seedSimSubmissions,
  seedSimJudges,
} from "./seed-sim";

async function seedMockData() {
  const eventId = "evt_vibe_2025";

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

    for (let i = 0; i < sub.members.length; i++) {
      await db.insert(teamMembers).values({
        id: nanoid(),
        submissionId: sub.id,
        name: sub.members[i].name,
        role: sub.members[i].role,
        order: i,
      });
    }

    for (let i = 0; i < sub.audienceVotes; i++) {
      await db.insert(audienceVotes).values({
        id: nanoid(),
        submissionId: sub.id,
        sessionFingerprint: `seed_${sub.id}_${i}`,
        createdAt: new Date(sub.createdAt),
      });
    }
  }

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
        id: nanoid(), judgeId: judge.id, submissionId, createdAt: new Date(),
      });
    }
  }

  for (const score of MOCK_HUMAN_SCORES) {
    await db.insert(humanScores).values({
      id: nanoid(),
      submissionId: score.submissionId, judgeId: score.judgeId,
      problemSelection: score.problemSelection, productUsefulness: score.productUsefulness,
      functionality: score.functionality, uxDesign: score.uxDesign,
      aiCollaboration: score.aiCollaboration, originality: score.originality,
      maintainability: score.maintainability, presentationClarity: score.presentationClarity,
      privateNotes: score.privateNotes, recommendation: score.recommendation,
      completed: score.completed, createdAt: new Date(), updatedAt: new Date(),
    });
  }

  for (const review of MOCK_AI_REVIEWS) {
    await db.insert(aiReviews).values({
      id: nanoid(), submissionId: review.submissionId,
      complianceCheck: review.complianceCheck, repoReview: review.repoReview,
      demoValidation: review.demoValidation, screenshotValidation: review.screenshotValidation,
      agentsMdEvaluation: review.agentsMdEvaluation,
      promptStrategyEvaluation: review.promptStrategyEvaluation,
      reliabilityNotes: review.reliabilityNotes, generatedScore: review.generatedScore,
      generatedRationale: review.generatedRationale, suggestedQuestions: review.suggestedQuestions,
      status: review.status, createdAt: new Date(), updatedAt: new Date(),
    });
  }
}

export async function seed() {
  console.log("Seeding database with mixed data (8 mock + 10 simulation = 18 total)...");
  await wipeTables();
  await seedEvent();
  await seedMockData();
  await seedSimSubmissions();
  await seedSimJudges();
  console.log("Done — 18 submissions, 5 judges total.");
}

if (process.argv[1]?.includes("seed-mixed")) {
  seed().catch(console.error);
}
