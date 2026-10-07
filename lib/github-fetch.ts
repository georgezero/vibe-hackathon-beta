const RAW_BASE = "https://raw.githubusercontent.com";
const TIMEOUT_MS = 8000;

export interface RepoCoords {
  owner: string;
  repo: string;
}

export interface FetchedFile {
  content: string;
  branch: string;
  path: string;
  length: number;
}

export interface RepoFiles {
  readme: FetchedFile | null;
  agentsMd: FetchedFile | null;
  license: FetchedFile | null;
  envExample: FetchedFile | null;
  vibeJson: FetchedFile | null;
  dockerCompose: FetchedFile | null;
  promptsMd: FetchedFile | null;
  vibeSubmissionMd: FetchedFile | null;
  agentReportMd: FetchedFile | null;
  branch: string | null;
}

export function parseGithubUrl(url: string): RepoCoords | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

async function fetchRaw(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string | null> {
  try {
    const url = `${RAW_BASE}/${owner}/${repo}/${branch}/${path}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function tryFile(
  owner: string,
  repo: string,
  branch: string,
  paths: string[]
): Promise<FetchedFile | null> {
  for (const path of paths) {
    const content = await fetchRaw(owner, repo, branch, path);
    if (content !== null) {
      return { content, branch, path, length: content.length };
    }
  }
  return null;
}

export async function fetchRepoFiles(coords: RepoCoords): Promise<RepoFiles> {
  const { owner, repo } = coords;

  // Detect default branch
  let branch = "main";
  const mainTest = await fetchRaw(owner, repo, "main", "README.md");
  if (mainTest === null) {
    const masterTest = await fetchRaw(owner, repo, "master", "README.md");
    if (masterTest !== null) branch = "master";
  }

  const [readme, agentsMd, license, envExample, vibeJson, dockerCompose, promptsMd, vibeSubmissionMd, agentReportMd] =
    await Promise.all([
      mainTest !== null
        ? { content: mainTest, branch, path: "README.md", length: mainTest.length }
        : tryFile(owner, repo, branch, ["README.md", "readme.md", "Readme.md"]),
      tryFile(owner, repo, branch, ["AGENTS.md", "agents.md", ".agents.md"]),
      tryFile(owner, repo, branch, [
        "LICENSE",
        "LICENSE.md",
        "LICENSE.txt",
        "license",
        "license.md",
      ]),
      tryFile(owner, repo, branch, [".env.example", ".env.sample", ".env.template"]),
      tryFile(owner, repo, branch, ["vibe.json"]),
      tryFile(owner, repo, branch, [
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml",
      ]),
      tryFile(owner, repo, branch, [
        "docs/prompts.md",
        "docs/PROMPTS.md",
        "PROMPTS.md",
        "prompts.md",
      ]),
      tryFile(owner, repo, branch, [
        "docs/vibe-submission.md",
        "docs/VIBE-SUBMISSION.md",
        "vibe-submission.md",
      ]),
      tryFile(owner, repo, branch, [
        "docs/agent-report.md",
        "docs/AGENT-REPORT.md",
        "agent-report.md",
      ]),
    ]);

  return {
    readme,
    agentsMd,
    license,
    envExample,
    vibeJson,
    dockerCompose,
    promptsMd,
    vibeSubmissionMd,
    agentReportMd,
    branch,
  };
}
