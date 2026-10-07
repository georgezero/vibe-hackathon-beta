/** Native team chat is deliberately opt-in until the controlled pilot is approved. */
export function isNativeTeamChatEnabled(submissionId?: string) {
  if (process.env.VIBE_NATIVE_TEAM_CHAT_ENABLED !== "true") return false;
  const allowlist = (process.env.VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowlist.length === 0 || Boolean(submissionId && allowlist.includes(submissionId));
}

export const NATIVE_CHAT_UNAVAILABLE_MESSAGE = "Messaging is temporarily unavailable. Your submission and account are unaffected.";
