# BrainWise Build Queue — APPEND Session 170

*Append to `build-queue.md`. Follows `build-queue-APPEND-session169.md`. Version marker v81 (Session 170 CLOSE). Covers publishing the Purpose/Present anchors after live metered E2E, and building + publishing the Present Foundational activity 0450 "Your team" with a guided elicitation flow.*

## Shipped this session

### 0420 "Your PTP" + 0210 "Your Ikigai" — PUBLISHED (live, metered E2E verified)

Both flipped draft → published after a real non-admin click-through on the live site confirmed the flow and the metered decrement.

- 0420 live E2E as a corporate PTP-holder: `requires_ptp` gate (no-PTP fixture returns `ptp_required` at `coaching_activity_access`; PTP-holder allowed), `ptp_display` renders the user's own five driving forces (self-read RLS, no cross-user leak — confirmed the coaching route URL is the ACTIVITY id, not the session id; each user owns a distinct `coaching_activity_sessions` row), both `qa_multimodal` reflection phases captured (v12 multi-qa serialization confirmed — the plan quoted both), `ai_panel` plan generated + stored.
- METERING CONFIRMED, both account types, on real non-admin sessions:
  - Corporate (org_admin fixture): `ai_usage_counters` (pool `chat`) incremented; UI "runs left" decremented. This validates the Session-169 corporate-enforcement fix (`check-ai-usage` v67 → `ai_counter_increment`) live.
  - Individual: `coaching-activity-analyze` correctly returned 402 while the fixture was free-tier, then 200 once given one-time chat credits; `ai_usage` + `one_time_chat_credits` decremented. (See the OPS finding below on why the pure subscription path could not be exercised.)
- 0210 published on shared-path equivalence: `coaching-ikigai-map` v2 routes through the exact same `check-ai-usage` call with identical gate/exempt logic, now proven live via 0420.

### 0450 "Your team" (Present Foundational) — BUILT + PUBLISHED

The inner-team / sub-characters module ("the players on your team"). Sourced from OneDrive `MBWC - 0450 Present - Your team.docx`. HANDOFF CORRECTION: this is the INNER team (multiple sub-characters each of us runs), NOT a work team — it needs NO `bw_can_read_team_profile` path; it reads only the user's own PTP + coaching story (same self-read pattern as `ptp_display`). Built world-class per Cole's direction, with a guided elicitation flow added after first scope:

- Flow: framing → "how this works" → `qa_multimodal` elicitation (8 specific questions across contexts / time+mood / threat / at-best / relationships / inner-voices / disowned / background) → `inner_team` widget ("Suggest my team" → AI sketches the team from the answers → user curates the roster → "Map my team") → `ai_panel` chat.
- New backend: `coaching-inner-team-map` (v2, metered) + `inner_team` frontend widget (Team Circle). See the architecture APPEND.
- `requires_ptp=false` (uses PTP where relevant but is not gated on it). Foundational entry ticket = current PTP OR active subscription, same as Ikigai.
- Live E2E verified as a corporate non-admin: 8 questions render + capture; "Suggest my team" (seed) identified 5 grounded players from 3 answers, seeded an editable roster; the coverage completeness gate fired and named the exact skipped angles (best-self / inner-voices / relationships / background) with targeted follow-ups; the Team Circle rendered (primary/secondary layer cards, power badges, grow/shrink markers, decision-driver, allies). Corporate metered decrement confirmed (`ai_usage_counters` +1).

## Findings added to queue

- **FINDING-CHECK-SUB-CLOBBER** (not a bug; a test-ops constraint): on the live site, `check-subscription` (v63) re-syncs `users.subscription_status` from Stripe on login. A manual DB flip of a test individual to `subscription_status='active'` is overwritten back to `inactive` on their next sign-in (the fixture has no real Stripe sub). Consequence: the pure individual 200/400 metered path cannot be exercised by a DB flip on production; verify it via one-time chat credits (which are not Stripe-synced) or a genuinely Stripe-active fixture.
- **FINDING-FILE-UPLOAD-TOOL-GAP** (tooling, not product): the browser `file_upload` automation no longer accepts host filesystem paths, and generated test files live in the cloud sandbox, not on the driving machine. So 0420's `assessment_upload` → `coaching-assessment-analyze` path is still NOT live click-through verified (the widget renders; the function stays code-verified + boot-probed from Session 169). RESIDUAL on a live activity — close by a user-driven upload while watching the bucket + edge logs, or a seeded `coaching_assessment_uploads` row + direct invocation.
- Minor polish: 0450 activity card shows a grey thumbnail placeholder (`thumbnail_url` unset); the hero image renders fine in the briefing. Set a `thumbnail_url` for the card.

## Remaining Present group

- 0475 "Additional future thoughts" — NEXT (close the Present Foundational group after it).
- Then continue the transition-map groups: Past, then Resolve, then External Support (Foundational), same cadence.

## Queued (decision captured, not built) — carried forward

- COACH-CHAT-METERING: meter non-comped coaches' AI chat from the shared pool (the 10 comped `coaching:all` coaches stay exempt); define coach subscription price + AI-chat allowance. Still open.
- COACH-METER-CLEANUP: retire `coaching_usage_check_and_consume`, `coaching_usage_counters`, `one_time_coaching_credits`.
- Optional: cap `ai-authoring-chat` input (super-admin surface, low risk).

## Standing / ops

- OPS-1 still open: the documented (public-repo) password does not authenticate the PTP fixtures. A fresh known password was set THIS session on the +orgmember / +convert2 / +employee fixtures for the live E2E; it supersedes the Session-169 password and is kept OUT of this public repo (in `userMemories`). Verify backend via simulated JWT claims + rolled-back transactions when a UI login is not available.
- SECURITY sequencing invariant unchanged (BQ-SEC-REVOKE-AFTER-PUBLISH-INVARIANT): repo-verified ≠ live; never revoke a base-table `authenticated` read until the repointed frontend is published AND verified on the live view. No base-table revokes were performed this session.
