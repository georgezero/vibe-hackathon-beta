export function githubAuthRequired() {
  return process.env.VIBE_HACKATHON_REQUIRE_GITHUB_AUTH === "true";
}

export function ownershipMode() {
  return githubAuthRequired() ? "github" : "badge";
}
