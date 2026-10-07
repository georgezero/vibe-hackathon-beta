import { NextRequest, NextResponse } from "next/server";
import { parseGithubUrl, fetchRepoFiles } from "@/lib/github-fetch";
import { scoreSubmission } from "@/lib/repo-scorer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { github_url } = body as { github_url?: string };

    if (!github_url?.trim()) {
      return NextResponse.json({ error: "github_url is required" }, { status: 400 });
    }

    const coords = parseGithubUrl(github_url);
    if (!coords) {
      return NextResponse.json(
        { error: "Invalid GitHub URL — expected https://github.com/owner/repo" },
        { status: 400 }
      );
    }

    const files = await fetchRepoFiles(coords);
    const scoring = scoreSubmission(files);

    return NextResponse.json({
      github_url,
      owner: coords.owner,
      repo: coords.repo,
      branch: files.branch,
      scoring,
    });
  } catch (err) {
    console.error("POST /api/v1/validate-repo error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
