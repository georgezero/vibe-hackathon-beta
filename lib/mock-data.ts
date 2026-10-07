export type SubmissionStatus = "draft" | "submitted" | "finalized" | "locked";

export interface TeamMember {
  name: string;
  role: string;
}

export interface Submission {
  id: string;
  editToken: string;
  status: SubmissionStatus;
  teamName: string;
  contactEmail: string;
  members: TeamMember[];
  projectTitle: string;
  problemStatement: string;
  targetUsers: string;
  demoUrl: string;
  githubUrl: string;
  screenshotUrl: string;
  readmeUrl: string;
  agentsMdUrl: string;
  sampleDataDescription: string;
  setupInstructions: string;
  deployInstructions: string;
  aiToolsUsed: string[];
  promptStrategyUrl: string;
  knownLimitations: string;
  audienceVotes: number;
  createdAt: string;
  submittedAt: string | null;
  tags: string[];
}

export interface HumanScore {
  submissionId: string;
  judgeId: string;
  problemSelection: number;
  productUsefulness: number;
  functionality: number;
  uxDesign: number;
  aiCollaboration: number;
  originality: number;
  maintainability: number;
  presentationClarity: number;
  privateNotes: string;
  recommendation: "strong-yes" | "yes" | "maybe" | "no";
  completed: boolean;
}

export interface AiReview {
  submissionId: string;
  complianceCheck: "pass" | "partial" | "fail" | "pending";
  repoReview: string;
  demoValidation: "live" | "down" | "pending";
  screenshotValidation: "valid" | "invalid" | "pending";
  agentsMdEvaluation: string;
  promptStrategyEvaluation: string;
  reliabilityNotes: string;
  generatedScore: number | null;
  generatedRationale: string;
  suggestedQuestions: string[];
  status: "pending" | "running" | "complete";
}

export interface Judge {
  id: string;
  name: string;
  email: string;
  assignedSubmissionIds: string[];
}

