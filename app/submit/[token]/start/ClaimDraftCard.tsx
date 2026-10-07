import { SaveProjectCard } from "@/components/SaveProjectCard";

export function ClaimDraftCard({ submissionId, editToken }: { submissionId: string; editToken: string }) {
  return <div style={{ marginTop: "1.5rem" }}><SaveProjectCard submissionId={submissionId} editToken={editToken} /></div>;
}
