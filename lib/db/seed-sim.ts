/**
 * seed-sim — wipes DB and seeds with the 10 Vibe Hackathon Alpha radiology games.
 * Run via: npm run db:seed:sim
 */
import { db } from "./index";
import {
  submissions, teamMembers, judges, judgeAssignments,
  humanScores, aiReviews, audienceVotes, submissionOwners, teamOwners, teams,
  events, reproductionRuns,
} from "./schema";
import { nanoid } from "nanoid";

// ── Static data (mirrors what create_repos.py submitted) ──────────────────────

const EVENT_ID = "evt_vibe_2025";

const SIM_SUBMISSIONS = [
  {
    id: "sub_ioo19yZO", editToken: "edit__M2xPDwWfuAEkkHw",
    slug: "dicom-dodger", teamName: "DICOM Dodgers", contactEmail: "team@dicomdodgers.dev",
    projectTitle: "DICOM Dodgers — Dicom Dodger",
    problemStatement: "Dodge incoming DICOM parsing errors before they crash your radiologist workflow. A fast-paced arcade shooter built with HTML5 Canvas.",
    targetUsers: "radiologists, PACS admins, medical imaging developers",
    demoUrl: "https://georgezero.github.io/vibe-hackathon-alpha-team-01-dicom-dodger",
    githubUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-01-dicom-dodger",
    screenshotUrl: "https://picsum.photos/seed/dicomdodger/800/500",
    readmeUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-01-dicom-dodger/blob/main/README.md",
    agentsMdUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-01-dicom-dodger/blob/main/AGENTS.md",
    promptStrategyUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-01-dicom-dodger/blob/main/docs/prompts.md",
    sampleDataDescription: "See sample-data/game-states.json for example state snapshots. No real patient data.",
    setupInstructions: "npm install", deployInstructions: "npm run build → deploy dist/",
    knownLimitations: "Mobile touch controls not implemented. Only tested in Chrome and Firefox.",
    tags: ["game", "DICOM", "arcade", "medical imaging"],
    license: "MIT", agentHarnesses: ["Claude Code"], agentModels: ["claude-opus-4-5"],
    budgetTier: "api_10_to_50", estimatedHumanHours: 8, estimatedAgentHours: 32,
    members: [
      { name: "Noah Stein", email: "noah.stein@harvard.edu", badgeNumber: "SIM-0101", role: "Team Lead / Developer", affiliation: "Harvard Medical School", degrees: "MD", isStudentTrainee: false },
      { name: "Amara Okonkwo", email: "amara.okonkwo@uct.ac.za", badgeNumber: "SIM-0102", role: "Clinical Strategy", affiliation: "University of Cape Town", degrees: "MBChB", isStudentTrainee: true },
      { name: "Luca Bianchi", email: "luca.bianchi@unimi.it", badgeNumber: "SIM-0103", role: "Gameplay Design", affiliation: "University of Zurich", degrees: "MS", isStudentTrainee: true },
      { name: "Mei Lin", email: "mei.lin@nus.edu.sg", badgeNumber: "SIM-0104", role: "QA + Prompting", affiliation: "Nanyang Technological University", degrees: "BS", isStudentTrainee: true },
    ],
    audienceVotes: 16,
  },
  {
    id: "sub_WbEWvzjB", editToken: "edit_BbOfecrBY9IOxHRe",
    slug: "annotation-racer", teamName: "Annotation Racers", contactEmail: "hello@annotationracer.io",
    projectTitle: "Annotation Racers — Annotation Racer",
    problemStatement: "Race against the clock to annotate medical image regions before time expires. Trains radiologist annotation speed and pattern recognition using gamified AI-generated cases.",
    targetUsers: "radiology residents, annotation teams, medical AI trainers",
    demoUrl: "https://georgezero.github.io/vibe-hackathon-alpha-team-02-annotation-racer",
    githubUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-02-annotation-racer",
    screenshotUrl: "https://picsum.photos/seed/annotationracer/800/500",
    readmeUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-02-annotation-racer/blob/main/README.md",
    agentsMdUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-02-annotation-racer/blob/main/AGENTS.md",
    promptStrategyUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-02-annotation-racer/blob/main/docs/prompts.md",
    sampleDataDescription: "See sample-data/game-states.json. No real patient data.",
    setupInstructions: "npm install", deployInstructions: "npm run build → deploy dist/",
    knownLimitations: "Image library is seeded with synthetic data only. No real patient data.",
    tags: ["game", "annotation", "training", "radiology"],
    license: "MIT", agentHarnesses: ["Cursor", "Claude Code"], agentModels: ["claude-sonnet-4-5", "gpt-4o"],
    budgetTier: "multiple_paid_subscriptions", estimatedHumanHours: 12, estimatedAgentHours: 28,
    members: [
      { name: "Sofia Andersson", email: "sofia.andersson@ki.se", badgeNumber: "SIM-0201", role: "Team Lead / AI Workflow", affiliation: "Karolinska Institutet", degrees: "PhD", isStudentTrainee: false },
      { name: "Diego Morales", email: "diego.morales@usp.br", badgeNumber: "SIM-0202", role: "Annotation UX", affiliation: "Universidade de São Paulo", degrees: "MD", isStudentTrainee: false },
      { name: "Hannah Brooks", email: "hannah.brooks@stanford.edu", badgeNumber: "SIM-0203", role: "Frontend", affiliation: "UCSF", degrees: "MS", isStudentTrainee: true },
      { name: "Jae Min Kim", email: "jaemin.kim@snu.ac.kr", badgeNumber: "SIM-0204", role: "Radiology Resident Advisor", affiliation: "Samsung Medical Center", degrees: "MD", isStudentTrainee: true },
      { name: "Amina El-Sayed", email: "amina.elsayed@cairo.edu", badgeNumber: "SIM-0205", role: "Evaluation Design", affiliation: "Cairo University", degrees: "MSc", isStudentTrainee: true },
    ],
    audienceVotes: 14,
  },
  {
    id: "sub_LudobqUp", editToken: "edit_l7oMBCxRjgDYYu88",
    slug: "token-tetris", teamName: "Token Tetris Labs", contactEmail: "dev@tokenlabs.xyz",
    projectTitle: "Token Tetris Labs — Token Tetris",
    problemStatement: "Tetris where every piece represents an LLM token. Clear lines to compress your context window. Score multipliers for efficient packing — the ultimate metaphor for prompt engineering.",
    targetUsers: "AI developers, prompt engineers, LLM enthusiasts",
    demoUrl: "https://georgezero.github.io/vibe-hackathon-alpha-team-03-token-tetris",
    githubUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-03-token-tetris",
    screenshotUrl: "https://picsum.photos/seed/tokenteris/800/500",
    readmeUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-03-token-tetris/blob/main/README.md",
    agentsMdUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-03-token-tetris/blob/main/AGENTS.md",
    promptStrategyUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-03-token-tetris/blob/main/docs/prompts.md",
    sampleDataDescription: "See sample-data/game-states.json. No real patient data.",
    setupInstructions: "npm install", deployInstructions: "npm run build → deploy dist/",
    knownLimitations: "Token piece shapes are simplified. Does not reflect actual tokenizer behavior.",
    tags: ["game", "LLM", "tokens", "tetris", "prompt engineering"],
    license: "MIT", agentHarnesses: ["Aider"], agentModels: ["claude-opus-4-5"],
    budgetTier: "api_under_10", estimatedHumanHours: 6, estimatedAgentHours: 40,
    members: [
      { name: "Ethan Walker", email: "ethan.walker@imperial.ac.uk", badgeNumber: "SIM-0301", role: "Team Lead / Game Systems", affiliation: "Imperial College London", degrees: "PhD", isStudentTrainee: false },
      { name: "Nadia Rahman", email: "nadia.rahman@aiims.edu", badgeNumber: "SIM-0302", role: "Prompt Engineering", affiliation: "AIIMS New Delhi", degrees: "MD", isStudentTrainee: true },
      { name: "Kenji Sato", email: "kenji.sato@tokyo.ac.jp", badgeNumber: "SIM-0303", role: "LLM Mechanics", affiliation: "Kyoto University", degrees: "MS", isStudentTrainee: true },
    ],
    audienceVotes: 12,
  },
  {
    id: "sub_z1HvhH95", editToken: "edit_QwW-98eoZ941i4V4",
    slug: "mri-minesweeper", teamName: "MRI Miners", contactEmail: "team@mriminers.com",
    projectTitle: "MRI Miners — Mri Minesweeper",
    problemStatement: "Classic Minesweeper reimagined as a radiological scan. Mines are hidden lesions. Numbers are adjacent abnormalities. Flag suspicious regions and clear the scan without a false positive.",
    targetUsers: "radiology trainees, gamers interested in medical imaging",
    demoUrl: "https://georgezero.github.io/vibe-hackathon-alpha-team-04-mri-minesweeper",
    githubUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-04-mri-minesweeper",
    screenshotUrl: "https://picsum.photos/seed/mriminesweeper/800/500",
    readmeUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-04-mri-minesweeper/blob/main/README.md",
    agentsMdUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-04-mri-minesweeper/blob/main/AGENTS.md",
    promptStrategyUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-04-mri-minesweeper/blob/main/docs/prompts.md",
    sampleDataDescription: "See sample-data/game-states.json. No real patient data.",
    setupInstructions: "npm install", deployInstructions: "npm run build → deploy dist/",
    knownLimitations: "Grid size fixed at 16x12. No difficulty levels yet.",
    tags: ["game", "minesweeper", "MRI", "radiology", "puzzle"],
    license: "MIT", agentHarnesses: ["Cursor"], agentModels: ["claude-sonnet-4-5"],
    budgetTier: "standard_subscription", estimatedHumanHours: 16, estimatedAgentHours: 24,
    members: [
      { name: "Claire Moreau", email: "claire.moreau@sorbonne.fr", badgeNumber: "SIM-0401", role: "Team Lead / Clinical Content", affiliation: "Sorbonne Université", degrees: "MD", isStudentTrainee: false },
      { name: "Tomás Silva", email: "tomas.silva@einstein.br", badgeNumber: "SIM-0402", role: "Puzzle Design", affiliation: "Hospital Israelita Albert Einstein", degrees: "BS", isStudentTrainee: true },
      { name: "Emily Chen", email: "emily.chen@utoronto.ca", badgeNumber: "SIM-0403", role: "Frontend", affiliation: "University of British Columbia", degrees: "MS", isStudentTrainee: true },
      { name: "Peter Novak", email: "peter.novak@charite.de", badgeNumber: "SIM-0404", role: "Testing + Accessibility", affiliation: "University Hospital Heidelberg", degrees: "MD", isStudentTrainee: true },
    ],
    audienceVotes: 6,
  },
  {
    id: "sub_RrP7H4Id", editToken: "edit_GczWB2w2F7nvcCs3",
    slug: "dose-defender", teamName: "Dose Defenders", contactEmail: "contact@dosedefenders.io",
    projectTitle: "Dose Defenders — Dose Defender",
    problemStatement: "Tower defense where radiation particles advance on a patient. Place shielding towers to deflect dose. Each wave represents a treatment fraction — balance protection with therapeutic delivery.",
    targetUsers: "radiation oncology residents, medical physics students, tower defense fans",
    demoUrl: "https://georgezero.github.io/vibe-hackathon-alpha-team-05-dose-defender",
    githubUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-05-dose-defender",
    screenshotUrl: "https://picsum.photos/seed/dosedefender/800/500",
    readmeUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-05-dose-defender/blob/main/README.md",
    agentsMdUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-05-dose-defender/blob/main/AGENTS.md",
    promptStrategyUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-05-dose-defender/blob/main/docs/prompts.md",
    sampleDataDescription: "See sample-data/game-states.json. No real patient data.",
    setupInstructions: "npm install", deployInstructions: "npm run build → deploy dist/",
    knownLimitations: "Only 5 wave types implemented. Pathfinding is fixed-route, not dynamic.",
    tags: ["game", "radiation", "tower defense", "oncology"],
    license: "MIT", agentHarnesses: ["Claude Code", "Codex CLI"], agentModels: ["claude-opus-4-5", "claude-sonnet-4-5"],
    budgetTier: "api_50_to_200", estimatedHumanHours: 10, estimatedAgentHours: 60,
    members: [
      { name: "Grace Miller", email: "grace.miller@mayo.edu", badgeNumber: "SIM-0501", role: "Team Lead / Medical Physics", affiliation: "Mayo Clinic", degrees: "PhD", isStudentTrainee: false },
      { name: "Omar Haddad", email: "omar.haddad@aub.edu.lb", badgeNumber: "SIM-0502", role: "Dose Modeling", affiliation: "American University of Beirut", degrees: "MS", isStudentTrainee: true },
      { name: "Yara Cohen", email: "yara.cohen@sheba.health", badgeNumber: "SIM-0503", role: "Radiation Oncology Advisor", affiliation: "Sheba Medical Center", degrees: "MD", isStudentTrainee: false },
      { name: "Mia Thompson", email: "mia.thompson@melbourne.edu.au", badgeNumber: "SIM-0504", role: "Game Balance", affiliation: "Monash University", degrees: "BS", isStudentTrainee: true },
      { name: "Kwame Mensah", email: "kwame.mensah@wits.ac.za", badgeNumber: "SIM-0505", role: "Visualization", affiliation: "University of Oslo", degrees: "MSc", isStudentTrainee: true },
    ],
    audienceVotes: 10,
  },
  {
    id: "sub_9O1wczUD", editToken: "edit_NqAo63XuKn4i12X-",
    slug: "prompt-snake", teamName: "Prompt Snakers", contactEmail: "hello@promptsnake.dev",
    projectTitle: "Prompt Snakers — Prompt Snake",
    problemStatement: "Classic snake where food pieces are prompt fragments. Eat them in the right order to build a complete system prompt. Wrong order penalizes length. A meditation on prompt composition.",
    targetUsers: "AI engineers, prompt designers, snake game fans",
    demoUrl: "https://georgezero.github.io/vibe-hackathon-alpha-team-06-prompt-snake",
    githubUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-06-prompt-snake",
    screenshotUrl: "https://picsum.photos/seed/promptsnake/800/500",
    readmeUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-06-prompt-snake/blob/main/README.md",
    agentsMdUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-06-prompt-snake/blob/main/AGENTS.md",
    promptStrategyUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-06-prompt-snake/blob/main/docs/prompts.md",
    sampleDataDescription: "See sample-data/game-states.json. No real patient data.",
    setupInstructions: "npm install", deployInstructions: "npm run build → deploy dist/",
    knownLimitations: "Prompt fragment library is static (50 examples). No dynamic generation.",
    tags: ["game", "snake", "prompts", "LLM", "AI"],
    license: "MIT", agentHarnesses: ["Cursor"], agentModels: ["gpt-4o", "claude-sonnet-4-5"],
    budgetTier: "multiple_paid_subscriptions", estimatedHumanHours: 14, estimatedAgentHours: 22,
    members: [
      { name: "Avery Martínez", email: "avery.martinez@ucl.ac.uk", badgeNumber: "SIM-0601", role: "Team Lead / AI Engineer", affiliation: "University College London", degrees: "PhD", isStudentTrainee: false },
      { name: "Blake Anderson", email: "blake.anderson@ox.ac.uk", badgeNumber: "SIM-0602", role: "Frontend", affiliation: "University of Cambridge", degrees: "MS", isStudentTrainee: true },
      { name: "Li Wei", email: "li.wei@fudan.edu.cn", badgeNumber: "SIM-0603", role: "Prompt Library", affiliation: "Fudan University", degrees: "BS", isStudentTrainee: true },
      { name: "Sara Al-Najjar", email: "sara.alnajjar@telaviv.edu", badgeNumber: "SIM-0604", role: "Evaluation", affiliation: "American University of Beirut", degrees: "MD", isStudentTrainee: true },
    ],
    audienceVotes: 7,
  },
  {
    id: "sub_QRY8MHpa", editToken: "edit_7PNNqUiaFjQh-xPK",
    slug: "voxel-vault", teamName: "Voxel Vault Co", contactEmail: "team@voxelvault.app",
    projectTitle: "Voxel Vault Co — Voxel Vault",
    problemStatement: "Place and remove voxels to reconstruct 3D medical scans from memory. Inspired by DICOM 3D reconstruction. Score is based on volumetric accuracy vs. reference structure.",
    targetUsers: "radiology students, 3D reconstruction enthusiasts, puzzle gamers",
    demoUrl: "https://georgezero.github.io/vibe-hackathon-alpha-team-07-voxel-vault",
    githubUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-07-voxel-vault",
    screenshotUrl: "https://picsum.photos/seed/voxelvault/800/500",
    readmeUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-07-voxel-vault/blob/main/README.md",
    agentsMdUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-07-voxel-vault/blob/main/AGENTS.md",
    promptStrategyUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-07-voxel-vault/blob/main/docs/prompts.md",
    sampleDataDescription: "See sample-data/game-states.json. No real patient data.",
    setupInstructions: "npm install", deployInstructions: "npm run build → deploy dist/",
    knownLimitations: "Isometric projection only. Full 3D rotation not yet implemented.",
    tags: ["game", "3D", "voxels", "reconstruction", "radiology"],
    license: "MIT", agentHarnesses: ["Claude Code"], agentModels: ["claude-opus-4-5"],
    budgetTier: "api_10_to_50", estimatedHumanHours: 20, estimatedAgentHours: 45,
    members: [
      { name: "Cameron Tanaka", email: "cameron.tanaka@tokyo.ac.jp", badgeNumber: "SIM-0701", role: "Team Lead / 3D Graphics", affiliation: "Tohoku University", degrees: "PhD", isStudentTrainee: false },
      { name: "Drew Jackson", email: "drew.jackson@sydney.edu.au", badgeNumber: "SIM-0702", role: "AI Integration", affiliation: "Royal Melbourne Hospital", degrees: "MS", isStudentTrainee: true },
      { name: "Fatima Khan", email: "fatima.khan@mcgill.ca", badgeNumber: "SIM-0703", role: "3D Reconstruction Advisor", affiliation: "McGill University", degrees: "MD", isStudentTrainee: false },
      { name: "Jonas Weber", email: "jonas.weber@ethz.ch", badgeNumber: "SIM-0704", role: "Geometry + QA", affiliation: "ETH Zurich", degrees: "BS", isStudentTrainee: true },
      { name: "Ana Pereira", email: "ana.pereira@usp.br", badgeNumber: "SIM-0705", role: "User Testing", affiliation: "Pontificia Universidad", degrees: "MD", isStudentTrainee: true },
      { name: "Mpho Dlamini", email: "mpho.dlamini@uct.ac.za", badgeNumber: "SIM-0706", role: "Documentation", affiliation: "University of the Witwatersrand", degrees: "BSc", isStudentTrainee: true },
    ],
    audienceVotes: 10,
  },
  {
    id: "sub_WmDwpV8u", editToken: "edit_iTz7eWA9eiK2Eh59",
    slug: "radiology-robot", teamName: "Radiology Robotics", contactEmail: "dev@radiologyrobot.io",
    projectTitle: "Radiology Robotics — Radiology Robot",
    problemStatement: "Navigate a hospital robot through corridors to deliver scan results. Avoid rogue autonomous systems. Collect imaging reports along the way.",
    targetUsers: "healthcare IT teams, hospital automation researchers, puzzle gamers",
    demoUrl: "https://georgezero.github.io/vibe-hackathon-alpha-team-08-radiology-robot",
    githubUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-08-radiology-robot",
    screenshotUrl: "https://picsum.photos/seed/radiologyrobot/800/500",
    readmeUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-08-radiology-robot/blob/main/README.md",
    agentsMdUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-08-radiology-robot/blob/main/AGENTS.md",
    promptStrategyUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-08-radiology-robot/blob/main/docs/prompts.md",
    sampleDataDescription: "See sample-data/game-states.json. No real patient data.",
    setupInstructions: "npm install", deployInstructions: "npm run build → deploy dist/",
    knownLimitations: "Single map only. Enemy AI is random walk, not pathfinding.",
    tags: ["game", "robot", "navigation", "healthcare", "automation"],
    license: "MIT", agentHarnesses: ["Aider", "Claude Code"], agentModels: ["claude-opus-4-5", "claude-sonnet-4-5"],
    budgetTier: "api_10_to_50", estimatedHumanHours: 18, estimatedAgentHours: 35,
    members: [
      { name: "Emery White", email: "emery.white@jhu.edu", badgeNumber: "SIM-0801", role: "Team Lead / Robotics Logic", affiliation: "Johns Hopkins University", degrees: "MD", isStudentTrainee: false },
      { name: "Finley Harris", email: "finley.harris@washington.edu", badgeNumber: "SIM-0802", role: "Full-stack", affiliation: "University of Washington", degrees: "MS", isStudentTrainee: true },
      { name: "Skyler Clark", email: "skyler.clark@nus.edu.sg", badgeNumber: "SIM-0803", role: "AI Navigation", affiliation: "Singapore General Hospital", degrees: "PhD", isStudentTrainee: false },
      { name: "Leila Farouk", email: "leila.farouk@cairo.edu", badgeNumber: "SIM-0804", role: "Hospital Workflow", affiliation: "AIIMS New Delhi", degrees: "MD", isStudentTrainee: true },
    ],
    audienceVotes: 6,
  },
  {
    id: "sub_nB2AvegO", editToken: "edit_Eaw54gYp1CIuqTMA",
    slug: "ct-scan-craft", teamName: "CT Scan Crafters", contactEmail: "hello@ctscancraft.com",
    projectTitle: "CT Scan Crafters — Ct Scan Craft",
    problemStatement: "Tetris variant where falling blocks are CT scan cross-sections. Stack slices to reconstruct a complete organ. Clear complete axial slices to score.",
    targetUsers: "radiology enthusiasts, Tetris fans, medical imaging students",
    demoUrl: "https://georgezero.github.io/vibe-hackathon-alpha-team-09-ct-scan-craft",
    githubUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-09-ct-scan-craft",
    screenshotUrl: "https://picsum.photos/seed/ctscancraft/800/500",
    readmeUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-09-ct-scan-craft/blob/main/README.md",
    agentsMdUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-09-ct-scan-craft/blob/main/AGENTS.md",
    promptStrategyUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-09-ct-scan-craft/blob/main/docs/prompts.md",
    sampleDataDescription: "See sample-data/game-states.json. No real patient data.",
    setupInstructions: "npm install", deployInstructions: "npm run build → deploy dist/",
    knownLimitations: "Grayscale-only theme. HU windowing aesthetics are approximated, not clinically accurate.",
    tags: ["game", "CT scan", "tetris", "radiology", "imaging"],
    license: "MIT", agentHarnesses: ["Windsurf"], agentModels: ["claude-sonnet-4-5"],
    budgetTier: "standard_subscription", estimatedHumanHours: 7, estimatedAgentHours: 28,
    members: [
      { name: "Harley Lewis", email: "harley.lewis@utoronto.ca", badgeNumber: "SIM-0901", role: "Team Lead / Developer", affiliation: "McGill University", degrees: "MD", isStudentTrainee: true },
      { name: "Nora Fischer", email: "nora.fischer@tum.de", badgeNumber: "SIM-0902", role: "CT Slice Mechanics", affiliation: "Technical University of Munich", degrees: "MS", isStudentTrainee: true },
      { name: "Akira Yamamoto", email: "akira.yamamoto@osaka-u.ac.jp", badgeNumber: "SIM-0903", role: "Imaging Advisor", affiliation: "Osaka University", degrees: "PhD", isStudentTrainee: false },
      { name: "Isabella Rossi", email: "isabella.rossi@unimi.it", badgeNumber: "SIM-0904", role: "UX", affiliation: "University of Helsinki", degrees: "BS", isStudentTrainee: true },
      { name: "Samuel Okafor", email: "samuel.okafor@wits.ac.za", badgeNumber: "SIM-0905", role: "QA", affiliation: "University of Cape Town", degrees: "MSc", isStudentTrainee: true },
    ],
    audienceVotes: 7,
  },
  {
    id: "sub_6z_UufYt", editToken: "edit_UpHVsPv2UKvypXP9",
    slug: "agent-arena", teamName: "Agent Arena Labs", contactEmail: "team@agentarena.xyz",
    projectTitle: "Agent Arena Labs — Agent Arena",
    problemStatement: "A competitive grid arena where two AI agents battle in real time. You control one agent using keyboard; the AI opponent uses a deterministic strategy. First to capture the board wins.",
    targetUsers: "AI researchers, game AI enthusiasts, agentic dev community",
    demoUrl: "https://georgezero.github.io/vibe-hackathon-alpha-team-10-agent-arena",
    githubUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-10-agent-arena",
    screenshotUrl: "https://picsum.photos/seed/agentarena/800/500",
    readmeUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-10-agent-arena/blob/main/README.md",
    agentsMdUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-10-agent-arena/blob/main/AGENTS.md",
    promptStrategyUrl: "https://github.com/georgezero/vibe-hackathon-alpha-team-10-agent-arena/blob/main/docs/prompts.md",
    sampleDataDescription: "See sample-data/game-states.json. No real patient data.",
    setupInstructions: "npm install", deployInstructions: "npm run build → deploy dist/",
    knownLimitations: "AI opponent uses greedy strategy only. No ML-based opponent yet.",
    tags: ["game", "AI", "agent", "competitive", "strategy"],
    license: "MIT", agentHarnesses: ["Claude Code", "Cursor"], agentModels: ["claude-opus-4-5", "gpt-4o", "gemini-1.5-pro"],
    budgetTier: "api_over_200", estimatedHumanHours: 24, estimatedAgentHours: 80,
    members: [
      { name: "Indigo Walker", email: "indigo.walker@sydney.edu.au", badgeNumber: "SIM-1001", role: "Team Lead / AI Systems", affiliation: "Royal Prince Alfred", degrees: "PhD", isStudentTrainee: false },
      { name: "Jordan Hall", email: "jordan.hall@ubc.ca", badgeNumber: "SIM-1002", role: "Backend", affiliation: "University of British Columbia", degrees: "MS", isStudentTrainee: true },
      { name: "Kyle Young", email: "kyle.young@stanford.edu", badgeNumber: "SIM-1003", role: "Frontend", affiliation: "UCLA", degrees: "BS", isStudentTrainee: true },
      { name: "Mina Park", email: "mina.park@yonsei.ac.kr", badgeNumber: "SIM-1004", role: "Agent Strategy", affiliation: "Yonsei University", degrees: "MD", isStudentTrainee: true },
      { name: "Clara Jensen", email: "clara.jensen@helsinki.fi", badgeNumber: "SIM-1005", role: "Evaluation", affiliation: "KU Leuven", degrees: "PhD", isStudentTrainee: false },
      { name: "Rafael Costa", email: "rafael.costa@einstein.br", badgeNumber: "SIM-1006", role: "Clinical Review", affiliation: "Hospital Israelita Albert Einstein", degrees: "MD", isStudentTrainee: false },
    ],
    audienceVotes: 12,
  },
] as const;

