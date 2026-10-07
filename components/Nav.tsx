"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeSelector } from "./ThemeSelector";
import type { AuthenticatedAccountDisplay } from "@/lib/application-account-display";

interface NavProps {
  variant?: "public" | "judge" | "admin";
  /** Display name for the current event, e.g. "RSNA 2026" */
  eventName?: string | null;
  /** Remote logo URL for the current event */
  eventLogoUrl?: string | null;
  /** Audience voting status — shows badge next to the Projects nav item */
  galleryVotingStatus?: "open" | "closed" | null;
  /** Sanitized interactive identity context for the global account control. */
  authenticatedAccount?: AuthenticatedAccountDisplay | null;
  directMessagesUnreadCount?: number;
  communityUnreadCount?: number;
  /** Presentation-only projection of the server-authoritative Community eligibility. */
  communityAvailable?: boolean;
  /** Server-authoritative event state used only to show useful actions. */
  submissionsOpen?: boolean;
  /** D.4 publication release state, never the legacy event compatibility field. */
  resultsPublished?: boolean;
  /** Gives the global shell a quieter treatment inside a project workspace. */
  workspaceContext?: boolean;
}

export function Nav({
  variant = "public",
  eventName,
  eventLogoUrl,
  galleryVotingStatus,
  authenticatedAccount,
  directMessagesUnreadCount = 0,
  communityUnreadCount = 0,
  communityAvailable = false,
  submissionsOpen = true,
  resultsPublished = false,
  workspaceContext = false,
}: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const showJudgeNavigation = authenticatedAccount?.roles?.isJudge === true;
  const showAdminNavigation = authenticatedAccount?.roles?.isAdmin === true;

  const closeMobile = () => setMobileOpen(false);

  const navLinks =
    variant === "public" ? (
      <>
        {authenticatedAccount && <NavLink href="/account/projects" pathname={pathname} onClick={closeMobile} tone="primary">My Projects</NavLink>}
        <NavLink href="/projects" pathname={pathname} onClick={closeMobile}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            Projects
            {galleryVotingStatus && (
              <span style={{
                fontSize: "0.5625rem",
                fontWeight: 700,
                padding: "0.2rem 0.45rem",
                borderRadius: 999,
                background: galleryVotingStatus === "open"
                  ? "color-mix(in srgb, var(--color-success) 22%, transparent)"
                  : "var(--color-surface-2)",
                color: galleryVotingStatus === "open" ? "var(--color-success)" : "var(--color-subtle)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}>
                {galleryVotingStatus === "open" ? "Voting Open" : "Voting Closed"}
              </span>
            )}
          </span>
        </NavLink>
        {authenticatedAccount && communityAvailable && <NavLink href="/community" pathname={pathname} onClick={closeMobile}><UnreadLabel label="Community" count={communityUnreadCount} kind="community" /></NavLink>}
        {authenticatedAccount && <NavLink href="/messages" pathname={pathname} onClick={closeMobile} tone="secondary"><UnreadLabel label="Messages" count={directMessagesUnreadCount} kind="message" /></NavLink>}
        <ExploreMenu
          pathname={pathname}
          authenticated={Boolean(authenticatedAccount)}
          resultsPublished={resultsPublished}
          onNavigate={closeMobile}
        />
        {submissionsOpen && <NavLink href="/start" pathname={pathname} onClick={closeMobile} emphasis>Start a project</NavLink>}
        {showJudgeNavigation && <NavLink href="/judge/dashboard" pathname={pathname} onClick={closeMobile}>Judge</NavLink>}
        {showAdminNavigation && <NavLink href="/admin/dashboard" pathname={pathname} onClick={closeMobile}>Admin</NavLink>}
        {!authenticatedAccount && <NavLink href="/login" pathname={pathname} onClick={closeMobile}>Log in</NavLink>}
      </>
    ) : variant === "judge" ? (
      <>
        <NavLink href="/judge/dashboard" pathname={pathname} onClick={closeMobile}>Assignments</NavLink>
        {showAdminNavigation && authenticatedAccount?.roles && (
          <NavLink href="/admin/dashboard" pathname={pathname} onClick={closeMobile}>Admin</NavLink>
        )}
      </>
    ) : variant === "admin" ? (
      <>
        <NavLink href="/admin/dashboard" pathname={pathname} exact onClick={closeMobile}>Admin</NavLink>
        <NavLink href="/admin/dashboard" pathname={pathname} onClick={closeMobile}>Dashboard</NavLink>
        <NavLink href="/admin/participant-experience" pathname={pathname} onClick={closeMobile}>Participant Experience</NavLink>
        <NavLink href="/admin/dashboard/submissions" pathname={pathname} onClick={closeMobile}>Projects</NavLink>
        <NavLink href="/admin/people" pathname={pathname} onClick={closeMobile}>People</NavLink>
        <NavLink href="/admin/community" pathname={pathname} onClick={closeMobile}>Community</NavLink>
        <NavLink href="/admin/judging" pathname={pathname} onClick={closeMobile}>Judging</NavLink>
        <NavLink href="/admin/results" pathname={pathname} onClick={closeMobile}>Results</NavLink>
        <NavLink href="/admin/calibration" pathname={pathname} onClick={closeMobile}>Calibration</NavLink>
        <NavLink href="/admin/publication" pathname={pathname} onClick={closeMobile}>Publication</NavLink>
        <NavLink href="/admin/dashboard/event-settings" pathname={pathname} onClick={closeMobile}>Settings</NavLink>
        {showJudgeNavigation && authenticatedAccount?.roles && (
          <NavLink href="/judge/dashboard" pathname={pathname} onClick={closeMobile}>Judge</NavLink>
        )}
      </>
    ) : null;

  return (
    <>
      <header
        className={`site-nav${workspaceContext ? " is-workspace-context" : ""}`}
        data-nav-scope={workspaceContext ? "project-workspace" : variant}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: "color-mix(in srgb, var(--color-bg) 88%, transparent)",
          borderBottom: "1px solid color-mix(in srgb, var(--color-border) 35%, transparent)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 flex h-14 items-center justify-between gap-3">
          {/* Left: platform brand + optional event identity */}
          <div className="flex items-center gap-0 shrink-0 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 shrink-0"
              style={{ textDecoration: "none" }}
            >
              <VibeIcon />
              <span
                style={{
                  fontFamily: "var(--font-headline)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--color-fg)",
                  letterSpacing: "-0.02em",
                }}
              >
                Vibe<span style={{ color: "var(--color-accent)" }}>.</span> Hackathon
              </span>
            </Link>

            {eventLogoUrl && (
              <div className="flex items-center gap-2" style={{ marginLeft: "0.75rem" }}>
                <div style={{ width: 1, height: 18, background: "var(--color-border)", flexShrink: 0 }} />
                <img
                  src={eventLogoUrl}
                  alt={eventName ?? "Event"}
                  style={{ height: 28, maxWidth: 80, objectFit: "contain", display: "block", flexShrink: 0 }}
                />
              </div>
            )}
          </div>

          {/* Right: desktop nav + theme selector + mobile hamburger */}
          <div className="flex items-center gap-1 shrink-0">
            <nav className="hidden xl:flex items-center gap-1" aria-label="Primary navigation">
              {navLinks}
            </nav>
            {authenticatedAccount && (
              <AccountMenu account={authenticatedAccount} />
            )}
            <ThemeSelector />
            <button
              className="flex xl:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--color-muted)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {mobileOpen ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <nav
            className="block xl:hidden border-t flex flex-col px-4 py-2"
            aria-label="Mobile navigation"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            {navLinks}
            {authenticatedAccount && (
              <div
                className="lg:hidden"
                data-testid="mobile-authenticated-account-control"
                style={{
                  borderTop: "1px solid var(--color-border)",
                  marginTop: "0.4rem",
                  paddingTop: "0.65rem",
                }}
              >
                <div className="flex items-center gap-2" style={{ marginBottom: "0.35rem" }}>
                  <AccountAvatar displayName={authenticatedAccount.displayName} />
                  <div style={{ color: "var(--color-fg)", fontSize: "0.875rem", fontWeight: 800 }}>
                    {authenticatedAccount.displayName}
                  </div>
                </div>
                <Link href="/account/profile" className="btn-ghost" onClick={closeMobile} style={{ minHeight: 44, width: "100%" }}>
                  <AccountGlyph />
                  Profile
                </Link>
                <Link href="/account" className="btn-ghost" onClick={closeMobile} style={{ minHeight: 44, width: "100%" }}>
                  <AccountGlyph />
                  Account
                </Link>
                {authenticatedAccount.roles?.isAdmin && (
                  <Link href="/admin/people" className="btn-ghost" onClick={closeMobile} style={{ minHeight: 44, width: "100%" }}>
                    <PeopleGlyph />
                    People &amp; Access
                  </Link>
                )}
                <form action="/logout" method="post">
                  <button
                    type="submit"
                    className="btn-ghost"
                    style={{ minHeight: 44, width: "100%", textAlign: "left" }}
                  >
                    <LogoutGlyph />
                    Log out
                  </button>
                </form>
              </div>
            )}
            {eventLogoUrl && (
              <div className="pt-2 mt-1 border-t flex items-center gap-2" style={{ borderColor: "var(--color-border)" }}>
                <img
                  src={eventLogoUrl}
                  alt={eventName ?? "Event"}
                  style={{ height: 28, maxWidth: 90, objectFit: "contain", display: "block" }}
                />
              </div>
            )}
          </nav>
        )}
      </header>

      {/* Spacer — reserves the nav's height in the document flow */}
      <div aria-hidden="true" style={{ height: "3.5rem" }} />
    </>
  );
}