export const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: "sub_01",
    editToken: "edit_abc123",
    status: "finalized",
    teamName: "PromptCraft Collective",
    contactEmail: "team@promptcraft.dev",
    members: [
      { name: "Aria Chen", role: "Lead developer" },
      { name: "Marcus Webb", role: "Product + prompting" },
    ],
    projectTitle: "Agentix — AI Code Review Agent",
    problemStatement:
      "Code review is slow and inconsistent. Most reviewers miss the same categories of bugs repeatedly. We built an AI agent that reviews PRs across five dimensions — security, performance, correctness, readability, and test coverage — and generates a structured report with inline suggestions.",
    targetUsers: "Engineering teams at fast-moving startups and solo developers who want consistent, high-quality code review without a senior reviewer bottleneck.",
    demoUrl: "https://agentix-demo.vercel.app",
    githubUrl: "https://github.com/promptcraft/agentix",
    screenshotUrl: "https://picsum.photos/seed/agentix/800/500",
    readmeUrl: "https://github.com/promptcraft/agentix/blob/main/README.md",
    agentsMdUrl: "https://github.com/promptcraft/agentix/blob/main/AGENTS.md",
    sampleDataDescription: "20 fake PRs across 3 repos with seeded review data covering all severity levels.",
    setupInstructions: "Clone, run `npm install`, copy `.env.example`, run `npm run dev`.",
    deployInstructions: "Deploy to Vercel with one click. Set `OPENAI_API_KEY` and `GITHUB_TOKEN` env vars.",
    aiToolsUsed: ["Claude", "Cursor", "GitHub Copilot"],
    promptStrategyUrl: "https://github.com/promptcraft/agentix/blob/main/docs/prompts.md",
    knownLimitations: "Only supports JavaScript/TypeScript. No support for large diffs (>500 lines). Rate-limited at 10 reviews/hour on free tier.",
    audienceVotes: 47,
    createdAt: "2025-11-10T09:00:00Z",
    submittedAt: "2025-11-14T22:30:00Z",
    tags: ["developer tools", "code review", "automation"],
  },
  {
    id: "sub_02",
    editToken: "edit_def456",
    status: "finalized",
    teamName: "Meridian Labs",
    contactEmail: "hello@meridianlabs.io",
    members: [
      { name: "Sophie Park", role: "Full-stack + AI" },
      { name: "James Okafor", role: "UX + strategy" },
      { name: "Lena Müller", role: "Backend + infra" },
    ],
    projectTitle: "Flowstate — Async Standup Intelligence",
    problemStatement:
      "Synchronous standups interrupt deep work. We built an async standup tool where team members submit brief voice or text updates, and an AI agent synthesizes them into a structured team briefing, highlights blockers, and suggests cross-team dependencies.",
    targetUsers: "Remote-first engineering teams who want standup intelligence without the meeting tax.",
    demoUrl: "https://flowstate.app",
    githubUrl: "https://github.com/meridian/flowstate",
    screenshotUrl: "https://picsum.photos/seed/flowstate/800/500",
    readmeUrl: "https://github.com/meridian/flowstate/blob/main/README.md",
    agentsMdUrl: "https://github.com/meridian/flowstate/blob/main/AGENTS.md",
    sampleDataDescription: "Seeded with 14 days of fake standup history for a fictional 8-person team.",
    setupInstructions: "Docker compose up. See README for env vars.",
    deployInstructions: "Railway deploy button in README. One env var: `ANTHROPIC_API_KEY`.",
    aiToolsUsed: ["Claude", "Whisper", "Cursor"],
    promptStrategyUrl: "https://github.com/meridian/flowstate/blob/main/docs/prompts.md",
    knownLimitations: "Voice transcription accuracy degrades with heavy accents. No calendar integration yet.",
    audienceVotes: 63,
    createdAt: "2025-11-09T14:00:00Z",
    submittedAt: "2025-11-14T20:15:00Z",
    tags: ["team tools", "async", "communication"],
  },
  {
    id: "sub_03",
    editToken: "edit_ghi789",
    status: "finalized",
    teamName: "Quantum Drafts",
    contactEmail: "contact@quantumdrafts.com",
    members: [
      { name: "Yuki Tanaka", role: "AI engineer" },
      { name: "Ravi Sharma", role: "Full-stack" },
    ],
    projectTitle: "DocuMind — Document Intelligence Engine",
    problemStatement:
      "Knowledge workers spend 30% of their time searching for information across documents. DocuMind indexes your documents and lets you ask complex questions that require synthesizing information from multiple sources — with citations.",
    targetUsers: "Researchers, analysts, legal teams, and knowledge workers dealing with large document repositories.",
    demoUrl: "https://documind.app/demo",
    githubUrl: "https://github.com/qdrafts/documind",
    screenshotUrl: "https://picsum.photos/seed/documind/800/500",
    readmeUrl: "https://github.com/qdrafts/documind/blob/main/README.md",
    agentsMdUrl: "https://github.com/qdrafts/documind/blob/main/AGENTS.md",
    sampleDataDescription: "50 fake research papers on climate policy with seeded Q&A pairs.",
    setupInstructions: "Python venv + npm install. See AGENTS.md for full setup.",
    deployInstructions: "Fly.io config included. `fly deploy` with env vars set.",
    aiToolsUsed: ["Claude", "OpenAI Embeddings", "Cursor", "Codex"],
    promptStrategyUrl: "https://github.com/qdrafts/documind/blob/main/docs/prompts.md",
    knownLimitations: "Max 500 documents per workspace. PDF parsing sometimes loses table formatting.",
    audienceVotes: 38,
    createdAt: "2025-11-11T10:00:00Z",
    submittedAt: "2025-11-14T18:00:00Z",
    tags: ["knowledge management", "RAG", "search"],
  },
  {
    id: "sub_04",
    editToken: "edit_jkl012",
    status: "finalized",
    teamName: "NightOwl Studio",
    contactEmail: "team@nightowl.studio",
    members: [
      { name: "Felix Adler", role: "Product + code" },
    ],
    projectTitle: "Schedulr — Intelligent Meeting Optimizer",
    problemStatement:
      "Calendar fragmentation costs knowledge workers 2+ hours per week in scheduling overhead. Schedulr analyzes your calendar patterns, meeting history, and preferences to auto-suggest optimal meeting times, identify scheduling conflicts before they happen, and draft decline/reschedule messages.",
    targetUsers: "Solo founders, managers, and anyone with a fragmented calendar and back-to-back meetings.",
    demoUrl: "https://schedulr.io",
    githubUrl: "https://github.com/nightowl/schedulr",
    screenshotUrl: "https://picsum.photos/seed/schedulr/800/500",
    readmeUrl: "https://github.com/nightowl/schedulr/blob/main/README.md",
    agentsMdUrl: "https://github.com/nightowl/schedulr/blob/main/AGENTS.md",
    sampleDataDescription: "Mock Google Calendar data for 3 personas with different scheduling styles.",
    setupInstructions: "npm install && npm run dev. Google OAuth required for real calendar.",
    deployInstructions: "Vercel. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ANTHROPIC_API_KEY.",
    aiToolsUsed: ["Claude", "Cursor"],
    promptStrategyUrl: "https://github.com/nightowl/schedulr/blob/main/docs/prompts.md",
    knownLimitations: "Only Google Calendar. No time zone auto-detection for multi-TZ teams.",
    audienceVotes: 29,
    createdAt: "2025-11-12T08:00:00Z",
    submittedAt: "2025-11-14T16:45:00Z",
    tags: ["productivity", "calendar", "scheduling"],
  },
  {
    id: "sub_05",
    editToken: "edit_mno345",
    status: "finalized",
    teamName: "DeepStack",
    contactEmail: "build@deepstack.dev",
    members: [
      { name: "Ana Costa", role: "Backend + prompting" },
      { name: "Tom Eriksen", role: "Frontend + UX" },
    ],
    projectTitle: "Debugify — AI Bug Detection & Fix Agent",
    problemStatement:
      "Debugging is the most time-consuming part of development. Debugify hooks into your error tracking (Sentry, Datadog) and for each new error, spawns an AI agent that reads the stack trace, locates the relevant code, generates a hypothesis, proposes a fix, and opens a draft PR.",
    targetUsers: "Development teams that use error monitoring and want to close the loop from error → fix faster.",
    demoUrl: "https://debugify.dev",
    githubUrl: "https://github.com/deepstack/debugify",
    screenshotUrl: "https://picsum.photos/seed/debugify/800/500",
    readmeUrl: "https://github.com/deepstack/debugify/blob/main/README.md",
    agentsMdUrl: "https://github.com/deepstack/debugify/blob/main/AGENTS.md",
    sampleDataDescription: "Seeded Sentry project with 15 fake errors across 3 categories.",
    setupInstructions: "Docker compose. Set SENTRY_DSN, GITHUB_TOKEN, ANTHROPIC_API_KEY.",
    deployInstructions: "Railway template included. Click deploy in README.",
    aiToolsUsed: ["Claude", "GitHub Copilot", "Cursor", "Hermes"],
    promptStrategyUrl: "https://github.com/deepstack/debugify/blob/main/docs/prompts.md",
    knownLimitations: "Fix quality varies with code complexity. Doesn't handle monorepos well yet.",
    audienceVotes: 52,
    createdAt: "2025-11-08T11:00:00Z",
    submittedAt: "2025-11-14T23:50:00Z",
    tags: ["developer tools", "debugging", "automation"],
  },
  {
    id: "sub_06",
    editToken: "edit_pqr678",
    status: "submitted",
    teamName: "Vortex Team",
    contactEmail: "hello@vortexteam.co",
    members: [
      { name: "Isla Fleming", role: "AI + content strategy" },
      { name: "Dario Marchetti", role: "Full-stack" },
    ],
    projectTitle: "Contentsmith — AI Content Strategy Engine",
    problemStatement:
      "Content marketing teams waste cycles on planning and ideation. Contentsmith analyzes your product, audience, and competitors to generate a full 90-day content strategy — complete with post outlines, distribution plans, and a feedback loop to refine based on engagement.",
    targetUsers: "Marketing teams, content leads, and solo founders doing content-led growth.",
    demoUrl: "https://contentsmith.io",
    githubUrl: "https://github.com/vortex/contentsmith",
    screenshotUrl: "https://picsum.photos/seed/contentsmith/800/500",
    readmeUrl: "https://github.com/vortex/contentsmith/blob/main/README.md",
    agentsMdUrl: "https://github.com/vortex/contentsmith/blob/main/AGENTS.md",
    sampleDataDescription: "Sample content strategy for a fictional B2B SaaS company.",
    setupInstructions: "npm install && npm run dev. Copy .env.example.",
    deployInstructions: "Vercel one-click. Set ANTHROPIC_API_KEY and POSTGRES_URL.",
    aiToolsUsed: ["Claude", "Pi", "Cursor"],
    promptStrategyUrl: "https://github.com/vortex/contentsmith/blob/main/docs/prompts.md",
    knownLimitations: "Output quality depends heavily on how well you describe your product and audience.",
    audienceVotes: 18,
    createdAt: "2025-11-13T15:00:00Z",
    submittedAt: "2025-11-14T21:00:00Z",
    tags: ["marketing", "content", "strategy"],
  },
  {
    id: "sub_07",
    editToken: "edit_stu901",
    status: "finalized",
    teamName: "Axiom Builders",
    contactEmail: "team@axiombuilders.io",
    members: [
      { name: "Nadia Volkov", role: "Data + backend" },
      { name: "Chris Huang", role: "Frontend + UX" },
      { name: "Sam O'Brien", role: "AI integration" },
    ],
    projectTitle: "DataPulse — Real-time Data Observatory",
    problemStatement:
      "Data teams are flooded with dashboards but starved for insight. DataPulse connects to your data warehouse, automatically detects anomalies and trends, and sends AI-written natural language summaries to your team — replacing noisy alerts with contextual insight.",
    targetUsers: "Data analysts, product managers, and ops teams who need to stay on top of key metrics without living in dashboards.",
    demoUrl: "https://datapulse.io/demo",
    githubUrl: "https://github.com/axiom/datapulse",
    screenshotUrl: "https://picsum.photos/seed/datapulse/800/500",
    readmeUrl: "https://github.com/axiom/datapulse/blob/main/README.md",
    agentsMdUrl: "https://github.com/axiom/datapulse/blob/main/AGENTS.md",
    sampleDataDescription: "E-commerce dataset with 6 months of fake orders, users, and events.",
    setupInstructions: "Docker compose up. See AGENTS.md.",
    deployInstructions: "Fly.io. `fly deploy` with `DATABASE_URL` and `ANTHROPIC_API_KEY`.",
    aiToolsUsed: ["Claude", "Codex", "OpenClaw"],
    promptStrategyUrl: "https://github.com/axiom/datapulse/blob/main/docs/prompts.md",
    knownLimitations: "Currently only supports PostgreSQL and BigQuery. Slack integration is hard-coded.",
    audienceVotes: 41,
    createdAt: "2025-11-10T13:00:00Z",
    submittedAt: "2025-11-14T17:30:00Z",
    tags: ["data", "analytics", "monitoring"],
  },
  {
    id: "sub_08",
    editToken: "edit_vwx234",
    status: "draft",
    teamName: "Circuit Co",
    contactEmail: "build@circuit.co",
    members: [
      { name: "Elena Vasquez", role: "Educator + product" },
      { name: "Kai Nguyen", role: "Full-stack" },
    ],
    projectTitle: "Learnloop — Adaptive Learning Platform",
    problemStatement:
      "One-size-fits-all courses fail learners because the pacing, depth, and examples don't adapt to the individual. Learnloop uses an AI tutor that dynamically adjusts curriculum, generates personalized exercises, and gives detailed feedback — so every learner follows their own optimal path.",
    targetUsers: "Self-directed learners, bootcamp students, and corporate L&D teams.",
    demoUrl: "https://learnloop.app",
    githubUrl: "https://github.com/circuitco/learnloop",
    screenshotUrl: "https://picsum.photos/seed/learnloop/800/500",
    readmeUrl: "https://github.com/circuitco/learnloop/blob/main/README.md",
    agentsMdUrl: "https://github.com/circuitco/learnloop/blob/main/AGENTS.md",
    sampleDataDescription: "3 sample courses: Python basics, Prompt engineering, SQL. Seeded student progress.",
    setupInstructions: "npm install && npm run dev. See .env.example.",
    deployInstructions: "Vercel + PlanetScale. See README.",
    aiToolsUsed: ["Claude", "Cursor"],
    promptStrategyUrl: "https://github.com/circuitco/learnloop/blob/main/docs/prompts.md",
    knownLimitations: "Currently text-only. No video or interactive coding exercises yet.",
    audienceVotes: 0,
    createdAt: "2025-11-14T10:00:00Z",
    submittedAt: null,
    tags: ["education", "adaptive learning", "AI tutor"],
  },
];

