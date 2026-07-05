# BrainWise Session 165 to 166 Handoff

*Closeout: Session 165. Open: Session 166.*

*Note: this session was off the normal cadence. It was a dedicated scope-and-build session for the My Coaching (coaching activities) system. If the local session count differs, adjust NN/MM on upload.*

## Where Session 165 left off

The entire My Coaching backend was built and verified, three Edge Functions were deployed, and the Clarity Engine (module 0745) was stood up as the reference activity with the frontend catalog, runner, history, search, tags, and thumbnails. A full scope document for the ~150-activity system was produced (`BrainWise_Coaching_Activities_Scope_v1.md`). The next ~149 activities, five to six net-new widgets, image storage, and PDF export remain to build.

## Session 166 opening priorities, in order

### 1. Build out coaching activities, starting with the content widget and one common group

Add the `content` widget (display an image, model, or inspirational statements plus a short reflection), then build one mostly-standard group end to end (recommend 05 Past or 02 Purpose) to confirm that a new activity is a data insert into `coaching_activities`, not a code build. Lock the visual and interaction bar (scope Section 10) for the standard pattern. Files: new content widget in the runner, new activity rows via SQL.

### 2. Image infrastructure and the `image_capture` widget

Build a Supabase storage bucket for coaching media plus the `image_capture` widget via 03 Future's "Pictures of the future" (0310). This single build clears thumbnails (upload), activity hero images, inline step images, and the first image-based activity. Cole will also provide a Clarity Engine thumbnail to set via SQL (`coaching_activities.thumbnail_url`).

### 3. Remaining widgets on demand

Add `select_model`, `matrix_2x2`, `goal_form`, `timeline`, and `ptp_display` only as the specific activity that needs them comes up, group by group. Foundational tiers first within each group.

### 4. PDF export and reference library

A polished PDF export of a completed session to the PTP-report standard, and a reference library for Appendix B (~90 supporting documents, not activities).

## Decisions locked in Session 165 (recap)

- Coaching activities are a separate domain from the LMS content-item/lesson system. Flow-engine, definition-driven; an activity is data.
- Nav label is "My Coaching," a new top-level item, not under Resources. Routes `/coaching` and `/coaching/:activityId`, plus history and a read-only session view.
- Access order: explicit deny, explicit grant (coach assignment wins), super admin (unlimited, unmetered, sees drafts), PTP-result baseline, tier gate. Foundational for anyone with a PTP; Typical for Base or Premium or a corporate seat; Advanced for Premium or corporate Premium.
- Metering on a dedicated coaching pool, never the chat pool. Individual Base 200, Premium 400; corporate Base 50, Premium 100 per seat; Free 10 one-time credits per assessment purchase, fallback only, Foundational only.
- Model routing: `coaching_analysis` and `coaching_chat` both on Sonnet.
- Memory: a rolling per-user summary updates on completion and is injected into analysis and chat, so the coach learns from accumulated work. Persistent memory, not model training.
- Sharing is grant-based (snapshot or always), not per activity run.
- The "250" is ~150 activities (Appendix A) plus ~90 reference documents (Appendix B). Appendix B goes to a library, not the engine.
- Authoring UI is deferred until all activities are built, so authors work on a complete widget palette.
- Experience bar (scope Section 10) is a pass-or-fail checklist for every activity build.

## Open questions / things to lock in Session 166

- Survey widget: reuse the assessment engine or build a coaching survey. Recommend reuse. [gate: decide]
- 06 Life's Tools Decoded: per-item decision on activity versus reference doc. [gate: Phil]
- Voice capture and transcription for Pictures of the future. Text is fine for v1. [optional]
- General-chat integration with the coaching summary. [optional]
- Per-activity AI touchpoint content and wording. [gate: Phil]

## Bugs surfaced in Session 165 added to Build Queue

- BUG-COACH-1 [FIXED]: Runner discarded progress on refresh or re-entry. Cause: the `?fresh=1` param persisted in the URL, so any remount re-ran the abandon-and-restart path. Fix prompt issued: clear the fresh param after a fresh start, guard with a ref, flush the debounced save on unmount.
- BUG-COACH-2 [FIXED in prompt set]: client debounced save overwrote server-owned `analysis`/`chat`. Resolved by `coaching_session_save` merge RPC (client sends input keys only).
- OPS-1 [OPEN]: the documented test password no longer authenticates any of the PTP fixtures (orgmember, orgadmin, convert2, employee, supervisor all returned invalid_credentials). Update the fixture password or the record. This blocked a full manual end-to-end run via password sign-in.

## What's NOT in scope for Session 166

- The authoring UI (deferred until all widgets exist).
- Appendix B documents as activities (they are reference material).
- Rebuilding surveys inside coaching if the assessment engine can serve them.

## Architecture additions in Session 165

Recorded in `architecture-reference-APPEND-session166.md`. Summary: four coaching domain tables, a dedicated usage counter and credit ledger, seven RPCs, a purchase-grant trigger, two model-registry roles, and three Edge Functions.

## Test fixture state at end of Session 165

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee)

The PTP fixtures (orgmember, orgadmin, convert2) each have a current PTP result and were used for rolled-back RPC tests. IMPORTANT: the documented test password did not authenticate any fixture this session (see OPS-1). One real coaching session completed end to end (super admin), producing a `coaching_user_summary` row, which confirms the analyze-to-complete-to-summary loop works.

## Documents this session leaves behind

- BrainWise_Coaching_Activities_Scope_v1.md (full system scope)
- build-queue-APPEND-session166.md (coaching build-queue additions)
- architecture-reference-APPEND-session166.md (coaching architecture additions)
- session-165-to-166.md (this document)

Version lineage for project-knowledge docx, if regenerated: Build Queue v65 to v66, Architecture Reference v61 to v62. This session used the markdown APPEND pattern rather than editing the canonical files inline.

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs.
