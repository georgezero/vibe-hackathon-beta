"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { AwardBadges } from "@/components/AwardBadges";
import { ShortcutHelpOverlay } from "@/components/ShortcutHelpOverlay";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { AwardBadge } from "@/lib/award-badges";
import { ParticipantEmptyState } from "@/components/ParticipantEmptyState";

export interface GallerySubmission {
  id: string;
  projectTitle: string | null;
  teamName: string;
  problemStatement: string | null;
  demoUrl: string | null;
  demoVideoUrl: string | null;
  githubUrl: string | null;
  screenshotUrl: string | null;
  status: string;
  tags: string[] | null;
  audienceVotes: number | null;
  awardBadges: AwardBadge[];
}

interface Props {
  submissions: GallerySubmission[];
  votingOpen: boolean;
  resultsVisible: boolean;
  identityMethod: string;
  votingMode: string;
}

const IDENTITY_LABELS: Record<string, { label: string; placeholder: string; hint: string }> = {
  badge: { label: "Badge number", placeholder: "123456", hint: "Enter the badge number from your conference badge." },
  email: { label: "Email address", placeholder: "you@example.com", hint: "Enter the email address you registered with." },
  invite_code: { label: "Invite code", placeholder: "Enter your code", hint: "Enter the invite code provided by the organizer." },
  anonymous: { label: "", placeholder: "", hint: "" },
};

interface VoteModalProps {
  submission: GallerySubmission;
  identityMethod: string;
  onClose: () => void;
  onSuccess: (submissionId: string, totalVotes: number) => void;
}