export const MOCK_JUDGES: Judge[] = [
  {
    id: "judge_01",
    name: "Dr. Priya Raghavan",
    email: "praghavan@techfellows.org",
    assignedSubmissionIds: ["sub_01", "sub_02", "sub_03", "sub_05"],
  },
  {
    id: "judge_02",
    name: "Marcus Lee",
    email: "mlee@vcfirm.com",
    assignedSubmissionIds: ["sub_04", "sub_06", "sub_07"],
  },
];

export const MOCK_HUMAN_SCORES: HumanScore[] = [
  {
    submissionId: "sub_01",
    judgeId: "judge_01",
    problemSelection: 9,
    productUsefulness: 8,
    functionality: 9,
    uxDesign: 7,
    aiCollaboration: 10,
    originality: 8,
    maintainability: 9,
    presentationClarity: 8,
    privateNotes: "Impressive prompt chaining strategy. The rubric decomposition into 5 dimensions is well-thought-out. Ask about CI integration.",
    recommendation: "strong-yes",
    completed: true,
  },
  {
    submissionId: "sub_02",
    judgeId: "judge_01",
    problemSelection: 8,
    productUsefulness: 9,
    functionality: 8,
    uxDesign: 9,
    aiCollaboration: 7,
    originality: 7,
    maintainability: 8,
    presentationClarity: 9,
    privateNotes: "Great UX. The synthesis quality varies by standup quality though.",
    recommendation: "yes",
    completed: true,
  },
];

