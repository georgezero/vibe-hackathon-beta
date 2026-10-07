import Link from "next/link";
import type { ParticipantIdentityData } from "@/lib/user-profiles";

export type ParticipantIdentityVariant = "compact" | "full";

/**
 * Participant-facing identity only. Keep roster snapshots and authorization
 * context outside this component; a link is possible only for a public handle.
 */
export default function ParticipantIdentity({
  identity,
  variant = "compact",
}: {
  identity: ParticipantIdentityData;
  variant?: ParticipantIdentityVariant;
}) {
  const content = (
    <>
      <span className="participant-identity-avatar" aria-hidden="true">{identity.initials}</span>
      <span className="participant-identity-copy">
        <strong>{identity.displayName}</strong>
        {variant === "full" && (identity.headline || identity.affiliation) && (
          <small>{[identity.headline, identity.affiliation].filter(Boolean).join(" · ")}</small>
        )}
      </span>
    </>
  );
  if (identity.handle) {
    return <Link className={`participant-identity participant-identity-${variant}`} href={`/people/${encodeURIComponent(identity.handle)}`} aria-label={`View ${identity.displayName}'s profile`}>{content}</Link>;
  }
  return <span className={`participant-identity participant-identity-${variant}`}>{content}</span>;
}
