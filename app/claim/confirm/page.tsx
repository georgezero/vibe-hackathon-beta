import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { getPendingSubmissionClaim, SUBMISSION_CLAIM_BINDING_COOKIE, SUBMISSION_CLAIM_COOKIE } from "@/lib/submission-claim";
import { ClaimConfirmClient } from "./ClaimConfirmClient";

export const dynamic = "force-dynamic";

export default async function ClaimConfirmPage() {
  const cookieStore = await cookies();
  const transactionId = cookieStore.get(SUBMISSION_CLAIM_COOKIE)?.value ?? "";
  const browserBinding = cookieStore.get(SUBMISSION_CLAIM_BINDING_COOKIE)?.value ?? "";
  if (!transactionId || !browserBinding) redirect("/account/projects?claim=expired");
  const result = await getPendingSubmissionClaim({ transactionId, browserBinding, headers: await headers() });
  if (!result.ok) redirect(`/account/projects?claim=${result.reason}`);
  return <div className="min-h-screen"><NavPublic /><main className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-16"><ClaimConfirmClient teamName={result.submission.teamName} /></main></div>;
}