function AccountMenu({
  account,
}: {
  account: AuthenticatedAccountDisplay;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="hidden lg:block"
      aria-label="Authenticated account"
      data-testid="authenticated-account-control"
      style={{
        position: "relative",
        borderLeft: "1px solid var(--color-border)",
        marginLeft: "0.25rem",
        paddingLeft: "0.65rem",
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="btn-ghost"
        aria-label={`Open account menu for ${account.displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{ minHeight: 38, maxWidth: 190, padding: "0.3rem 0.45rem" }}
      >
        <AccountAvatar displayName={account.displayName} />
        <span
          title={account.displayName}
          style={{
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--color-fg)",
            fontSize: "0.75rem",
            fontWeight: 800,
          }}
        >
          {account.displayName}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 4.5L6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account menu"
          style={{
            position: "absolute",
            top: "calc(100% + 0.5rem)",
            right: 0,
            width: 210,
            padding: "0.4rem",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            background: "var(--color-surface)",
            boxShadow: "0 14px 32px color-mix(in srgb, var(--color-bg) 62%, transparent)",
          }}
        >
          <div style={{ padding: "0.55rem 0.65rem 0.65rem", borderBottom: "1px solid var(--color-border)", marginBottom: "0.3rem" }}>
            <div style={{ color: "var(--color-fg)", fontSize: "0.78rem", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis" }}>
              {account.displayName}
            </div>
          </div>
          <Link href="/account" role="menuitem" className="btn-ghost" onClick={() => setOpen(false)} style={{ width: "100%", minHeight: 38 }}>
            <AccountGlyph />
            Account
          </Link>
          <Link href="/account/profile" role="menuitem" className="btn-ghost" onClick={() => setOpen(false)} style={{ width: "100%", minHeight: 38 }}>
            <AccountGlyph />
            Profile
          </Link>
          {account.roles?.isAdmin && (
            <Link href="/admin/people" role="menuitem" className="btn-ghost" onClick={() => setOpen(false)} style={{ width: "100%", minHeight: 38 }}>
              <PeopleGlyph />
              People &amp; Access
            </Link>
          )}
          <form action="/logout" method="post">
            <button type="submit" role="menuitem" className="btn-ghost" style={{ width: "100%", minHeight: 38 }}>
              <LogoutGlyph />
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function AccountAvatar({ displayName }: { displayName: string }) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "A";
  return (
    <span
      aria-hidden="true"
      style={{
        display: "grid",
        width: 28,
        height: 28,
        flex: "0 0 28px",
        placeItems: "center",
        borderRadius: 999,
        background: "color-mix(in srgb, var(--color-accent) 16%, var(--color-surface-2))",
        color: "var(--color-accent)",
        fontSize: "0.7rem",
        fontWeight: 850,
      }}
    >
      {initial}
    </span>
  );
}

function AccountGlyph() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" /><path d="M5.5 19c.8-3.3 3-5 6.5-5s5.7 1.7 6.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function LogoutGlyph() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 8l4 4-4 4M18 12H8M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PeopleGlyph() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" /><path d="M3.5 19c.7-3 2.5-4.5 5.5-4.5s4.8 1.5 5.5 4.5M16 7.5a2.5 2.5 0 010 5M17 15c2.1.4 3.3 1.7 3.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function NavLink({ href, children, pathname, exact, onClick, tone = "default", emphasis = false }: { href: string; children: React.ReactNode; pathname: string; exact?: boolean; onClick?: () => void; tone?: "default" | "primary" | "secondary"; emphasis?: boolean }) {
  const active = exact ? pathname === href : isActivePath(pathname, href);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`btn-ghost participant-nav-link participant-nav-link-${tone}${emphasis ? " participant-nav-link-emphasis" : ""}`}
      aria-current={active ? "page" : undefined}
      style={{
        fontSize: "0.875rem",
        padding: "0.5rem 0.75rem",
        display: "flex",
        alignItems: "center",
        color: active ? "var(--color-fg)" : undefined,
        background: active ? "color-mix(in srgb, var(--color-accent) 14%, transparent)" : undefined,
        borderColor: active ? "color-mix(in srgb, var(--color-accent) 35%, transparent)" : undefined,
      }}
    >
      {children}
    </Link>
  );
}

function UnreadLabel({ label, count, kind }: { label: string; count: number; kind: "message" | "community" }) {
  const safeCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
      {label}
      {safeCount > 0 && (
        <span
          className="nav-unread-badge"
          data-kind={kind}
          aria-label={`${safeCount} unread ${kind === "message" ? "message" : "community message"}${safeCount === 1 ? "" : "s"}`}
        >
          {safeCount > 9 ? "9+" : safeCount}
        </span>
      )}
    </span>
  );
}

function ExploreMenu({ pathname, authenticated, resultsPublished, onNavigate }: { pathname: string; authenticated: boolean; resultsPublished: boolean; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const items = [
    ...(authenticated ? [{ href: "/people", label: "People" }] : []),
    { href: "/status", label: "Status" },
    { href: "/ai-evals", label: "AI Evals" },
    ...(resultsPublished ? [{ href: "/winners", label: "Results" }] : []),
  ];
  const active = items.some((item) => isActivePath(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="participant-nav-menu">
      <button
        ref={triggerRef}
        type="button"
        className={`btn-ghost participant-nav-menu-trigger${active ? " is-active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { const next = !open; setOpen(next); if (authenticated && next) sendNavigationSignal("participant_explore_opened", "explore"); }}
      >
        Explore
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="participant-nav-menu-panel" role="menu" aria-label="Explore">
          {items.map((item) => (
            <Link key={item.href} href={item.href} role="menuitem" className="participant-nav-menu-item" aria-current={isActivePath(pathname, item.href) ? "page" : undefined} onClick={() => { setOpen(false); onNavigate(); if (authenticated) sendNavigationSignal("participant_navigation_destination_selected", item.href === "/ai-evals" ? "ai_evals" : item.href === "/winners" ? "results" : item.href.slice(1) as "status" | "people"); }}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function sendNavigationSignal(eventType: "participant_explore_opened" | "participant_navigation_destination_selected", destination: "explore" | "status" | "people" | "ai_evals" | "results") {
  void fetch("/api/participant-experience/events", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, context: "explore", source: "explore", destination, outcome: eventType === "participant_explore_opened" ? "viewed" : "success", deviceClass: window.matchMedia("(max-width: 680px)").matches ? "mobile" : "desktop" }),
    keepalive: true,
  }).catch(() => undefined);
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/admin/dashboard") return pathname === "/admin" || pathname.startsWith("/admin/");
  if (href === "/judge") return pathname === "/judge";
  if (href === "/submit") return pathname === "/submit" || pathname.startsWith("/submit/");
  if (href === "/projects") return pathname === "/projects" || pathname.startsWith("/project/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function VibeIcon() {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: "var(--color-accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
        <path
          d="M1 5 L4 5 L5.5 1 L7 9 L8.5 3 L10 5 L15 5"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
