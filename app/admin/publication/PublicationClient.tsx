"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PublicationData, PublicationMode } from "@/lib/publication";

const statusLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const tone = (value: string) =>
  value === "published" || value === "archived" || value === "released"
    ? "success"
    : value === "approved" || value === "reviewed"
      ? "warning"
      : "muted";

export default function PublicationClient({
  data,
}: {
  data: PublicationData | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [viewFilter, setViewFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState(
    data?.release.publicationMode ?? "awards_only",
  );
  const [showScores, setShowScores] = useState(
    data?.release.showScores ?? true,
  );
  const [summary, setSummary] = useState(data?.rows[0]?.feedbackPreview ?? "");
  const [comment, setComment] = useState("");
  const [customAwardLabel, setCustomAwardLabel] = useState("");
  const [announcement, setAnnouncement] = useState(
    data?.announcement?.markdown ?? "",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const operate = (payload: Record<string, unknown>) => {
    if (
      payload.operation === "publish" ||
      payload.operation === "withdraw" ||
      payload.operation === "archive"
    ) {
      const label =
        payload.operation === "publish"
          ? "publish these participant-facing results"
          : payload.operation === "withdraw"
            ? "withdraw the current participant-facing results"
            : "archive this publication";
      if (!window.confirm(`Confirm: ${label}? This action is audited.`)) return;
    }
    if (
      payload.operation === "update_mode" &&
      (data?.release.status === "published" ||
        data?.release.status === "archived")
    ) {
      if (
        !window.confirm(
          "This changes the participant-visible payload and creates a new publication revision. Continue?",
        )
      )
        return;
      payload = {
        ...payload,
        confirmRevision: true,
        reason: "Administrator confirmed a new publication revision.",
      };
    }
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/admin/publication", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof result.error === "string"
            ? result.error
            : "The publication operation could not be completed.",
        );
        return;
      }
      router.refresh();
    });
  };
  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter((row) => {
        const matchesQuery =
          !query ||
          `${row.projectTitle} ${row.teamName} ${row.institution} ${row.submissionId} ${row.awards.map((award) => award.label).join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase());
        const matchesFilter =
          viewFilter === "all" ||
          (viewFilter === "published" && row.published) ||
          (viewFilter === "award" && row.awards.length > 0) ||
          (viewFilter === "finalist" && row.finalist) ||
          (viewFilter === "feedback" && row.feedbackStatus === "released") ||
          (viewFilter === "pending" && !row.published);
        return matchesQuery && matchesFilter;
      }),
    [data?.rows, query, viewFilter],
  );
  const selected =
    data?.rows.find((row) => row.submissionId === selectedId) ??
    rows[0] ??
    null;
  const qualificationSubmissionId =
    selected?.submissionId ?? rows[0]?.submissionId;
  const filterControl = (
    <label className="publication-filter-control">
      Filter results
      <select
        aria-label="Filter publication results"
        value={viewFilter}
        onChange={(event) => setViewFilter(event.target.value)}
      >
        <option value="all">All projects</option>
        <option value="published">Published</option>
        <option value="award">Award winner</option>
        <option value="finalist">Finalist</option>
        <option value="feedback">Feedback released</option>
        <option value="pending">Pending publication</option>
      </select>
    </label>
  );
  if (!data)
    return (
      <section className="publication-empty">
        <h1>Publication</h1>
        <p>No active event is configured.</p>
      </section>
    );
  return (
    <>
      {filterControl}
      <header className="publication-header">
        <div>
          <p className="eyebrow">Awards · feedback · release control</p>
          <h1>Publication</h1>
          <p>
            Make the final audience visible only when the organizer is ready.
            Every release is explicit and audited.
          </p>
        </div>
        <div className="publication-header-actions">
          <Link
            className="publication-button secondary"
            href="/api/admin/publication/export?format=csv"
          >
            Winners CSV
          </Link>
          <Link
            className="publication-button secondary"
            href="/api/admin/publication/export?format=json"
          >
            Results JSON
          </Link>
        </div>
      </header>
      <section className="publication-metrics" aria-label="Publication summary">
        {[
          ["Submissions", data.summary.submissions],
          ["Published", data.summary.published],
          ["Unpublished", data.summary.unpublished],
          ["Finalists", data.summary.finalists],
          ["Awards", data.summary.awards],
          ["Feedback released", data.summary.feedbackReleased],
          ["Pending review", data.summary.pendingReview],
          ["Ready to publish", data.summary.readyToPublish ? "Yes" : "No"],
        ].map(([name, value]) => (
          <div className="publication-metric" key={String(name)}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <section className="publication-lifecycle">
        <div>
          <p className="eyebrow">Release state</p>
          <h2>{statusLabel(data.release.status)}</h2>
          <p>
            Calculated → Reviewed → Approved → Published → Archived. Nothing
            becomes public before Published.
          </p>
        </div>
        <span className={`publication-chip ${tone(data.release.status)}`}>
          {statusLabel(data.release.status)}
        </span>
        <div className="publication-lifecycle-actions">
          {data.release.status === "calculated" && (
            <button
              className="publication-button"
              disabled={pending}
              onClick={() =>
                operate({
                  operation: "review",
                  ...(qualificationSubmissionId
                    ? { submissionId: qualificationSubmissionId }
                    : {}),
                })
              }
            >
              Mark reviewed
            </button>
          )}
          {data.release.status === "reviewed" && (
            <button
              className="publication-button"
              disabled={pending}
              onClick={() =>
                operate({
                  operation: "approve",
                  ...(qualificationSubmissionId
                    ? { submissionId: qualificationSubmissionId }
                    : {}),
                })
              }
            >
              Approve publication
            </button>
          )}
          {data.release.status === "approved" && (
            <button
              className="publication-button"
              disabled={pending}
              onClick={() =>
                operate({
                  operation: "publish",
                  ...(qualificationSubmissionId
                    ? { submissionId: qualificationSubmissionId }
                    : {}),
                })
              }
            >
              Publish results
            </button>
          )}
          {data.release.status === "published" && (
            <button
              className="publication-button secondary"
              disabled={pending}
              onClick={() =>
                operate({
                  operation: "archive",
                  ...(qualificationSubmissionId
                    ? { submissionId: qualificationSubmissionId }
                    : {}),
                })
              }
            >
              Archive release
            </button>
          )}
          {(data.release.status === "published" ||
            data.release.status === "archived") && (
            <button
              className="publication-button danger"
              disabled={pending}
              onClick={() =>
                operate({
                  operation: "withdraw",
                  ...(qualificationSubmissionId
                    ? { submissionId: qualificationSubmissionId }
                    : {}),
                })
              }
            >
              Withdraw publication
            </button>
          )}
        </div>
      </section>
      {error && (
        <p className="publication-error" role="alert">
          {error}
        </p>
      )}
      <section className="publication-settings">
        <div>
          <p className="eyebrow">Visibility options</p>
          <h2>Choose what participants receive</h2>
          <p>Private judge notes and internal discussion are never released.</p>
        </div>
        <div className="publication-setting-controls">
          <label>
            Publication mode
            <select
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as PublicationMode)
              }
            >
              <option value="awards_only">Publish awards only</option>
              <option value="awards_feedback">Publish awards + feedback</option>
              <option value="feedback_later">Publish feedback later</option>
              <option value="everything">Publish everything</option>
            </select>
          </label>
          <label className="publication-check">
            <input
              type="checkbox"
              checked={showScores}
              onChange={(event) => setShowScores(event.target.checked)}
            />{" "}
            Show overall and criterion averages
          </label>
          <button
            className="publication-button compact"
            disabled={pending}
            onClick={() =>
              operate({
                operation: "update_mode",
                publicationMode: mode,
                showScores,
                ...(qualificationSubmissionId
                  ? { submissionId: qualificationSubmissionId }
                  : {}),
              })
            }
          >
            Save options
          </button>
        </div>
      </section>
      <section className="publication-workspace">
        <div className="publication-section">
          <div className="publication-section-heading">
            <div>
              <p className="eyebrow">Awards and feedback</p>
              <h2>Participant outcomes</h2>
            </div>
            <label className="publication-search">
              <span className="sr-only">Search projects</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search project, team, institution, ID"
              />
            </label>
          </div>
          <div className="publication-table-wrap">
            <table className="publication-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Rank</th>
                  <th>Score</th>
                  <th>Awards</th>
                  <th>Feedback</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.submissionId}
                    className={
                      selected?.submissionId === row.submissionId
                        ? "is-selected"
                        : ""
                    }
                  >
                    <td data-label="Project">
                      <button
                        className="publication-row-button"
                        onClick={() => {
                          setSelectedId(row.submissionId);
                          setSummary(row.feedbackPreview ?? "");
                        }}
                      >
                        <strong>{row.projectTitle}</strong>
                        <small>
                          {row.teamName} · {row.institution}
                        </small>
                      </button>
                    </td>
                    <td data-label="Rank">{row.rank ?? "—"}</td>
                    <td data-label="Score">{row.score ?? "—"}</td>
                    <td data-label="Awards">
                      {row.awards.length
                        ? row.awards.map((award) => (
                            <span
                              className="publication-chip success"
                              key={award.id}
                            >
                              {award.label}
                            </span>
                          ))
                        : "—"}
                    </td>
                    <td data-label="Feedback">
                      <span
                        className={`publication-chip ${tone(row.feedbackStatus)}`}
                      >
                        {statusLabel(row.feedbackStatus)}
                      </span>
                    </td>
                    <td data-label="Preview">
                      <Link
                        className="publication-button compact secondary"
                        href={`/admin/publication/preview/${encodeURIComponent(row.submissionId)}`}
                      >
                        Preview
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="publication-empty-inline">
                No projects match this view.
              </p>
            )}
          </div>
        </div>
        <aside
          className="publication-inspector"
          aria-label="Publication inspector"
        >
          {selected ? (
            <>
              <p className="eyebrow">Selected project</p>
              <h2>{selected.projectTitle}</h2>
              <p>
                {selected.teamName} · {selected.institution}
              </p>
              <div className="publication-inspector-block">
                <span className="publication-label">Assign award</span>
                <div className="publication-inline-form">
                  <select
                    id="award-category"
                    defaultValue="grand_prize"
                    aria-label="Award category"
                  >
                    <option value="grand_prize">Grand Prize</option>
                    <option value="runner_up">Runner-up</option>
                    <option value="honorable_mention">Honorable Mention</option>
                    <option value="innovation">Innovation Award</option>
                    <option value="clinical_impact">
                      Clinical Impact Award
                    </option>
                    <option value="technical_excellence">
                      Technical Excellence
                    </option>
                    <option value="peoples_choice">People&apos;s Choice</option>
                    <option value="custom">Custom</option>
                  </select>
                  <input
                    aria-label="Custom award label"
                    value={customAwardLabel}
                    onChange={(event) =>
                      setCustomAwardLabel(event.target.value)
                    }
                    placeholder="Custom label (optional)"
                  />
                  <button
                    className="publication-button compact"
                    disabled={pending}
                    onClick={() =>
                      operate({
                        operation: "assign_award",
                        submissionId: selected.submissionId,
                        category:
                          (
                            document.getElementById(
                              "award-category",
                            ) as HTMLSelectElement
                          )?.value ?? "grand_prize",
                        label: customAwardLabel,
                      })
                    }
                  >
                    Assign
                  </button>
                </div>
              </div>
              <div className="publication-award-list">
                {selected.awards.map((award) => (
                  <div key={award.id}>
                    <span>{award.label}</span>
                    <button
                      className="publication-link-button"
                      disabled={pending}
                      onClick={() =>
                        operate({
                          operation: "remove_award",
                          awardId: award.id,
                          submissionId: selected.submissionId,
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="publication-inspector-block">
                <label className="publication-label" htmlFor="feedback-summary">
                  Administrator summary
                </label>
                <textarea
                  id="feedback-summary"
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="Optional strengths and opportunities…"
                  rows={4}
                />
                <button
                  className="publication-button compact"
                  disabled={pending}
                  onClick={() =>
                    operate({
                      operation: "save_feedback",
                      submissionId: selected.submissionId,
                      summary,
                    })
                  }
                >
                  Save summary
                </button>
              </div>
              <div className="publication-inspector-block">
                <label className="publication-label" htmlFor="feedback-comment">
                  Releasable comment
                </label>
                <textarea
                  id="feedback-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="A participant-safe comment…"
                  rows={3}
                />
                <button
                  className="publication-button compact"
                  disabled={pending || comment.trim().length < 3}
                  onClick={() => {
                    operate({
                      operation: "add_feedback_comment",
                      submissionId: selected.submissionId,
                      comment,
                    });
                    setComment("");
                  }}
                >
                  Add comment
                </button>
                <button
                  className="publication-button compact secondary"
                  disabled={pending || selected.feedbackStatus === "released"}
                  onClick={() =>
                    operate({
                      operation: "set_feedback_status",
                      submissionId: selected.submissionId,
                      status: "released",
                    })
                  }
                >
                  Release feedback
                </button>
              </div>
            </>
          ) : (
            <p className="publication-muted">
              Select a project to prepare its participant-facing result.
            </p>
          )}
        </aside>
      </section>
      <section className="publication-announcement">
        <div>
          <p className="eyebrow">Announcement</p>
          <h2>Give the release a human voice</h2>
          <p>
            Markdown is stored as text and rendered safely as paragraphs for
            participants.
          </p>
        </div>
        <textarea
          value={announcement}
          onChange={(event) => setAnnouncement(event.target.value)}
          rows={5}
          placeholder="Congratulations to every team…"
        />
        <div className="publication-action-row">
          <button
            className="publication-button compact"
            disabled={pending}
            onClick={() =>
              operate({
                operation: "save_announcement",
                markdown: announcement,
                ...(qualificationSubmissionId
                  ? { submissionId: qualificationSubmissionId }
                  : {}),
              })
            }
          >
            Save announcement
          </button>
          <button
            className="publication-button compact secondary"
            disabled={pending || !announcement.trim()}
            onClick={() =>
              operate({
                operation: "set_announcement_status",
                status: "published",
                ...(qualificationSubmissionId
                  ? { submissionId: qualificationSubmissionId }
                  : {}),
              })
            }
          >
            Publish announcement
          </button>
        </div>
      </section>
    </>
  );
}