export const MOCK_AI_REVIEWS: AiReview[] = [
  {
    submissionId: "sub_01",
    complianceCheck: "pass",
    repoReview: "README is comprehensive. AGENTS.md covers setup, seed, test, and deploy steps. Architecture doc present. Prompts documented. Code is well-structured with clear separation of concerns. TypeScript throughout. ESLint configured.",
    demoValidation: "live",
    screenshotValidation: "valid",
    agentsMdEvaluation: "Strong AGENTS.md. Covers 8/8 required sections. Setup instructions tested and working. Seed data realistic.",
    promptStrategyEvaluation: "Prompt strategy document shows thoughtful decomposition. Uses chain-of-thought prompting with structured output. Prompt versioning tracked in git.",
    reliabilityNotes: "Demo URL consistently returns 200. Average response time 2.1s. No errors observed over 10 test requests.",
    generatedScore: 88,
    generatedRationale: "High-quality submission with strong prompt strategy, reliable demo, and excellent repo documentation. Loses points on UX polish and the TypeScript-only limitation.",
    suggestedQuestions: [
      "How would you handle very large diffs (5000+ lines)?",
      "Walk us through your prompt iteration process — how many versions did you go through?",
      "What's your plan for supporting Python repos?",
    ],
    status: "complete",
  },
  {
    submissionId: "sub_02",
    complianceCheck: "pass",
    repoReview: "All required files present. Docker compose works. Missing architecture.md — only has a brief system overview in README.",
    demoValidation: "live",
    screenshotValidation: "valid",
    agentsMdEvaluation: "Good AGENTS.md. Covers 6/8 sections. Missing: debug common issues section and deployment troubleshooting.",
    promptStrategyEvaluation: "Prompt strategy shows synthesis pipeline with fallback handling. Could be more detailed on how edge cases (empty updates, very long updates) are handled.",
    reliabilityNotes: "Demo stable. Voice upload occasionally slow (5–8s). Text path very fast.",
    generatedScore: 82,
    generatedRationale: "Strong product concept and execution. Minor documentation gaps. UX is polished. Voice path is the differentiator but also the reliability risk.",
    suggestedQuestions: [
      "How does the synthesis prompt handle conflicting updates from team members?",
      "What was your biggest technical challenge?",
    ],
    status: "complete",
  },
  {
    submissionId: "sub_05",
    complianceCheck: "partial",
    repoReview: "README present and good. AGENTS.md present. Missing .env.example — only .env.sample. Architecture doc is thin.",
    demoValidation: "live",
    screenshotValidation: "valid",
    agentsMdEvaluation: "AGENTS.md covers setup and run but is weak on debugging and deployment.",
    promptStrategyEvaluation: "Prompt strategy is innovative — using error taxonomy to route to different fix generation prompts. Would benefit from more documentation.",
    reliabilityNotes: "Demo URL live. PR generation takes 15–30s. One timeout observed.",
    generatedScore: 79,
    generatedRationale: "Ambitious project with a clever approach. Execution is solid but documentation needs work. High potential.",
    suggestedQuestions: [
      "How do you handle false positive bug detections?",
      "What percentage of generated fixes pass tests without modification?",
    ],
    status: "complete",
  },
];

