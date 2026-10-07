"use client";

import { use, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { EventFreezeBannerClient } from "@/components/EventFreezeBannerClient";
import { AgentCompletionPrompt } from "@/components/AgentCompletionPrompt";
import type { PrizeEligibilitySummary } from "@/lib/prize-eligibility";
import { isHardLockedStatus, isSubmittedStatus } from "@/lib/submission-finalization";
import {
  PROJECT_EDITOR_FIELD_META,
  PROJECT_EDITOR_SECTIONS,
  getEditorSectionProgress,
  validateProjectEditorForm,
  type ProjectEditorField,
} from "@/lib/project-editor";

const AI_TOOLS_OPTIONS = [
  "Claude", "Cursor", "Codex", "GitHub Copilot", "Hermes",
  "OpenClaw", "Pi", "Aider", "Devin", "SWE-agent", "Replit AI", "Other",
];

// License * remains part of the authoritative required set; the UI presents
// that state as a consistent "Required" badge instead of punctuation-heavy labels.

type EditorForm = {
  teamName: string;
  contactEmail: string;
  projectTitle: string;
  problemStatement: string;
  targetUsers: string;
  demoUrl: string;
  demoVideoUrl: string;
  githubUrl: string;
  license: string;
  screenshotUrls: string[];
  readmeUrl: string;
  agentsMdUrl: string;
  sampleDataDescription: string;
  setupInstructions: string;
  deployInstructions: string;
  aiToolsUsed: string[];
  promptStrategyUrl: string;
  knownLimitations: string;
};

const EMPTY_FORM: EditorForm = {
  teamName: "", contactEmail: "", projectTitle: "", problemStatement: "", targetUsers: "",
  demoUrl: "", demoVideoUrl: "", githubUrl: "", license: "", screenshotUrls: [""],
  readmeUrl: "", agentsMdUrl: "", sampleDataDescription: "", setupInstructions: "",
  deployInstructions: "", aiToolsUsed: [], promptStrategyUrl: "", knownLimitations: "",
};

interface Props { params: Promise<{ token: string }> }

function formFromResponse(data: Record<string, unknown>): EditorForm {
  const screenshots = Array.isArray(data.screenshotUrls) ? data.screenshotUrls.filter((item): item is string => typeof item === "string") : [];
  return {
    teamName: String(data.teamName ?? ""),
    contactEmail: String(data.contactEmail ?? ""),
    projectTitle: String(data.projectTitle ?? ""),
    problemStatement: String(data.problemStatement ?? ""),
    targetUsers: String(data.targetUsers ?? ""),
    demoUrl: String(data.demoUrl ?? ""),
    demoVideoUrl: String(data.demoVideoUrl ?? ""),
    githubUrl: String(data.githubUrl ?? ""),
    license: String(data.license ?? ""),
    screenshotUrls: screenshots.length ? screenshots : data.screenshotUrl ? [String(data.screenshotUrl)] : [""],
    readmeUrl: String(data.readmeUrl ?? ""),
    agentsMdUrl: String(data.agentsMdUrl ?? ""),
    sampleDataDescription: String(data.sampleDataDescription ?? ""),
    setupInstructions: String(data.setupInstructions ?? ""),
    deployInstructions: String(data.deployInstructions ?? ""),
    aiToolsUsed: Array.isArray(data.aiToolsUsed) ? data.aiToolsUsed.filter((item): item is string => typeof item === "string") : [],
    promptStrategyUrl: String(data.promptStrategyUrl ?? ""),
    knownLimitations: String(data.knownLimitations ?? ""),
  };
}

export default function EditSubmissionPage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const [subId, setSubId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const [teamSummary, setTeamSummary] = useState<PrizeEligibilitySummary | null>(null);
  const [editVersion, setEditVersion] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState("New draft");
  const [statusClass, setStatusClass] = useState("badge-warning");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(true);
  const [deadlineLabel, setDeadlineLabel] = useState("");
  const [eventFrozen, setEventFrozen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "idle">("saved");
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const writeClosed = isLocked || eventFrozen || !deadlineOpen;

  useEffect(() => {
    let active = true;
    fetch(`/api/submissions/token/${token}`)
      .then(async (response) => response.ok ? response.json() : null)
      .then((data: Record<string, unknown> | null) => {
        if (!active) return;
        if (!data?.id) {
          setLoadError("Project not found. Check your private project link.");
          setIsLoading(false);
          return;
        }
        const status = String(data.status ?? "draft");
        const locked = isHardLockedStatus(status);
        setSubId(String(data.id));
        setForm(formFromResponse(data));
        setTeamSummary((data.teamSummary as PrizeEligibilitySummary | null) ?? null);
        setEditVersion(typeof data.editVersion === "string" ? data.editVersion : null);
        setIsLocked(locked);
        setIsSubmitted(isSubmittedStatus(status));
        setDeadlineOpen(data.deadlineOpen !== false);
        setDeadlineLabel(String(data.deadlineLabel ?? ""));
        setEventFrozen(Boolean(data.eventFrozen));
        const labels: Record<string, string> = { draft: "Draft", submitted: "Submitted", finalized: "Submitted", locked: "Submitted" };
        const classes: Record<string, string> = { draft: "badge-warning", submitted: "badge-success", finalized: "badge-success", locked: "badge-default" };
        setStatusLabel(labels[status] ?? "Draft");
        setStatusClass(classes[status] ?? "badge-warning");
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError("We could not load this project. Try the private link again.");
        setIsLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  const progress = useMemo(() => {
    const required = PROJECT_EDITOR_SECTIONS.flatMap((section) => section.fields).filter((field) => PROJECT_EDITOR_FIELD_META[field].required);
    const errors = validateProjectEditorForm(form);
    const complete = required.filter((field) => !errors[field]).length;
    return { complete, total: required.length, missing: required.length - complete };
  }, [form]);

  useEffect(() => {
    if (!saveState || saveState === "saved") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  function updateField(field: keyof EditorForm, value: string | string[]) {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveState("dirty");
    setSaveError("");
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function toggleTool(tool: string) {
    updateField("aiToolsUsed", form.aiToolsUsed.includes(tool)
      ? form.aiToolsUsed.filter((item) => item !== tool)
      : [...form.aiToolsUsed, tool]);
  }

  function showValidation(errors: Record<string, string>) {
    setFieldErrors(errors);
    const first = Object.keys(errors)[0];
    if (first) window.setTimeout(() => document.getElementById(`field-${first}`)?.focus(), 0);
  }

  async function saveProject(): Promise<boolean> {
    if (!subId || writeClosed) return false;
    // Draft saves may be partial. Only entered values are validated here;
    // the full required checklist remains authoritative at Preview/finalize.
    const errors = validateProjectEditorForm(form, { requireAll: false });
    if (Object.keys(errors).length) {
      showValidation(errors);
      setSaveError("Review the highlighted fields before saving.");
      return false;
    }
    setSaving(true);
    setSaveState("saving");
    setSaveError("");
    try {
      const response = await fetch(`/api/v1/submissions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          expectedEditVersion: editVersion,
          teamName: form.teamName,
          contactEmail: form.contactEmail,
          projectTitle: form.projectTitle,
          problemStatement: form.problemStatement,
          targetUsers: form.targetUsers,
          demoUrl: form.demoUrl,
          demoVideoUrl: form.demoVideoUrl || null,
          githubUrl: form.githubUrl,
          license: form.license,
          screenshotUrl: form.screenshotUrls.find((url) => url.trim()) ?? null,
          screenshotUrls: form.screenshotUrls.filter((url) => url.trim()),
          readmeUrl: form.readmeUrl,
          agentsMdUrl: form.agentsMdUrl,
          sampleDataDescription: form.sampleDataDescription,
          setupInstructions: form.setupInstructions,
          deployInstructions: form.deployInstructions,
          aiToolsUsed: form.aiToolsUsed,
          promptStrategyUrl: form.promptStrategyUrl,
          knownLimitations: form.knownLimitations,
          source: "web-editor",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveState("dirty");
        if (data.code === "STALE_PROJECT_EDIT") {
          setSaveError("This project changed in another session. Reload before saving so you do not overwrite newer work.");
        } else if (data.code === "DEADLINE_PASSED") {
          setSaveError("Changes are closed. Your existing project is safe and remains available to review.");
          setDeadlineOpen(false);
        } else {
          setSaveError(data.error ?? "We could not save this project. Your entries are still here; try again.");
        }
        return false;
      }
      setEditVersion(typeof data.editVersion === "string" ? data.editVersion : editVersion);
      setSaveState("saved");
      return true;
    } catch {
      setSaveState("dirty");
      setSaveError("We could not save this project. Your entries are still here; try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (writeClosed) return;
    if (saveState === "dirty") {
      const saved = await saveProject();
      if (!saved) return;
    }
    const confirmed = window.confirm("Submit this project for judging? This marks the current version for judging. You can update and submit a new version while the event deadline remains open.");
    if (!confirmed) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch(`/api/v1/submissions/${subId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ source: "web" }),
      });
      if (response.ok) router.push(`/submit/${token}/done`);
      else {
        const data = await response.json().catch(() => ({}));
        setSubmitError(data.code === "DEADLINE_PASSED" ? "Submissions are closed. Your project is safe and remains available to review." : data.code === "READINESS_INCOMPLETE" ? "Complete the required project details in Preview before submitting." : data.error ?? "The project could not be submitted right now.");
      }
    } catch {
      setSubmitError("We could not submit the project right now. Your draft is safe; try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <PageFrame><p className="project-editor-loading">Loading project…</p></PageFrame>;
  if (loadError || !subId) return <PageFrame><div className="project-editor-not-found" role="alert"><h1>Project unavailable</h1><p>{loadError || "Check your private project link."}</p></div></PageFrame>;

  return (
    <PageFrame>
      <main className="project-editor-page">
        <header className="project-editor-header">
          <div>
            <div className="project-editor-eyebrow">
              <span className={`badge ${statusClass}`}>{statusLabel}</span>
              <span className={`project-editor-save-state ${saveState}`} role="status" aria-live="polite">
                {saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : "Saved"}
              </span>
            </div>
            <h1>{form.projectTitle || "Build your project story"}</h1>
            <p>Shape the story judges will read, one section at a time. You can leave and return safely with this private project link.</p>
            <details className="project-editor-recovery">
              <summary>Recovery details</summary>
              <p>Anyone with this private link can edit the project. Keep it safe.</p>
              <code>{token}</code>
            </details>
          </div>
          <EditorActions onSave={saveProject} onSubmit={handleSubmit} saving={saving} submitting={submitting} disabled={writeClosed} token={token} />
        </header>

        {isLocked || eventFrozen || !deadlineOpen ? (
          <div className="project-editor-closed" role="status">
            <strong>{eventFrozen ? "Project changes are currently closed." : isLocked ? "This project is locked for judging." : "Changes are closed."}</strong>
            <span>{eventFrozen ? "The event is frozen. Your project remains available to review." : !deadlineOpen ? `${deadlineLabel || "The submission deadline has passed."} Your project remains available to review.` : "This submitted project is read-only while judging is underway."}</span>
          </div>
        ) : isSubmitted ? (
          <div className="project-editor-submitted" role="status"><strong>Submitted for judging.</strong><span>You can update this project and submit a new version while submissions remain open.</span></div>
        ) : null}

        {saveError && <p className="project-editor-error" role="alert">{saveError}</p>}
        {submitError && <p className="project-editor-error" role="alert">{submitError}</p>}

        <section className="project-editor-progress" aria-labelledby="progress-heading">
          <div>
            <p className="project-editor-kicker">Project draft</p>
            <h2 id="progress-heading">{progress.complete} of {progress.total} required items complete</h2>
            <p>{progress.missing ? `${progress.missing} ${progress.missing === 1 ? "item still needs" : "items still need"} attention before submission.` : "Everything required for submission is in place."}</p>
          </div>
          <Link href={`/submit/${token}/preview`} className="btn-secondary">Review judge-facing preview</Link>
        </section>

        <div className="project-editor-layout">
          <aside className="project-editor-nav" aria-label="Project sections">
            <p className="project-editor-nav-label">Build your story</p>
            {PROJECT_EDITOR_SECTIONS.map((section) => {
              const sectionProgress = getEditorSectionProgress(section, form);
              return <a href={`#section-${section.id}`} key={section.id}><span>{section.title}</span><small>{sectionProgress.total ? `${sectionProgress.complete}/${sectionProgress.total}` : ""}</small></a>;
            })}
            <a href="#section-team"><span>Team</span><small>Manage</small></a>
            <Link href={`/submit/${token}/preview`}><span>Review & submit</span><small>→</small></Link>
          </aside>

          <div className="project-editor-content">
            {writeClosed ? <ReadOnlyStory form={form} token={token} /> : <>
            <section id="section-basics" className="project-editor-section" aria-labelledby="basics-heading">
              <SectionHeading id="basics-heading" number="01" title="Project basics" description="Start with the details that identify your work." progress={getEditorSectionProgress(PROJECT_EDITOR_SECTIONS[0], form)} />
              <div className="project-editor-field-grid">
                <EditorField field="projectTitle" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} />
                <EditorField field="teamName" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} />
                <EditorField field="contactEmail" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} />
              </div>
            </section>

            <section id="section-problem" className="project-editor-section" aria-labelledby="problem-heading">
              <SectionHeading id="problem-heading" number="02" title="The problem" description="Make the need behind the project easy to understand." progress={getEditorSectionProgress(PROJECT_EDITOR_SECTIONS[1], form)} />
              <div className="project-editor-field-grid">
                <EditorField field="problemStatement" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} wide />
                <EditorField field="targetUsers" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} wide />
              </div>
            </section>

            <section id="section-solution" className="project-editor-section" aria-labelledby="solution-heading">
              <SectionHeading id="solution-heading" number="03" title="Your solution" description="Describe how it works and what a reviewer should know." progress={getEditorSectionProgress(PROJECT_EDITOR_SECTIONS[2], form)} />
              <div className="project-editor-field-grid">
                <EditorField field="setupInstructions" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} wide />
                <EditorField field="deployInstructions" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} wide />
                <EditorField field="knownLimitations" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} wide />
              </div>
            </section>

            <section id="section-demo" className="project-editor-section" aria-labelledby="demo-heading">
              <SectionHeading id="demo-heading" number="04" title="Demo & code" description="Give judges a clear path to the working project and its source." progress={getEditorSectionProgress(PROJECT_EDITOR_SECTIONS[3], form)} />
              <div className="project-editor-field-grid">
                <EditorField field="demoUrl" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} />
                <EditorField field="demoVideoUrl" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} />
                <EditorField field="githubUrl" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} />
                <EditorField field="readmeUrl" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} />
                <EditorField field="agentsMdUrl" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} />
                <EditorField field="license" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} />
                <ScreenshotField form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} />
              </div>
            </section>

            <section id="section-data" className="project-editor-section" aria-labelledby="data-heading">
              <SectionHeading id="data-heading" number="05" title="Data & implementation" description="Add the context that makes the project understandable and reproducible." progress={getEditorSectionProgress(PROJECT_EDITOR_SECTIONS[4], form)} />
              <div className="project-editor-field-grid">
                <EditorField field="sampleDataDescription" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} wide />
                <ToolField tools={form.aiToolsUsed} disabled={writeClosed} onToggle={toggleTool} />
                <EditorField field="promptStrategyUrl" form={form} errors={fieldErrors} disabled={writeClosed} onChange={updateField} />
              </div>
            </section>

            <section id="section-team" className="project-editor-section" aria-labelledby="team-heading">
              <SectionHeading id="team-heading" number="06" title="Team" description="Team formation and project access live on the dedicated Team page." />
              <div className="project-editor-team-summary">
                <div>
                  <strong>{teamSummary?.memberCount ?? 0} people listed</strong>
                  <span>{teamSummary?.eligibleForPrize ? "Prize eligible" : "Prize eligibility needs attention"}</span>
                </div>
                <Link href={`/submit/${token}/team`} className="btn-secondary">Manage team</Link>
              </div>
              {teamSummary && !teamSummary.eligibleForPrize && <p className="project-editor-team-note">{teamSummary.missingMembers.length ? `${teamSummary.missingMembers.join(", ")} ${teamSummary.missingMembers.length === 1 ? "needs" : "need"} a badge number for prize eligibility.` : "Review team details before submitting."}</p>}
            </section>

            {!writeClosed && <section id="agent-completion-prompt" className="project-editor-agent" aria-label="Coding agent option">
              <AgentCompletionPrompt
                submissionId={subId}
                editToken={token}
                editUrl={typeof window !== "undefined" ? `${window.location.origin}/submit/${token}` : `/submit/${token}`}
                previewUrl={typeof window !== "undefined" ? `${window.location.origin}/submit/${token}/preview` : `/submit/${token}/preview`}
                finalizeUrl={typeof window !== "undefined" ? `${window.location.origin}/api/v1/submissions/${subId}/finalize` : `/api/v1/submissions/${subId}/finalize`}
                promptDisclosure
                title="Continue with a coding agent"
              />
            </section>}

            <div className="project-editor-savebar">
              <span>{saveState === "saved" ? "Your latest changes are saved." : "Save before leaving this page."}</span>
              <div>
                <Link href={`/submit/${token}/preview`} className="btn-secondary">Preview</Link>
                {!writeClosed && <button type="button" onClick={() => void saveProject()} disabled={saving} className="btn-secondary">{saving ? "Saving…" : "Save draft"}</button>}
                {!writeClosed && <button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="btn-primary">{submitting ? "Submitting…" : "Review & submit"}</button>}
              </div>
            </div>
            </>}
          </div>
        </div>
      </main>
    </PageFrame>
  );
}

