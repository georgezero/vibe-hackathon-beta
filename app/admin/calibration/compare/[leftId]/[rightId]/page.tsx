import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { requireAdminSession } from "@/lib/admin-session";
import { getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getCalibrationSubmissionDetail } from "@/lib/calibration";

export const dynamic = "force-dynamic";

export default async function CalibrationComparePage({ params }: { params: Promise<{ leftId: string; rightId: string }> }) {
  await requireAdminSession();
  const { leftId, rightId } = await params;
  const [event, branding] = await Promise.all([getActiveEvent(), getEventBranding()]);
  const [left, right] = event ? await Promise.all([getCalibrationSubmissionDetail(event.id, decodeURIComponent(leftId)), getCalibrationSubmissionDetail(event.id, decodeURIComponent(rightId))]) : [null, null];
  if (!left || !right) notFound();
  return <div className="min-h-screen"><Nav variant="admin" eventName={branding.eventName} eventLogoUrl={branding.logoUrl} /><main className="calibration-page"><header className="calibration-detail-header"><div><Link className="calibration-back" href="/admin/calibration">← Calibration</Link><p className="eyebrow">Side-by-side review</p><h1>Compare projects</h1><p>Informational comparison only. Scores remain unchanged.</p></div></header><section className="calibration-compare-grid">{[left, right].map((item) => <article className="calibration-detail-card" key={item.row.submissionId}><p className="eyebrow">Project</p><h2>{item.project.title}</h2><p>{item.project.team}</p><div className="calibration-detail-stats"><div><span>Rank</span><strong>{item.row.rank ?? "—"}</strong></div><div><span>Average</span><strong>{item.row.average ?? "—"}</strong></div><div><span>Variance</span><strong>{item.row.variance ?? "—"}</strong></div></div></article>)}</section><section className="calibration-section"><div className="calibration-section-heading"><div><p className="eyebrow">Criterion comparison</p><h2>Panel averages</h2></div></div><div className="calibration-table-wrap"><table className="calibration-table"><thead><tr><th>Criterion</th><th>{left.project.title}</th><th>{right.project.title}</th></tr></thead><tbody>{left.criterionBreakdown.map((criterion, index) => <tr key={criterion.key}><td>{criterion.label}</td><td>{criterion.average ?? "—"}</td><td>{right.criterionBreakdown[index]?.average ?? "—"}</td></tr>)}</tbody></table></div></section></main></div>;
}
