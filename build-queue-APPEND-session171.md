# BrainWise Build Queue — APPEND Session 171

*Append to `build-queue.md`. Follows `build-queue-APPEND-session170.md`. Version marker v82 (Session 171 CLOSE). Covers finishing the Foundational tier across every module group, the semantic activity search, analyzer v13/v14, and the coaching-runner frontend hardening.*

## Shipped this session

### Foundational tier — COMPLETE across all groups (27 activities, 0 drafts)

Every Foundational activity in every module group is now built and published.

- **Present — closed.** 0475 "Additional future thoughts" built as a HEAVY capstone (cross-reads the user's Present + Purpose work forward) and published after a live non-admin metered check.
- **Past — closed.** Built + published 0503 "Recent past" (gentle, duty-of-care signposting), 0505 "Major influencers & the mirror" (5-subfield influencer capture + the asymmetric-tone mirror synthesis), 0545 "Additional future thoughts" (Past→Future capstone).
- **Resolve — closed.** 0820 "Decisions already made" (Dixon's Law; the four decision stages as a forced-choice picker, degrading to guided free-text until the F1 frontend shipped).
- **External Support — closed.** 0915 "Networking" — a coach-LED adaptive interview (opening question → up to ~5 adaptive questions → a suggested Elevator Speech to confirm/adjust → networking plan), driven entirely by the `chat_prompt` off `{story_block}` (all prior work).
- **Foundational wrap-up.**
  - Published the 7 complete-but-draft activities that were hiding the "can't see them" visibility issue: Future ×4 (0301/0305/0310/0385), Purpose 0205 (Life's Purpose — The Start), plus `pitch-engine` and `clarity-engine`. All smoke-tested (analysis generates) before publish.
  - Built + published **Pathway** 0705 "Change review" (Bridges + Ewing; per-change opportunity/worst-fear/maximize/minimize via risk_blocks), 0710 "Journalling" (light practice-starter), 0770 "Additional future thoughts" (Pathway→Future capstone). clarity-engine = 0745 Action Evaluation (already existed).
  - Built + published the new **Summary** module group (group 10, the wrap-up): 1005 "Reviewing commitments", 1010 "Symbols & ceremony", 1015 "Capturing it all" (a card-sized whole-journey synthesis).
- Tagged every Session-171 activity (module + tier + MBWC code + topical keywords) so they surface in search.

### Semantic activity search — BUILT (backend live)

pgvector + the in-runtime `gte-small` model. NO external embeddings API, NO metering, NO per-search LLM cost. Embeds title + desired outcome + description + learning outcomes + tags; cosine-ranks published activities. Intent queries verified ("putting off a decision" → Decisions already made; "reach out for career help" → Networking, etc.). Frontend search bar is a Lovable prompt handed to Cole (not yet shipped).

### Analyzer + widget capability

- `coaching-activity-analyze` **v13** (opt-in cross-activity recap) and **v14** (subfield-aware risk_blocks serialization). Both backward-compatible. See architecture APPEND.
- Frontend **F1**: risk_blocks subfields can render as a single-select picker (`subfieldTypes`/`subfieldOptions`). Shipped by Cole; unblocks 0820's forced-choice stage.

### Coaching-runner frontend hardening — IN PROGRESS (Cole executing in Lovable)

Staged plan delivered (`scope-frontend-hardening-coaching-runner.md`). Track A (file split) done: runner 3,691 → 969 lines, types/helpers → `runner/shared.tsx`, 17 widgets → `runner/widgets/*`. F1 picker + the "Add a person" label fix shipped. Remaining: Stage 0 profiling → Track B (memo/useCallback per profile) → Track C (lazy-load heavy widgets).

## Findings / notes added to queue

- **FINDING-EMBED-CPU-CAP:** embedding the whole catalog in one edge call hit the edge CPU limit (~14 ok, 21 = HTTP 546). Fixed: `coaching-activity-embed` v2 is incremental (skips unchanged) + capped per call (default 10, returns `remaining`). Re-run until `remaining:0` after each catalog change.
- **METERING — 0915 conversational cost:** the coach-led interview meters per chat turn (opening + ~5 questions + adjustments ≈ 6–10 interactions per elevator speech), heavier than a typical 1–2. Consistent with the shared-pool model; option to make it unmetered or cap turns if it eats too much allowance. Cole aware, left metered.
- **Complex engines published on smoke-test only:** `pitch-engine` and `clarity-engine` (7-step, multi-widget) were published after an analysis smoke-test, not a full widget-flow click-through. Recommend a live click-through; revert to draft if either misbehaves.
- **Draft visibility is by design:** draft = super-admin-only. The "coach can't see Future" report was simply unpublished drafts; resolved by publishing. Showing unfinished drafts to users was deliberately NOT done.

## Remaining Foundational gap (carried)

- **Life's Tools Decoded / "Change" toolkit** — group 06 is organized into sub-toolkits; `06a-Foundational` holds a "Change" subfolder of micro-modules, none built (only `pitch-engine` exists, and that's a sales tool). Needs its own scoping pass. This is the ONLY Foundational gap left.

## Queued (decision captured, not built) — carried forward

- **TYPICAL WAVE (Session 172 focus):** build all Typical-tier activities, starting at Intro and working down the OneDrive `MBWC-0Xb-Typical` folders across every group.
- **ADVANCED WAVE:** after Typical, all Advanced-tier activities across every group.
- Life's Tools/Change Foundational (above).
- Frontend: finish the runner hardening (Track B/C) and ship the search bar.
- COACH-CHAT-METERING, COACH-METER-CLEANUP, optional ai-authoring-chat input cap — still open from prior sessions.

## Standing / ops

- OPS-1: a fresh fixture password was set THIS session on +orgmember / +convert2 / +employee; it supersedes Session-170's and lives in `userMemories` (kept OUT of this public repo). UPDATE `userMemories`.
- Embed/admin pattern: `coaching-activity-embed` is super-admin-gated. To run it (and to smoke-test drafts), the +orgmember fixture was briefly elevated to `brainwise_super_admin` and reverted each time — no persistent privilege change.
- SECURITY sequencing invariant unchanged (repo-verified ≠ live; no base-table `authenticated` read revokes were performed). New `coaching_activity_embeddings` table has RLS enabled, service-role only.