const SIM_JUDGES = [
  { id: "jdg_alpha01", name: "Dr. Sarah Chen",   email: "sarah.chen@radiology.edu" },
  { id: "jdg_beta02",  name: "Dr. Marcus Webb",  email: "m.webb@medimaging.org" },
  { id: "jdg_gamma03", name: "Dr. Yuki Tanaka",  email: "y.tanaka@aihealth.io" },
];

// Base rubric scores per game — judge styles apply bias + jitter on top
const BASE_SCORES: Record<string, Record<string, number>> = {
  "dicom-dodger":     { problemSelection:8, productUsefulness:7, functionality:9, uxDesign:8, aiCollaboration:9, originality:8, maintainability:8, presentationClarity:9 },
  "annotation-racer": { problemSelection:9, productUsefulness:9, functionality:8, uxDesign:8, aiCollaboration:8, originality:7, maintainability:8, presentationClarity:8 },
  "token-tetris":     { problemSelection:7, productUsefulness:6, functionality:9, uxDesign:7, aiCollaboration:8, originality:9, maintainability:9, presentationClarity:8 },
  "mri-minesweeper":  { problemSelection:7, productUsefulness:7, functionality:8, uxDesign:8, aiCollaboration:7, originality:7, maintainability:8, presentationClarity:7 },
  "dose-defender":    { problemSelection:8, productUsefulness:7, functionality:8, uxDesign:8, aiCollaboration:9, originality:8, maintainability:7, presentationClarity:8 },
  "prompt-snake":     { problemSelection:6, productUsefulness:5, functionality:8, uxDesign:7, aiCollaboration:8, originality:8, maintainability:8, presentationClarity:7 },
  "voxel-vault":      { problemSelection:8, productUsefulness:8, functionality:7, uxDesign:9, aiCollaboration:8, originality:9, maintainability:7, presentationClarity:8 },
  "radiology-robot":  { problemSelection:7, productUsefulness:6, functionality:7, uxDesign:7, aiCollaboration:8, originality:7, maintainability:7, presentationClarity:7 },
  "ct-scan-craft":    { problemSelection:7, productUsefulness:6, functionality:9, uxDesign:9, aiCollaboration:8, originality:8, maintainability:9, presentationClarity:8 },
  "agent-arena":      { problemSelection:9, productUsefulness:8, functionality:8, uxDesign:8, aiCollaboration:10, originality:9, maintainability:8, presentationClarity:9 },
};