function PageFrame({ children }: { children: ReactNode }) {
  return <div className="flex flex-col min-h-screen"><Nav /><EventFreezeBannerClient />{children}</div>;
}

function EditorActions({ onSave, onSubmit, saving, submitting, disabled, token }: { onSave: () => Promise<boolean>; onSubmit: () => Promise<void>; saving: boolean; submitting: boolean; disabled: boolean; token: string }) {
  return <div className="project-editor-actions">
    {!disabled && <button type="button" className="btn-secondary" onClick={() => document.getElementById("agent-completion-prompt")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Use coding agent</button>}
    <Link href={`/submit/${token}/preview`} className="btn-secondary">Preview</Link>
    {!disabled && <button type="button" className="btn-secondary" onClick={() => void onSave()} disabled={saving}>{saving ? "Saving…" : "Save"}</button>}
    {!disabled && <button type="button" className="btn-primary" onClick={() => void onSubmit()} disabled={submitting}>{submitting ? "Submitting…" : "Review & submit"}</button>}
  </div>;
}

function ReadOnlyStory({ form, token }: { form: EditorForm; token: string }) {
  const values: Array<[string, string]> = [
    ["Project title", form.projectTitle], ["Team name", form.teamName], ["Problem statement", form.problemStatement],
    ["Who is this for?", form.targetUsers], ["Working demo", form.demoUrl], ["GitHub repository", form.githubUrl],
    ["Project license", form.license], ["Data used", form.sampleDataDescription],
  ];
  return <>
    <section className="project-editor-section" aria-labelledby="read-only-story-heading"><SectionHeading id="read-only-story-heading" number="01" title="Submitted project" description="This is the project version currently available for judging." />
      <div className="project-editor-readonly-list">{values.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || "Not provided"}</strong></div>)}</div>
    </section>
    <section className="project-editor-section" aria-labelledby="read-only-next-heading"><SectionHeading id="read-only-next-heading" number="02" title="What you can do next" description="Preview the submitted project or return to your participant home." />
      <div className="project-editor-readonly-actions"><Link href={`/submit/${token}/preview`} className="btn-primary">Review judge-facing preview</Link><Link href="/account/projects" className="btn-secondary">My Projects</Link></div>
    </section>
  </>;
}

