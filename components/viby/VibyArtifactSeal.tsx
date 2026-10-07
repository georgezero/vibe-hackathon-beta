import type { VerifiedArtifact } from "@/lib/verifiedArtifacts";
import { formatVibyArtifactSealText } from "@/lib/verifiedArtifacts";

export function VibyArtifactSeal({ artifact }: { artifact: VerifiedArtifact }) {
  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--color-accent) 7%, var(--color-surface))",
        borderRadius: 12,
        padding: "0.5rem",
        overflowX: "auto",
      }}
    >
      <pre
        style={{
          margin: 0,
          color: "var(--color-fg)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.74rem",
          lineHeight: 1.35,
          whiteSpace: "pre",
          width: "max-content",
        }}
      >
        {formatVibyArtifactSealText(artifact)}
      </pre>
    </div>
  );
}
