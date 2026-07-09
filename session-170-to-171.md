# BrainWise Session 170 to 171 Handoff

*Closeout: Session 170. Open: Session 171. Follows `session-169-to-170.md`.*

## Where Session 170 left off

Verified the Purpose/Present anchors live and published them: 0420 "Your PTP" and 0210 "Your Ikigai" are now on the live site, with the metered decrement confirmed on real non-admin sessions for both corporate and individual account types. Then built the next Present Foundational activity, 0450 "Your team" (the inner team of sub-characters), end to end — a new `coaching-inner-team-map` function and a new `inner_team` Team Circle widget — upgraded it mid-build to a guided elicitation flow (8 questions → AI suggests a team → user curates → map, with an AI coverage-completeness gate), verified it live as a corporate non-admin, and published it. Three activities (0420, 0210, 0450) are live and verified; the Present Foundational group is one activity (0475) from done.

## Session 171 opening priorities, in order

### 1. 0475 "Additional future thoughts" (Present Foundational)

Scope world-class from the OneDrive source, present for approval leading with the strongest design question, build backend-first, read the exact live runner via GitHub SHA before any Lovable prompt. Then the Present Foundational group is complete.

### 2. Close the Present group

Any remaining Present Foundational, then move on.

### 3. Continue the transition-map groups

Past, then Resolve, then External Support (Foundational), same cadence.

### Carried residual to close when convenient

- 0420 `assessment_upload` → `coaching-assessment-analyze` live click-through (blocked this session by the `file_upload` tooling gap; function is code-verified + boot-probed). Close via a user-driven upload while watching the bucket + edge logs, or a seeded `coaching_assessment_uploads` row + direct invocation.
- 0450 activity card `thumbnail_url` (grey placeholder; hero renders fine).

## Decisions locked in Session 170

- 0450 "Your team" = the INNER team of sub-characters ("the players on your team"), NOT a work team. It reads only the user's own PTP + story (self-read); it does NOT use `bw_can_read_team_profile`. The Session-169 note that it "leans on the hardened `bw_can_read_team_profile` path" was a pre-source assumption and is corrected.
- 0450 uses a guided elicitation flow (fixed battery + AI completeness pass), chosen as best for a first-timer: fixed questions give traction, and the completeness gate catches the specific angle the person skipped, which is what actually surfaces the whole cast. First "Suggest my team" and each "Map my team"/re-map is one metered run; curating between them is free.
- The AI "suggest" and "profile" are folded into one call (the seed pass both identifies players from the answers and profiles them, and writes the editable roster), to keep a full pass to ~1 metered run.
- Publishing is the mechanism that makes a metered activity testable by a non-admin (draft is super-admin-only, and super-admin is meter-exempt). Approved pattern: publish → live click-through as a non-admin → keep if clean, revert to draft if not.

## Open questions / things to lock in Session 171

- Coach subscription: allowance number, chat-only vs full activities, and price point (COACH-CHAT-METERING). Still open.
- Whether to also cap `ai-authoring-chat` input (super-admin surface, low risk).

## Findings surfaced in Session 170 (added to Build Queue)

- FINDING-CHECK-SUB-CLOBBER: `check-subscription` (v63) re-syncs `subscription_status` from Stripe on login, so a test individual can't be held `active` via a DB flip on production. Verify the individual metered path via one-time chat credits or a Stripe-active fixture.
- FINDING-FILE-UPLOAD-TOOL-GAP: the browser `file_upload` automation no longer accepts host filesystem paths; the `assessment_upload` live path is still unverified.
- Cosmetic: 0450 card thumbnail placeholder.

## What's NOT in scope for Session 171

- Coach subscription pricing/checkout build (design decision still open).
- Re-verifying the shared `check-ai-usage` decrement path (proven live this session for both account types).

## Architecture additions in Session 170

New function `coaching-inner-team-map` v2 (seed-from-elicitation + curated modes, coverage completeness gate, self-read only, metered). New `inner_team` widget (`InnerTeamCircleView`/`InnerTeamCharacterCard`/`TeamCircleBackdrop` + `InnerTeamWidget`, with a roster editor and layer overrides). New activity `present-your-team` (0450). 0420 + 0210 published. No new tables, RLS, or standing rules; no base-table revokes. All recorded in `architecture-reference-APPEND-session170.md`.

## Test fixture state at end of Session 170

Test org: BrainWise Test Corp. Look up current UUIDs via Supabase MCP; the working fixture password lives in Claude's `userMemories` (kept OUT of this public repo).

- testclientbwe+orgmember@gmail.com — org_admin, corporate, has a current PTP, corporate chat allowance. Used for the live 0420 + 0450 corporate E2E. Its own super-admin browser session had to be logged out to run the fixture; Cole re-signs into the live site as himself after.
- testclientbwe+convert2@gmail.com — individual, has a current PTP. Used for the individual 0420 metered check (via one-time credits; credits reset to 0 after).
- testclientbwe+employee@gmail.com — corporate_employee, no PTP. Used to confirm the `ptp_required` gate.

OPS-1: a fresh known password was set on the three fixtures above THIS session and supersedes the Session-169 one; it is in `userMemories`, not here. UPDATE `userMemories` with the new password. When a UI login is unavailable, verify backend via simulated JWT claims + rolled-back transactions.

## Documents this session leaves behind

- BrainWise_Build_Queue_v81.docx (upload to project knowledge)
- BrainWise_System_Architecture_Reference_v77.docx (upload to project knowledge)
- BrainWise_Session_170_to_171_Handoff.docx (this document, upload to project knowledge)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs: `build-queue-APPEND-session170.md`, `architecture-reference-APPEND-session170.md`, `session-170-to-171.md`.
