# Build Queue — APPEND Session 169

*Append to `build-queue.md`. Follows `build-queue-APPEND-session168.md` (Intro group + access model + unified metering). This session (v80) built the Purpose group and the Present anchor activity 0420, fixed the corporate metering enforcement gap, added chat input caps, and ran a multi-round security-hardening arc that locked the assessment/coaching data model behind presentation views.*

## Epic: My Coaching — Purpose group, Present anchor (0420), metering fixes, security lockdown

### DONE (built + verified via GitHub SHA reads + Supabase rolled-back simulations + boot-probes)

- COACH-GROUP-PURPOSE: Purpose (Foundational) built. `0205 lifes-purpose-start` (draft) and `0210 lifes-purpose-ikigai` (draft, seq 210). Ikigai flow: four lens lists → AI lens-membership assignment → server-derived region overlap → coaching plan.
- COACH-SD-0006: "Principles for Living Your Ikigai" reference resource (article/inline_html, reference_library, unpublished) drawn from the module's own material.
- COACH-FN-ikigai-map: `coaching-ikigai-map` v1→v2. v2 adds per-item `reasoning`, a conservative membership prompt, and a `sufficiency {enough, note, questions[]}` deepening gate (with structural fallback) that asks coaching questions before the final plan when the four lenses are thin.
- COACH-WIDGET-ikigai: `ikigai` widget shipped (Lovable) and revised in round 2 — usage instructions above the diagram, a larger brand-colored Venn with stacked/tspan labels (no clipping), per-item AI reasoning with manual lens override, and a firm-nudge deepening gate before the plan. Verified against live `CoachingViews.tsx` / `CoachingActivityRunner.tsx`.
- COACH-ACT-0420: "Your PTP" (`present-your-ptp`, draft, seq 420, `requires_ptp=true`) — the Present anchor. Flow: content → `ptp_display` → qa (ptp_reflection) → `assessment_upload` → qa (assessment_reflection) → `ai_panel` (coaching plan). Shipped in stages.
- COACH-WIDGET-ptp_display: new `ptp_display` widget renders the signed-in user's own five-forces PTP (reuses existing results rendering) + PTP-required lock state on tile and runner.
- COACH-WIDGET-assessment_upload: new `assessment_upload` widget — upload external assessments (DiSC, EQ 2.0, StrengthsFinder, MBTI, HBDI, mental models) as PDF / image / Word, then AI-analyze against the PTP.
- COACH-FN-assessment-analyze: `coaching-assessment-analyze` v1 — reads uploaded assessments (PDF/image native to model; docx text-extracted), analyzes vs PTP, stores `responses.assessment_analysis`. Metered. Boot-probed; docx extraction unit-verified.
- COACH-FN-analyze-multiqa: `coaching-activity-analyze` v12 — serializes ALL `qa_multimodal` steps (multi-phase reflections), backward compatible; resolves `{assessment_analysis}`.
- COACH-GATE-requires_ptp: `coaching_activity_access` adds a `requires_ptp` gate (deny reason `ptp_required`); grant/super-admin bypass. Verified PTP-holder allowed / no-PTP blocked (rolled back).

### BUGS (this session)

- BUG-CORP-METER-UNENFORCED [FIXED]: `check-ai-usage` corporate branch READ the allowance from the enforced counter but WROTE consumption to a different table via a non-existent RPC, so corporate AI usage was silently unlimited (402 never fired). Fixed in v67: corporate consume now goes through `ai_counter_increment` (enforced counter, raises over-limit → 402). Verified live: corporate consume increments and 402s at limit.
- BUG-CHAT-HISTORY-UNCAPPED [FIXED]: `ai-chat` capped the current message (4000) and history COUNT (50) but not each history item's content, enabling direct-call cost amplification. Fixed in v57 (per-item cap 8000 + shape validation). Adjacent: `coaching-activity-chat` v3 caps the inbound message (4000) since its stored history is built from it. Both caps fire before any Anthropic call. Verified live.
- BUG-XSS-URL-SCHEME [FIXED, frontend]: two `window.open(resource.url_or_content)` sites opened without scheme validation (a `javascript:` URL could execute; super-admin-authored only). Guarded with the existing `isSafeHttpUrl`; unsafe external links render as non-actionable tiles. HTML render path was already DOMPurify-sanitized.

### SECURITY HARDENING ARC (multi-round, this session)