function SectionHeading({ id, number, title, description, progress }: { id: string; number: string; title: string; description: string; progress?: { complete: number; total: number } }) {
  return <div className="project-editor-section-heading"><div><p className="project-editor-section-number">{number}</p><h2 id={id}>{title}</h2><p>{description}</p></div>{progress && <span className="project-editor-completion" aria-label={`${progress.complete} of ${progress.total} required items complete`}>{progress.total ? `${progress.complete} of ${progress.total} complete` : "Reference"}</span>}</div>;
}

function EditorField({ field, form, errors, disabled, onChange, wide }: { field: ProjectEditorField; form: EditorForm; errors: Record<string, string>; disabled: boolean; onChange: (field: keyof EditorForm, value: string) => void; wide?: boolean }) {
  const meta = PROJECT_EDITOR_FIELD_META[field];
  if (meta.input === "tools") return null;
  const value = String(form[field] ?? "");
  const error = errors[field];
  const id = `field-${field}`;
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;
  return <div className={`project-editor-field ${wide ? "project-editor-field-wide" : ""}`}>
    <div className="project-editor-field-label"><label htmlFor={id}>{meta.label}</label><FieldBadge meta={meta} /></div>
    {meta.input === "textarea" ? <textarea id={id} className="textarea" value={value} onChange={(event) => onChange(field, event.target.value)} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={describedBy} /> : <input id={id} className="input" type={meta.input} value={value} onChange={(event) => onChange(field, event.target.value)} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={describedBy} />}
    <p id={`${id}-help`} className="project-editor-field-help">{meta.helper}</p>
    {error && <p id={`${id}-error`} className="project-editor-field-error" role="alert">{error}</p>}
  </div>;
}

