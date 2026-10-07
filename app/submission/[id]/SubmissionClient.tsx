"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  submissionId: string;
  initialVotes: number;
  votingOpen: boolean;
  votingStatus: string;
  resultsVisible: boolean;
}

export default function SubmissionClient({ submissionId, initialVotes, votingOpen, votingStatus, resultsVisible }: Props) {
  const [voted, setVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(initialVotes);
  const fingerprintRef = useRef<string>("");

  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      const stored = sessionStorage.getItem("vf");
      if (stored) {
        fingerprintRef.current = stored;
      } else {
        const f = Math.random().toString(36).slice(2);
        sessionStorage.setItem("vf", f);
        fingerprintRef.current = f;
      }
    }
  }, []);

  async function handleVote() {
    if (voted) return;
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, fingerprint: fingerprintRef.current }),
    });
    const data = await res.json();
    if (data.success) {
      setVoted(true);
      setVoteCount(data.totalVotes);
    } else if (data.alreadyVoted) {
      setVoted(true);
    }
  }

  return (
    <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-headline)", fontSize: "2.5rem", fontWeight: 700, color: "var(--color-fg)", lineHeight: 1 }}>
        {resultsVisible ? voteCount : "—"}
      </div>
      <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)", margin: "0.375rem 0 1rem" }}>
        audience votes
      </div>
      <button
        onClick={handleVote}
        disabled={voted || !votingOpen}
        className={voted ? "btn-secondary" : "btn-primary"}
        style={{ width: "100%", justifyContent: "center" }}
      >
        {!votingOpen ? votingStatus : voted ? "✓ Voted" : "▲ Vote for People's Choice"}
      </button>
    </div>
  );
}
