# BrainWise Session 128 to 129 Handoff

*Closeout: Session 128. Open: Session 129.*

> Closeout note: the original Session-128 chat ("Session 128 kickoff: highlight comments feature") completed the work below but could not emit downloadable markdown files, and GitHub was never updated. This handoff, build-queue v136, and architecture-reference v130 were rebuilt from the committed v135 / v129 plus the recovered Session-128 transcript. Nothing was lost; items 9, 10, 3 are confirmed shipped and SHA-verified.

## Where Session 128 left off

Three low-hanging-fruit backlog items shipped end-to-end and verified, all frontend-only with zero backend migrations: item 9 (highlight comments), item 10 (My Learning as its own page), and item 3 (Individual Dashboard built as option a, cards/widgets). A highlight-popover dismissal fix (click-outside / Escape) and coach-dashboard additions shipped alongside. At the session tail, items 2, 5, and 12 were recon/readout only (no code shipped, because that session's toolset had no Edge Function read/deploy access); each now carries a Cole decision for Session 129. The single most important finding: the +10 AI-chat grant (item 2) is scaffolded in the DB but never wired into enforcement, so it is currently inert for everyone and all coaches get no AI chat.

## Session 129 opening priorities, in order

### 1. Super-admin organization management (backlog item 1): START HERE, not begun

Build the equivalent of the org-admin page/functionality for a super admin, so BrainWise can support organizations through onboarding (invite members, manage members and roles, the rest of the org-admin surface). Backend-first: confirm the live org-admin RPCs/RLS and whether a super admin can already call them cross-org or needs a super-admin-scoped path. This is the single heaviest item in the backlog; treat it as its own multi-step arc, backend verified before any Lovable prompt.

### 2. Free +10 AI-chat grant (backlog item 2), split into two phases

Phase A first (this is the real fix, not a verification task): wire `check-ai-usage` to honor `one_time_chat_credits` and fire the grant on the per-assessment purchase path so REGULAR purchasing users actually receive their +10. Phase B next, after A is verified: extend the grant to coach-paid clients and super-admin-invited clients, resolving the non-Stripe invite-path trigger and the `source_ref` idempotency key per path. All of this lives in Edge Functions (`check-ai-usage` plus the purchase / comp / invite webhooks), so Session 129 needs Edge Function read + deploy access, which Session 128 lacked. The DB grant function is already idempotent and correct.

### 3. White-label readiness (backlog item 5), full track, "all of it"

Cole's decision is to build the complete white-label capability, not just the branding-layer first slice. Suggested sequence within the track: (1) branding layer on `organizations` (logo asset, primary/accent colors, optional custom CSS) plus session-time CSS-variable injection keyed to the resolved org; (2) a per-session org-brand resolver; (3) tenant-isolation hardening where the public schema is not org-partitioned; (4) custom-domain / subdomain support (domain columns, domain-to-org resolver, DNS/cert handling at the hosting layer). This is a multi-session arc; do not try to squeeze it into a session tail.

### 4. Surface the lesson-block editor (backlog item 12), Option B, restate options first

Cole chose Option B. IMPORTANT: the recovered Session-128 transcript ended before the A/B/C entry-point options were written out, so the exact definition of "Option B" was not captured. Re-run the short recon (the editor is at `/super-admin/content-authoring/lessons/:contentItemId`, reachable only via a saved `lesson_blocks` content item), restate the A/B/C entry-point options, and confirm B before building. Likely small/frontend, same shape as item 10.

### Remaining backlog (sequence after the above, mostly multi-session)

Items 4 (in-system support chatbot plus an admin capture/report surface), 6 (SCORM export for the Rise lesson block, plus external SCORM import), 7 (lesson-block tracking API plus HRIS ingest), 8 (super-admin learning report section: completions across cert paths / curricula / modules / content items, sliceable, CSV export, clean dashboard), and 11 (subfolder organization for My Learning and Resources). All still open, none begun.

## Decisions locked in Session 128 (recap)

- Item 9 highlight comments: reuse the existing `ptp_report_highlights.note` column; the note is optional at create AND editable after; delete clears it to null. No backend change (RLS and grants already covered it).
- Item 3 Dashboard: built option (a), cards/widgets that launch results and resources. The remove-from-nav alternative was rejected.
- Item 2 free chats: split into Phase A (regular per-assessment purchasers first) and Phase B (coach-paid plus super-admin-invited next).
- Item 5 white-label: build the full track, not just the first slice.
- Item 12 lesson-block editor: Option B (pending restatement of the captured options, see priority 4).

## Open questions / things to lock in Session 129

- Item 2 Phase B: does the +10 stack on top of the monthly tier allowance, or is it the sole allowance for users who would otherwise be denied (comped clients, coaches)? Lock before building Phase B.
- Item 12: confirm the exact "Option B" entry-point design once the options are restated.

## Bugs surfaced in Session 128 added to Build Queue

- None new. The item-2 finding (the +10 grant scaffolded but unwired in `check-ai-usage`) is a pre-existing gap, now documented in build-queue item 2 and architecture-reference v130, to be fixed under item 2 Phase A.

## What's NOT in scope for Session 129 opening

- Operations work (Doc-1 invoice live refund test, CRM Phase 9/10 tail, Operations Docs 3/4/5 backlog).
- BQ-PTP-PERFECT-VERIFY (still needs an authenticated-app super-admin JWT that cannot be minted from MCP).
- The ai-chat v50 repo commit (Cole, manual).
- The newsletter STATIC_ROUTES manual-edit reminder (surface it only if newsletter / sitemap / SEO / new-marketing-page work comes up).
- The §82 facet_interpretations {public}-role nit.

## Architecture additions in Session 128

None at the database level. Session 128 was frontend-only:

- `useReportHighlights.ts` gained a `note` field (interface / select / insert) and a new `updateHighlightNote(id, note)` doing a direct RLS-scoped supabase update.
- `ReportHighlight.tsx` gained the comment textarea on the create popover, an edit popover replacing the old Remove popover, commented-mark rendering (dotted underline + note as hover title), and a click-outside / Escape dismissal `useEffect` placed before the early return.
- New standalone My Learning page (item 10) and a populated Individual Dashboard page (item 3, option a), plus coach-dashboard additions.

No new tables, columns, RPCs, Edge Functions, crons, or numbered standing rules. `ptp_report_highlights` was untouched at the DB level (the `note` column already existed from v129).

## Test fixture state at end of Session 128

No fixture changes this session (frontend-only, no migrations, no test data writes).

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

## Documents this session leaves behind (markdown only, per the Session-74 decision)

- build-queue.md (v136 entry added; items 3, 9, 10 marked done; items 2, 5, 12 annotated with Session-129 decisions)
- architecture-reference.md (v130 entry added)
- session-128-to-129.md (this document)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs. Upload all three by drag-and-drop via the GitHub web UI (GitHub MCP is read-only by design).