// Deterministic jitter using submission+judge index as seed (reproducible)
function stableJitter(subIdx: number, judgeIdx: number, fieldIdx: number, range: number): number {
  const seed = subIdx * 1000 + judgeIdx * 100 + fieldIdx;
  const pseudo = Math.sin(seed) * 43758.5453123;
  return (pseudo - Math.floor(pseudo) - 0.5) * range * 2;
}

function clamp(v: number): number {
  return Math.max(1, Math.min(10, Math.round(v)));
}

// ── Exported seed functions ───────────────────────────────────────────────────

export async function wipeTables() {
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
}

export async function seedEvent() {
  await db.insert(events).values({
    id: EVENT_ID,
    name: "Vibe Hackathon 2026",
    slug: "vibe-hackathon-2026",
    isActive: true,
    audienceVotingEnabled: true,
    audienceAwardCount: 3,
    audienceVotesPerPerson: 1,
    audienceResultsVisible: true,
    audienceVotingMode: "human",
    audienceIdentityMethod: "badge",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function seedSimSubmissions() {
  for (const sub of SIM_SUBMISSIONS) {
    await db.insert(submissions).values({
      id: sub.id,
      eventId: EVENT_ID,
      editToken: sub.editToken,
      status: "submitted",
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
      tags: [...sub.tags] as string[],
      license: sub.license,
      agentHarnesses: [...sub.agentHarnesses] as string[],
      agentModels: [...sub.agentModels] as string[],
      budgetTier: sub.budgetTier,
      estimatedHumanHours: sub.estimatedHumanHours,
      estimatedAgentHours: sub.estimatedAgentHours,
      submittedAt: new Date("2025-11-14T18:00:00Z"),
      createdAt: new Date("2025-11-10T10:00:00Z"),
    });

    for (let i = 0; i < sub.members.length; i++) {
      await db.insert(teamMembers).values({
        id: nanoid(),
        submissionId: sub.id,
        name: sub.members[i].name,
        email: sub.members[i].email,
        badgeNumber: sub.members[i].badgeNumber,
        role: sub.members[i].role,
        affiliation: sub.members[i].affiliation,
        degrees: sub.members[i].degrees,
        isStudentTrainee: sub.members[i].isStudentTrainee,
        order: i,
      });
    }

    // Audience votes
    for (let i = 0; i < sub.audienceVotes; i++) {
      await db.insert(audienceVotes).values({
        id: nanoid(),
        submissionId: sub.id,
        sessionFingerprint: `sim_${sub.slug}_${i}`,
        createdAt: new Date(),
      });
    }

    // AI review (deterministic scorer result: 93/100)
    await db.insert(aiReviews).values({
      id: nanoid(),
      submissionId: sub.id,
      complianceCheck: "pass",
      repoReview: `Repo compliance score: 100/100\n✓ README.md\n✓ LICENSE (MIT)\n✓ .env.example\n✓ vibe.json\n— docker-compose.yml not present`,
      demoValidation: "pending",
      screenshotValidation: "pending",
      agentsMdEvaluation: `AGENTS.md found. Sections detected: install, run, architecture, workflow, debug.\n✓ Install section\n✓ Run section\n✓ Architecture section`,
      promptStrategyEvaluation: "docs/prompts.md found — prompt strategy is documented.",
      reliabilityNotes: `Reproducibility: 80/100 | Deployment: 65/100\n✓ Install instructions in README\n✓ Usage instructions in README\n— No deploy instructions in README`,
      generatedScore: 93,
      generatedRationale: `Overall: 93/100 (deterministic, evidence-based)\nRepo: 100 | Docs: 85 | Reproducibility: 80 | Deployment: 65 | Agent readiness: 95\nAll required files present.`,
      suggestedQuestions: ["Is the demo URL publicly accessible? Any cold-start limitations?"],
      status: "complete",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function seedSimJudges() {
  const JUDGE_STYLES = [
    { bias: 0,  sd: 1.0 },  // Sarah Chen  — neutral
    { bias: -1, sd: 1.5 },  // Marcus Webb — harsher, more variable
    { bias: 1,  sd: 0.8 },  // Yuki Tanaka — easier, more consistent
  ];

  const FIELDS = ["problemSelection","productUsefulness","functionality","uxDesign","aiCollaboration","originality","maintainability","presentationClarity"] as const;

  for (let ji = 0; ji < SIM_JUDGES.length; ji++) {
    const judge = SIM_JUDGES[ji];
    const style = JUDGE_STYLES[ji];

    await db.insert(judges).values({
      id: judge.id,
      token: `judge_${nanoid(32)}`,
      name: judge.name,
      email: judge.email,
      createdAt: new Date(),
    });

    for (let si = 0; si < SIM_SUBMISSIONS.length; si++) {
      const sub = SIM_SUBMISSIONS[si];
      const base = BASE_SCORES[sub.slug] ?? {};

      await db.insert(judgeAssignments).values({
        id: nanoid(),
        judgeId: judge.id,
        submissionId: sub.id,
        createdAt: new Date(),
      });

      const scores: Record<string, number> = {};
      FIELDS.forEach((field, fi) => {
        const raw = (base[field] ?? 7) + style.bias + stableJitter(si, ji, fi, style.sd);
        scores[field] = clamp(raw);
      });

      const avg = Object.values(scores).reduce((a, b) => a + b, 0) / FIELDS.length;
      const rec = avg >= 8.5 ? "strong-yes" : avg >= 7 ? "yes" : avg >= 5 ? "maybe" : "no";

      await db.insert(humanScores).values({
        id: nanoid(),
        submissionId: sub.id,
        judgeId: judge.id,
        problemSelection: scores.problemSelection,
        productUsefulness: scores.productUsefulness,
        functionality: scores.functionality,
        uxDesign: scores.uxDesign,
        aiCollaboration: scores.aiCollaboration,
        originality: scores.originality,
        maintainability: scores.maintainability,
        presentationClarity: scores.presentationClarity,
        privateNotes: avg >= 8 ? `Strong effort on AI collaboration.` : `Good concept, execution could be stronger.`,
        recommendation: rec as "strong-yes" | "yes" | "maybe" | "no",
        completed: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function seed() {
  console.log("Seeding database with simulation entries (10 radiology games)...");
  await wipeTables();
  await seedEvent();
  await seedSimSubmissions();
  await seedSimJudges();
  console.log(`Done — ${SIM_SUBMISSIONS.length} submissions, ${SIM_JUDGES.length} judges, ${SIM_SUBMISSIONS.length * SIM_JUDGES.length} scores.`);
}

// Only auto-run when executed directly, not when imported
if (process.argv[1]?.includes("seed-sim")) {
  seed().catch(console.error);
}