- Presentation views created + base tables locked (authenticated/anon read revoked), reads repointed via Lovable: `items` → `items_presentation`; `airsa_skills` → `airsa_skills_public`; `coaching_activities` → `coaching_activities_public` (definition minus `analysis_prompt`/`chat_prompt`); `dimensions` → `dimensions_public`; `response_scales` → `response_scales_public`. Views drop scoring internals (item→dimension map, scoring_method, reverse/scale metadata, prompts).
- Fully locked (no frontend reads, service_role only): `trigger_logic`, `ptp_facet_types`.
- `coaching_assessment_uploads` RLS fixed (an over-broad all-roles policy dropped; six policies scoped to authenticated).
- `ptp_report_highlights` INSERT read-auth: added `bw_can_read_ptp_result()` (SECURITY DEFINER) and gated the INSERT so a viewer can only highlight a PTP result they can actually read (was existence-only → enumeration/pollution). Mirrors the paired/team highlight pattern.
- `bw_can_read_paired_profile` / `bw_can_read_team_profile` now gate on `narrative_status='complete'` (was a fragile section-count heuristic).
- False positives confirmed (ignore in scanner): `newsletter_subscribers`, `users` (properly per-tenant scoped), `coach_pending_bulk_batches` (intentional service-role-only), and the `ops_*` policies on `operations.items`/`operations.users` (a separate schema — not OR'd with `public.*`).

### REGRESSION + RECOVERY (important lesson)

- REGRESSION: base-table reads were revoked while the LIVE/PUBLISHED frontend still ran the pre-repoint bundle. Assessment-taking ("no items found", all four instruments) and super-admin My Coaching went dark on live.
- RECOVERY: bridged reads back open (temporary), waited for the frontend repoint to be PUBLISHED, verified from live API logs that the browser was hitting the VIEWS (not base tables), then re-locked. Post-lock verified: base `items`/`coaching_activities`/`airsa_skills`/`dimensions` return 0 rows for a non-super token; views serve full data.
- LESSON (locked): NEVER revoke a base table's authenticated read until the repointed frontend is PUBLISHED to live AND verified via API logs (browser hitting the view). Repo-verified ≠ live. Sequence: repoint → publish → verify live traffic on views → revoke.

### DECISIONS LOCKED (Session 169)

- 0420 "Your PTP" = visual PTP display + PTP-gated (`requires_ptp`) + external-assessment upload (pdf/docx/image) + AI analysis vs PTP + reflection → coaching plan. Shipped in stages.
- Activities can require a current PTP via a definition flag; denial reason `ptp_required`, tile + runner locked with a link to take the PTP.
- Ikigai: AI assigns lens membership AND supplies its reasoning AND allows manual override AND asks deepening questions before the final plan when the four lenses are thin.
- Non-comped coaches SHOULD be metered on AI chat from the shared pool (the ten `coaching:all` comped coaches stay exempt); a firm nudge, not a hard wall. (Implementation deferred — see QUEUED.)
- Security model: assessment/coaching data reads go through presentation views; base tables are service-role/elevated only. Revoke only after the repoint is published + verified live.

### QUEUED / NEXT (Session 170+)

- COACH-0420-E2E [NEXT]: live click-through of 0420 (PTP gate → upload → assessment-analyze → multi-qa plan → metered decrement) once a real non-admin session exists.
- COACH-ACT-0450 [NEXT]: "Your team" (Present Foundational, heaviest source; leans on the hardened `bw_can_read_team_profile` path).
- COACH-ACT-0475: "Additional future thoughts" + any remaining Present Foundational modules.
- COACH-GROUPS-NEXT: then Past, Resolve, and External Support (Foundational) groups.
- COACH-CHAT-METERING [QUEUED, decision captured]: meter non-comped coaches' AI chat from the shared pool; define + add a coach subscription price carrying the AI-chat allowance (open: allowance number, chat-only vs full activities, price point).
- COACH-METER-CLEANUP: retire now-unused `coaching_usage_check_and_consume`, `coaching_usage_counters`, `one_time_coaching_credits`.
- SEC-AI-AUTHORING-CAP (optional): apply the same input cap to `ai-authoring-chat` (super-admin authoring surface, lower risk).

### GATES / OPEN

- OPS-1 [STILL OPEN]: documented test password does not authenticate PTP fixtures; backend verified via simulated JWT claims + boot-probes. (A working password was set on two fixtures this session for live metering checks — kept OUT of this public repo; see userMemories.)
- Live E2E residuals: metered `analyze → check-ai-usage` path and the 0420 upload→analyze→plan click-through pending a live metered activity + real non-admin session.
- Security re-lock is DONE and verified; the bridge migrations are reversed. Anyone on a pre-publish cached tab must hard-refresh (self-healing).
