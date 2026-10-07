export function AuthenticationIntro({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="text-center mb-8">
      <div
        aria-hidden="true"
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 1.25rem",
          color: "var(--color-accent)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M7 10V8a5 5 0 0110 0v2M6 10h12v10H6z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="15" r="1.25" fill="currentColor" />
        </svg>
      </div>
      <h1
        style={{
          fontFamily: "var(--font-headline)",
          fontSize: "1.75rem",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--color-fg)",
          marginBottom: "0.5rem",
        }}
      >
        {title}
      </h1>
      <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.6 }}>
        {description}
      </p>
    </div>
  );
}
