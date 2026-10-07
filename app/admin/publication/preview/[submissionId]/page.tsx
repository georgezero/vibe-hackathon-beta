import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { requireAdminSession } from "@/lib/admin-session";
import { getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { buildParticipantPublicationProjection, getPublicationDetail } from "@/lib/publication";

export const dynamic = "force-dynamic";

function safeParagraphs(markdown: string | null | undefined) { return (markdown ?? "").split(/\n{2,}/).map((paragraph) => paragraph.replaceAll(/<[^>]*>/g, "").trim()).filter(Boolean); }

export default async function PublicationPreviewPage({ params }: { params: Promise<{ submissionId: string }> }) {
  await requireAdminSession();
  const { submissionId } = await params;
  const [event, branding] = await Promise.all([getActiveEvent(), getEventBranding()]);
  const detail = event ? await getPublicationDetail(event.id, decodeURIComponent(submissionId)) : null;
  if (!detail) notFound();
  const projection = buildParticipantPublicationProjection(detail);
  if (!projection) notFound();
  const announcement = safeParagraphs(projection.announcement);
  const isPublished = projection.status !== "pending";
  return <div className="min-h-screen"><Nav variant="admin" eventName={branding.eventName} eventLogoUrl={branding.logoUrl} /><main className="publication-preview-page"><Link className="publication-back" href="/admin/publication">← Publication</Link><div className="publication-preview-banner"><span className="publication-chip warning">Participant preview</span><p>This is exactly the participant-visible shape. Private notes, judge identities, consensus, and audit history are intentionally absent.</p></div><header><p className="eyebrow">{projection.project.team}</p><h1>{projection.project.title}</h1><p>{projection.project.institution}</p></header>{projection.status === "pending" && <section className="publication-preview-card"><p className="eyebrow">Pending</p><h2>Results are not available yet</h2><p className="publication-muted">The participant sees only the pending state until publication.</p></section>}{isPublished && projection.awards.length > 0 && <section className="publication-celebration"><p className="eyebrow">Recognition</p><div className="publication-award-pills">{projection.awards.map((award) => <span className="publication-chip success" key={award.id}>{award.label}</span>)}</div>{projection.finalist && <span className="publication-chip warning">Finalist</span>}</section>}{isPublished && projection.score !== null && <section className="publication-preview-card"><span className="publication-label">Overall score</span><strong>{projection.score}/100</strong><p>Shown according to the current publication options.</p></section>}{isPublished && projection.criteria.length > 0 && <section className="publication-preview-card"><p className="eyebrow">Criterion averages</p><div className="publication-criteria-grid">{projection.criteria.map((criterion) => <div key={criterion.key}><span>{criterion.label}</span><strong>{criterion.average ?? "—"}</strong></div>)}</div></section>}{isPublished && projection.feedback && <section className="publication-preview-card"><p className="eyebrow">Feedback from the judging panel</p>{projection.feedback.summary && <p className="publication-feedback-copy">{projection.feedback.summary}</p>}{projection.feedback.comments.map((comment) => <blockquote key={comment}>{comment}</blockquote>)}</section>}<section className="publication-preview-card"><p className="eyebrow">Announcement</p>{announcement.length > 0 ? announcement.map((paragraph) => <p className="publication-feedback-copy" key={paragraph}>{paragraph}</p>) : <p className="publication-muted">The event announcement appears here after it is published.</p>}</section></main></div>;
}
