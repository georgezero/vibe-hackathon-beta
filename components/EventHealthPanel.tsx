import Link from "next/link";
import type { EventHealthData, EventHealthDomain, EventHealthState, AttentionItem } from "@/lib/event-health";

const stateLabel: Record<EventHealthState, string> = {
  healthy: "Healthy",
  attention: "Attention needed",
  blocked: "Blocked",
  ready: "Ready to publish",
};

const stateColor: Record<EventHealthState, string> = {
  healthy: "var(--color-success)",
  attention: "var(--color-warning)",
  blocked: "var(--color-danger)",
  ready: "var(--color-accent)",
};

const severityLabel: Record<AttentionItem["severity"], string> = {
  blocker: "Blocker",
  action: "Action required",
  watch: "Watch",
};

function DomainCard({ domain }: { domain: EventHealthDomain }) {
  return (
    <article className="event-health-domain" aria-labelledby={`event-health-${domain.id}`}>
      <div className="event-health-domain-heading">
        <div>
          <h3 id={`event-health-${domain.id}`}>{domain.label}</h3>
          <p>{domain.headline}</p>
        </div>
        <span className="event-health-state" data-state={domain.state}>
          <span className="event-health-state-dot" aria-hidden="true" />
          {stateLabel[domain.state]}
        </span>
      </div>
      <p className="event-health-domain-explanation">{domain.explanation}</p>
      <div className="event-health-domain-metrics">
        {domain.metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      <Link className="event-health-link" href={domain.href}>Open {domain.label} <span aria-hidden="true">→</span></Link>
    </article>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <li className="event-health-attention-row">
      <span className="event-health-severity" data-severity={item.severity}>{severityLabel[item.severity]}</span>
      <div className="event-health-attention-copy">
        <strong>{item.title}</strong>
        <span>{item.explanation}</span>
        <small>{item.why} {item.recommendation}</small>
      </div>
      <Link className="event-health-link event-health-attention-link" href={item.href}>Open <span aria-hidden="true">→</span></Link>
    </li>
  );
}

export function EventHealthPanel({ data }: { data: EventHealthData }) {
  const { summary } = data.attention;
  return (
    <section className="event-health-panel" aria-labelledby="event-health-title">
      <div className="event-health-header">
        <div>
          <div className="event-health-title-row">
            <h2 id="event-health-title">Event Health</h2>
            <span className="event-health-overall" data-state={data.overall.state} style={{ color: stateColor[data.overall.state] }}>
              <span className="event-health-state-dot" aria-hidden="true" />
              {stateLabel[data.overall.state]}
            </span>
          </div>
          <p className="event-health-summary">{data.overall.summary}</p>
        </div>
        <div className="event-health-phase" aria-label={`Event phase: ${data.event.phaseLabel}`}>
          <span>Current phase</span>
          <strong>{data.event.phaseLabel}</strong>
          {data.event.isFrozen && <small>Event controls are frozen</small>}
        </div>
      </div>

      <div className="event-health-domains">
        {data.domains.map((domain) => <DomainCard key={domain.id} domain={domain} />)}
      </div>

      <div className="event-health-queue" aria-labelledby="event-health-queue-title">
        <div className="event-health-queue-heading">
          <div>
            <h3 id="event-health-queue-title">What should I do next?</h3>
            <p>{summary.total === 0 ? "Nothing needs intervention right now." : `${summary.total} item${summary.total === 1 ? "" : "s"} need attention.`}</p>
          </div>
          <div className="event-health-queue-counts" aria-label="Attention summary">
            <span>{summary.blockers} blocker{summary.blockers === 1 ? "" : "s"}</span>
            <span>{summary.actions} action{summary.actions === 1 ? "" : "s"}</span>
            <span>{summary.watch} watch</span>
          </div>
        </div>
        {summary.mostImportant && (
          <div className="event-health-most-important">
            <strong>Most important: {summary.mostImportant.title}</strong>
            <span>{summary.mostImportant.affected}</span>
          </div>
        )}
        {data.attention.items.length > 0 ? (
          <>
            <ul className="event-health-attention-list">{data.attention.items.slice(0, 20).map((item) => <AttentionRow key={item.id} item={item} />)}</ul>
            {data.attention.items.length > 20 && <p className="event-health-more">Showing the 20 highest-priority items. Open the specialist tools for the complete queue ({data.attention.items.length - 20} more).</p>}
          </>
        ) : (
          <div className="event-health-empty">The event is clear of actionable health conditions. Continue to monitor the specialized tools as the phase changes.</div>
        )}
      </div>
    </section>
  );
}
