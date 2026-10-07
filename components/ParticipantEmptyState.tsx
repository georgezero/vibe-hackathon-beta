import Link from "next/link";

type EmptyAction = { href: string; label: string; primary?: boolean };

/**
 * A small, semantic primitive for participant-facing empty data states.
 * Unavailable, denied, closed, and error states intentionally remain bespoke.
 */
export function ParticipantEmptyState({
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
  className = "",
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: EmptyAction;
  secondaryAction?: EmptyAction;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section className={`participant-empty-state${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}>
      {eyebrow && <p className="participant-empty-state-eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      <p>{description}</p>
      {(action || secondaryAction) && (
        <div className="participant-empty-state-actions">
          {action && <Link className={action.primary === false ? "btn-secondary" : "btn-primary"} href={action.href}>{action.label}</Link>}
          {secondaryAction && <Link className={secondaryAction.primary ? "btn-primary" : "btn-secondary"} href={secondaryAction.href}>{secondaryAction.label}</Link>}
        </div>
      )}
    </section>
  );
}
