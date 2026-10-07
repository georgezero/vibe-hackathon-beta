"use client";

import { FormEvent, useState } from "react";

type FeedbackContext = "start" | "my_projects" | "editor" | "preview" | "team" | "invitation" | "workspace" | "people" | "messages" | "community" | "team_chat" | "explore" | "submit" | "unknown";

const categories = [
  ["confusing", "Something was confusing"],
  ["could_not_complete", "I couldn't complete a task"],
  ["broken", "Something seems broken"],
  ["suggestion", "I have a suggestion"],
  ["other", "Other"],
] as const;

export default function ParticipantFeedback({ context = "unknown" }: { context?: FeedbackContext }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<typeof categories[number][0]>("confusing");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "limited">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const response = await fetch("/api/participant-feedback", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, context, message }),
    }).catch(() => null);
    if (!response) { setState("error"); return; }
    if (response.status === 429) { setState("limited"); return; }
    if (!response.ok) { setState("error"); return; }
    setMessage("");
    setState("sent");
  }

  return <section className="participant-feedback" aria-label="Participant feedback">
    {!open && state !== "sent" ? <button className="participant-feedback-link" type="button" onClick={() => setOpen(true)}>Send feedback</button> : null}
    {state === "sent" ? <div className="participant-feedback-success" role="status"><strong>Thanks for the note.</strong><span>Your feedback was sent to the event organizers.</span><button type="button" className="participant-feedback-link" onClick={() => { setState("idle"); setOpen(true); }}>Send another</button></div> : null}
    {open && state !== "sent" ? <form className="participant-feedback-form" onSubmit={submit}>
      <div className="participant-feedback-heading"><div><h2>Send feedback</h2><p>Optional and private to the event organizers. Please do not include passwords, private links, or message content.</p></div><button type="button" className="participant-feedback-close" aria-label="Close feedback" onClick={() => setOpen(false)}>×</button></div>
      <label className="participant-feedback-label" htmlFor="participant-feedback-category">What kind of note is this?</label>
      <select id="participant-feedback-category" className="input" value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
        {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label className="participant-feedback-label" htmlFor="participant-feedback-message">Your note <span>(1,000 characters max)</span></label>
      <textarea id="participant-feedback-message" className="input participant-feedback-textarea" value={message} maxLength={1000} onChange={(event) => setMessage(event.target.value)} placeholder="What should organizers know?" required />
      {(state === "error" || state === "limited") && <p className="participant-feedback-error" role="alert">{state === "limited" ? "Feedback is limited to three notes per hour. Try again later." : "That note could not be sent. Check your connection and try again."}</p>}
      <div className="participant-feedback-actions"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={state === "sending" || message.trim().length === 0}>{state === "sending" ? "Sending…" : "Send feedback"}</button></div>
    </form> : null}
  </section>;
}