export const EVENT_INFO = {
  name: "Vibe Hackathon",
  edition: "2025",
  tagline: "Vibe coding competition for agentic devs",
  submissionDeadline: "2025-11-14T23:59:59Z",
  judgingDeadline: "2025-11-17T23:59:59Z",
  resultsDate: "2025-11-20",
  totalPrize: "$10,000",
  status: "judging" as "open" | "judging" | "closed",
};

export function getSubmissionById(id: string) {
  return MOCK_SUBMISSIONS.find((s) => s.id === id);
}

export function getSubmissionByToken(token: string) {
  return MOCK_SUBMISSIONS.find((s) => s.editToken === token);
}

export function getAssignedSubmissions(judgeId: string) {
  const judge = MOCK_JUDGES.find((j) => j.id === judgeId);
  if (!judge) return [];
  return MOCK_SUBMISSIONS.filter((s) => judge.assignedSubmissionIds.includes(s.id));
}

export function getHumanScore(submissionId: string, judgeId: string) {
  return MOCK_HUMAN_SCORES.find(
    (s) => s.submissionId === submissionId && s.judgeId === judgeId
  );
}

export function getAiReview(submissionId: string) {
  return MOCK_AI_REVIEWS.find((r) => r.submissionId === submissionId);
}

export function getPublicSubmissions() {
  return MOCK_SUBMISSIONS.filter((s) => s.status === "finalized" || s.status === "submitted")
    .sort((a, b) => b.audienceVotes - a.audienceVotes);
}

export function calcHumanAvgScore(score: HumanScore): number {
  const fields = [
    score.problemSelection,
    score.productUsefulness,
    score.functionality,
    score.uxDesign,
    score.aiCollaboration,
    score.originality,
    score.maintainability,
    score.presentationClarity,
  ];
  return Math.round((fields.reduce((a, b) => a + b, 0) / fields.length) * 10) / 10;
}
