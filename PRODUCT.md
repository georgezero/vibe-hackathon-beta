# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Hackathon participants who register teams, submit projects, and manage their own application account.
- Human judges who review only their assigned submissions for the active event.
- Event administrators who operate the hackathon and explicitly manage user access.
- Public visitors who browse projects, results, event status, and published evaluation material.

## Product Purpose

Vibe Hackathon is an application for running an AI-assisted hackathon from registration through judging, public presentation, and results. Success means participants can submit safely, judges can score only assigned work, administrators can operate the event, and public audiences see only intentionally published information.

## Positioning

The platform keeps interactive authentication, verified external identity, application authorization, judge assignments, and score ownership as separate layers. A single Better Auth account can hold independent administrator and event-scoped judge access without identity verification itself granting privileges.

## Operating Context

- Participants use public and private submission routes from desktop and mobile browsers.
- Administrators use authenticated operational dashboards and exports during a live event.
- Judges use an assignment-focused dashboard and scoring workflow.
- Better Auth owns interactive application sessions.
- Viby Runtime verifies identities and links them to Better Auth accounts, but does not authorize application roles.
- Application-owned authorization records are checked live.

## Capabilities and Constraints

- Next.js 16 App Router application with a SQLite canonical database.
- Better Auth supports password and configured provider authentication.
- Administrator authorization comes only from `admin_authorizations`.
- Judge authorization comes only from event-scoped `judge_authorizations`; assignment checks remain separately required.
- Viby identity links are role-neutral and grant no access.
- Account administration must never expose or persist plaintext passwords after their one-time handoff.
- User-facing pages must not expose internal user, session, identity-link, Runtime, or authorization identifiers.
- Public surfaces must not expose private team, authentication, or operational data.
- Viby Runtime and its contract remain outside application account-management changes.

## Brand Commitments

- Product name: Vibe Hackathon.
- Preserve the existing theme system, semantic CSS variables, typography, and compact professional application shell.
- Administrative experiences should be calm, precise, and operational rather than promotional.

## Evidence on Hand

- Existing application routes, authentication boundaries, database schema, and Phase B qualification reports in `docs/runtime-migration/sdk-admin-auth/`.
- Existing theme tokens and component conventions in `app/globals.css` and `components/`.
- No fabricated customer claims, benchmarks, testimonials, or commercial proof should be introduced.

## Product Principles

- Authentication establishes identity; explicit application records establish access.
- Sensitive operational actions are deliberate, attributable, and reversible where possible.
- Personal account management is self-service without permitting self-escalation.
- Preserve judging attribution, assignments, scores, and authorization history.
- Favor clear recovery paths and progressive disclosure over dense administrative forms.

## Accessibility & Inclusion

Interactive account and access controls must be keyboard operable, visibly focused, usable on mobile, understandable without color alone, and explicit about destructive or access-changing consequences.