function ScreenshotField({ form, errors, disabled, onChange }: { form: EditorForm; errors: Record<string, string>; disabled: boolean; onChange: (field: keyof EditorForm, value: string[]) => void }) {
  const meta = PROJECT_EDITOR_FIELD_META.screenshotUrls;
  const error = errors.screenshotUrls;
  return <div className="project-editor-field project-editor-field-wide">
    <div className="project-editor-field-label"><label htmlFor="field-screenshotUrls-0">{meta.label}</label><FieldBadge meta={meta} /></div>
    <div className="project-editor-screenshot-list">{form.screenshotUrls.map((url, index) => <div className="project-editor-screenshot-row" key={`${index}-${url}`}><input id={`field-screenshotUrls-${index}`} className="input" type="url" value={url} onChange={(event) => { const next = [...form.screenshotUrls]; next[index] = event.target.value; onChange("screenshotUrls", next); }} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby="field-screenshotUrls-help" placeholder="https://example.com/project-screenshot.png" />{!disabled && form.screenshotUrls.length > 1 && <button type="button" className="project-editor-remove" onClick={() => onChange("screenshotUrls", form.screenshotUrls.filter((_, current) => current !== index))} aria-label={`Remove screenshot ${index + 1}`}>×</button>}</div>)}</div>
    {!disabled && form.screenshotUrls.length < 5 && <button type="button" className="project-editor-add" onClick={() => onChange("screenshotUrls", [...form.screenshotUrls, ""])}>+ Add another screenshot</button>}
    {form.screenshotUrls[0]?.startsWith("https://") && <img className="project-editor-screenshot-preview" src={form.screenshotUrls[0]} alt="Current project screenshot preview" />}
    <p id="field-screenshotUrls-help" className="project-editor-field-help">{meta.helper}</p>
    {error && <p className="project-editor-field-error" role="alert">{error}</p>}
  </div>;
}

function ToolField({ tools, disabled, onToggle }: { tools: string[]; disabled: boolean; onToggle: (tool: string) => void }) {
  const meta = PROJECT_EDITOR_FIELD_META.aiToolsUsed;
  return <div className="project-editor-field project-editor-field-wide"><div className="project-editor-field-label"><span>{meta.label}</span><FieldBadge meta={meta} /></div><div className="project-editor-tool-list" role="group" aria-label="AI tools used">{AI_TOOLS_OPTIONS.map((tool) => <button key={tool} type="button" aria-pressed={tools.includes(tool)} disabled={disabled} className={`project-editor-tool ${tools.includes(tool) ? "selected" : ""}`} onClick={() => onToggle(tool)}>{tool}</button>)}</div><p className="project-editor-field-help">{meta.helper}</p></div>;
}

function FieldBadge({ meta }: { meta: { required?: boolean; recommended?: boolean } }) {
  return <span className={`project-editor-field-badge ${meta.required ? "required" : meta.recommended ? "recommended" : "optional"}`}>{meta.required ? "Required" : meta.recommended ? "Recommended" : "Optional"}</span>;
}
