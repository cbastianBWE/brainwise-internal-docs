# BrainWise Session 171 to 172 Handoff

*Closeout: Session 171. Open: Session 172. Follows `session-170-to-171.md`.*

## Where Session 171 left off

The **entire Foundational tier is now built and published — 27 activities, zero drafts, across all ten module groups.** This session closed Present (0475), Past (0503/0505/0545), Resolve (0820) and External Support (0915); then did the Foundational wrap-up: published the seven complete-but-draft activities that were invisible to non-super-admins (Future ×4, Life's-Purpose-Start, pitch-engine, clarity-engine), built Pathway's three missing modules (0705/0710/0770), and built the new **Summary** wrap-up group (1005/1010/1015). Semantic activity search was built end to end (pgvector + gte-small, zero cost). The analyzer advanced to v14 and the coaching runner was largely hardened (Track A + F1 done on Cole's side).

## Session 172 opening priorities, in order

### 1. TYPICAL wave
Build all **Typical-tier** activities. Start at Intro and work down the OneDrive `MBWC - Module Selection (USE THIS FOLDER)` groups, tier folders `MBWC-0Xb-Typical`. Same cadence as Foundational: scope from source → build backend-first (reuse widgets, conserve Lovable) → draft → publish → headless non-admin metered check → keep. Re-run `coaching-activity-embed` (empty body, repeat until `remaining:0`) after each batch so search stays current.

### 2. Life's Tools Decoded / "Change" toolkit (the last Foundational gap)
Group 06 `06a-Foundational` is organized into sub-toolkits; read the "Change" subfolder and build its micro-modules. Only `pitch-engine` exists today.

### 3. ADVANCED wave
After Typical, all Advanced-tier activities across every group.

## Carried residuals

- **0420 assessment_upload → coaching-assessment-analyze** live click-through still unverified (blocked since Session 170 by the file_upload tooling gap). Close via a user-driven upload or a seeded `coaching_assessment_uploads` row + direct invocation.
- **pitch-engine + clarity-engine** were published after an analysis smoke-test only (complex 7-step flows). Recommend a real click-through; revert to draft if either misbehaves.
- **Frontend search bar** — the Lovable prompt is written and handed over; not yet shipped. After it ships, verify it calls `coaching-activity-search` and renders ranked results.
- **Runner hardening Track B/C** — Cole to profile (Stage 0, React DevTools) and send the worst offenders; then memo/useCallback (B) and lazy-load heavy widgets (C).

## Decisions locked in Session 171

- Semantic search = **pgvector + in-runtime gte-small**, no external embeddings API and no per-search LLM cost (Cole explicitly rejected the LLM-ranker cost).
- 0915 Networking = a **coach-led adaptive interview** that meters per chat turn (heavier than typical); left metered.
- Mirror / Dixon / change-review syntheses use an **asymmetric tone**: confident on the affirming half, gentle-invitation ("only you can say", never a verdict) on the self-critical half.
- 0820 decision stage = a **forced-choice picker** (F1 capability), degrading to guided free-text.
- Draft activities stay **hidden from non-super-admins**; visibility is achieved by finishing and publishing, not by exposing drafts.

## Open questions / things to lock in Session 172

- 0915 metering: leave per-turn, or make it unmetered / cap the interview turns?
- Whether to add a DB trigger that auto-re-embeds an activity on publish (so search never goes stale).
- Coach subscription pricing/allowance (COACH-CHAT-METERING) — still open from prior sessions.

## Test fixture state at end of Session 171

Test org: BrainWise Test Corp. Look up current UUIDs via Supabase MCP; the working fixture password is in Claude's `userMemories` (kept OUT of this public repo).

- **+orgmember** (org_admin, corporate, has a current PTP) was the workhorse for every live metered check and every draft smoke-test this session. It was briefly elevated to `brainwise_super_admin` to run `coaching-activity-embed` / smoke-test drafts, and **reverted to `org_admin` each time** — end state is `org_admin`. Its metered counter was restored to its pre-test value after each check.
- OPS-1: the fixture password set in Session 170 remains the working one; it lives in `userMemories`, not here. Verify backend via simulated JWT / minted fixture tokens + rolled-back transactions when no UI login is available.

## Documents this session leaves behind

- BrainWise_Build_Queue_v82.docx (upload to project knowledge)
- BrainWise_System_Architecture_Reference_v78.docx (upload to project knowledge)
- BrainWise_Session_171_to_172_Handoff.docx (this document, upload to project knowledge)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs: `build-queue-APPEND-session171.md`, `architecture-reference-APPEND-session171.md`, `session-171-to-172.md`, plus the standing `scope-frontend-hardening-coaching-runner.md`.