function VoteModal({ submission, identityMethod, onClose, onSuccess }: VoteModalProps) {
  const [value, setValue] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const config = IDENTITY_LABELS[identityMethod] ?? IDENTITY_LABELS.badge;
  const showEmailField = identityMethod === "badge";

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) { setError(`Please enter your ${config.label.toLowerCase()}.`); return; }
    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, string> = { submissionId: submission.id, identity: value.trim(), identityMethod };
      if (showEmailField && email.trim()) body.email = email.trim();
      const res = await fetch("/api/v1/audience-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(submission.id, data.totalVotes);
      } else if (res.status === 409 || data.alreadyVoted) {
        setError(data.message ?? "You have already voted for this project.");
      } else {
        setError(data.error ?? "Vote failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
      <div
        className="card"
        style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400, padding: "2rem" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
              People&apos;s Choice Vote
            </div>
            <div style={{ fontWeight: 700, color: "var(--color-fg)", fontSize: "1rem", lineHeight: 1.3 }}>
              {submission.projectTitle ?? submission.teamName}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.125rem" }}>
              {submission.teamName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: "1.25rem", lineHeight: 1, padding: "0.25rem", flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-fg)", marginBottom: "0.5rem" }}>
            {config.label}
          </label>
          <input
            ref={inputRef}
            type={identityMethod === "email" ? "email" : "text"}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            placeholder={config.placeholder}
            style={{
              width: "100%",
              padding: "0.625rem 0.875rem",
              borderRadius: 8,
              border: `1px solid ${error ? "var(--color-error, #ef4444)" : "var(--color-border)"}`,
              background: "var(--color-surface-2)",
              color: "var(--color-fg)",
              fontSize: "0.9375rem",
              outline: "none",
              marginBottom: "0.375rem",
            }}
          />
          {config.hint && (
            <p style={{ fontSize: "0.75rem", color: "var(--color-subtle)", marginBottom: "0.875rem" }}>{config.hint}</p>
          )}

          {showEmailField && (
            <div style={{ marginBottom: "0.875rem" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-fg)", marginBottom: "0.5rem" }}>
                Email <span style={{ fontWeight: 400, color: "var(--color-subtle)" }}>(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)",
                  color: "var(--color-fg)",
                  fontSize: "0.9375rem",
                  outline: "none",
                  marginBottom: "0.375rem",
                }}
              />
              <p style={{ fontSize: "0.6875rem", color: "var(--color-subtle)" }}>
                Used only for optional follow-up. Voting uniqueness is based on badge number.
              </p>
            </div>
          )}

          {error && (
            <p style={{ fontSize: "0.8125rem", color: "var(--color-error, #ef4444)", marginBottom: "0.75rem" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{ width: "100%", justifyContent: "center", opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "Submitting…" : "Submit Vote"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function GalleryClient({ submissions, votingOpen, resultsVisible, identityMethod, votingMode }: Props) {
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [localVotes, setLocalVotes] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>("all");
  const [modalSubmission, setModalSubmission] = useState<GallerySubmission | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const fingerprintRef = useRef<string>("");
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem("vf");
    if (stored) {
      fingerprintRef.current = stored;
    } else {
      const f = Math.random().toString(36).slice(2);
      sessionStorage.setItem("vf", f);
      fingerprintRef.current = f;
    }
  }, []);

  const allTags = Array.from(new Set(submissions.flatMap((s) => s.tags ?? []))).sort();
  const filtered = filter === "all" ? submissions : submissions.filter((s) => (s.tags ?? []).includes(filter));
  const chooseFilter = (nextFilter: string) => {
    setFilter(nextFilter);
    setSelectedIndex(null);
  };

  useEffect(() => {
    if (selectedIndex === null) return;
    cardRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  useKeyboardShortcuts((event) => {
    if (modalSubmission) return;
    if (event.key === "?") {
      event.preventDefault();
      setHelpOpen((open) => !open);
      return;
    }
    if (event.key === "Escape" && helpOpen) {
      event.preventDefault();
      setHelpOpen(false);
      return;
    }
    if (helpOpen) return;
    if (event.key === "j") {
      event.preventDefault();
      setSelectedIndex((index) => index === null ? 0 : (index + 1) % filtered.length);
      return;
    }
    if (event.key === "k") {
      event.preventDefault();
      setSelectedIndex((index) => index === null ? null : (index - 1 + filtered.length) % filtered.length);
      return;
    }
    if (event.key === "Enter" && selectedIndex !== null && filtered[selectedIndex]) {
      event.preventDefault();
      window.location.href = `/project/${filtered[selectedIndex].id}`;
      return;
    }
    if (event.key === "/") {
      event.preventDefault();
    }
  });

  function handleVoteClick(sub: GallerySubmission) {
    if (voted.has(sub.id) || !votingOpen) return;
    if (votingMode === "human" && identityMethod !== "anonymous") {
      setModalSubmission(sub);
    } else {
      handleAnonymousVote(sub.id);
    }
  }

  async function handleAnonymousVote(id: string) {
    if (voted.has(id)) return;
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: id, fingerprint: fingerprintRef.current }),
    });
    const data = await res.json();
    if (data.success) {
      setVoted((prev) => new Set([...prev, id]));
      setLocalVotes((prev) => ({ ...prev, [id]: data.totalVotes }));
    } else if (data.alreadyVoted) {
      setVoted((prev) => new Set([...prev, id]));
    }
  }

  function handleVoteSuccess(submissionId: string, totalVotes: number) {
    setVoted((prev) => new Set([...prev, submissionId]));
    setLocalVotes((prev) => ({ ...prev, [submissionId]: totalVotes }));
    setModalSubmission(null);
  }

  return (
    <>
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => chooseFilter("all")}
          className="badge"
          style={{
            cursor: "pointer",
            padding: "0.375rem 0.875rem",
            fontSize: "0.8125rem",
            background: filter === "all" ? "var(--color-accent)" : "color-mix(in srgb, var(--color-muted) 14%, transparent)",
            color: filter === "all" ? "var(--color-accent-fg)" : "var(--color-muted)",
            border: "none",
          }}
        >
          All
        </button>
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => chooseFilter(tag)}
            className="badge"
            style={{
              cursor: "pointer",
              padding: "0.375rem 0.875rem",
              fontSize: "0.8125rem",
              background: filter === tag ? "var(--color-accent)" : "color-mix(in srgb, var(--color-muted) 14%, transparent)",
              color: filter === tag ? "var(--color-accent-fg)" : "var(--color-muted)",
              border: "none",
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((sub, index) => {
          const hasVoted = voted.has(sub.id);
          const displayVotes = localVotes[sub.id] ?? sub.audienceVotes;

          return (
            <div
              key={sub.id}
              ref={(el) => { cardRefs.current[index] = el; }}
              className="card card-hover flex flex-col overflow-hidden"
              onClick={() => setSelectedIndex(index)}
              style={{
                outline: index === selectedIndex ? "2px solid var(--color-accent)" : "2px solid transparent",
                outlineOffset: 3,
                boxShadow: index === selectedIndex ? "0 0 0 4px color-mix(in srgb, var(--color-accent) 12%, transparent)" : undefined,
              }}
            >
              {/* Screenshot */}
              <Link
                href={`/project/${sub.id}`}
                style={{ display: "block", aspectRatio: "16/9", overflow: "hidden", background: "var(--color-surface-2)" }}
              >
                {sub.screenshotUrl ? (
                  <img
                    src={sub.screenshotUrl}
                    alt={sub.projectTitle ?? "Project screenshot"}
                    style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 300ms" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1.03)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1)"; }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)", fontSize: "0.8125rem" }}>
                    No screenshot
                  </div>
                )}
              </Link>

              <div style={{ padding: "1.125rem", display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {(sub.tags ?? []).map((tag) => (
                    <span key={tag} className="badge badge-default" style={{ fontSize: "0.625rem" }}>{tag}</span>
                  ))}
                  {sub.status === "finalized" && (
                    <span className="badge badge-success" style={{ fontSize: "0.625rem" }}>finalized</span>
                  )}
                </div>

                {/* Title */}
                <div>
                  <Link
                    href={`/project/${sub.id}`}
                    style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "1rem", textDecoration: "none", lineHeight: 1.3, display: "block" }}
                  >
                    {sub.projectTitle ?? sub.teamName}
                  </Link>
                  <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>{sub.teamName}</div>
                </div>

                <AwardBadges badges={sub.awardBadges} />

                {/* Problem statement */}
                <p style={{ fontSize: "0.8125rem", color: "var(--color-subtle)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {sub.problemStatement}
                </p>

                {/* Links row */}
                <div className="flex items-center gap-2 mt-auto pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
                  {sub.demoUrl && (
                    <a href={sub.demoUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}>↗ Demo</a>
                  )}
                  {sub.githubUrl && (
                    <a href={sub.githubUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}>GitHub</a>
                  )}
                  {sub.demoVideoUrl && (
                    <a href={sub.demoVideoUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}>▶ Video</a>
                  )}
                </div>

                {/* Vote control */}
                {votingOpen && (
                  <div style={{ marginTop: "0.625rem" }}>
                    <button
                      onClick={() => handleVoteClick(sub)}
                      disabled={hasVoted}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        width: "100%",
                        padding: "0.75rem 1rem",
                        minHeight: 48,
                        borderRadius: 10,
                        border: hasVoted
                          ? "1px solid var(--color-success)"
                          : "1px solid color-mix(in srgb, var(--color-accent) 50%, transparent)",
                        background: hasVoted
                          ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
                          : "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                        color: hasVoted ? "var(--color-success)" : "var(--color-accent)",
                        fontWeight: 700,
                        fontSize: "0.9375rem",
                        cursor: hasVoted ? "default" : "pointer",
                        transition: "all 150ms",
                      }}
                    >
                      {hasVoted ? "✓ Vote Recorded" : "🏆 Vote for People's Choice"}
                    </button>
                    {resultsVisible && displayVotes !== null && (
                      <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--color-subtle)", marginTop: "0.375rem" }}>
                        {displayVotes} vote{displayVotes !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                )}

                {/* Show vote count when voting closed but results visible */}
                {!votingOpen && resultsVisible && displayVotes !== null && (
                  <div style={{ marginTop: "0.625rem", textAlign: "center", fontSize: "0.8125rem", color: "var(--color-muted)", fontWeight: 500 }}>
                    🏆 {displayVotes} People&apos;s Choice vote{displayVotes !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        submissions.length === 0
          ? <ParticipantEmptyState title="Projects will appear here" description="As teams submit their work, this gallery will become the place to explore what they built." action={{ href: "/start", label: "Start a project" }} />
          : <ParticipantEmptyState title="No projects in this category yet" description="Try another category to keep exploring the event gallery." action={{ href: "/projects", label: "View all projects", primary: false }} />
      )}

      {/* Voting modal */}
      {modalSubmission && (
        <VoteModal
          submission={modalSubmission}
          identityMethod={identityMethod}
          onClose={() => setModalSubmission(null)}
          onSuccess={handleVoteSuccess}
        />
      )}
      <ShortcutHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
