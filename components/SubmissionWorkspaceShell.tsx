import Link from "next/link";
import { NavPublic } from "@/components/NavPublic";
import { workspaceRoleLabel, type WorkspaceContext } from "@/lib/submission-workspace";
import type { ApplicationPrincipal } from "@/lib/application-principal";
import ParticipantFeedback from "@/components/ParticipantFeedback";
import ParticipantJourneyTracker from "@/components/ParticipantJourneyTracker";

export type WorkspaceTab = "overview" | "team" | "messages" | "activity" | "preview" | "status" | "submission" | "results" | "evaluation";

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "team", label: "Team" },
  { id: "messages", label: "Team Chat" },
  { id: "preview", label: "Preview" },
  { id: "submission", label: "Submit" },
  { id: "activity", label: "Activity" },
  { id: "results", label: "Results" },
];

const judgeTabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "preview", label: "Preview" },
  { id: "submission", label: "Submission" },
  { id: "evaluation", label: "Evaluation" },
];

export function SubmissionWorkspaceShell({ context, principal, currentTab, children, viewer = "participant", basePath }: { context: WorkspaceContext; principal: ApplicationPrincipal; currentTab: WorkspaceTab; children: React.ReactNode; viewer?: "participant" | "judge"; basePath?: string }) {
  const { submission, membership } = context;
  const title = submission.projectTitle || submission.teamName;
  const workspaceBasePath = basePath ?? `/projects/${encodeURIComponent(submission.id)}`;
  const visibleTabs = viewer === "judge" ? judgeTabs : tabs;
  const roleLabel = viewer === "judge" ? "Judge" : workspaceRoleLabel(membership.role);
  const journeyEvent = currentTab === "overview"
    ? "participant_project_opened"
    : currentTab === "preview"
      ? "participant_preview_viewed"
      : currentTab === "team"
        ? "participant_project_opened"
        : currentTab === "messages"
          ? "participant_team_chat_opened"
          : "participant_editor_viewed";
  const journeyContext = currentTab === "preview" ? "preview" : currentTab === "team" ? "team" : currentTab === "messages" ? "team_chat" : currentTab === "submission" ? "editor" : "workspace";
  const journeyDestination = currentTab === "messages" ? "team_chat" : currentTab === "submission" ? "submit" : currentTab === "preview" ? "preview" : currentTab === "team" ? "team" : currentTab === "status" ? "status" : currentTab === "results" ? "results" : "workspace";
  return <div className="min-h-screen">
    {viewer === "participant" && <ParticipantJourneyTracker eventType={journeyEvent} context={journeyContext} destination={journeyDestination} />}
    <NavPublic workspaceContext authenticatedAccount={{ displayName: principal.user.name?.trim() || principal.user.email, roles: principal.roles }} />
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href={viewer === "judge" ? "/judge/dashboard" : "/account/projects"} className="btn-ghost" style={{ paddingLeft: 0 }}>{viewer === "judge" ? "← Assigned projects" : "← My Projects"}</Link>
      <header className="workspace-shell-header">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${submission.status === "draft" ? "badge-warning" : "badge-success"}`}>{submission.status === "draft" ? "Draft" : "Submitted"}</span>
          <span className="badge badge-default">{roleLabel}</span>
          <span className="badge badge-default">{context.eventName}</span>
        </div>
        <h1 className="workspace-shell-title">{title}</h1>
        <p className="workspace-shell-copy">{submission.teamName} <span aria-hidden="true">·</span> {context.readiness.completionPercent}% ready</p>
      </header>
      <div className="workspace-tabs-frame">
        <nav aria-label="Project workspace sections" aria-describedby="workspace-tabs-help" className="workspace-tabs">
          <div className="workspace-tabs-list">
          {visibleTabs.map((tab) => <Link key={tab.id} href={`${workspaceBasePath}${tab.id === "overview" ? "" : `/${tab.id}`}`} aria-current={currentTab === tab.id ? "page" : undefined} className={currentTab === tab.id ? "workspace-tab is-active" : "workspace-tab"}>{tab.label}</Link>)}
          </div>
        </nav>
        <span id="workspace-tabs-help" className="workspace-tabs-help">Swipe for more project sections</span>
      </div>
      {children}
      {viewer === "participant" && <ParticipantFeedback context="workspace" />}
    </main>
  </div>;
}

export function WorkspaceStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" }) {
  const className = tone === "success" ? "badge-success" : tone === "warning" ? "badge-warning" : "badge-default";
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", padding: "0.75rem 0", borderBottom: "1px solid var(--color-border)" }}><span style={{ color: "var(--color-muted)", fontSize: "0.86rem" }}>{label}</span><span className={`badge ${className}`}>{value}</span></div>;
}
