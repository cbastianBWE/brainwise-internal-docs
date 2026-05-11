# BrainWise System Architecture Reference

*v55 - Session 56 IN-PROGRESS (§33 and §34 added: standing patterns from Prompts 3.1-3.4 cycle. §33 covers PostgREST FK-disambiguation in embedded selects — when a child table has multiple FKs to the same parent, embedded selects MUST use `!<column_name>` syntax or return silently-null rows. Discovered Session 56 in AttachedCurriculaSection; one-line fix in Prompt 3.3. Standing recon protocol added for Prompts 4+: enumerate FKs on every join table before writing embeds. §34 covers content authoring tree's "All <type>" sections — Prompt 3.4 renamed Standalone → All, removed attachment-status filters, added selection-ancestor auto-expand via reverse-lookup Maps for cu and mo nodes. Same curriculum now appears in both hierarchical and flat sections, selection state shared via nodeKey. Forward-compat notes for Prompts 4-5 included.)*

*v54 - Session 56 IN-PROGRESS (§32 added: soft-archive slug uniqueness fix. Migration slug_unique_only_among_active_for_authoring_tables shipped: dropped global *_slug_key UNIQUE constraints on certification_paths/curricula/modules, replaced with partial unique indexes (slug) WHERE archived_at IS NULL. Matches existing lesson_blocks_active_order_uniq pattern. Discovered when Cole archived PTP-Coach and tried to recreate — 23505 toast incorrectly suggested active-slug collision. Now archived rows release their slug for reuse; active-active collisions still rejected. Established as standing pattern for any future authoring table with slug + archived_at.)*

*v53 - Session 56 IN-PROGRESS (Step 1 SHIPPED: AI authoring Edge Functions deployed. draft-lesson-block v1, scaffold-lesson v1, draft-text v1 all ACTIVE. Canonical `_shared/impersonation_gate.ts` source extracted from production via `get_edge_function` on set-account-type v43. Deploy followed §23.7's "Custom (set-account-type)" `entrypoint_path` pattern: `<function-name>/index.ts` plus `_shared/<file>.ts` in the files array. §29.5 updated from "pending Session 56" to SHIPPED state with full deploy parameters, audit pattern, and deferred-verification list. Live super-admin happy-path and impersonation-denied path verification deferred to Lovable Prompt 5 frontend integration.)*

*v52 - Session 55 CLOSE (Phase 4 backend prep COMPLETE + Lovable Prompt 1 landed + invite-coach hardening FULLY shipped: backend + frontend. Backend: 8 prep migrations (notifications/CHECKs/lesson_blocks/CRUD/AI infra) + 1 hardening migration (coach_invitations email tracking columns: email_send_status/email_send_error/email_last_attempt_at); 10 authoring CRUD RPCs deployed; AI authoring infrastructure with 5 voice presets and 5 context blocks. Edge Functions: invite-coach redeployed v10→v11 with resend-aware logic (detects existing pending row and resends instead of refusing), email_type/source passed to send-email (was 'unknown'), hard email-send failure surfacing, email status persisted to row. End-to-end Resend button verified via test row. Cheryl's invitation flow verified separately. Frontend: Content Authoring shell live in production; Coach Management hardening Lovable prompt landed and verified (584 lines, up from 495) — 4 call sites use new inspectInviteCoachResponse helper, Email Status column with Sent/Failed/Pending badges, Retry Email button with destructive styling on failed rows. AI Edge Functions (3) drafted locally but not deployed pending canonical _shared/impersonation_gate.ts source confirmation in Session 56. New standing protocol locked: every Lovable prompt now requires backend + frontend + branding recon (3 passes). See architecture-reference §28-§31 for full Session 55 detail.)*

*v51 - Session 55 CLOSE (initial close marker — superseded by v52 above after invite-coach hardening late-session).

*v50 - Session 55 IN-PROGRESS — superseded by v51 CLOSE marker above.

*v49 - Session 54 CLOSE (Group C backend complete through Phase 3.5; new §27 covers all Group C tables, RPCs, notifications subsystem, and Phase 3.5 authoring-adjacent RPCs. Two standing rules locked: SOC 2 from inception, Impersonation gate from inception. Vault secret `internal_function_secret` runbook pending Cole's one-time setup before any email-channel notification fires in production. Phase 4 frontend work begins Session 55.)*

*v48 - Session 53 CLOSE (Group A Phase C + Phase D fully shipped and verified end-to-end. New §26.7 hook freshness gate, §26.8 mfa_challenges fallback, §26.9 lifecycle event mode column, §26.10 paginated multi-field search, §26.11 my_access_history category default, §26.12 identityMutation helper. §25.9 partially reversed in §26.4. §25.10 corrected in §26.1. Session 54 opens Group C — Coach Certification + Resources / Learning Paths.)*

## 1. Overview

This reference captures the canonical system architecture for the BrainWise platform as of Session 45 close. **Three Session 45 shipments**: AIRSA org dashboard PDF export delivered end-to-end (`src/lib/generateAIRSADashboardPdf.ts` ~1276 lines, sections: Cover + Overview + Domains + Skill Inventory + Manager Calibration + Trends), `generate-airsa-org-narrative` v2 deployed with rewritten action-oriented voice prompt (canonical template for future voice work), and risk-flag color fix shipped. Two rendering bugs fixed: PDF `bodyText` font-state leak through continuation pages, and frontend hyphen-bullet rendering via new `renderNarrativeText` helper.

A comprehensive scope doc was produced for the Org Overview Dashboard + AIRSA cross-instrument extensions (4 phases, 3-5 sessions estimated, parked at `/mnt/user-data/outputs/org-overview-and-airsa-cross-instrument-scope.md`). Test fixture overlap verified: 44 PTP+AIRSA users, 34 NAI+AIRSA users, 32 all-three. **Sub-task 2b (test fixture seeding) dropped entirely** — no seeding needed.

Prior context: Phase 5b AIRSA org dashboard frontend shipped Session 44. Phase 5a backend (RPC and Edge Function) shipped Session 43. AIRSA dual-rater Phase 2 (backend workflow), Phase 3a (calculate-scores enhancement), Phase 3b (self-rater post-submit experience), Phase 3e backend (AI section generators), Phase 3e frontend (AirsaCombinedReport.tsx, 14-section combined report), and Phase 4 (PDF export) are all shipped to production and verified.

A production hot-fix shipped in Session 38 unblocked corporate invitation redemption. PTP Pleasure brand color flipped from yellow to forest green across the entire codebase. NAI Saturation color refactor (#FFB703 to mustard #7a5800) shipped in Session 39 via Lovable. Phase 3e frontend shipped via AirsaCombinedReport.tsx in Session 40 with multiple visual polish iterations. Phase 4 PDF export shipped in Session 41. Phase 5a backend recon completed and AIRSA test fixture seeded in Session 42 (47 pairs total in production, org-wide TCI = 40.1). The complete brand color map and the AIRSA STATUS_COLORS canonical mapping are in Section 5.

## 2. AIRSA dual-rater workflow - current state

### 2.1 State machine

AIRSA dual-rater is a paired-assessment workflow. A self-rater completes their AIRSA, which automatically creates a paired manager assessment row pointed at their supervisor. The supervisor takes the manager rating; once both legs complete, a combined results row is generated with self-manager divergence calculated, and AI section generators fan out to populate facet_interpretations rows.

Both legs of the pair use instrument_id = INST-003. The legs differ on rater_type (lowercase 'self' vs 'manager') and on which user_id is the rater versus the target_user_id.

Status flow per leg:

- Self leg: in_progress -> completed
- Manager leg: pending -> in_progress -> completed

### 2.2 Database schema additions to assessments

- paired_assessment_id (uuid, FK to assessments.id, ON DELETE SET NULL) - reciprocal linkage between self and manager rows
- reminder_count (int, default 0) - tracks reminder emails sent by self-rater
- last_reminder_sent_at (timestamptz, nullable) - enforces 72-hour cooldown server-side
- self_only_released_at (timestamptz, nullable) - set when self-rater clicks Release self-only after 14d timeout
- status CHECK constraint extended to allow 'pending'

Indexes: idx_assessments_paired_assessment_id, idx_assessments_target_user_status.

### 2.3 Database schema additions to assessment_results

- UNIQUE constraint on assessment_results.assessment_id (name: assessment_results_assessment_id_unique). Required for ON CONFLICT upsert in calculate-scores combined-result merge.
- skill_level_breakdown JSONB column (NEW in v33). Populated by calculate-scores Branch A. Shape: keyed by item_number string; each value contains skill_number, skill_name, skill_description, dimension_id, domain_name, self_level, manager_level, self_response, manager_response, delta, direction, status. Partial index where instrument_id = 'INST-003'.

manager_dimension_scores and self_manager_divergence columns already existed; they are now populated by Branch A. self_manager_divergence per-dimension entries now include a `status` field (NEW in v33) with values aligned, confirmed_strength, confirmed_gap, blind_spot, underestimate.

NOTE: an `airsa_report_sections` JSONB column was briefly added and then dropped during Session 39 after a concurrency-design pivot. AI section content lives in facet_interpretations (Section 2.11), not on this table.

### 2.4 Schema convention warning

rater_type case sensitivity is split across the schema. items.rater_type uses CAPITAL-S 'Self' and CAPITAL-M 'Manager'. assessments.rater_type uses LOWERCASE 'self' and 'manager' (per the assessments_rater_type_check CHECK constraint). All Phase 2 backend code conforms to the assessments lowercase convention. Phase 3 frontend code that loads items for the supervisor's rating flow must use capital-M 'Manager' when querying the items table. Cross-table joins on rater_type WILL FAIL silently because of the case mismatch. Always normalize at the boundary.

### 2.5 Pair-creation trigger

Function: public.create_airsa_manager_pair_on_self_complete (SECURITY DEFINER, search_path = public).
Trigger: on_airsa_self_completed_create_pair, AFTER UPDATE on assessments, FOR EACH ROW.

Logic, in order:

- Skip if not AIRSA, not self rater_type, not flipping to completed, or already completed (idempotent)
- Look up self-rater's supervisor_user_id; if null, skip pair creation (assessment proceeds solo)
- Validate supervisor: must be active and in same org as self-rater; otherwise skip
- Idempotency guard: skip if a paired manager row already exists
- INSERT manager assessment row: user_id = supervisor, target_user_id = self-rater, rater_type = 'manager', status = 'pending'
- UPDATE self assessment row to set its paired_assessment_id reciprocally
- Fire async pg_net.http_post to airsa-supervisor-invite Edge Function

All exception paths use RAISE WARNING and RETURN NEW. The trigger never blocks the parent transaction.

### 2.6 RLS anchoring fix on assessments

The original 'assessments: managers read assessments they ordered' policy used target_user_id = auth.uid() OR ordered_by_coach_id = auth.uid(). For AIRSA, the self-rater IS the target_user_id on the manager row, which would have leaked manager assessment metadata to them.

New policy expression:

```
(instrument_id != 'INST-003' AND (target_user_id = auth.uid() OR ordered_by_coach_id = auth.uid()))
OR (instrument_id = 'INST-003' AND ordered_by_coach_id = auth.uid())
```

Effect: non-AIRSA behavior preserved. For AIRSA, the target_user_id read path is removed; supervisors read their manager assessment via 'users read their own' (user_id = auth.uid()). Self-rater never reads the manager row metadata.

### 2.7 Combined-results gate RPC

public.airsa_can_generate_combined_result(p_self_assessment_id uuid)

Returns: out_can_generate, out_mode ('combined' | 'self_only' | 'blocked'), out_reason, plus context fields.

Decision tree:

- Self assessment not found or not AIRSA Self rater_type -> blocked / not_*
- Self status != 'completed' -> blocked / self_not_completed
- paired_assessment_id IS NULL -> self_only / no_paired_manager_no_supervisor
- Paired manager status = 'completed' -> combined / both_rater_types_completed
- self_only_released_at IS NOT NULL -> self_only / self_only_released_after_timeout
- Otherwise -> blocked / awaiting_manager_completion

calculate-scores invokes this gate before deciding what to write to assessment_results.

### 2.8 RPCs (all SECURITY DEFINER, GRANT EXECUTE TO authenticated unless noted)

- airsa_can_generate_combined_result(uuid) - the gate (see 2.7)
- airsa_release_self_only(uuid) - 14-day timeout self-only release
- airsa_send_reminder(uuid) - reminder with 72-hour cooldown
- airsa_request_rerate(uuid) - 90-day cooldown re-take
- my_pending_manager_assessments() - supervisor's pending cards on /assessment
- my_direct_reports_with_pending_ratings() - direct reports + AIRSA cycle status
- airsa_get_my_paired_manager_status(uuid) - self-rater reads minimal paired-manager metadata for awaiting-state UI; closes the RLS gap from 2.6
- airsa_get_paired_self_rater_name(uuid) - manager-side minimum-disclosure RPC for paired-name read by corporate_employee role
- **get_airsa_aggregate(p_slice_type text, p_slice_value text)** - org dashboard aggregate (NEW Session 43, see §10.6 for full payload shape and §10.7 for the consuming Edge Function)

### 2.9 Edge Functions (rater-flow)

airsa-supervisor-invite v2 (Class B, INTERNAL_FUNCTION_SECRET gated)

- Triggered by: pg_net call from create_airsa_manager_pair_on_self_complete
- Input: { manager_assessment_id }
- Action: builds branded HTML email, forwards to send-email

airsa-supervisor-reminder v2 (Class A, JWT-required)

- Triggered by: frontend after airsa_send_reminder RPC succeeds
- Input: { manager_assessment_id }
- Authorization: caller must equal target_user_id on the manager assessment

Both deployed with verify_jwt: false (consistent with codebase; validation happens inside function bodies via auth.getClaims).

### 2.10 calculate-scores - v42 (Phase 3e fan-out wired)

Three explicit branches:

Branch A: AIRSA Manager submission. Loads paired self assessment + responses; computes self dimension scores; computes manager dimension scores; computes self-manager divergence with status field; computes skill_level_breakdown by joining assessment_responses self+manager with airsa_skills with dimensions; UPSERTs the assessment_results row keyed by SELF assessment_id with manager_dimension_scores, self_manager_divergence, and skill_level_breakdown populated; flips manager assessment to completed; triggers generate-report fire-and-forget (legacy narrative path) and ALSO triggers all six AIRSA AI section generators in parallel via fire-and-forget (Phase 3e fan-out).

Branch B: AIRSA Self submission. Flips self to completed; calls the gate; if 'blocked' returns awaiting_manager with no results row written; if 'self_only', upserts results row with no manager fields and triggers generate-report.

Branch C: All non-AIRSA paths. Preserved byte-for-byte from prior versions.

Detection: `isAirsaCorrect = instrument_id === 'INST-003'` drives all AIRSA branching. Legacy isAIRSA prefix check preserved (always false in practice) to avoid changing PTP/NAI/HSS code paths.

KNOWN BUG: Branch B re-stamps completed_at on the self-only release path. See Build Queue BUG-5.

### 2.11 AI section generators (NEW in v33) - storage, auth, and orchestration

Six Edge Functions, one per section. Storage shared with existing PTP/NAI AI content via the facet_interpretations table.

Functions:

- generate-airsa-profile-overview v5 - section_type airsa_profile_overview, plain text, 800 max_tokens
- generate-airsa-what-this-means v3 - section_type airsa_what_this_means, JSON 4-key object, 2000 max_tokens
- generate-airsa-action-plan v3 - section_type airsa_action_plan, JSON 3-key object, 600 max_tokens
- generate-airsa-conversation-guide v3 - section_type airsa_conversation_guide, JSON 3-key object, 600 max_tokens
- generate-airsa-top-priorities v2 - section_type airsa_top_priorities, JSON array of 3 objects, 1500 max_tokens
- generate-airsa-cross-instrument v2 - section_type airsa_cross_instrument, plain text, 1200 max_tokens, conditional

Orchestration: calculate-scores Branch A fires all six in parallel via fire-and-forget HTTP POST with `x-internal-secret`. Each writes its own facet_interpretations row keyed by (assessment_result_id, section_type) UNIQUE. Frontend reads all rows in a single SELECT WHERE assessment_result_id = ? AND section_type LIKE 'airsa_%'.

Storage row shape (facet_data JSONB):

- For plain-text sections: { content: "<text>", ai_version, model }
- For JSON-object sections: { content: { ...keys }, ai_version, model }
- For array sections: { content: [...], ai_version, model }
- For cross-instrument with PTP/NAI present: { content, ai_version, model, has_ptp, has_nai }

Auth model (per function): hybrid Class A + Class B. Internal secret with constant-time `safeEqual` comparison for service-to-service calls (calculate-scores Branch A, pg_net tests). User JWT via auth.getClaims for frontend calls, with ownership check against assessment_results.user_id and AIRSA-only gate (instrument_id === 'INST-003').

Cache discipline: each function checks for an existing row first. Returns cached content with no AI call if present and force_regenerate flag is not set. Force regenerate path deletes the row before insert. Concurrent same-section calls handled via 23505 unique-violation catch: re-read and return cached.

Race-condition fix history: an earlier attempt used a JSONB merge column on assessment_results, which suffered last-write-wins overwrites under parallel fan-out. A SECURITY DEFINER atomic-merge RPC was tried as a fix, then dropped. The current per-row pattern in facet_interpretations is the canonical solution and matches PTP/NAI precedent.

Cross-instrument skip behavior: when the user has neither PTP (INST-001) nor NAI (INST-002) results, the function returns success with skipped=true and writes NO row. Frontend treats absence of the row as "show unlock CTA". This mirrors the existing facet_interpretations convention where missing rows render empty.

Output discipline (all six functions):

- Reference skills by NUMBER only ("Skill 7"), never by name. Frontend post-processor wraps "Skill N" mentions with hover-tooltip components reading from skill_level_breakdown.
- BANNED words in AI output: fascinating, valuable, interesting, exciting, striking, remarkable, dynamic, masking
- BANNED phrases: "this creates", "this suggests you", "may be masking", "valuable calibration"
- No em-dashes
- Domain names used in prose, never dimension IDs
- Model: claude-sonnet-4-20250514 across all six

Shared utilities (inlined per function deploy because Edge Functions deploy per-folder):

- _shared/secrets.ts: `safeEqual` constant-time comparison (SOC 2 CC6.1)
- _shared/errors.ts: `serverError` sanitized 5xx (SOC 2 CC7.2)

### 2.12 airsa_skills reference table (NEW in v33)

Static lookup table seeded from the canonical AI Readiness Skills Profile source document (24 skills across 8 domains).

Schema:

- item_number INTEGER PRIMARY KEY
- dimension_id TEXT NOT NULL FK -> dimensions.dimension_id (UNIQUE constraint required for FK)
- skill_name TEXT NOT NULL
- short_description TEXT NOT NULL
- full_definition TEXT NOT NULL
- theoretical_basis TEXT
- behavioral_indicators JSONB
- is_new_skill BOOLEAN NOT NULL DEFAULT false (true for skills 10, 17, 22)
- primary_p TEXT CHECK (Protection|Participation|Prediction|Purpose|Pleasure)
- secondary_ps JSONB
- created_at, updated_at with updated_at trigger

RLS: read-only authenticated. No writes from app code.

Distribution verified: 24 total rows, 3 with is_new_skill = true (10, 17, 22), domain coverage D1=3 D2=3 D3=4 D4=3 D5=4 D6=2 D7=2 D8=3, primary_p coverage Protection=5 Participation=5 Prediction=6 Purpose=3 Pleasure=5.

Used by: calculate-scores Branch A (joins to build skill_level_breakdown); the 6 AI section generators (read indirectly through skill_level_breakdown which already contains the denormalized skill metadata).

### 2.13 AIRSA scale labels (Session 42 lock)

AIRSA frequency scale: `0=Never, 1=Rarely, 2=Often, 3=Consistently`. NOT "Always". Items table values verified during Session 42 fixture seeding. Frontend, PDF, and AI prompts must all use this exact labeling. Any drift to "Always" in copy is a bug.

## 3. Frontend - Phase 3b through Phase 3e shipped

### 3.1 /my-results AIRSA awaiting-state (shipped Session 38)

Awaiting state polls airsa_get_my_paired_manager_status periodically with early-exit when status changes to completed mid-poll. Time-based UI:

- 0-13 days: awaiting card only
- 14-89 days: awaiting card + Send Reminder + Release Self-Only
- 90+ days: awaiting card + Re-take confirmation dialog

### 3.2 Self-rater frontend data path (shipped Session 38)

The self-rater cannot read the manager assessment row directly (RLS blocks via 2.6). The awaiting-state UI gets data exclusively through airsa_get_my_paired_manager_status RPC.

### 3.3 Combined report frontend (SHIPPED in Session 40)

AirsaCombinedReport.tsx (~1360 lines) is the canonical 14-section AIRSA combined report. Mounted at `/my-results` for users whose selected result has `instrument_id === "INST-003"`. Reads `assessment_results.skill_level_breakdown` plus all `facet_interpretations` rows where `section_type LIKE 'airsa_%'` in a single fetch on mount. Loading skeletons per section while AI fan-out is still completing. Polls every 8 seconds for missing AI sections until all six arrive or 90 seconds elapsed.

Section list (14 sections, Section 10 quadrant removed in Session 40):

1. Header
2. At a glance (4 metric cards)
3. Action buttons (Export PDF / Retake / Take Another - matches PTP/NAI standard)
4. How to read your results (with AIRSA overview folded in, 4-level frequency to 3-level readiness)
5. Domain heatmap (5-status column with `whiteSpace: nowrap` pill, Status column min-width 160)
6. Profile overview (AI - airsa_profile_overview)
7. What does this mean to me? (AI - airsa_what_this_means, 4 themed boxes with tone pills)
8. Action plan (AI - airsa_action_plan, 3 timeframes with navy/teal/green branded pills)
9. Skill-by-skill comparison lollipop (24 skills, chartW=560, level-zone shading, combined legend at top with star explanation)
10. Conversation guide (AI - airsa_conversation_guide, 3 openings with role pills)
11. Top 3 development priorities (AI - airsa_top_priorities, status-color pills)
12. How this connects to your other assessments (AI - airsa_cross_instrument, conditional)
13. Skill reference list, collapsed (all 24 skills)
14. Methodology footer

Star marker semantics: `★` next to a skill name in Section 9 indicates the skill is one of the user's three top priorities (sourced from `airsa_top_priorities.content[].skill_number`). Computed via useMemo on the `data` object. NOT surfaced in Section 11 priority cards or Section 13 reference list.

Self-only mode: same layout structure, manager columns hidden, no divergence pills, banner explaining manager rating did not arrive. The SkillReference popover, the lollipop legend, and the heatmap status column all gate on `!isSelfOnly`.

### 3.4 AIRSA combined report PDF export (SHIPPED in Session 41)

`src/lib/generateAirsaPdf.ts` (NEW) is the canonical PDF renderer for AIRSA. Pattern mirrors `generateNaiPdf.ts` exactly: jsPDF native primitives only, helvetica family, page-numbering loop at the end, `addFooter` / `checkPageBreak` / `ensureBlockSpace` / `sectionHeading` / `bodyText` / `cleanMarkdown` / `hexToRgb` helpers. Cover page + 14 sections (Header always rendered, Section 3 buttons skipped because they're screen-only, all other 12 sections individually toggleable via `AirsaPdfSections` interface). Filename pattern `BrainWise-AIRSA[-Coach][-SelfOnly]-<LastName>-<YYYY-MM-DD>.pdf`.

`src/lib/assemblePdfDataForUser.ts` (EDIT) gained `assembleAirsaPdfData()` export. Reuses `fetchCommon()` helper, queries `assessment_results.skill_level_breakdown` and all `facet_interpretations` rows where `section_type LIKE 'airsa_%'`, plus `airsa_skills` for the 24-row self-only fallback. Returns typed `AirsaPdfData` object. Footer metadata fallback: `aiGeneratedAt = anySection?.generated_at ?? result.created_at ?? null` because AI generator Edge Functions do not consistently populate `generated_at` in the `facet_data` JSONB.

`src/components/results/ExportPdfModal.tsx` (EDIT) gained `AirsaPdfSectionsUi` interface, `AIRSA_GROUPS` config (4 groups: Profile sections / Skill detail / Cross-cutting / Reference), `instrumentType: "AIRSA"` branch, `onExportAirsa` prop. PTP/NAI code paths untouched.

`src/pages/MyResults.tsx` (EDIT): the `<ExportPdfModal>` was lifted out of the `!isAIRSA` branch so it renders for all instruments. `instrumentType` switches on `isAIRSA / isNAI / isPTP / "OTHER"`. `handleAirsaPdfExport` callback dispatches `assembleAirsaPdfData()` then `generateAirsaPdf()`.

`src/components/results/AirsaCombinedReport.tsx` (EDIT): `onExportClick?: () => void` prop added; the Export PDF button stub (`alert("PDF export coming soon")`) replaced with `onExportClick?.()`. The 1360-line component is otherwise untouched, preserving Session 40 visual polish and Rules of Hooks structure.

PDF rendering decisions locked in Session 41:

- **Lollipop** rendered as native jsPDF lines + circles on its own page. Level-zone shading uses pre-blended values (peach/sky-blue/green-tint blended against white at 60% opacity) so jsPDF GState reliability across viewers is not a concern. STATUS_COLORS mapping reproduced exactly: aligned dot, blind_spot dashed line via `setLineDashPattern([1.2, 1.0], 0)`, all other statuses solid lines. Self-only mode: single teal dot per skill, no lines.

- **Star glyph substitution.** ★ (U+2605) is not in WinAnsiEncoding which jsPDF default helvetica uses. PRIORITY_GLYPH = "*" constant in `generateAirsaPdf.ts`. The on-screen `AirsaCombinedReport.tsx` continues to use ★. Pattern documented in §5.6.

- **Section 6 Profile overview** uses the sectionHeading anti-orphan pattern: card height computed first (5mm padding + descLines × 4.5mm leading + 5mm padding), passed as `minContentNeeded` argument to sectionHeading. Wrap width is `CONTENT_W - 12` (full content area minus 6mm × 2 inner padding) to match the "What this means" cards.

- **Skill reference list** computes per-entry height from `headingH (4.5) + domainH (3.8) + descLines × 4.2 + padH (4)`, sets font BEFORE splitTextToSize (canonical pattern, see §5.6), and uses computed height for both `ensureBlockSpace` and `y` advance. Result: ~6-8 skills per page comfortably.

- **Top priorities cards** computes per-card height from pill (5+2) + title row (6+4) + 2 eyebrows (each 4+1) + targetLines (×4.5) + practiceLines (×4.5) + padding. Same pattern as skill reference. Status pill bg blended at 20% saturation, text at full saturation.

## 4. Production hot-fix: corporate invitation redemption (carried from v32)

GUC opt-out pattern: `app.bypass_user_immutable_check`, set transaction-locally via set_config(name, value, true) inside the invitation_redeem RPC body. The enforce_immutable_user_fields trigger reads current_setting(name, true) and short-circuits if 't'. Defense-in-depth via the users-update-own-safe-fields RLS WITH CHECK clause. SOC 2 CC6.1 / CC6.3 / CC7.2 compliant.

Audit follow-up logged in Build Queue (BUG-7): enumerate other SECURITY DEFINER functions that UPDATE public.users.

## 5. Brand color complete map

### 5.1 Locked dimension color assignments

PTP dimensions:

- Protection: #021F36 (navy)
- Participation: #006D77 (teal)
- Prediction: #6D6875 (slate gray)
- Purpose: #3C096C (plum/purple)
- Pleasure: #2D6A4F (forest green)

NAI dimensions:

- Certainty: #021F36 (navy)
- Agency: #F5741A (orange)
- Fairness: #006D77 (teal)
- Ego Stability: #3C096C (plum/purple)
- Saturation: #7a5800 (mustard)

Instrument-level:

- AIRSA primary: #2D6A4F (forest green)
- HSS primary: #6D6875 (slate gray)

### 5.2 Brand tokens preserved

The CSS token --bw-amber: #FFB703 in src/index.css and src/styles/marketing-tokens.css is preserved. It remains the brand palette yellow used by the --warning semantic token and other UI elements. After the v33 Saturation refactor, #FFB703 no longer appears as a dimension color anywhere.

### 5.3 AIRSA combined report STATUS_COLORS canonical mapping (Session 40 lock)

The five AIRSA dual-rater statuses each use a distinct brand color. This mapping is authoritative — it drives the lollipop line color, the heatmap status pill, the priority card status pill, and the Section 5 "skills by status" indicator dots in AirsaCombinedReport.tsx.

- aligned: #006D77 (teal)
- confirmed_strength: #2D6A4F (green)
- confirmed_gap: #6D6875 (gray)
- blind_spot: #021F36 (navy)
- underestimate: #3C096C (purple)

Dash pattern is preserved on `blind_spot` only. Other statuses use solid lines and chips.

Cross-instrument note: #3C096C is also used as the PTP Purpose dimension color. Contexts never overlap on the same screen, so the reuse is acceptable.

### 5.4 AIRSA lollipop level-zone shading (Session 40 lock)

Three vertical band colors behind the dots in `LollipopChart` only. These three hex values must NOT be used anywhere else in the codebase:

- Foundational (left third): #FCE4D6 (warm peach)
- Proficient (middle third): #D6E8F5 (clear sky blue)
- Advanced (right third): #D8E8D0 (fresh leaf green-tint)

All three at fillOpacity 0.6. Hardcoded hex literals required in the SVG `fill` attribute (CSS variables do not resolve there).

### 5.5 Quadrant map removed (historical note)

Section 5.3 of v33 documented quadrant map colors. The developmental quadrant section was built in Session 40 and then removed mid-session. Rationale: it duplicated lollipop information in less-readable form. Section count dropped from 15 to 14. The four quadrant labels (Underestimate, Confirmed strength, Confirmed gap, Blind spot) are now visible exclusively through the STATUS_COLORS mapping above.

### 5.6 jsPDF rendering rules (Session 41 lock)

Three rules govern PDF generation across all instruments:

**WinAnsiEncoding glyph constraint.** jsPDF default helvetica uses WinAnsiEncoding. Unicode glyphs outside that codepoint range (★ U+2605, ◆ U+25C6, etc.) get substituted by jsPDF's encoder to a fallback character (observed: ampersand `&`). Pattern: define an ASCII-equivalent constant in the PDF generator (`PRIORITY_GLYPH = "*"`) and use it everywhere the on-screen report uses the Unicode glyph. The on-screen component continues to use the Unicode glyph because browsers handle U+2605 fine. This rule applies to the AIRSA PDF (★ → `*`) and any future PDF generator that wants to mirror an on-screen Unicode glyph.

**splitTextToSize font-state dependency.** `doc.splitTextToSize(text, width)` uses the CURRENT font for width calculation. Setting font BEFORE calling splitTextToSize is the canonical pattern, already commented in `generateNaiPdf.ts` line 406-407: "splitTextToSize uses the CURRENT font for width calc. Set font to match rendering font BEFORE splitting, or wrap widths come out wrong." Skipping this produces correct text but wrong wrap width, causing entries to render at narrow column widths even when full content area is available. All four AIRSA PDF render loops (Profile overview, Skill reference, Top priorities, What this means cards) follow this pattern.

**Section heading anti-orphan pattern.** When a section has a body card whose total height is computable upfront, pass that height plus heading clearance as the `minContentNeeded` argument to `sectionHeading()`. The helper does a page-break check before drawing the heading; if the page can't fit heading + card together, it advances to a new page first. Skipping this orphans the heading on one page with the body card on the next. Examples: `sectionHeading("Profile overview", overviewCardH + 6)`, `sectionHeading("Skill reference list", 60)`, `sectionHeading("Top 3 development priorities", 70)`.

## 6. Edits to existing surfaces

### 6.1 marketing-tokens.css

Two semantic alias tokens added in Session 37 after the existing --success/--warning/--info/--premium line:

```
--danger: var(--bw-orange-700); --danger-soft: var(--bw-orange-100);
```

The brand uses orange (not red) for danger states. App-side index.css does NOT mirror these aliases yet (see Build Queue: semantic-token reconciliation).

### 6.2 AdminUsers.tsx

Two banners above the Users tab Card showing supervisor health (no supervisor assigned, deactivated supervisor). Each has a Review button that filters the user table.

## 7. Three-tier Edge Function auth model

Class A: JWT via auth.getClaims (user context, frontend-callable)

- Used by: airsa-supervisor-reminder v2, calculate-scores, invitation_send, generate-airsa-org-narrative v1 (primary path)
- Will be used by: generate-airsa-org-narrative (Phase 5a, mirrors generate-dashboard-narrative v22)

Class B: x-internal-secret header (value INTERNAL_FUNCTION_SECRET from Edge Function Secrets, validated with constant-time `safeEqual` comparison)

- Used by: airsa-supervisor-invite v2, send-email, generate-report
- The 6 AIRSA AI section generators support BOTH Class A and Class B (hybrid) on the same function

Class C: x-dispatcher-secret (departure_dispatcher_shared_secret)

- Used by: pg_cron entry points only
- Currently: dispatch_grace_reminders_daily, sync_stripe_prices_daily

## 8. Locked architectural constraints

- Two sequential Anthropic Opus calls cannot be bundled in one Edge Function (Supabase 150-second timeout). Phase 3e splits this into 6 separate functions with frontend parallel fan-out.
- auth.getClaims is the canonical JWT verification method; not getUser, not local decode
- After every apply_migration via MCP, run a separate execute_sql verification query
- Multi-statement execute_sql returns only the last statement's result; split intermediate checks
- Edge Function Secrets are not readable/writable via MCP; verify via dashboard or indirect pg_net wrong-secret HTTP tests
- get_edge_function returns full source and is reliable for pre-patch audits
- deploy_edge_function requires complete file content; always preserve verify_jwt: false explicitly
- Before generating values for an existing table, query pg_constraint for CHECK rules. Reading information_schema.columns is not sufficient.
- GUC opt-out pattern for SECURITY DEFINER UPDATEs that legitimately need to bypass enforce_immutable_user_fields: app.bypass_user_immutable_check, transaction-local
- NEW (Session 39): When multiple Edge Functions write per-section AI content, use the per-row pattern in facet_interpretations with UNIQUE (assessment_result_id, section_type) and 23505 race-recovery, NOT a JSONB merge on a shared column. The merge approach suffers last-write-wins under fan-out.
- NEW (Session 39): Constant-time secret comparison via `safeEqual` for `x-internal-secret` validation in Class B and hybrid auth, not direct string equality. Inlined per Edge Function via _shared/secrets.ts pattern.
- NEW (Session 40): SVG `fill` attribute does NOT resolve CSS variables in production browsers. `fill="var(--bw-cream)"` evaluates to nothing and the shape doesn't render. Use either hardcoded hex literals (`fill="#F9F7F1"`) or the inline `style={{ fill: "var(--bw-cream)" }}` form. The lollipop level-zone bands surfaced this during debugging.
- NEW (Session 40): React Rules of Hooks violations cause silent blank pages in production builds (no visible error, just an empty render tree because there's no error boundary above the failing component). Diagnostic signature: console shows minified React error #310 ("Rendered more hooks than during the previous render"). Mechanism: any hook placed AFTER an early return causes hook-count mismatch between renders. Mitigation: ALL hook calls (useState, useEffect, useMemo, useRef, useCallback) must appear at the top of a component body, BEFORE any `if (loading || !data) return ...` guard. Verified via the Phase 3e frontend `prioritySkillNumbers` useMemo bug.
- NEW (Session 40): When passing computed Sets/Maps from a parent component into a memoized child, derive them via useMemo with the underlying data object as the dependency. Source the data via optional chaining (`data?.sections?.foo?.bar`) so the useMemo can run unconditionally before the loading guard fires. The dependency array on `[data]` is correct even though `data` changes only at fetch boundaries.
- NEW (Session 41): jsPDF default helvetica uses WinAnsiEncoding; Unicode glyphs outside that range (★ ◆ etc.) get substituted to an in-range fallback character. Pattern: ASCII-equivalent constants in PDF generators, Unicode glyph in on-screen contexts. See §5.6 rule 1.
- NEW (Session 41): jsPDF's splitTextToSize uses CURRENT font for width calc; setting font BEFORE the call is mandatory or wrap widths come out wrong. See §5.6 rule 2.
- NEW (Session 41): When a section heading has a body card whose height is computable upfront, pass that height as the minContentNeeded argument to sectionHeading() to prevent heading orphaning. See §5.6 rule 3.
- NEW (Session 42): For dashboard-level AI generators that are user-triggered from the frontend (Regenerate AI button), use Class A JWT via auth.getClaims, not Class B internal-secret. The Class B path is reserved for service-to-service calls (e.g., calculate-scores fan-out to individual report generators). Pattern reference: generate-dashboard-narrative v22.
- NEW (Session 42): When designing org-level aggregations that include a supervisor-rollup view, do NOT add a `'supervisor'` slice_type. The existing `'team'` slice already routes by `supervisor_user_id`. Iterate supervisors INSIDE the RPC body for per-supervisor rollups instead of adding a new slice enum value. This avoids a CHECK constraint migration and keeps slice_type semantics clean.

- NEW (Session 43): n<5 suppression in aggregate RPCs must be applied to the eligible participant pool size (`array_length(v_participant_ids)`), NOT the skill-pair count or any product of participants × items. Suppressing on a participant × items product silently allows single-participant slices through, breaking privacy guarantees. Caught and fixed during Session 43 verification of `get_airsa_aggregate`.
- NEW (Session 43): When an Edge Function calls a SECURITY DEFINER RPC on behalf of a user, the RPC client must be created with the user's JWT forwarded as Authorization header: `createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: 'Bearer <userToken>' } } })`. This makes `auth.uid()` resolve correctly inside the RPC. Service-role clients bypass `auth.uid()` entirely (returns NULL), which would break SECURITY DEFINER caller validation. The Class B path uses the service-role client because there's no user JWT, and instead requires `organization_id` in the request body.
- NEW (Session 44): When extending an existing RPC's payload shape with new fields, Edge Functions that read the payload as opaque JSONB (no per-field iteration) accept the new fields without redeployment. Verified for `generate-airsa-org-narrative` consuming the new `per_department_breakdown` field added in Session 44 — function was unchanged, just stored the larger payload in `org_dashboard_narratives.dimension_scores`. This is the safe extension pattern: add new fields rather than restructuring existing ones, and downstream consumers that don't reference the new fields keep working.
- NEW (Session 44): When populating a frontend dropdown with org-scoped data that doesn't have a dedicated RPC, prefer a direct `users` table query under existing RLS over creating a new SECURITY DEFINER RPC. The supervisor list for the AIRSA Team selector uses two PostgREST queries (subordinates with non-null supervisor_user_id, then a name lookup on the distinct supervisor IDs) instead of adding a `list_org_supervisors()` RPC. This pattern is appropriate when (a) the data is already exposed to the role via existing RLS, (b) the lookup is cheap (typically dozens of rows), and (c) the alternative would be a single-purpose RPC that adds maintenance surface without unique value. Reserve new RPCs for cases requiring SECURITY DEFINER privilege escalation, multi-table joins beyond what RLS allows, or computation that can't be done client-side.
- NEW (Session 45): jsPDF font-state must be re-applied on EVERY `doc.text()` call inside a multi-line wrapped-text loop, not just before `splitTextToSize`. The previous §5.6 rule 2 only addressed measurement (set font before splitTextToSize so wrap widths are correct). It missed the render-side leak: `renderContinuationHeader` runs INSIDE the loop when a pagebreak fires mid-section, sets 10pt italic for the "(cont.)" label, then resets weight back to "normal" but NOT the font size. Control returns to the caller's loop, which calls `doc.text(line, ...)` directly without re-applying font state. The line was split for 8.5pt width but renders at 10pt, overflowing the right margin. Visible on page 3 of the first AIRSA dashboard PDF export with clipped words ("Ethical and Re", "Information and Resource Management fo"). Fix: every multi-line render loop that can pagebreak must re-apply `setFontSize`, `setFont`, `setText` AFTER `checkPageBreak()` and BEFORE `doc.text()` on each iteration. Updated `bodyText` helper in `generateAIRSADashboardPdf.ts` reflects this. The same bug likely exists latently in `generatePTPDashboardPdf.ts` — to verify and fix when convenient.
- NEW (Session 45): For frontend rendering of AI-emitted hyphen-prefixed bullet lines and numbered steps, `whiteSpace: pre-wrap` is insufficient. It preserves newlines but produces zero visual hierarchy — bullets read as a wall of hyphens. The pattern locked in `renderNarrativeText` helper in `AirsaDashboard.tsx`: split text on `\n`, classify each line via regex (`/^[-*]\s+(.+)$/` for bullets, `/^(\d+)\.\s+(.+)$/` for numbered, blank lines as paragraph breaks), buffer consecutive prose lines into single `<p>` elements, render bullets as flex rows with `paddingLeft: 16, marginBottom: 4` and a hanging-indent layout for wrapped continuation lines. The helper takes `(text, fontSize, color)` so it's reusable across narrative subsections, summary cards, and risk flag detail blocks. Same logic ported to PDF generator's `bodyText` helper with 4mm hanging indent and 1mm extra spacing before each list item. This pattern is portable to NAI/PTP dashboards if/when those are voice-redesigned.
- NEW (Session 45): When rewriting an AI generator's prompt for action-oriented voice across multiple instruments, pull existing skill names and confirm character lengths first. AIRSA's 24 skill names are 13-37 chars (avg 21) — short enough to drop "Skill N." prefix from prose without bloating the text. Numbers can stay only in on-screen lookup tables (Calibration Map, Skill Inventory) where users cross-reference visually. The verification query is `SELECT MIN(LENGTH(skill_name)), MAX(LENGTH(skill_name)), AVG(LENGTH(skill_name))::int FROM airsa_skills`. Apply same check before extending this voice pattern to PTP/NAI dimension or facet names.
- NEW (Session 45): For instrument-agnostic table designs, the `org_cross_instrument_recommendations` schema (id, organization_id, slice_type, slice_value, primary_instrument_id text, primary_narrative_id uuid, input_narrative_ids jsonb, recommendations jsonb, summary text) supports any instrument as primary or cross — verified via Session 45 recon. Adding new instruments (AIRSA cross-instrument coming in scoped future work) requires no migration. The `input_narrative_ids` jsonb array can hold any number of cross-referenced narrative IDs, supporting both 1×1 pairings and the future 3-way Overview synthesis without schema changes.

## 9. Test fixtures

Test org name: BrainWise Test Corp.

Test user emails follow the testclientbwe+role@gmail.com pattern (orgmember, supervisor, employee). Specific UUIDs and the test password are NOT stored in this public repo. Look them up at session start by:

- Querying Supabase via MCP for users where email matches the testclientbwe+ pattern
- Reading the test password from Claude's userMemories block
- If neither is available, ask the user

Session 39 fixture state at close:

- Test users renamed to Maya Employee (the self-rater) and David Supervisor (the manager-rater) so first-name extraction is testable in AI output. Production code does not hardcode these names; they are pulled from users.full_name and split on first space.
- AIRSA self assessment, manager assessment, and combined assessment_result row exist for the fixture.
- All six facet_interpretations rows for sections airsa_profile_overview, airsa_what_this_means, airsa_action_plan, airsa_conversation_guide, and airsa_top_priorities are populated; airsa_cross_instrument is NOT (Maya has no PTP/NAI, so the function correctly skips and writes no row).

When a new session begins, look up the current state via Supabase rather than relying on values written in prior closeouts. The full Session 42 seed structure is documented in §11.

## 10. AIRSA Company Dashboard (Session 41 strategic frame, Session 42 recon, Phase 5a backend SHIPPED Session 43, Phase 5b frontend remaining)

The strategic frame for the AIRSA org dashboard is locked. Phase 5a backend (RPC + Edge Function) shipped Session 43 and is verified against the seeded fixture. Phase 5b frontend is the remaining piece. The full RPC payload spec is in §10.6 and the Edge Function spec is in §10.7.

### 10.1 Central thesis

PTP and NAI dashboards answer "what's the population state?" — distributions of latent constructs (threat reactivity, cognitive friction). Each leads with a composite (Threat Profile / AI Readiness Index) and breaks down into dimension cards.

The AIRSA dashboard answers a structurally different question: **how accurately does the organization see its own AI talent?** This comes from two AIRSA-unique properties:

1. AIRSA is the only dual-rater instrument. The org-level data is fundamentally about agreement and disagreement, not population state.
2. AIRSA measures observable skills, not latent constructs. The org-level question becomes "where are we wasting talent?" and "where do we have a calibration problem?"

### 10.2 Headline metric: Talent Calibration Index (TCI)

`TCI = (count of aligned + confirmed_strength) / (total assessed skill-pairs) × 100`. Range 0-100, higher is better. Confirmed gaps do NOT count positive (real capability gap, not earned strength). Stored in `org_dashboard_narratives.index_score` (existing polymorphic numeric column).

Three companion sub-metrics in the headline strip: Alignment rate (any same-direction read), Blind spot rate, Underestimate rate.

### 10.3 Tab structure (5 tabs, mirrors PTP/NAI)

1. **Overview**: persistent header with TCI; slice controls (All / Department / Level / Team — Manager Calibration data is computed by iterating supervisors INSIDE the RPC, no `'supervisor'` slice_type); 4 sub-metric cards; **AI workforce narrative inline as expandable card** (top 3 recommended actions surfaced when expanded); Greatest Growth Opportunities / Strengths to Capitalize paired panels (top 2 skills + top 2 domains per panel, full ranking via expand link); Calibration Map (visual centerpiece); Risk flags.

2. **Domains**: 8 domain cards (PTP dimension card pattern). Each card: domain name + colored dot, average self-readiness 3-zone bar, average manager-readiness 3-zone bar, status distribution 5-segment stacked bar using STATUS_COLORS. Click to expand for per-skill breakdown.

3. **Skill Inventory**: sortable filterable table (Skill # | Name | Domain | Self avg | Manager avg | TCI | Blind spot % | Underestimate % | n). Default sort: `cps_growth DESC` ("Sort by growth priority"). Row expand: per-department TCI for that skill, top blind-spot departments, top underestimate departments, AI-generated intervention recommendation.

4. **Manager Calibration** (AIRSA-unique tab, NOT in PTP/NAI): aggregates by `users.supervisor_user_id` chain, computed inside the RPC. Per-manager panel: name, report count, TCI scoped to their reports, blind-spot rate vs underestimate rate (asymmetry signals over-estimator vs under-estimator tendency), calibration consistency. Top 5 best-calibrated / Bottom 5. Privacy threshold: minimum 3 reports per manager.

5. **Trends + Cross-Instrument**: LineChart of TCI over time (PTP/NAI Trends pattern); PTP × AIRSA and NAI × AIRSA correlations using existing C.A.F.E.S–PTP co-elevation framework.

### 10.4 Composite Priority Score (CPS)

Each skill and domain gets two scores per slice:

- `cps_growth = (1 - readiness_index) * misalignment_weight`
- `cps_strength = confirmed_strength_pct`

Where `readiness_index` = avg(self+manager levels) mapped to [0,1] (Foundational=0, Proficient=0.5, Advanced=1.0) averaged across all pairs in the slice, and `misalignment_weight = 1 + (blind_spot_pct + confirmed_gap_pct) / 100` bounded [1.0, 2.0]. A skill with no misalignment gets weight 1.0 (raw capability gap); a skill with full misalignment gets weight 2.0 (gap doubled because the org is weak AND unaware).

Tie-breakers: growth prefers higher blind_spot_pct (org doesn't see the problem yet), strength prefers higher n. Suppression: n < 5 excluded.

### 10.5 Calibration Map (visual centerpiece)

24-skill × N-departments heatmap. Rows = 24 skills grouped visually by 8 domain bands. Columns = active slice values. Cell color = locked STATUS_COLORS by modal status. Cell intensity = % of pairs with that status. Hover popover: n, % aligned, % blind, % under. Click: drill into underlying pairs (privacy threshold respected). Suppressed cells (n < 5): rendered gray with "n<5" tooltip.

Priority markers (Session 41 lock): orange ▲ for top 2 growth skills, green ◆ for top 2 strength skills, on row labels. Markers track the active slice's CPS rankings (when a department slice is on, markers reflect that department's priorities, not the org-wide priorities).

### 10.6 Schema strategy and verified RPC payload

Match PTP/NAI exactly. Reuse `org_dashboard_narratives` table with `instrument_id = 'INST-003'`. AIRSA-specific aggregates carried in `dimension_scores` JSONB. AI workforce narrative cached in `narrative_text` JSONB. TCI carried in `index_score` numeric column. NO new aggregate table.

Session 42 recon confirmed: existing `'team'` slice already routes by `supervisor_user_id`. Manager Calibration tab is computed inside the RPC by iterating supervisors with min-3-reports threshold.

Session 44 added a `per_department_breakdown` field on every skill aggregate via migration `add_per_department_breakdown_to_get_airsa_aggregate`. This was needed for the Calibration Map's 24-skill × N-department visualization (Phase 5b frontend). Implementation adds two CTEs (`skill_dept_agg` and `skill_dept_object`) that group `skills_long` by `(skill_number, department_name)` joined to `users.department_id` → `departments.id` → `departments.name`. Null-safe fallback to `(unassigned)`. Per-cell `modal_status` is computed via `MODE() WITHIN GROUP (ORDER BY status)` over the actual per-pair status values, more accurate than recomputing from modal levels. Per-cell n<5 suppression flag is set independently of wholesale RPC suppression.

**Verified RPC payload shape** (live against the seeded fixture as of Session 44 close):

```jsonc
{
  "suppressed": false,
  "instrument_id": "INST-003",
  "slice_type": "all",
  "slice_value": "all",
  "pair_count": 1128,
  "eligible_count": 54,
  "completed_count": 47,
  "tci_overall": 40.1,
  "alignment_rate": 59.0,
  "blind_spot_rate": 20.3,
  "underestimate_rate": 20.7,
  "status_distribution": {
    "aligned": 276,
    "confirmed_strength": 176,
    "confirmed_gap": 214,
    "blind_spot": 229,
    "underestimate": 233
  },
  "skill_aggregates": {
    "1": {
      "skill_name": "Cognitive Adaptability",
      "dimension_id": "DIM-AIRSA-01",
      "domain_name": "Cognitive & Learning Skills",
      "modal_self_level": "Proficient",
      "modal_manager_level": "Proficient",
      "tci": 72.3,
      "blind_spot_pct": 8.5,
      "underestimate_pct": 14.9,
      "confirmed_strength_pct": 8.5,
      "n": 47,
      "cps_growth": 0.5458,
      "cps_strength": 8.5106,
      "suppressed": false,
      "per_department_breakdown": {
        "Engineering": { "n": 18, "tci": 72.2, "modal_status": "aligned",
                         "blind_spot_pct": 11.1, "underestimate_pct": 16.7,
                         "confirmed_strength_pct": 11.1, "suppressed": false },
        "Finance":     { "n": 14, "tci": 64.3, "modal_status": "aligned", ... },
        "Marketing":   { "n": 15, "tci": 80.0, "modal_status": "aligned", ... }
      }
    },
    // ... 23 more skills keyed by skill_number string
  },
  "domain_aggregates": {
    "DIM-AIRSA-01": {
      "domain_name": "Cognitive & Learning Skills",
      "tci": 53.9,
      "blind_spot_pct": 31.9,
      "underestimate_pct": 11.3,
      "confirmed_strength_pct": 5.0,
      "n": 141,
      "cps_growth": 0.5806,
      "cps_strength": 4.9645,
      "suppressed": false
    },
    // ... 7 more domains
  },
  "rankings": {
    "growth_skills":   [{ "skill_number": 10, "skill_name": "Identity Flexibility",
                          "dimension_id": "DIM-AIRSA-03", "cps_growth": 1.8030 }, ...],
    "strength_skills": [{ "skill_number": 23, "skill_name": "Algorithmic Vigilance",
                          "dimension_id": "DIM-AIRSA-08", "cps_strength": 85.1064 }, ...],
    "growth_domains":  [{ "dimension_id": "DIM-AIRSA-03", "domain_name": "Psychological Readiness",
                          "cps_growth": 1.4350 }, ...],
    "strength_domains":[{ "dimension_id": "DIM-AIRSA-04", "domain_name": "Strategic & Systems Thinking",
                          "cps_strength": 51.0638 }, ...]
  },
  "manager_calibration": [
    { "supervisor_id": "...", "supervisor_name": "Demo Reese Thomas",
      "n_reports": 3, "n_skill_pairs": 72,
      "tci": 47.2, "blind_spot_pct": 16.7, "underestimate_pct": 13.9 },
    // ... 9 more (only supervisors meeting n>=3 threshold)
  ]
}
```

Notes on the actual shape vs the original Session 41 spec:

- `status_distribution` returns RAW COUNTS, not percentages. Frontend computes percentages by dividing each by `pair_count`.
- Skill aggregates carry `modal_self_level` and `modal_manager_level` (categorical), not numeric averages.
- Both skill and domain aggregates carry `domain_name` directly (no need to join `dimensions` table on the frontend).
- `per_department_breakdown` keys are `departments.name` strings (with `(unassigned)` fallback for null department_id). When slice is `department=X`, the breakdown returns a single key matching that department.
- No top-level `calibration_map` array exists. The frontend reconstructs the calibration matrix from `skill_aggregates[N].per_department_breakdown` per skill.

### 10.7 Cadence

Match PTP/NAI exactly. Live RPC `get_airsa_aggregate(p_slice_type, p_slice_value)` computes aggregates from `assessment_results` on each dashboard load. No nightly cron, no pre-computed aggregate table. AI workforce narrative cached in `org_dashboard_narratives.narrative_text` and regenerated on user-triggered click via new Edge Function `generate-airsa-org-narrative` (**Class A JWT** via `auth.getClaims`, mirrors `generate-dashboard-narrative` v22). The Class B path documented in Session 41 was corrected after recon: dashboard-level AI generators are user-triggered from the frontend with full JWT context, matching PTP/NAI cadence. Model: `claude-opus-4-6`, `max_tokens` 7000.

### 10.8 Privacy thresholds

- Calibration Map cells, Skill Inventory rollups, Trends per-period: minimum 5 pairs
- Manager Calibration tab: minimum 3 reports per manager
- All suppressed cells render gray with "n<X" tooltip

### 10.9 Deferred to v2 (post-launch)

- Skill-level radar chart on 24 axes (unreadable; heatmap is better)
- Time-comparison overlays on Calibration Map (state management complexity; Trends tab handles longitudinal)
- Anonymous self-report mode (defer until customer asks)
- Predictive "if you close blind spots in Skill X, expected TCI gain is Y" (requires platform-wide outcome data; Wave 2/3 validation pathway)

### 10.10 Phase 5b frontend (SHIPPED Session 44)

Single new file: `src/pages/company/AirsaDashboard.tsx`. Modifications to `src/App.tsx` (route addition) and `src/components/AppSidebar.tsx` (Dashboards submenu third entry).

Route: `/company/airsa-dashboard`. RoleGuard `["company_admin", "org_admin", "brainwise_super_admin"]` — identical to NAI and PTP. Defense-in-depth: the route gate at the React layer, the Edge Function caller validation against the same role set in `generate-airsa-org-narrative`, and the SECURITY DEFINER RPC's caller validation inside `get_airsa_aggregate`.

**Locked AIRSA dashboard domain coloring** (frontend-only constants in `AirsaDashboard.tsx`):

- DIM-AIRSA-01 Cognitive & Learning Skills — Navy `#021F36`
- DIM-AIRSA-02 Social & Collaborative Skills — Teal `#006D77`
- DIM-AIRSA-03 Psychological Readiness — Purple `#3C096C`
- DIM-AIRSA-04 Strategic & Systems Thinking — Mustard `#7a5800`
- DIM-AIRSA-05 Execution & Practical Skills — Green `#2D6A4F`
- DIM-AIRSA-06 Proactivity & Personal Drive — Orange `#F5741A`
- DIM-AIRSA-07 Information & Resource Management — Gray `#6D6875`
- DIM-AIRSA-08 Ethical & Reflective Judgment — Deep plum `#5A1A4A`

The new `#5A1A4A` is dashboard-scoped (not part of the global brand palette). It avoids reusing PTP Purpose `#3C096C` in a context where AIRSA Psychological Readiness already takes Purple. PTP Purpose and AIRSA D8 will never appear on the same dashboard, but the visual proximity in the AIRSA Calibration Map's domain-band ordering required a distinct hue.

**Calibration Map implementation**: HTML CSS Grid (NOT SVG). 24 skill rows × N department columns. Cell rendering iterates `skill_aggregates[N].per_department_breakdown[deptName]`. Cells with `suppressed: true` render gray with "n<5" tooltip. Cells with `modal_status === 'blind_spot'` render with dashed border and transparent fill (preserving STATUS_COLORS canonical iconography). Hover popover via native `title` attribute. Priority markers ▲ (orange) for top 2 growth skills and ◆ (green) for top 2 strength skills, sourced from `aggregate.rankings.growth_skills.slice(0,2)` and `strength_skills.slice(0,2)`.

**Three latent bugs surfaced and fixed in AIRSA build, deferred for NAI/PTP**:

1. Team `<select>` populated from `departments.map` (sending `department_id` where RPC expects `supervisor_user_id`). Fixed in AIRSA via direct `users` table query under existing RLS.
2. Slice control dropdowns lacked clearable first option; placeholder "Department ▾" / "Level ▾" / "Team ▾" disappeared after selection. Fixed in AIRSA by changing first-option labels to "All departments" / "All levels" / "All teams".
3. cps_growth (0-2 composite) and cps_strength (%) panels displayed without unit context. Fixed in AIRSA via italic subtitle line under each panel header.

NAI and PTP still carry bugs 1 and 2; deferred for post-launch fix to avoid regression risk on dashboards already in production use.

**Known UX issue carried to Session 45**: HIGH risk-flag rendering uses Tailwind red (`#dc2626` / `#fee2e2` / `#991b1b`) instead of brand orange variants per §6.1. Fix is a three-edit patch in the risk flag render block.

## 11. AIRSA test fixture seed (Session 42)

A production-realistic AIRSA test fixture lives on the BrainWise Test Corp organization. Seeded in Session 42 to enable end-to-end validation of the Phase 5a RPC + Edge Function and the Phase 5b dashboard UI before any real customer data exists.

### 11.1 Org structure

BrainWise Test Corp now has 4 departments and 50 corporate employees:

- **Executive**: 5 (5 C-Suite users moved here in Session 42)
- **Engineering**: 18
- **Finance**: 14
- **Marketing**: 13

Supervisor chain: 17 distinct supervisors, with 10+ clearing the Manager Calibration min-3-reports threshold. `users.supervisor_user_id` populated for all corporate_employee rows that have a supervisor.

**Session 44 fixture drift observed**: live counts are Engineering 19 users (18 with AIRSA), Marketing 16 users (15 with AIRSA), Finance unchanged at 14. Executive still has 5 users with 0 AIRSA pairs. The 47 AIRSA pair total is unchanged from Session 42 close. Calibration Map renders 3 columns (Engineering, Finance, Marketing) on the test fixture as of Session 44; Executive will appear automatically once seeded with AIRSA pairs.

### 11.2 AIRSA pairs

**47 self+manager assessment pairs** in production (Maya = pair #47 from prior fixture work; 46 pairs new in Session 42).

- 94 `assessments` rows total: 47 self + 47 manager, all `instrument_id = 'INST-003'`, all `status = 'completed'`
- **2,208 `assessment_responses`**: 46 new pairs × 24 items × 2 raters
- **46 `assessment_results`** rows with full JSONB derived server-side from responses (no AI calls used during seed):
  - `dimension_scores` (self per-domain readiness)
  - `manager_dimension_scores` (manager per-domain readiness)
  - `self_manager_divergence` (per-domain with `status` field)
  - `skill_level_breakdown` (24 entries per row, per the §2.3 schema)

The Maya fixture's six `facet_interpretations` rows (AI section content) are unchanged from Session 39 close. The 46 new pairs do NOT have AI section content; they exist for org-level aggregate validation, not individual-report rendering.

### 11.3 Org-level distribution (verified)

Across all 47 AIRSA pairs:

- Org-wide TCI = **40.1**
- aligned: 24.5%
- underestimate: 20.7%
- blind_spot: 20.3%
- confirmed_gap: 19.0%
- confirmed_strength: 15.6%

This distribution gives the Phase 5b dashboard a realistic demo: enough alignment to show a working organization, enough divergence in both directions to populate the Calibration Map, and enough confirmed gaps to surface workforce-risk callouts.

### 11.4 Seed mechanics (for reference)

The seed script lived in `/home/claude/internal-docs/` during Session 42 and is not committed. The relevant facts for future sessions:

- All scoring derived server-side. The seed inserts `assessment_responses`, then runs `calculate-scores` Branch A logic (or its SQL equivalent) to produce `assessment_results`. No AI Edge Functions called.
- AIRSA scale labels confirmed during seed: **`0=Never, 1=Rarely, 2=Often, 3=Consistently`** (NOT "Always"). Items table values verified.
- Self/manager rater assignments use the **lowercase `'self'`/`'manager'`** convention (per §2.4 schema warning) on the `assessments` table.
- `paired_assessment_id` reciprocal linkage populated for all 47 pairs.

If the seed needs to be regenerated or extended, mirror the structure: 50 employees, 4 departments, supervisor chain with 17 distinct supervisors, 47+ AIRSA pairs with computed JSONB aggregates.

### 11.5 What the fixture does NOT cover

- AI section content for the 46 new pairs (only Maya has facet_interpretations rows). The Phase 5a `generate-airsa-org-narrative` Edge Function will be tested against the Maya pair plus the org-wide aggregate.
- PTP or NAI cross-instrument pairings for the 46 new users. The cross-instrument tab on the AIRSA org dashboard will render limited data on the test org until additional fixtures are seeded for those instruments.
- Trend data over time. All 47 pairs share a single timestamp window. The Trends tab on the dashboard will show a single point until time-spread fixtures are added.

## 12. Coach certification gating (Session 46 — Group C Phase 8 absorbed)

Live state of the `coach_certifications` table diverges from the Group C scope doc as authored. Recon at session open verified actual schema constraints, then locked the gating rules forward-compatible with future Group C Phase 1 (Q9 revocation enum extension).

### 12.1 Live CHECK constraints

`coach_certifications.certification_type`: four allowed values, not three.

| Value | Maps to instruments |
|-------|---------------------|
| `ptp_coach` | PTP |
| `ai_transformation_coach` | NAI, AIRSA, HSS |
| `ai_transformation_ptp_coach` | PTP, NAI, AIRSA, HSS (Combined) |
| `my_brainwise_coach` | PTP, NAI, AIRSA, HSS |

`coach_certifications.status`: three allowed values: `in_progress`, `certified`, `suspended`. The Group C scope doc anticipates a future revocation extension via Q9; the gating logic shipped in Session 46 is forward-compatible with that extension because the rule reads "only `certified` allows," not "anything-not-revoked."

### 12.2 Gating rule (locked)

In `src/pages/coach/CoachClients.tsx`, the Order Assessment dialog instrument-list filters by the union of the active coach's `certified` rows mapped through `CERT_TYPE_TO_INSTRUMENTS`. Both entry-point buttons ("Order Assessment for New Client" and "Order Assessment for This Client") feed the same `<Dialog>` instance — gating is applied once at the dialog's render block.

Shipped behavior:
- Coach with zero `certified` rows: both buttons disabled, tooltip "You need an active certification to order assessments," empty-state message inside dialog with link to `/certifications`.
- Coach with one or more `certified` rows: dialog shows checkboxes only for instruments in the union of allowed sets. Submission logic and Stripe metadata unchanged.
- `in_progress` and `suspended` rows do not contribute to the allowed set.

### 12.3 `auto_grant_combined_certification` trigger behavior

Trigger is `AFTER UPDATE` only on `public.coach_certifications`, not `AFTER INSERT`. Direct seeding of `certified` rows via INSERT does NOT fire the trigger. The trigger only auto-grants Combined when an existing in_progress row transitions to certified via UPDATE AND the user has both `ptp_coach` and `ai_transformation_coach` rows certified AND no Combined row exists.

This matters for future test seeding and for any path where Combined cert is granted programmatically: if the path uses INSERT directly to a certified state, no auto-grant fires; if it uses UPDATE through certification, auto-grant fires.

## 13. Shared Results supervisor toggle (Session 46)

Single toggle pill on the existing `/shared-results` page filters the peer list to the viewer's own direct reports. Replaces the previously-considered "My Team tab" idea (never written into the build queue).

### 13.1 Backend

No new RPC. Reuses the existing `get_my_direct_reports()` SECURITY DEFINER function which returns the caller's direct reports as `out_user_id, out_email, out_full_name, out_org_level, out_department_id, out_department_name`. Function filters by `users.supervisor_user_id = auth.uid() AND deactivated_at IS NULL`, ordered by `full_name NULLS LAST, email`.

### 13.2 Frontend

In `src/pages/SharedResults.tsx`:
- New state: `directReportIds: Set<string>`, `myReportsOnly: boolean` (default false).
- New `useEffect` calls `get_my_direct_reports()` on `[user]` change, populates `directReportIds` from `out_user_id` field.
- Toggle pill rendered conditionally on `directReportIds.size > 0` between the existing department dropdown and the existing supervisor dropdown.
- `myReportsOnly` resets to false on instrument change (joins existing reset block at the top of the peer-fetch effect).
- `filteredPeers` memo gains clause: `if (myReportsOnly && !directReportIds.has(p.user_id)) return false;`
- All four filters (name search, department, existing supervisor dropdown, new toggle) compose with AND semantics.

### 13.3 Existing supervisor dropdown unchanged

The existing `supervisorFilter` dropdown at `SharedResults.tsx` lines 173-185 (filters peers by their `supervisor_user_id` matching some other peer's user_id) is left intact in Session 46. It does something different from the new toggle: it lets the viewer scope to "people who report to person X" rather than "people who report to me."

Latent bug noted but not fixed in Session 46: the `supervisors` array is built only from peers whose `user_id` appears as another peer's `supervisor_user_id` AND who are themselves in the peer list. Many supervisors silently won't appear in the dropdown if they haven't shared their own results. Carried as a deferred quality item.

## 14. Group D — Coach Bulk Invite + Shareable Link (Sessions 47 + 48)

Group D extends the existing single-client invitation flow with two new entry points: bulk invite (table or CSV) and individual shareable link generation. Backend (Phases 1-3) shipped Session 47. Frontend (Phases 4-6 + polish) shipped Session 48. Auto-refund extension (Phase 6 polish addition) shipped Session 48.

### 14.1 Schema additions to `coach_clients`

| Column | Purpose |
|---|---|
| `expires_at timestamptz` | 30 days from creation for shareable_link and bulk source rows. NULL for legacy single-source invitations (pre-Group-D). Sweep job marks rows revoked when expires_at passes. |
| `revoked_at timestamptz` | Stamped when row is revoked (manual via coach_invitation_revoke OR automatic via sweep_expired_invitations). |
| `invitation_source text` | Values: 'single', 'bulk', 'shareable_link'. |
| `client_first_name text` | Optional first name captured at invitation time. |
| `client_last_name text` | Optional last name captured at invitation time. |
| `refunded_at timestamptz` | Stamped when auto-refund processed. NULL = not refunded. |
| `stripe_refund_id text` | Stripe refund object ID for audit trail. Format: `re_xxx`. |
| `refund_amount numeric(10,2)` | Dollar amount refunded for this row (per-row share of original payment). |
| `refund_failure_reason text` | If Stripe rejected refund (e.g., charge too old), reason logged here. |

### 14.2 New table `coach_pending_bulk_batches`

Holds metadata for in-flight Stripe checkout sessions for coach-paid bulk invites. Webhook iterates over the batch on `checkout.session.completed` and inserts coach_clients rows + generates per-row coupons. Self-pay rows do NOT use this table (they're inserted directly during dispatch).

### 14.3 RPCs

- `bulk_coach_invitation_create(rows jsonb)` — Per-row BEGIN/EXCEPTION isolation, 75-row cap, certification gating reuse from Item 37 mapping. Returns per-row outcomes. Called by `bulk_coach_invite` Edge Function for self-pay rows. Coach-paid rows are NOT created here; they wait for stripe-webhook.
- `coach_invitation_revoke(p_coach_client_id uuid)` — Validates ownership via `auth.uid()`, stamps `revoked_at`. Returns `out_*` columns for the calling Edge Function to use in coupon recalc + refund logic.

### 14.4 Edge Functions

| Function | Version | Purpose |
|---|---|---|
| `bulk_coach_invite` | v2 | Wraps `bulk_coach_invitation_create` RPC + email dispatch in parallel batches of 10. 75-row cap. Self-pay path inserts rows immediately; coach-paid path returns Stripe checkout session URL. |
| `coach_invitation_revoke` | v3 | Class A JWT auth. Calls revoke RPC, then `recalcCouponAfterRevoke` (deletes Stripe coupon if last row, else recreates at lower amount), then `processAutoRefund` (per refund policy gate). Trigger metadata: `manual_revoke`. |
| `sweep_expired_invitations` | v3 | Class C cron auth via `DISPATCHER_SHARED_SECRET`. Loops over expired-but-not-revoked rows, stamps revoked_at, recalcs coupon, processes auto-refund. Trigger metadata: `auto_expiry_sweep`. Schedule `45 3 * * *`. |
| `coach_invitation_resend` | v1 | Class A JWT auth. Per-client scope: lists ALL pending instruments for that coach + client_email. 24-hour rate limit per recipient_email + email_type='coach_reminder_pending' enforced via email_logs query. shareable_link rows treated as first-send template. |
| `create-checkout` | v47 | Extended with `coach_bulk_order` mode. Lovable-fragile per standing rule — `coach_user_id` regularly dropped from Stripe metadata. Verify after every Lovable prompt touching checkout-adjacent code. |
| `stripe-webhook` | v23 | New `coach_bulk_order` branch iterates over pending batch metadata, generates per-row coupons via `recalculateCombinedCouponForEmail`, creates coach_clients rows, dispatches emails in parallel batches of 10. |

### 14.5 Refund policy (locked Session 48)

**Auto-refund eligibility gate (ALL must be true):**
- `coupon_redeemed = false`
- `assessment_id IS NULL`
- `payment_age <= 90 days` (computed from row created_at)
- `payment_intent_id IS NOT NULL`
- `coupon_amount > 0`

**Triggers:**
- Manual revoke via `coach_invitation_revoke` Edge Function (`processAutoRefund` called after coupon recalc)
- Automatic expiry via `sweep_expired_invitations` Edge Function (`processAutoRefund` called per swept row)

**Both paths use the same `processAutoRefund` helper.** Logic is duplicated verbatim between the two Edge Functions (build queue item exists to extract to shared module). Trigger metadata differentiates: `manual_revoke` vs `auto_expiry_sweep`.

**Refunded amount = `coach_clients.coupon_amount`** (per-row share of original payment, not full payment_intent amount). Calls `stripe.refunds.create({ payment_intent, amount: rowAmount * 100, reason: 'requested_by_customer', metadata: { coach_client_id, trigger } })`.

**On Stripe rejection** (e.g., charge already refunded, charge too old): row stamped with `refund_failure_reason`, helper returns `{refunded: false, reason: 'stripe_error: ...'}`. Doesn't fail the surrounding revoke or sweep — those succeed regardless.

### 14.6 Frontend surfaces

In `src/pages/coach/CoachClients.tsx`:
- DropdownMenu on header with three options: Single client / Bulk invite / Generate shareable link
- `perAssessmentPrice` state querying `subscription_plans` for dynamic price (not hardcoded)
- URL parameter handler for `?bulk_checkout=success|cancelled`
- Tabs structure: Clients tab (default) + Pending Invitations tab
- Stat cards: Total Clients (signed-up), Pending Invitations, Completed This Month, Assessments Pending
- Tooltip primitive replaces `title` attribute on disabled DropdownMenu trigger (Radix asChild swallowed it)

In `src/components/coach/BulkInviteModal.tsx` (607 lines):
- Three-stage flow: Validate (table editor + CSV upload) / Preview (per-row outcome) / Dispatch+Results
- xlsx@^0.18.5 dependency for CSV parsing
- 75-row cap, sticky defaults, payment_mode self_pay/coach_paid lowercase
- Cert gating reuses `allowedInstrumentIds` from `CoachClients.tsx`

In `src/components/coach/ShareableLinkModal.tsx` (287 lines):
- qrcode.react@^4.0.1 dependency (`QRCodeSVG` component)
- Both self-pay and coach-paid paths
- 30-day expiry displayed

In `src/components/coach/PendingInvitations.tsx` (295 lines):
- Tab-based, replaces card-based design from initial Phase 5 ship
- Per-row Copy link / Revoke (with confirmation dialog) / Resend (24h rate-limited via Edge Function) actions
- Date formatting MMM d (no year) for tightness
- Payment badges Coach / Self
- Source badges Bulk / Single / Link

## 15. Email infrastructure (Session 48 — Option A + Option B)

### 15.1 `email_logs` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email_type` | text NOT NULL | Categorical (`coach_invitation_self_pay`, `coach_reminder_pending`, `auth_or_external`, etc) |
| `recipient_email` | text NOT NULL | |
| `subject` | text NOT NULL | |
| `resend_message_id` | text | Resend's message ID, used for webhook correlation |
| `send_status` | text NOT NULL | `sent` or `failed` |
| `error_message` | text | Populated when send_status='failed' |
| `source` | text | Where in the codebase the send originated (e.g., `CoachClients.handleRemind`, `coach_invitation_resend`) |
| `sent_at` | timestamptz NOT NULL | |
| `delivered_at` | timestamptz | Populated by webhook when Resend delivers |
| `bounced_at` | timestamptz | Populated by webhook on bounce |
| `complained_at` | timestamptz | Populated by webhook on spam complaint |
| `last_status_event` | text | Most recent webhook event type |
| `last_status_at` | timestamptz | Timestamp of last_status_event |

**RLS:** super_admin SELECT only via account_type check. Service role bypasses RLS for writes from Edge Functions.

**Indexes:**
- `recipient_sent_at`: `(recipient_email, sent_at DESC)`
- `resend_message_id_partial`: `(resend_message_id)` WHERE `resend_message_id IS NOT NULL`
- `failures_partial`: `(sent_at DESC)` WHERE `send_status = 'failed'`
- `problem_events_partial`: `(last_status_at DESC)` WHERE `last_status_event IN ('bounced', 'complained')`

**Retention:** pg_cron `purge_email_logs_90d` schedule `0 3 * * *` (03:00 UTC daily) executes `DELETE FROM email_logs WHERE sent_at < NOW() - INTERVAL '90 days'`.

### 15.2 `send-email` Edge Function v8

Internal-secret authenticated via `X-Internal-Secret` header (`INTERNAL_FUNCTION_SECRET` env). Logs every send to `email_logs` via `logEmailDispatch` helper that runs unconditionally on every code path (success and failure both write a row). Accepts optional `email_type` (default `unknown`) and `source` (default the calling Edge Function name).

**Standing convention:** Edge Functions calling send-email should always pass both `email_type` and `source`. Build queue item: backfill these on functions that don't yet (stripe-webhook, bulk_coach_invite, invite-coach, send-departure-emails, generate-departure-export).

### 15.3 Resend webhook integration (`resend-webhook` v1)

**Endpoint:** `https://svprhtzawnbzmumxnhsq.supabase.co/functions/v1/resend-webhook`

**Auth:** Svix-format signature verification (HMAC-SHA256 with `whsec_` prefix stripped from `RESEND_WEBHOOK_SECRET` env). 5-minute timestamp freshness window prevents replay attacks. `verify_jwt: false` because Resend doesn't send Supabase JWT.

**Subscribed events (configured in Resend dashboard):**
- email.sent
- email.delivered
- email.bounced
- email.complained
- email.delivery_delayed

**Logic:**
- Verify Svix signature, reject 401 on failure
- Parse payload, look up email_logs row by `resend_message_id`
- If found: update with delivery status (delivered_at / bounced_at / complained_at depending on event type, plus last_status_event / last_status_at)
- If not found (Auth-system email or external): insert new row with `email_type='auth_or_external'`, `source='resend-webhook'`

**Verified end-to-end Session 48:** send-email → Resend → webhook fires ~1s later → email_logs row updated with delivered_at. Full lifecycle in single row.

### 15.4 Notes for future Edge Function authors

- All transactional emails should route through `send-email` (not direct Resend API) so email_logs captures them.
- Pass `email_type` and `source` parameters on every call.
- For new email categories, register the `email_type` value here in the arch ref to maintain a canonical list.
- Auth emails (Supabase Auth → Resend SMTP) bypass send-email by design. The webhook captures them with `email_type='auth_or_external'` for audit completeness.

## 16. pg_cron jobs (current state)

| Job | Schedule | Purpose | Auth |
|---|---|---|---|
| `sync-stripe-prices-daily` | `0 2 * * *` | Pulls Stripe prices into `subscription_plans` table | Class C (vault `departure_dispatcher_shared_secret`) |
| `purge_email_logs_90d` | `0 3 * * *` | Deletes email_logs rows older than 90 days | Inline SQL (no auth needed, runs as superuser) |
| `dispatch_grace_reminders_daily` | `15 3 * * *` | Dispatches Email 4 grace reminders to deactivated corporate users | Class C (vault `departure_dispatcher_shared_secret`) |
| `sweep_expired_coach_invitations` | `45 3 * * *` | Sweeps Group D expired invitations + voids coupons + processes auto-refunds | Class C (vault `departure_dispatcher_shared_secret`) |

**Staggering rationale:** All overnight jobs offset by 15-30 minutes to avoid concurrent cron load.

**Class C cron auth pattern:** pg_cron job calls `net.http_post` with header `X-Dispatcher-Secret` populated from `vault.decrypted_secrets`. Edge Function reads `DISPATCHER_SHARED_SECRET` env var and constant-time compares against the header value via `safeEqual`. Reject 401 on mismatch.

## 17. Auto-refund automation (Session 48)

Both manual revoke and automatic sweep use the same `processAutoRefund` helper (currently duplicated verbatim between `coach_invitation_revoke` and `sweep_expired_invitations`).

### 17.1 Eligibility gate

```
auto_refund_eligible = (
  row.coupon_redeemed = false
  AND row.assessment_id IS NULL
  AND row.stripe_payment_intent_id IS NOT NULL
  AND row.coupon_amount > 0
  AND age_days(row.created_at) <= 90
)
```

If any condition fails → `{refunded: false, reason: <specific>}` with no Stripe call. Reasons: `coupon_already_redeemed`, `assessment_started`, `not_coach_paid`, `no_refund_amount`, `outside_90_day_window`.

### 17.2 Refund execution

```typescript
const refund = await stripe.refunds.create({
  payment_intent: row.stripe_payment_intent_id,
  amount: Math.round(row.coupon_amount * 100), // per-row share, not full charge
  reason: "requested_by_customer",
  metadata: {
    coach_client_id: row.id,
    trigger: "manual_revoke" | "auto_expiry_sweep",
  },
});
```

On success: stamps `refunded_at`, `stripe_refund_id`, `refund_amount` on the coach_clients row.

On Stripe failure: stamps `refund_failure_reason` (truncated to 500 chars), helper returns `{refunded: false, reason: 'stripe_error: <msg>'}`. Surrounding revoke/sweep proceeds.

### 17.3 Individual purchase refund tracking (no automation)

`assessment_purchases` extended with `refunded_at`, `stripe_refund_id`, `refund_amount`, `refund_failure_reason`, `refund_processed_by` (UUID FK users — audits which super_admin approved the refund). Manual processing only — no auto-refund Edge Function.

Build queue: super-admin UI surface to view a user's purchases + eligibility status + "Process refund" button gating on Tier 2 audit. Depends on Group A audit prequel being complete.

### 17.4 Refund policy text (locked Session 48, in Terms of Service v2)

Per `src/content/legal/termsContent.ts` Section 5.5:

- **Individual purchases:** 14-day refund window if assessment not started AND no AI interpretation generated AND feature not substantively used.
- **Coach-paid client assessments:** auto-refund per Section 5.3 (the policy described in 14.5 above).
- **Corporate contracts:** all sales final per executed contract.

## 18. `coach_invitation_resend` Edge Function (Session 48)

Per-client scope reminder dispatch with rate limiting via email_logs query.

**Auth:** Class A JWT via `auth.getClaims`. Caller must own the `coach_clients` row referenced by `p_coach_client_id`.

**Logic:**
1. Look up the row, verify ownership (`row.coach_user_id = caller.uid`)
2. Rate limit check: query `email_logs` for any row with `recipient_email = row.client_email AND email_type = 'coach_reminder_pending' AND sent_at > NOW() - INTERVAL '24 hours'`. If found → 429 `rate_limited`.
3. Find ALL pending rows for `(coach_user_id, client_email)` pair: `revoked_at IS NULL AND assessment_id IS NULL AND invitation_status IN ('sent', 'opened') AND (expires_at IS NULL OR expires_at > NOW())`
4. If no rows match → 400 `nothing_to_remind`
5. Look up instrument names, build email (reminder template OR first-send template if shareable_link)
6. Dispatch via `send-email` with `email_type='coach_reminder_pending'`, `source='coach_invitation_resend'`
7. Return `{success: true, instruments_count, instruments: [...]}` or error code

**Templates:**
- Reminder ("Reminder: Your BrainWise Assessment is Waiting") for non-shareable_link sources
- First-send ("Your coach prepared an assessment for you") for shareable_link sources where the original invitation never sent an email

**Frontend surfaces** in `PendingInvitations.tsx`: Resend button with toast variants per response (`success` → "Reminder sent", `rate_limited` → "Reminder already sent recently", `nothing_to_remind` → "Nothing to remind", `unauthorized` → "Unauthorized", other → generic error).

## 19. `super_admin_action_types` lookup table (Session 49)

Replaces the prior CHECK constraint on `super_admin_audit_log.action_type` with a foreign key to `public.super_admin_action_types`. SOC 2 CC6.1 evidence: this table enumerates every privileged super-admin action the platform supports.

### 19.1 Schema

```sql
CREATE TABLE public.super_admin_action_types (
  action_type            text PRIMARY KEY,
  category               text NOT NULL,        -- enumerated CHECK
  description            text NOT NULL,
  tier                   text,                  -- 'tier1','tier2','tier3','tier4' or NULL
  requires_mfa           boolean NOT NULL DEFAULT false,
  requires_justification boolean NOT NULL DEFAULT false,
  is_mutation            boolean NOT NULL DEFAULT true,
  denylist_during_impersonation boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now()
);
```

Categories (CHECK-constrained): `impersonation`, `org_management`, `user_management`, `admin_role_management`, `contract_management`, `content_authoring`, `platform_observability`, `usage_management`, `mfa_management`, `audit_reporting`.

### 19.2 Seeded action types (19 total)

15 carried over from prior CHECK list (company_account_viewed, individual_record_viewed, version_created, version_deprecated, prompt_updated, aggregate_export_generated, platform_health_viewed, organization_created, corporate_contract_created, org_admin_assigned, org_admin_transferred, corporate_invitation_created, contract_upsert, ai_counter_reset, mfa_factor_reset).

Plus 4 new for A1 impersonation: `impersonation_started`, `impersonation_ended`, `impersonation_action`, `impersonation_denied_action`.

### 19.3 Adding new action types

Group C and Group A A2 will add ~30+ more action types over Sessions 50-65. Convention: each feature-introducing migration that adds a privileged action MUST insert into this lookup table in the same migration. Pattern:

```sql
INSERT INTO public.super_admin_action_types (action_type, category, description, ...)
VALUES ('coach_certification_revoked', 'admin_role_management', '...', ...)
ON CONFLICT (action_type) DO NOTHING;
```

### 19.4 RLS

`super_admin_action_types: super admin can read` (SELECT for `current_user_account_type() = 'brainwise_super_admin'`).
`super_admin_action_types: service_role full access` (ALL with USING true, WITH CHECK true).

## 20. Audit log infrastructure additions (Session 49)

### 20.1 `super_admin_audit_log` new columns

```sql
ALTER TABLE public.super_admin_audit_log
  ADD COLUMN ip_address inet,
  ADD COLUMN user_agent text,
  ADD COLUMN reason text,
  ADD COLUMN before_value jsonb,
  ADD COLUMN after_value jsonb,
  ADD COLUMN mode text,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN ended_at timestamptz,
  ADD COLUMN end_reason text;
```

`ip_address`/`user_agent` populated by calling Edge Functions. `reason` required for impersonation start and Tier 2/3 edits. `before_value`/`after_value` are best-effort jsonb snapshots. `mode` carries the raw mode string or, for impersonation events, prefixed format `impersonation:<observe|act>:<sub_action>`. `expires_at`/`ended_at`/`end_reason` populated only for impersonation_started rows (other action_types leave them NULL).

Indexes added: `idx_super_admin_audit_log_mode` (partial WHERE mode IS NOT NULL), `idx_super_admin_audit_log_session_id`.

### 20.2 `company_admin_audit_log` new columns

```sql
ALTER TABLE public.company_admin_audit_log
  ADD COLUMN reason text,
  ADD COLUMN before_value jsonb,
  ADD COLUMN after_value jsonb,
  ADD COLUMN super_admin_acting_as_user_id uuid REFERENCES users(id);
```

`super_admin_acting_as_user_id` is the dual-attribution column — when a super admin performs a company-admin-tier action via impersonation, this captures the super admin actor while `actor_user_id` still holds the impersonated user (org admins see the override in their normal audit feed).

### 20.3 `log_super_admin_action()` helper RPC

Standardized write path for `super_admin_audit_log`. Used by Group A A2 direct user editing, Group C revocation/direct-enrollment/mentor-assignment RPCs, and the impersonation-start/end Edge Functions.

**Signature:** `(p_target_user_id uuid, p_target_org_id uuid, p_action_type text, p_before jsonb, p_after jsonb, p_reason text, p_mode text) RETURNS uuid`.

**Actor derivation (Path 3 from Session 49 design):**
1. Reads `current_setting('request.jwt.claims', true)::jsonb`
2. If `imp_actor_user_id` claim present → that's the actor (impersonation context)
3. Otherwise `auth.uid()` is the actor (direct super admin context)

**Session ID derivation:**
1. If `imp_session_id` claim present → use that (so audit_session_replay can group all events)
2. Otherwise `gen_random_uuid()` per-action

**Mode derivation:**
1. If `imp_mode` claim present → prefix with `impersonation:<imp_mode>:`
2. Otherwise pass through `p_mode`

**Trust boundary:** caller is responsible for `assert_super_admin()` gating. The helper does NOT self-gate because in dual-attribution mode `auth.uid()` is the impersonated user (would fail self-gate). SECURITY DEFINER, owned by postgres.

Returns the inserted row's UUID for callers that need to update `ended_at`/`end_reason` later (e.g., impersonation-end).

## 21. A1 impersonation Tier 1 backend (Session 49)

Per Group A scope section 2 (Feature A1 — User impersonation). All design decisions traceable to scope sections 2.2.1-2.2.11.

### 21.1 `impersonation_sessions` table

Server-side tracking for active and historical impersonation sessions.

```sql
CREATE TABLE public.impersonation_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_user_id   uuid NOT NULL REFERENCES users(id),
  target_user_id        uuid NOT NULL REFERENCES users(id),
  mode                  text NOT NULL CHECK IN ('observe','act'),
  justification         text NOT NULL CHECK (length >= 10),
  started_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL CHECK > started_at,
  ended_at              timestamptz,
  end_reason            text CHECK IN ('manual','timeout','forced'),
  ip_address            inet,
  user_agent            text,
  audit_log_id          uuid REFERENCES super_admin_audit_log(id),
  CONSTRAINT no_self_impersonation CHECK (super_admin_user_id <> target_user_id)
);
```

**Unique active session per super admin:** `CREATE UNIQUE INDEX impersonation_sessions_one_active_per_super_admin ON impersonation_sessions (super_admin_user_id) WHERE ended_at IS NULL` — backstops nested impersonation prevention at the DB level (scope 2.2.11).

**Immutability:** trigger `trg_impersonation_sessions_immutable` blocks DELETE entirely and blocks UPDATE on any column except `ended_at` and `end_reason`. Sessions cannot be modified once ended.

**RLS:**
- `impersonation_sessions: super admin can read all` (SELECT for super_admin)
- `impersonation_sessions: target user can read own history` (SELECT WHERE target_user_id = auth.uid()) — powers the access-history page (scope 2.4.2 / 4.4.4)
- `impersonation_sessions: service_role full access`

### 21.2 `validate_impersonation_session(p_session_id uuid)` RPC

Read-only check returning `{is_valid, reason, super_admin_user_id, target_user_id, mode, expires_at, ended_at}`. Called by `assert_impersonation_allows` for layer 1 enforcement and by Edge Functions for kill-switch checks. Reasons returned: `valid`, `session_not_found`, `session_ended`, `session_expired`. SECURITY DEFINER STABLE.

### 21.3 `assert_impersonation_allows(p_action_category text)` RPC

Layer 1 denylist enforcement. Returns `{status, imp_session_id, imp_actor_user_id, imp_target_user_id, imp_mode}` with status one of:
- `no_impersonation` — no `imp_session_id` claim, caller proceeds normally
- `act_allowed` — active act-mode session, caller must write `impersonation_action` audit row

Raises `42501` (Permission denied) when:
- Session is invalid (validation failed)
- Mode is `observe` (all mutations blocked)
- Mode is `act` AND category is on denylist

**Denylist categories (9 total, mapped to scope 2.3.1-2.3.9):**
- `identity_change` (2.3.1) — password/email/MFA/account deletion/ToS/consent
- `assessment_submission` (2.3.2) — 168 items, EPN, demographics, peer access response
- `privacy_consent` (2.3.3) — sharing prefs, demographic consent withdraw, share-with-coach toggle, peer access initiate
- `financial_transaction` (2.3.4) — Stripe purchase, subscription cancel, payment update, coupon apply
- `outbound_user_communication` (2.3.5) — AI chat send, peer access initiate
- `permission_change` (2.3.6) — account_type modify, org membership, nested impersonation
- `corporate_admin_action` (2.3.7) — bulk deactivation, supervisor assignment, admin promote/revoke, narratives, invitations
- `coach_action` (2.3.8) — invite client, order assessment, certification module mark-complete
- `lifecycle_action` (2.3.9) — corporate-to-individual conversion, pseudonymization

Mode read from DB row (not JWT) as defense in depth against tampered JWT claims.

Helper view `impersonation_denylist_categories()` returns the denylist categories with their scope-section mapping for documentation/reporting.

### 21.4 `custom_access_token_hook(event jsonb)` Postgres function

Auth Hook registered in Dashboard → Authentication → Hooks. Fires on every JWT issuance platform-wide. Reads `impersonation_sessions` for the user_id being authenticated; if active session exists AND `authentication_method` is `magiclink` or `token_refresh`, injects `imp_session_id`, `imp_actor_user_id`, `imp_mode`, `imp_expires_at` claims.

**Auth method gate:** the `magiclink` / `token_refresh` filter prevents the target user's normal logins (password, oauth, otp) from accidentally inheriting impersonation context if they happen to log in during an active session.

**Failure isolation:** entire body wrapped in `EXCEPTION WHEN OTHERS THEN RAISE WARNING ...; RETURN event; END` to ensure hook errors NEVER break platform auth. Hook errors logged via `RAISE WARNING` for monitoring.

`GRANT EXECUTE ... TO supabase_auth_admin` (the auth system role); `REVOKE EXECUTE ... FROM public, authenticated, anon`.

### 21.5 `check_mfa_freshness(p_session_id uuid, p_max_age_seconds integer)` RPC

Service-role-only RPC that reads `auth.mfa_amr_claims` for a session and verifies a TOTP verification has happened within the last `p_max_age_seconds`. Returns `boolean`. Used by `impersonation-start` to enforce fresh MFA gate (scope 2.2.7).

### 21.6 `impersonation-start` Edge Function

**Auth:** Class A (verify_jwt=false, explicit auth.getClaims).

**Gates (in order):**
1. Authenticated request
2. Caller is brainwise_super_admin (assert_super_admin RPC)
3. Caller has fresh MFA (check_mfa_freshness, 5-min window)
4. Target user exists
5. Target user is not the caller (no self-impersonation)
6. Caller has no other active session (DB UNIQUE constraint backstops)
7. Mode is observe or act
8. Justification length >= 10 chars

**Flow:**
1. Insert impersonation_sessions row (30-min expiry from now)
2. log_super_admin_action with action_type='impersonation_started'
3. Update sessions row with audit_log_id (link for access-history UI)
4. auth.admin.generateLink({ type: 'magiclink', email: target_email })
5. verifyOtp with hashed_token → real session as target user; hook fires and injects imp_* claims
6. Return { imp_session_id, access_token, refresh_token, expires_at, mode, target_user }

**Rollback:** if any post-insert step fails (audit, generateLink, verifyOtp), update sessions row with ended_at = now(), end_reason = 'forced'.

### 21.7 `impersonation-end` Edge Function

**Auth:** Class A using the impersonation JWT (caller is inside the session being ended).

**Validation:** JWT must carry `imp_session_id` AND `imp_actor_user_id`. Sanity checks ensure JWT claims match the DB row's super_admin_user_id and target_user_id (defense in depth against tampered JWT).

**Flow:** Update impersonation_sessions row with ended_at = now(), end_reason = 'manual'. Write log_super_admin_action with action_type='impersonation_ended'. Returns { imp_session_id, ended_at, duration_seconds }.

### 21.8 `sweep_expired_impersonation_sessions` Edge Function

**Auth:** Class C (cron-secret via X-Dispatcher-Secret header from `vault.decrypted_secrets WHERE name = 'departure_dispatcher_shared_secret'`).

**Flow:** Find sessions where `ended_at IS NULL AND expires_at < now()`. End each with end_reason='timeout', ended_at = the original expires_at (not now — for accurate timeline). Direct INSERT into super_admin_audit_log (cron-context exception since log_super_admin_action requires auth.uid() which is null in cron context). Returns summary stats { sessions_ended, audit_rows_written, audit_rows_failed }.

**Cron schedule:** `*/5 * * * *` (every 5 minutes). Worst-case post-expiry session lingering = 5 minutes. Frontend client-side timeout enforces user-visible countdown; this cron is the server-side backstop.

### 21.9 SOC 2 control summary (CC6.1, CC6.6)

- Privileged sessions time-bounded (30-min fixed)
- Server-side session row + signed JWT — both must be valid for actions to proceed
- Impersonation actions logged with actor (real super admin via JWT claim), target, IP, UA, justification, mode
- Justification required at session start (10-char minimum, scope 2.2.6)
- Fresh MFA gate at session start (scope 2.2.7, 5-min freshness)
- Dual attribution captured automatically by log_super_admin_action via JWT claims
- Audit log append-only (UPDATE/DELETE blocked at DB level via trg_immutable_audit_log)
- Self-impersonation blocked (DB CHECK + Edge Function gate)
- Nested impersonation blocked (DB UNIQUE INDEX + Edge Function gate)
- Quarterly review runbook deferred (scope 2.4.3 / 4.4.5, due 90 days post-launch)

### 21.10 Tier 2 deferred to Session 50

The denylist enforcement rollout across the 27 Edge Functions identified in Session 49 recon is Tier 2 work. Helper module `_shared/impersonation_gate.ts` deployed and verified Session 49. Per-function splices in Session 50.

## 22. `_shared/impersonation_gate.ts` Edge Function helper (Session 49)

Canonical denylist enforcement helper for Tier 2 Edge Function rollout. Shared module bundled with each function deploy via the `files` array in deploy_edge_function.

### 22.1 Exports

```typescript
export type ImpersonationDenylistCategory =
  | "identity_change" | "assessment_submission" | "privacy_consent"
  | "financial_transaction" | "outbound_user_communication"
  | "permission_change" | "corporate_admin_action" | "coach_action"
  | "lifecycle_action" | "read_only" | "other";

export class ImpersonationDeniedError extends Error {
  public readonly impSessionId: string | null;
}

export type ImpersonationGateResult =
  | { gated: false }
  | { gated: true; imp_session_id, imp_actor_user_id, imp_target_user_id, imp_mode: "act" };

export async function enforceImpersonationGate(
  callerClient: SupabaseClient,
  category: ImpersonationDenylistCategory,
): Promise<ImpersonationGateResult>;

export async function logImpersonationAction(
  callerClient: SupabaseClient,
  args: { target_user_id, target_org_id, edge_function_name, before, after },
): Promise<void>;
```

### 22.2 Standard usage pattern (for Tier 2 splices)

```typescript
import { enforceImpersonationGate, ImpersonationDeniedError } from "../_shared/impersonation_gate.ts";
// or "./_shared/impersonation_gate.ts" depending on existing convention in target function

// After auth.getClaims succeeds, before any mutation:
try {
  const gate = await enforceImpersonationGate(callerClient, "financial_transaction");
  // Proceed with mutation. If gate.gated is true (act_allowed),
  // call logImpersonationAction() AFTER mutation succeeds.
} catch (err) {
  if (err instanceof ImpersonationDeniedError) {
    return new Response(
      JSON.stringify({
        error: err.message,
        code: "IMPERSONATION_DENIED",
        imp_session_id: err.impSessionId,
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  throw err;
}
```

### 22.3 Hybrid auth pattern (generate-airsa-* style)

Functions that accept either user JWT or x-internal-secret header must short-circuit the gate when isInternal=true:

```typescript
if (callerUserId !== null) {
  // user JWT path — enforce gate
  await enforceImpersonationGate(callerClient, "corporate_admin_action");
}
// internal-secret path skips gate (no impersonation context possible)
```

### 22.4 Validation status (Session 49)

Helper deployed via `test-impersonation-gate` Edge Function (test-only, kept deployed for future ad-hoc testing). Probe with no-auth confirmed clean 401 response — module bundling resolved correctly, no module-not-found errors. RPC interaction validation deferred to first real Tier 2 splice in Session 50.

## 23. Tier 2 impersonation gate rollout (Sessions 50-51)

### 23.1 Helper module deep verification

End-to-end behavioral validation of `assert_impersonation_allows` RPC + helper module pairing performed Session 50 via direct SQL JWT-claim simulation:

| Test | Setup | Expected | Result |
|------|-------|----------|--------|
| 1 | No `request.jwt.claims` set | Returns `no_impersonation` | ✓ |
| 2 | JWT with bogus session_id (random UUID) | Raises 42501 | ✓ |
| 3a | observe-mode session, category=permission_change | Raises 42501 with `imp_session_id=<uuid>` DETAIL | ✓ |
| 3b | act-mode session, category=permission_change (denylisted) | Raises 42501 with DETAIL | ✓ |
| 3c | act-mode session, category=read_only (NOT denylisted) | Returns `act_allowed` with full session metadata | ✓ |

DETAIL field format `imp_session_id=<uuid>` confirmed to match helper TypeScript regex `/imp_session_id=([0-9a-f-]+)/i`. The helper's session-id extraction works correctly across all 42501 paths.

### 23.2 Edge Function file-path conventions discovered

Three distinct prefix styles exist across deployed functions. Always read `entrypoint_path` from `get_edge_function` and match exactly when redeploying:

| Style | Example function | entrypoint_path returned | Files block uses |
|-------|------------------|--------------------------|------------------|
| Naked | delete-account, calculate-scores, invitation_send, etc. | `source/index.ts` | `index.ts`, `_shared/<file>.ts` |
| `functions/` prefix | create-checkout | `source/functions/create-checkout/index.ts` | `functions/create-checkout/index.ts`, `functions/_shared/<file>.ts` |
| `supabase/functions/` prefix | ai-chat, customer-portal | `source/supabase/functions/<name>/index.ts` | `supabase/functions/<name>/index.ts`, `supabase/functions/_shared/<file>.ts` |
| Custom (set-account-type) | set-account-type | `source/set-account-type/index.ts` | `set-account-type/index.ts`, `_shared/<file>.ts` |

Wrong prefix = module bundling error at runtime (relative `../_shared/` import fails to resolve). The fix is mechanical but the symptom is a 500 with module-not-found, not the function's normal 401/error response.

### 23.3 Gate client requirement (CRITICAL)

`enforceImpersonationGate(callerClient, category)` MUST be called with an anon-key client that carries the user's `Authorization` header:

```typescript
const callerClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { global: { headers: { Authorization: authHeader } } }
);
await enforceImpersonationGate(callerClient, "permission_change");
```

If passed a service-role client instead, the gate **silently fails** — service-role calls don't carry user JWT context, so PostgREST's `request.jwt.claims` is null, the RPC returns `no_impersonation`, and the action proceeds even when impersonation is active.

This is a silent failure mode. Always verify by inspecting the client's auth config before passing it to the gate. In functions where the existing client is service-role (e.g. customer-portal, reactivate-account), construct a separate `userClient` for the gate call.

### 23.4 Tier 2 recon corrections

Recon misclassified four functions; corrected during rollout:

1. **`peer-access-respond`** — invoked from email-link click. No JWT, only `action_token` query param. Gate would always return `no_impersonation`. Reclassified as "explicitly NOT gated — public unauthenticated form".
2. **`verify-conversion`** — same pattern. Email-link, token query param, no JWT. Reclassified as "explicitly NOT gated".
3. **`airsa-supervisor-invite`** — Class B internal-secret only (`x-internal-secret` header). No caller user JWT possible. The CALLER (calculate-scores) is gated; this is the receiver. Reclassified.
4. **`send-departure-emails`** — same as #3. Class B receiver. Callers (deactivate-and-notify, bulk-deactivate-and-notify, etc.) are all gated. Reclassified.

Lesson: when classifying functions for impersonation gate, distinguish (a) JWT-required user-facing endpoints, (b) internal-secret server-to-server endpoints, (c) public unauthenticated form endpoints. Only (a) needs the gate. For (b), gate the CALLER. (c) cannot be gated.

### 23.5 reactivate-account preserved verify_jwt:true

Unique among Tier 2 functions — `reactivate-account` had `verify_jwt: true` at platform level and lacked an inline `auth.getUser()` call. The gate splice was added conditionally on `Authorization` header presence to preserve existing behavior.

Pre-existing security observation flagged but out of scope: any authenticated user could pass any email and reactivate that user's account — there's no caller-vs-target ownership check. The impersonation gate adds defense for the impersonation case; the broader hole is a separate hardening item for the build queue.

### 23.6 airsa-supervisor-reminder category re-categorization

Session 49 recon classified `airsa-supervisor-reminder` as `corporate_admin_action`. During Session 50 reading, the actual semantics turned out to be: the SELF-RATER (a regular employee) clicks a button to nudge their supervisor. The action is sending an email from the user's identity. The correct category is `outbound_user_communication`. Both categories are denylisted in observe and act mode, so enforcement behavior is identical — but the category label matters for audit trail accuracy and future reporting queries.

### 23.7 Session 51 deltas

Two updates to the Session 50 architectural learnings, surfaced during the final 6-function rollout in Session 51.

**`entrypoint_path` convention clarification.** The `Supabase:deploy_edge_function` MCP tool prepends `source/` to the `entrypoint_path` value automatically. Pass `entrypoint_path: "index.ts"` (naked, no `source/` prefix). Passing `source/index.ts` causes path doubling and a `BadRequestException` at deploy time.

This corrects the implication in §23.2 that the prefix returned by `get_edge_function` (e.g. `source/index.ts`) is what should be passed back into `deploy_edge_function`. The returned path is the platform's absolute internal path; the `entrypoint_path` parameter is interpreted relative to the implicit `source/` root that the deploy tool creates. The file `name` field for files in the bundle stays as `index.ts` and `_shared/impersonation_gate.ts`.

This was discovered during the `generate-dashboard-narrative` deploy: first attempt with `entrypoint_path: "source/index.ts"` failed with BadRequestException, retry with `entrypoint_path: "index.ts"` succeeded. Subsequent deploys (`generate-nai-delta-narrative` v12, `generate-ptp-delta-narrative` v9) used the naked convention and succeeded first try.

For the four file-path conventions documented in §23.2, the `entrypoint_path` parameter values that work are:

| Style | Files block uses | entrypoint_path parameter |
|-------|------------------|---------------------------|
| Naked | `index.ts`, `_shared/<file>.ts` | `index.ts` |
| `functions/` prefix | `functions/<name>/index.ts`, `functions/_shared/<file>.ts` | `functions/<name>/index.ts` |
| `supabase/functions/` prefix | `supabase/functions/<name>/index.ts`, `supabase/functions/_shared/<file>.ts` | `supabase/functions/<name>/index.ts` |
| Custom (set-account-type) | `set-account-type/index.ts`, `_shared/<file>.ts` | `set-account-type/index.ts` |

In all cases, drop the `source/` prefix that `get_edge_function` returns when constructing the deploy parameter.

**Recon correction #5: `generate-departure-export` is `lifecycle_action`.** The function was originally tagged `corporate_admin_action` in the Session 49 recon. In practice the caller is the deactivated `corporate_employee` retrieving their own data export — a self-service lifecycle action, not an admin operation against another user. Recategorized to `lifecycle_action` (v8 deploy).

Both categories are denylisted in observe and act mode, so runtime behavior is unchanged. The category label matters for audit trail accuracy and future reporting queries.

This brings the running total of recon corrections to 5: four from Session 50 (`peer-access-respond`, `verify-conversion`, `airsa-supervisor-invite`, `send-departure-emails` — all reclassified out of Tier 2 entirely) plus one from Session 51 (`generate-departure-export` — recategorized within Tier 2).

**Session 51 deploy summary.** Six functions, all probed clean HTTP 401:

| Function | Version | Category |
|----------|---------|----------|
| `generate-departure-export` | v8 | `lifecycle_action` |
| `generate-airsa-org-narrative` | v4 | `corporate_admin_action` (HYBRID — gate only when !isInternal) |
| `generate-cross-instrument-recommendations` | v9 | `corporate_admin_action` |
| `generate-dashboard-narrative` | v24 | `corporate_admin_action` |
| `generate-nai-delta-narrative` | v12 | `corporate_admin_action` |
| `generate-ptp-delta-narrative` | v9 | `corporate_admin_action` |

23 of 23 in-scope Tier 2 functions now spliced.

## 24. A3 Phase 2 audit reporting RPCs (Session 52)

Six SECURITY DEFINER RPCs deployed for the audit reporting surface. All gated via `assert_super_admin()` except `my_access_history` (gated only by `auth.uid() IS NOT NULL` since each user reads their own history). All take a max-200 hard cap on `p_limit` to bound row counts.

### 24.1 RPC catalog

| RPC | Args | Returns | Gate | Indexes used |
|---|---|---|---|---|
| `list_audit_events` | `p_filters jsonb, p_limit int, p_offset int` | `TABLE(... total_count bigint)` | `assert_super_admin()` | `idx_audit_log_action_type`, `idx_super_admin_audit_log_actor_created`, `idx_super_admin_audit_log_session_id`, `idx_super_admin_audit_log_mode` |
| `audit_event_detail` | `p_event_id uuid` | `TABLE(... before_value jsonb, after_value jsonb, ...)` | `assert_super_admin()` | PK lookup |
| `audit_session_replay` | `p_session_id uuid` | `jsonb` (`{session: {...}, events: [...]}`) | `assert_super_admin()` | `idx_super_admin_audit_log_session_id` |
| `export_audit_events` | `p_filters jsonb` | `jsonb` (`{rows, total_returned, total_matched, truncated, cap, exported_at}`) | `assert_super_admin()` | Same as `list_audit_events` |
| `my_access_history` | `p_limit int, p_offset int` | `TABLE(audit_source text, ... total_count bigint)` | `auth.uid() IS NOT NULL` | `idx_super_admin_audit_log_affected_user_created`, `idx_company_admin_audit_log_target` |
| `search_impersonation_targets` | `p_query text, p_limit int` | `TABLE(user_id uuid, email, full_name, account_type, organization_name)` | `assert_super_admin()` | `idx_users_email_trgm`, `idx_users_full_name_trgm` |

### 24.2 Filter schema (jsonb shape used by `list_audit_events` and `export_audit_events`)

```json
{
  "actor_user_id": "uuid|null",
  "target_user_id": "uuid|null",
  "action_type": "text|null",
  "date_from": "ISO8601|null",
  "date_to": "ISO8601|null",
  "mode": "text|null",
  "session_id": "uuid|null"
}
```

`mode` filter exact-matches against the stored value (e.g. `"impersonation:observe:individual_record_viewed"`). For wildcard mode searches (e.g. all impersonation modes), a `mode_prefix` filter would need to be added later. Empty/missing keys are treated as no filter.

### 24.3 `my_access_history` UNION shape decision

`my_access_history` UNIONs `super_admin_audit_log` (filtered on `affected_user_id = auth.uid()`) and `company_admin_audit_log` (filtered on `target_user_id = auth.uid()`). The two tables have divergent shapes: `super_admin_audit_log` carries `mode`/`session_id`/`detail`; `company_admin_audit_log` carries neither. Unified output shape includes an `audit_source text` discriminator (`'super_admin'` or `'company_admin'`) so the frontend can render row variants. `before_value`/`after_value` are intentionally NOT returned — the user sees metadata about who accessed their record but not the raw before/after diffs (those are super-admin-only via `audit_event_detail`).

Decision rationale logged Session 52: UNION inside RPC chosen over pre-unified view. View would require RLS sync + breaks when underlying table shapes diverge further; RPC encapsulates both concerns and lets future audit tables (coach-tier, instrument-content) extend cleanly via `ALTER FUNCTION`.

### 24.4 `export_audit_events` truncation behavior

Hard cap: 10,000 rows. When `total_matched > cap`, returns the most-recent 10,000 rows (`ORDER BY created_at DESC`) plus `truncated: true`. The frontend renders a banner instructing the user to narrow filters and re-export. SOC 2 CC7.2 (anomaly detection) favors graceful truncation over hard-fail because investigators hitting the cap still see the most recent slice while being told to narrow.

### 24.5 `audit_session_replay` single-jsonb shape

Returns `jsonb` with two top-level keys: `session` (the `impersonation_sessions` row joined with super admin and target user metadata) and `events` (array of `super_admin_audit_log` rows where `session_id = p_session_id`, ordered chronologically ASC). Single jsonb chosen over two RPCs to enforce atomic gate + atomic session/event consistency. Frontend renders session metadata as a header card and events as a timeline.

When `p_session_id` does not match any row in `impersonation_sessions`, the `session` key returns null but the events query still runs (since `session_id` values in `super_admin_audit_log` can be ad-hoc per-action UUIDs unrelated to impersonation). This means callers get a useful response for both impersonation-bound and ad-hoc session IDs.

### 24.6 Architecture-reference §20 schema clarification

§20.1 (`super_admin_audit_log`) and §20.2 (`company_admin_audit_log`) ALTER TABLE statements are correct and verified against live DB. The actor column on `super_admin_audit_log` is `super_admin_user_id`; the target column is `affected_user_id`; the org column is `company_id`; the jsonb detail column is `detail` (NOT `action_details`). The actor column on `company_admin_audit_log` is `actor_user_id`; the target column is `target_user_id`; the org column is `organization_id`; the jsonb detail column is `action_details`. These names matter for any RPC writing or filtering against these tables — they are not interchangeable.

### 24.7 `pg_trgm` extension enabled

Trigram extension installed Session 52 to support ILIKE substring acceleration on `users.email` and `users.full_name` for `search_impersonation_targets`. GIN indexes added: `idx_users_email_trgm`, `idx_users_full_name_trgm` (the latter partial WHERE full_name IS NOT NULL). Available now for any future user-search RPCs (coach search, departments search, etc.).

### 24.8 Verification record

All six RPCs verified Session 52 via:
1. `pg_proc` catalog confirmation (signature, SECURITY DEFINER flag).
2. Functional smoke test with super admin JWT claims (real-data return, joins working).
3. Gate test with non-super-admin JWT claims (42501 raise from `assert_super_admin()` for the five gated RPCs, empty-result behavior for `my_access_history` when the caller has no audit history).
4. Filter exactness check against ground-truth COUNT queries on the underlying tables.

Production audit log row counts at verification time: 367 rows in `super_admin_audit_log` across 10 distinct action types. `my_access_history` UNION verified at user level: orgmember test user shows 30 super_admin + 2 company_admin = 32 events, matching ground truth.

## 25. Phase C frontend integration map (Session 52 recon)

Recon completed Session 52 against commit `a896b67…` of `cbastianBWE/brainwise-blueprint`. The integration decisions below are locked and should drive Phase C prompt construction.

### 25.1 Routing structure (existing)

- `src/main.tsx` is bare — renders `<App/>` only.
- `src/App.tsx` is the router root. Wraps in `QueryClientProvider` → `TooltipProvider` → `BrowserRouter` → `AuthProvider` → `<Routes>`.
- Protected routes split into two buckets:
  - **Bypass-AppLayout protected routes**: `/onboarding`, `/demographic-consent`, `/demographic-form`, `/mfa-enrollment`, `/peer-sharing-optin`, `/departed`. These wrap `<ProtectedRoute>` directly.
  - **AppLayout protected routes**: everything else under `<Route element={<ProtectedRoute><AppLayout/></ProtectedRoute>}>`. AppLayout provides sidebar + navy header.
- `RoleGuard allowedRoles={["brainwise_super_admin"]}` is the canonical super-admin gating pattern used at the route level.
- `SuperAdminSessionProvider` already wraps every super-admin route — it is just a `crypto.randomUUID()` per-mount client-side correlation hook. Does NOT conflict with Phase C `ImpersonationProvider`.

### 25.2 Banner injection: App.tsx-level (locked)

The orange impersonation banner injects in `src/App.tsx`, between `<AuthProvider>` and `<Routes>`, NOT inside `AppLayout`. Reason: the existing demographics/MFA/deactivation gates in `ProtectedRoute` redirect users to bypass-AppLayout protected routes. If a super admin impersonates a target whose demographics are incomplete, ProtectedRoute will redirect to `/demographic-form`, which does not render inside AppLayout. The banner MUST persist on those routes.

`AppLayout`'s existing structure:
```
SidebarProvider → div.flex
  AppSidebar
  div.flex-col
    header (navy 56px)
    main (renders <Outlet/> with optional coupon banner above)
```

The coupon banner currently inside `<main>` is a content-area banner, not the model for the impersonation banner. Impersonation banner must sit OUTSIDE both AppLayout and any route-specific page chrome.

### 25.3 ImpersonationProvider design (new)

New file `src/contexts/ImpersonationProvider.tsx`. Sits in `App.tsx` between `<AuthProvider>` and `<Routes>`. Reads JWT claims (`imp_session_id`, `imp_actor_user_id`, `imp_mode`, `exp`) on every `auth.onAuthStateChange` fire. Exposes:

```
{
  isImpersonating: boolean,
  session: { sessionId, actorUserId, targetUserId, mode, expiresAt, startedAt } | null,
  beginImpersonation(targetUserId, mode, justification, mfaCode): Promise<void>,
  endImpersonation(reason: 'manual' | 'forced'): Promise<void>,
  remainingSeconds: number  // ticks every second; 0 when not impersonating
}
```

`beginImpersonation` calls the `impersonation-start` Edge Function, then `supabase.auth.setSession({ access_token, refresh_token })` with the response tokens, then navigates to `/dashboard`. `endImpersonation` calls `impersonation-end`, restores original tokens (returned in the response), navigates to `/super-admin/users` (the impersonation entry point).

### 25.4 Impersonation entry point: `/super-admin/users` page (new, locked)

NEW page `src/pages/super-admin/Users.tsx` registered at `/super-admin/users` in App.tsx (alongside existing super-admin routes). Page contents:

- Search input (debounced 250ms) → calls `search_impersonation_targets(query, 25)`.
- Table with columns: Email, Full Name, Account Type, Organization, Actions.
- Action column: "Impersonate" button (opens `JustificationModal` for that target). Future actions (MFA reset, password reset, force pseudonymization, view session history) slot in as additional menu items.
- Empty state for unsearched / too-short query: "Type at least 2 characters to search."

Sidebar `superAdminNav` array gets a new entry: `{ title: 'User Management', url: '/super-admin/users', icon: Users }`. Update `useAuth.redirectByRole` so super admins land on `/super-admin/users` instead of `/super-admin/health` (small but worth flagging — doc this as a behavior change).

`/super-admin` (currently a layout-only fallback at App.tsx line 165) gets removed or replaced with a redirect to `/super-admin/users`.

### 25.5 JustificationModal design (new)

New file `src/components/impersonation/JustificationModal.tsx`. Receives `target: { user_id, email, full_name, account_type }` as prop (from the row click on `/super-admin/users`).

Flow:
1. Step 1: Justification textarea (10 char min, hint shown), mode selector (observe/act radio buttons). Continue button enabled when justification ≥ 10 chars.
2. Step 2: Embedded `<MfaChallenge userId={user.id} onSuccess={...} onCancel={closeModal} />` (note `onCancel` is a NEW prop — see §25.6).
3. On MFA success: call `beginImpersonation(target.user_id, mode, justification, mfaCode)`. Loading spinner. On success: modal closes, banner appears, navigation to `/dashboard`.

### 25.6 MfaChallenge.tsx additive change

Existing `src/components/MfaChallenge.tsx` already does: list factors → challenge → verify → onSuccess callback. Phase C needs to reuse this component but the existing `handleCancel` calls `supabase.auth.signOut()` — wrong for the justification modal where cancelling should just close the modal.

Modification: add optional `onCancel?: () => void` prop. If provided, run that instead of signOut. Backwards-compatible — existing call sites (Login flow) continue to work because `onCancel` is undefined for them. One-prop additive change.

### 25.7 Tab title / favicon / red border (new ImpersonationChrome)

New file `src/components/impersonation/ImpersonationChrome.tsx`. Render-only side effects, no UI. Mounted by `ImpersonationProvider` when `isImpersonating === true`. Effects:

- `useEffect`: prefix `document.title` with `[IMPERSONATING] `, restore on unmount.
- `useEffect`: swap `<link rel="icon">` href to `/brain-icon-impersonating.png` (asset to be added — red dot version of brain-icon.png), restore on unmount.
- 4 fixed-position 2px-wide red divs (top, bottom, left, right of viewport) for the border.

### 25.8 ImpersonationBanner design (new)

New file `src/components/impersonation/ImpersonationBanner.tsx`. Sticky-top fixed position, full-width, height ~48px, BrainWise orange (#F5741A) background, white text. Contents (left to right):

- Mode pill: `OBSERVE` or `ACT` (white text, slightly darker orange background pill).
- "Impersonating: {target_email}" text.
- Countdown: "Time remaining: {mm:ss}" — driven by `remainingSeconds` from context.
- "Exit Impersonation" button (white-bordered, white text, transparent background).

Body content shifts down by banner height when `isImpersonating` (set a `--impersonation-banner-height: 48px` CSS variable on `body` when active, applied as `padding-top` on `body`).

### 25.9 ProtectedRoute handling during impersonation: Option B locked

Decision Session 52: `ProtectedRoute` does NOT bypass demographic/MFA/deactivation gates during impersonation. Reasoning:

- The principle of impersonation is "see and act as the target user." If the target user has incomplete demographics, the super admin should see them on `/demographic-form` — that's the experience the target sees.
- Avoids a class of UI inconsistency bugs where the super admin sees a different state than the target during integration testing.
- Backend Tier 2 denylist is already the security layer enforcing that no mutations slip through.

ACTION ITEM for Phase C-1 prompt: AUDIT the Tier 2 denylist (action types in `super_admin_action_types.denylist_during_impersonation`) to confirm the demographic-form-submit and mfa-enrollment-completion Edge Functions are denylisted. If they are not, add a Phase C-1 backend task to add them BEFORE shipping Phase C-1 frontend.

### 25.10 Token swap mechanics

`impersonation-start` Edge Function returns `{ access_token, refresh_token, session: {...} }`. Frontend calls `supabase.auth.setSession({ access_token, refresh_token })`. This triggers `auth.onAuthStateChange` SIGNED_IN, which propagates through `AuthProvider` → all hooks consuming `useAuth()` re-render → `useUserProfile` refetches based on new `user.id` (which is now the target). `RoleGuard` re-evaluates with the target's account_type and routes accordingly.

`impersonation-end` returns the original super admin tokens. Same `setSession` flow restores the super admin session.

Phase C-1 prompt MUST verify the actual response shape of `impersonation-start` and `impersonation-end` Edge Functions before writing the frontend integration code (recon read deferred to that prompt's pre-flight).

### 25.11 Phase D `/settings/access-history` integration

Top-level route, NOT nested under `/settings`. Registered in App.tsx alongside `/settings/privacy`, `/settings/billing` (flat sibling pattern, line 128-131 of current App.tsx). Page reads from `my_access_history` RPC. CSV export uses `export_audit_events` (BUT only super admins can call that — `my_access_history` does not have an export equivalent. Phase D adds a `my_access_history_export` RPC OR the frontend assembles CSV from the paginated RPC results client-side. Simpler path: client-side CSV from paginated results, capped at 1000 rows. Decision deferred to Phase D prompt construction.)

Sidebar update in `src/components/AppSidebar.tsx`: add `{ title: 'Access History', url: '/settings/access-history', icon: History }` to BOTH `settingsSubItems` (line 137) and `coachSettingsSubItems` (line 143) arrays. Two-line change.

### 25.12 Three-prompt sequencing (locked)

- **Phase C-1 (infrastructure)**: ImpersonationProvider + ImpersonationBanner + ImpersonationChrome + MfaChallenge `onCancel` additive prop + App.tsx wiring + Tier 2 denylist audit. Ships dormant infrastructure (no entry point yet, banner never shows because no session is started).
- **Phase C-2 (entry + flow)**: SuperAdminUsers page + JustificationModal + sidebar superAdminNav update + redirectByRole update + `impersonation-start`/`impersonation-end` integration. End-to-end impersonation goes live.
- **Phase D (access history)**: AccessHistory page + sidebar settings update + route registration. Independent of impersonation. Low-risk.

Each prompt is testable independently. Phase C-1 ships dormant; Phase C-2 lights it up; Phase D is unrelated.


## 26. Session 53 backend pre-flight deltas

Three pre-flight backend tasks shipped before Phase C-1 frontend prompt construction. Each was triggered by recon findings that contradicted Session 52 §25 locked decisions; each contradiction is captured below alongside the corrected design.

### 26.1 impersonation-end v2: super admin token mint (corrects §25.10)

**Contradiction found**: §25.10 stated "impersonation-end returns the original super admin tokens. Same setSession flow restores the super admin session." Code recon of impersonation-end v1 showed it returns only `{ success, imp_session_id, ended_at, duration_seconds }` — no tokens. The architecture reference assumption was speculative and not grounded in code.

**Resolution (Decision 1, Path 2)**: Modify impersonation-end to mint fresh tokens for the original super admin so the frontend can restore the super admin session without forced re-login.

**impersonation-end v2 deployed Session 53**. Sequence:

1. Validate JWT, extract imp_session_id and imp_actor_user_id from claims.
2. Fetch impersonation_sessions row, verify actor and target match JWT claims.
3. UPDATE ended_at FIRST so custom_access_token_hook does not stamp imp_* claims on the new super admin token (the hook filters on ended_at IS NULL).
4. log_super_admin_action with action_type='impersonation_ended'. Attribution still records super admin to target because we use callerClient which still holds imp_actor_user_id.
5. Look up super admin email from public.users via adminClient.
6. generateLink (magiclink) + verifyOtp on a fresh anon client. Produces an aal1 session for the super admin.
7. Return { success, restored: true, super_admin_user_id, access_token, refresh_token, expires_at } at top level.

**Token AAL note**: The minted super admin session is aal1 (magic-link single-factor). Current MFA gate (current_user_mfa_satisfied) checks factor existence not session AAL, so super admin lands cleanly back on /super-admin/users without being bounced through MFA. Session-AAL-aware MFA gating is its own architectural pass — logged as a build queue item (medium priority, post-launch).

**Failure path**: If super admin lookup or token mint fails, the function returns `{ success: true, restored: false, restore_error: ... }`. The session has already been ended at the DB level; only the client-side restoration fails. Frontend handles `restored: false` by signing out the impersonation session and redirecting to /login.

**Critical sequencing**: ended_at is set BEFORE generateLink fires for the super admin. This is defensive: even in a hypothetical scenario where the super admin's user_id matched some impersonation_sessions.target_user_id (which should never happen since super admins shouldn't be targets), the hook would skip claim stamping because ended_at is no longer null.

### 26.2 is_impersonating() and is_impersonating_act() helpers + user_demographics RLS

**Contradiction found**: §25.9 stated that the Tier 2 backend denylist is "the security layer enforcing that no mutations slip through" during impersonation. Recon revealed Tier 2 enforcement only fires when an Edge Function explicitly calls `enforceImpersonationGate(callerClient, category)`. It does NOT fire on:

- Direct Supabase client table writes gated only by RLS (e.g. `user_demographics`, where the policy was `user_id = auth.uid()`). During act-mode impersonation the JWT's auth.uid() is the target's user_id, so RLS allowed the write through.
- Supabase auth APIs (mfa.enroll, mfa.challenge, mfa.verify, auth.updateUser) — platform endpoints that don't go through user-defined Edge Functions.

This was a gap in the §25.9 security-layer claim.

**Resolution (Decision 2, Path C, RLS half)**: Add helpers that read JWT claims for an active impersonation session, then add RLS WITH CHECK clauses on user-self-write tables that block writes during impersonation.

**Helpers deployed**:

```
public.is_impersonating() RETURNS boolean STABLE SECURITY DEFINER
  - Reads request.jwt.claims for imp_session_id
  - Confirms session is live (ended_at IS NULL AND expires_at > now()) by querying impersonation_sessions
  - Returns true if both conditions hold; false otherwise
  - Defense in depth: doesn't trust JWT alone, verifies against DB row

public.is_impersonating_act() RETURNS boolean STABLE SECURITY DEFINER
  - Same as is_impersonating() but additionally requires mode = 'act'
  - Reads mode from DB row (canonical), not from JWT (defense against tampered claims)
  - Returns false if no matching active session (COALESCE wraps the SELECT result)
```

Both granted EXECUTE to authenticated.

**user_demographics policy refactor**: The original FOR ALL policy `(user_id = auth.uid())` was split into four policies:

- `user_demographics: users read their own row` — FOR SELECT, USING `(user_id = auth.uid())`. No impersonation block on reads, so super admin observers can SELECT target demographics.
- `user_demographics: users insert their own row, no impersonation` — FOR INSERT, WITH CHECK `(user_id = auth.uid() AND NOT public.is_impersonating())`.
- `user_demographics: users update their own row, no impersonation` — FOR UPDATE, USING `(user_id = auth.uid())`, WITH CHECK same as INSERT.
- `user_demographics: users delete their own row, no impersonation` — FOR DELETE, USING `(user_id = auth.uid() AND NOT public.is_impersonating())`.

Service role policy unchanged (full access).

**Verification matrix** (all ✓):

| Scenario | is_impersonating() | is_impersonating_act() | INSERT into user_demographics |
|---|---|---|---|
| No JWT (service role direct) | false | false | (RLS bypassed) |
| JWT, no imp_session_id claim | false | false | succeeds |
| JWT, imp_session_id pointing at ended session | false | false | succeeds |
| JWT, observe-mode active session | true | false | blocked (insufficient_privilege) |
| JWT, act-mode active session | true | true | blocked (insufficient_privilege) |

**Semantics decision**: BOTH observe and act mode block writes. Reasoning: a super admin should never write the target's demographics, regardless of mode. Observe mode redundantly blocks (the gate function already blocks all observe-mode writes), but having NOT is_impersonating() in WITH CHECK is harmless and makes the policy self-documenting at the table level.

### 26.3 identity-mutation Edge Function wrapper

**Resolution (Decision 2, Path C, application half)**: Single chokepoint for identity_change category mutations that go through Supabase auth APIs (auth.updateUser for password/email; auth.mfa.enroll/unenroll). These bypass Edge Function Tier 2 gating when called via the Supabase JS client directly. The wrapper calls enforceImpersonationGate first, then forwards via the caller's authenticated client.

**identity-mutation v1 deployed Session 53**. Class A explicit (verify_jwt=false; auth.getClaims inside).

Body shape discriminator-based:
- `{ action: "update_password", new_password }` → callerClient.auth.updateUser({ password })
- `{ action: "update_email", new_email }` → callerClient.auth.updateUser({ email })
- `{ action: "mfa_enroll" }` → callerClient.auth.mfa.enroll({ factorType: "totp" }), returns { factor_id, qr_code, secret }
- `{ action: "mfa_unenroll", factor_id }` → callerClient.auth.mfa.unenroll({ factorId })

Gate: enforceImpersonationGate(callerClient, "identity_change"). identity_change is in the denylist for both observe and act, so any impersonation context blocks the call. On gate denial: 403 with `{ code: "IMPERSONATION_DENIED", imp_session_id }`.

**Frontend rewires required (Phase C-1.5, folded into Phase C-1 prompt)**:

- src/pages/ResetPassword.tsx line 49: `supabase.auth.updateUser({ password })` → call identity-mutation with action="update_password".
- src/pages/Settings.tsx saveEmail() line 364: `supabase.auth.updateUser({ email })` → call identity-mutation with action="update_email".
- src/pages/MfaEnrollment.tsx handleEnroll() and any unenroll surface in Settings.tsx → call identity-mutation with action="mfa_enroll" or "mfa_unenroll".
- src/components/MfaChallenge.tsx is unaffected (challenge/verify steps don't include enroll).

**Why pattern Z (gate + perform via caller token) was chosen** over admin-perform: Supabase auth admin API has `auth.admin.updateUserById` for password/email but no admin equivalent for `mfa.enroll/unenroll`. Pattern Z uses callerClient throughout, working uniformly for all four operations.

**Future-proofing**: Any future identity_change path (phone-number change, recovery email, account merge, etc.) routes through the same wrapper, automatically gated. SOC 2 audit log review benefits from a single chokepoint for identity_change events.

### 26.4 §25.9 partial reversal: ProtectedRoute redirects gate routes during impersonation

**Reversal**: Original §25.9 Option B locked: "ProtectedRoute does NOT bypass demographic/MFA/deactivation gates during impersonation." That decision rested on the false assumption that the Tier 2 backend denylist alone protected all mutation paths from those gate routes. §26.2 and §26.3 close the actual mutation paths at the database and Edge Function layers; the frontend complement is to ALSO redirect the gate routes during impersonation.

**New behavior locked Session 53**: When ImpersonationProvider context indicates `isImpersonating === true`, ProtectedRoute treats the impersonation as authoritative and redirects gate routes to /dashboard:

- /onboarding → /dashboard
- /demographic-consent → /dashboard
- /demographic-form → /dashboard
- /mfa-enrollment → /dashboard
- /peer-sharing-optin → /dashboard

(/departed remains accessible because deactivation observation is a legitimate impersonation use case.)

**Defense in depth**: This is layer 3 of three layers. Layers 1-2 (RLS WITH CHECK + identity-mutation Edge Function wrapper) close the database and application paths. Layer 3 (frontend redirect) prevents the super admin from even reaching the surface that would attempt those mutations.

This is implemented in Phase C-1 frontend prompt as a small ProtectedRoute modification: read isImpersonating from ImpersonationProvider, short-circuit gate routes when true.

### 26.5 Vestigial column finding: super_admin_action_types.denylist_during_impersonation

**Side observation logged Session 53**: The `super_admin_action_types` table has a `denylist_during_impersonation` boolean column. The actual runtime denylist mechanism (`assert_impersonation_allows`) is category-based and uses a hardcoded text array literal; it does not consult `super_admin_action_types` at all. The column is therefore vestigial — never read by any code path.

Logged as build queue item (LOW priority, post-launch): replace the hardcoded `v_denylist text[]` array in `assert_impersonation_allows` with a SELECT against a new `super_admin_denylist_categories` table (one row per category, `category text PRIMARY KEY`, `denylist_during_act boolean`, `comment text`). Drop the dead `super_admin_action_types.denylist_during_impersonation` column in the same migration.

Benefits: queryable denylist for SOC 2 evidence collection, no schema drift between RPC and registry, no behavior change at deploy (table seed = current array).

### 26.6 useMfaSatisfied semantics finding

Not a Session 53 ship; logged for future MFA gate hardening pass.

`current_user_mfa_satisfied()` checks whether the user has a verified factor in `auth.mfa_factors`, NOT whether the current session is `aal2`. This means:

- A user with a verified TOTP factor returns `mfaSatisfied: true` regardless of whether their current session is aal1 or aal2.
- The MFA gate is enforcing "user has set up MFA" not "user has presented MFA on this session" — weaker than Supabase's native AAL-based enforcement.

For Session 53 this means: when impersonation-end mints a fresh aal1 session for the super admin, ProtectedRoute does NOT bounce them through MFA (because they have a verified factor). Good UX, but a SOC 2 weakness worth fixing in a later pass.

Logged build queue item (MEDIUM priority, post-launch): refactor current_user_mfa_satisfied to check session AAL via `auth.aal()` claim or a new `current_user_session_aal()` helper, requiring `aal2` for sensitive surfaces. Will require coordinated frontend changes to handle the post-impersonation re-MFA flow gracefully.

### 26.7 custom_access_token_hook freshness gate (Session 53 close)

**Problem surfaced during Phase D testing**: When a super admin logged out via the sidebar instead of clicking "Exit Impersonation", the `impersonation_sessions` row stayed `ended_at IS NULL`. The next time the target user attempted to log into their own account, the hook detected the stranded active row, matched on `auth_method='otp'` (since Supabase records `verifyOtp` as 'otp' regardless of link type — used by both impersonation-start AND normal login flows), and stamped imp_* claims onto the target's normal login token. The target user landed in their own account but with imp claims attached, which surfaced as confusing MFA errors and ImpersonationProvider bootstrap failures.

**Investigation**: Considered an `AFTER DELETE` trigger on `auth.sessions` to auto-end matching impersonation_sessions on logout. Verified via `has_table_privilege` that we can create such a trigger. But verified empirically that **Supabase does NOT delete auth.sessions rows on logout** (cbastian had 11 active auth.sessions rows despite multiple logouts; only expiry via `expires_at` is enforced). The trigger would never fire on signOut events. Wrong layer.

**Fix locked Session 53 close**: Tighten the hook itself with a freshness gate distinguishing legitimate impersonation-start mints from stranded-row contamination.

For `'otp'` and `'magiclink'` initial token mints: require the matching `impersonation_sessions` row was created within the last 60 seconds. impersonation-start mints the token within ~2 seconds of inserting the row (via verifyOtp), so this catches the legitimate flow with 30x slack. Stranded rows (minutes+ old by definition) take the early return — no claims stamped.

For `'token_refresh'`: require the incoming JWT already carries `imp_session_id` matching the active row. The hook receives existing claims via `event -> 'claims'`, so this check is trivial. Refreshes preserve impersonation; they cannot create one out of nothing.

```sql
IF v_auth_method = 'token_refresh' THEN
  v_existing_imp_session := v_claims ->> 'imp_session_id';
  IF v_existing_imp_session IS NULL OR v_existing_imp_session <> v_session.id::text THEN
    RETURN event;
  END IF;
ELSE
  -- magiclink/otp initial mint
  v_row_age_seconds := EXTRACT(EPOCH FROM (now() - v_session.started_at));
  IF v_row_age_seconds > 60 THEN
    RETURN event;
  END IF;
END IF;
```

**Net effect**: stranded rows (which still get cleaned by the existing 30-min cron sweep `sweep_expired_impersonation_sessions`) can no longer pollute subsequent target-user logins while pending cleanup. The 60-second window is generous enough that no legitimate impersonation-start flow could miss it (the verifyOtp-to-token-mint path has no possible 60s delay).

### 26.8 check_mfa_freshness reads auth.mfa_challenges.verified_at as fallback

**Problem surfaced mid-Session 53**: After completing MFA verification on an already-aal2 session (e.g., super admin already logged in with MFA, navigates to /super-admin/users, clicks Impersonate, completes the JustificationModal MFA challenge), `check_mfa_freshness` returned false. Root cause: Supabase does NOT write a new row to `auth.mfa_amr_claims` when re-verifying MFA on a session that's already aal2. The amr_claims table only captures the most recent factor that elevated the session to aal2, not subsequent verifications.

**Fix**: `check_mfa_freshness` now reads BOTH `auth.mfa_amr_claims` AND `auth.mfa_challenges.verified_at`. The `mfa_challenges` table records every verification attempt, including re-verifications on already-aal2 sessions. The function returns true if EITHER source shows a verified factor within the freshness window (default: 5 minutes).

```sql
RETURN (
  EXISTS (
    SELECT 1 FROM auth.mfa_amr_claims
    WHERE session_id = v_session_id
      AND created_at > now() - p_window
  )
  OR EXISTS (
    SELECT 1 FROM auth.mfa_challenges c
    JOIN auth.mfa_factors f ON f.id = c.factor_id
    WHERE f.user_id = v_uid
      AND c.verified_at IS NOT NULL
      AND c.verified_at > now() - p_window
  )
);
```

**Side benefit**: this also closes a smaller edge case where the user verifies MFA on a different session than the one initiating the impersonation request (multi-tab usage). The verified_at fallback catches the verification regardless of which session it occurred on.

### 26.9 log_super_admin_action lifecycle event mode column

**Problem surfaced mid-Session 53**: Audit log queries paired `impersonation_started` and `impersonation_ended` rows by `session_id`, but the `mode` column on lifecycle rows showed `'impersonation:observe:observe'` instead of just `'observe'`. The double-prefix came from the `log_super_admin_action` helper applying its category prefix logic uniformly without distinguishing lifecycle events from action events.

**Fix**: `log_super_admin_action` now skips the category prefix when `p_action_type` is one of:
- `impersonation_started`
- `impersonation_ended`
- `impersonation_denied_action`

```sql
IF p_action_type IN ('impersonation_started', 'impersonation_ended', 'impersonation_denied_action') THEN
  v_mode_to_log := p_mode;
ELSE
  v_mode_to_log := COALESCE(p_category || ':' || p_mode || ':' || p_mode, p_mode);
END IF;
```

Lifecycle rows now write clean `mode` values ('observe', 'act') matching the `started_at` row, enabling proper grouping in audit reporting.

**Backfill of one historical row blocked by SOC 2**: The audit log table is append-only by design (no UPDATE policy at the user-facing layer; modification at the DB level requires direct admin access which is itself a documented privileged operation). One historical row from Session 52 testing has the old double-prefix value (`impersonation:observe:observe`). Documented as cosmetic build queue item BUG-S53-3, acceptable historical artifact.

### 26.10 search_impersonation_targets paginated multi-field search

**Final form locked Session 53**:

- Default-loads all users when query is empty or < 2 characters
- Multi-field search across email, full_name, organization_name (LEFT JOIN to organizations)
- Three-tier ordering: prefix matches first, then substring matches, then alphabetical email
- COALESCE account_type to 'unknown' (handles 2 production users with NULL account_type)
- Window-function `total_count` for pagination
- p_limit clamped to LEAST(GREATEST(p_limit, 1), 100), default 25
- p_offset clamped to GREATEST(p_offset, 0)
- INCLUDES self — no `u.id <> v_caller` filter; UX layer prevents self-impersonation via disabled menu item with "(cannot impersonate yourself)" hint

The decision to include self at the data layer (rather than filter it out) was made Session 53: future per-row actions on the User Management page (Reset MFA, Trigger password reset, View access history) may need to operate on the caller's own row. Backend filtering is the wrong layer for a UX rule. Frontend's per-action gates decide whether each action is permitted on self.

### 26.11 my_access_history defaults action_category for company_admin source rows

**Problem surfaced mid-Session 53**: `AccessHistory.tsx` called `formatActionType(row.action_category)` which invokes `.replace(/_/g, ' ')` on the value. For rows sourced from `company_admin_audit_log`, the RPC's UNION ALL branch returned `NULL::text AS action_category` (since `company_admin_audit_log` has no category column). The frontend crashed with TypeError on `null.replace`.

**Fix**: RPC now returns `'organization_admin_action'::text` instead of NULL for company_admin source rows. The string is descriptive enough as a fallback for users viewing their access history; matches the existing `super_admin_action_types.category` taxonomy convention.

```sql
SELECT
  'company_admin'::text                     AS audit_source,
  cal.id                                    AS event_id,
  cal.action_type,
  'organization_admin_action'::text         AS action_category,  -- was NULL
  ...
FROM public.company_admin_audit_log cal
WHERE cal.target_user_id = v_uid
```

Backend defense; frontend null-guard logged as build queue item BUG-S53-1 for defense-in-depth.

### 26.12 identityMutation.ts helper for friendly Edge Function error toasts

**Problem surfaced during T-B testing**: `supabase.functions.invoke('identity-mutation', ...)` returns null `data` and a `FunctionsHttpError` on non-2xx responses. The error's `.message` is the generic "Edge Function returned a non-2xx status code" — the actual structured payload (`{ error, code: 'IMPERSONATION_DENIED', imp_session_id }`) is in `error.context` and must be retrieved via `await error.context.json()`. Frontend wasn't doing that, so users saw an opaque error toast that looked like a real Edge Function bug instead of the intended IMPERSONATION_DENIED protection.

**Fix**: New `src/lib/identityMutation.ts` helper centralizes the parse-then-error pattern.

```typescript
export async function callIdentityMutation<T = any>(
  body: IdentityMutationAction,
): Promise<IdentityMutationResult<T>> {
  const { data, error } = await supabase.functions.invoke("identity-mutation", { body });
  if (!error && data && !data.error) return { ok: true, data: data as T };
  if (error) {
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        const code = body?.code as string | undefined;
        const friendly = code === "IMPERSONATION_DENIED"
          ? "This action is blocked while impersonating. Identity changes (email, password, MFA) are not permitted during impersonation, even in act mode."
          : (body?.error as string) || error.message;
        return { ok: false, error: friendly, code };
      }
    } catch { /* fall through */ }
    return { ok: false, error: error.message };
  }
  if (data?.error) {
    const code = data.code as string | undefined;
    const friendly = code === "IMPERSONATION_DENIED" ? IMPERSONATION_DENIED_MESSAGE : data.error;
    return { ok: false, error: friendly, code };
  }
  return { ok: false, error: "Unknown error" };
}
```

Five callsites refactored to use the helper:
- Settings.tsx: saveEmail (line 371), startEnroll (line 65), cancelEnroll (line 79), unenroll (line 128)
- ResetPassword.tsx: password update call
- MfaEnrollment.tsx: handleEnroll call

**Pattern note**: any future Edge Function that returns structured error codes should adopt the same helper-with-error-body-parse pattern. The Supabase SDK's behavior of hiding non-2xx body content behind `error.context.json()` is non-obvious and the helper hides that ergonomically.

## 27. Group C — Coach Certification + Resources / Learning Paths backend (Session 54)

Three phases of backend work shipped in Session 54. Backend is complete for Phase 4 frontend to begin. Two standing rules locked at session open, retroactive + forward.

### 27.1 Standing rules locked

**Rule 1 — SOC 2 from inception.** Every new table, RPC, and Edge Function satisfies:
- CC6.1: RLS enabled + caller validation inside RPC body
- CC6.3: SECURITY DEFINER with explicit `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`; `SET search_path = public, pg_temp`
- CC7.2: sanitized errors (stable error codes, no PII echo); audit columns (`created_by`, `updated_by`) on all authoring tables

**Rule 2 — Impersonation gate from inception.** Every new mutation RPC or Edge Function is categorized against the §21.3 9-category denylist at design time. Every RLS WITH CHECK on user-self-write OR super-admin-write includes `NOT public.is_impersonating()` from day one. No retrofits.

### 27.2 Schema additions (Phase 1)

**17 new tables** in dependency order:

- `certification_paths` — top-level cert program (e.g. PTP Coach, AI Transformation Coach)
- `curricula` — slug-named learning units; published flag; archived_at
- `certification_path_curricula` — many-to-many with display_order
- `modules` — slug-named module units inside curricula
- `curriculum_modules` — many-to-many with display_order, prerequisite_module_id (single-prereq v1; multi-prereq DAG deferred to v2)
- `content_items` — polymorphic by `item_type`. 29 columns, 8 CHECK constraints enforcing per-type field requirements. 7 v1 item_types: `video`, `quiz`, `written_summary`, `skills_practice`, `file_upload`, `external_link`, `live_event`
- `quiz_questions` — 5 question_types: `multiple_choice`, `true_false`, `select_all`, `match_definition`, `match_picture`
- `quiz_answer_options` — `is_correct` direct trainee SELECT blocked (Migration 10.5); access routes through SECURITY DEFINER RPC only
- `user_curriculum_assignments` — 3-source assignment model: `direct_assignment`, `certification_path`, `audience_tag`. EXCLUDE constraint on (user_id, curriculum_id, source) WHERE status='active' (permits re-assignment after unassignment)
- `content_item_completions` — UNIQUE (user_id, content_item_id); status enum, type-specific columns (video_watch_pct, quiz_best_score_pct, quiz_passed, written_review_status, skills_trainee_signed_off, skills_mentor_signed_off, reviewer_comments)
- `quiz_attempts` — append-only (no UPDATE policy); attempt_number monotonic per (user, content_item)
- `written_submissions` — append-only iterations; review_decision, reviewer_comments, reviewed_at
- `coach_mentor_assignments` — EXCLUDE constraint on (trainee_user_id, mentor_user_id, certification_id) WHERE ended_at IS NULL; CHECK `(ended_at IS NULL) XOR (end_reason IS NOT NULL)`
- `cohorts`, `cohort_members` — Q11 seam, no UI v1
- `user_notification_preferences` — per-user channel pref per notification_type
- `user_notifications` — in-app inbox; dedup_key column added in Phase 3 with partial unique index

**2 EXTENDS:**

- `coach_certifications`: status enum changed `in_progress/certified/suspended` → `in_progress/certified/revoked` (suspended had 0 production rows, conflicted with Q9 revoke semantics); added `post_certification_benefit_applied_at` for Q13 hook idempotency
- `resources`: added `category` text NOT NULL with CHECK on 5 v1 categories: `my_learning`, `reference_library`, `articles_guides`, `videos`, `tools_templates`

**1 supporting catalog:** `notification_types_catalog` seeded with 14 v1 types (3 critical non-configurable, 8 important configurable, 3 informational configurable). `cert_path_deadline_approaching` is marked `is_v1_active=false` (v2 scope).

**8 new `super_admin_action_types` seeded:** `certification_granted`, `certification_revoked`, `mentor_assigned`, `mentor_unassigned`, `curriculum_directly_assigned`, `curriculum_unassigned`, `written_submission_reviewed`, `skills_practice_signoff`.

**Two retroactive Phase 1 fixes:** Migration 08.5 retrofitted `NOT public.is_impersonating()` onto 6 catalog table super admin policies. Migration 10.5 locked down `quiz_answer_options.is_correct` from trainee direct SELECT.

### 27.3 Phase 2 RPC catalog

All RPCs `SECURITY DEFINER` with `SET search_path = public, pg_temp`, `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`. Gate ordering: `auth.uid()` check → `assert_super_admin()` (where applicable) → `assert_impersonation_allows(<category>)` → input validation → mutation → `log_super_admin_action` (where applicable) → `notify_user` (Phase 3) → return jsonb.

| RPC | Caller | Impersonation category | Tier 2 reason ≥10 chars |
|---|---|---|---|
| `get_user_learning_state(uuid)` | self / mentor / super admin | none (read; observation permitted) | n/a |
| `submit_quiz_attempt(uuid, jsonb)` | trainee | `assessment_submission` | n/a |
| `submit_written_summary(uuid, text)` | trainee | `assessment_submission` | n/a |
| `mentor_review_submission(uuid, text, text)` | mentor or super admin | `coach_action` | n/a |
| `mark_skills_practice_signoff(uuid, text, uuid?)` | trainee or mentor/admin | `assessment_submission` (trainee) / `coach_action` (mentor) | n/a |
| `grant_certification(uuid, text)` | super admin | `permission_change` | ✓ |
| `revoke_certification(uuid, text)` | super admin | `permission_change` | ✓ |
| `assign_mentor(uuid, uuid, uuid, text)` | super admin | `permission_change` | ✓ |
| `assign_curriculum_directly(uuid, uuid, text, …)` | super admin | `permission_change` | ✓ |

Plus the Q13 no-op hook `apply_post_certification_benefits(uuid)`: stamps `post_certification_benefit_applied_at` for idempotency. Full benefit logic (12-month premium tier coupon, Stripe subscription provisioning, 13th-month auto-revert) deferred until subscription tiers + pricing are decided.

**Verified end-to-end:**
- `get_user_learning_state` viewer_role projection across 4 scenarios (super admin observation, unauthenticated→42501, non-admin cross-user→42501, self-query success)
- `submit_quiz_attempt` impersonation gate fires with `imp_session_id=<uuid>` in DETAIL when called inside active act-mode impersonation session
- All Tier 2 RPCs raise `22023 reason_required_min_chars: 10` on short justification
- All super admin RPCs raise `42501 caller is not a BrainWise super admin` on non-admin caller

### 27.4 Phase 3 notifications subsystem

**`notify_user(p_user_id, p_notification_type, p_payload, p_dedup_key)` contract:**

- Validates target user exists and notification_type is in catalog
- `is_v1_active=false` types return `{dispatched: false, reason: 'type_not_v1_active'}` — no-op
- Hybrid channel resolution: if `user_configurable=true`, consults `user_notification_preferences` (defaults to catalog `default_channel` if no preference row); if `user_configurable=false` (critical types), ignores preference and uses catalog default
- `channel='none'` returns `{dispatched: false, reason: 'user_opted_out'}` — no-op
- **In-app dispatch:** direct INSERT into `user_notifications` with `ON CONFLICT DO NOTHING` via partial unique index on `(user_id, notification_type, dedup_key) WHERE dedup_key IS NOT NULL`. Duplicate `dedup_key` returns existing `notification_id` and `{dispatched: false, reason: 'duplicate_dedup_key'}` — idempotency seam.
- **Email dispatch:** `pg_net.http_post` fire-and-forget to `send-email` Edge Function with `x-internal-secret` header read from `vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET'` (uppercase — vault row name matches the Edge Function Secret env var name; both have existed since Session 48 when the Class B pattern shipped). Composes subject + html_body via `compose_notification_email` helper (inline branded templates: navy header #021F36, orange CTA #F5741A, sand background #F9F7F1).
- **Fail-loud on missing vault secret:** raises `42501 internal_function_secret_not_in_vault` with HINT pointing at the vault row name; entire transaction rolls back. Intentional. No half-completed dispatches. End-to-end verified Session 54: `certification_granted` dispatched live, `email_logs.send_status='sent'`, Resend message ID populated.
- **No impersonation gate inside `notify_user` itself.** Caller is responsible for its own gating. notify_user dispatches notifications TO users; impersonation context is orthogonal.

**Extensibility decisions:**

- Shipped `p_dedup_key` — real value, prevents double-fire on retries
- Explicitly NOT shipped `p_channels` override — catalog `user_configurable=false` already handles critical-types-bypass-pref; speculative seam without a call site

**Credential routing decision (Option A locked).** `INTERNAL_FUNCTION_SECRET` lives in Edge Function Secrets (env) for the `send-email` function's own env reads, and is also stored in `vault.secrets` so Postgres RPCs can read it. Same value, two storage locations, kept in sync manually on the rare rotation. The vault row was added Session 48 alongside the Edge Function Secrets sync; `notify_user` reads it via `vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET'`. Rejected Option B (dedicated dispatch-notification Edge Function — overengineering for one call site) and Option C (`email_outbox` + cron — adds 1-min latency on critical notifications, new table, new cron cadence pattern that diverges from existing 4-cron stagger).

**Vault version mismatch caught Session 54.** `notify_user` was originally deployed with a lowercase `'internal_function_secret'` lookup. Production vault row is uppercase `INTERNAL_FUNCTION_SECRET`. Migration `groupc_phase3_10` corrected the RPC; no vault change needed. Postgres `LIKE` is case-sensitive — diagnostic queries that case-mangle the pattern can falsely return "secret missing" against a vault that has it under a different case.

**Phase 2 RPC notification wiring map:**

| RPC | Notification | Recipient | Dedup key |
|---|---|---|---|
| `submit_written_summary` (when submitted_for_review) | `mentor_review_required` | each active mentor | `review_required:<submission_id>:<mentor_id>` |
| `mentor_review_submission` (approved) | `mentor_review_completed` | trainee | `review_decision:<submission_id>` |
| `mentor_review_submission` (revision_requested) | `mentor_review_revision_requested` | trainee | `review_decision:<submission_id>` |
| `grant_certification` | `certification_granted` (critical) | newly certified user | `grant_cert:<cert_id>` |
| `revoke_certification` | `certification_revoked` (critical) | revoked user | `revoke_cert:<cert_id>:<minute-trunc>` |
| `assign_mentor` | `mentor_assigned` ×2 | mentor + trainee | `mentor_assignment_{mentor,trainee}:<assignment_id>` |
| `assign_curriculum_directly` | `module_assigned` | assigned user | `curriculum_assigned:<assignment_id>` |
| `enroll_user_in_certification_path` (Phase 3.5) | `certification_enrolled` | enrolled user | `enroll_path:<cert_id>` |

**Not wired intentionally:** `submit_quiz_attempt`, `mark_skills_practice_signoff`. No v1 catalog type for item-level pass. If Phase 5 trainee learning UI surfaces a need for module-level `module_completed` dispatch, wire there.

### 27.5 Phase 3.5 — Authoring-adjacent RPCs

Three RPCs added because Phase 4 management UIs need them. All Tier 2 super admin actions (reason ≥10 chars) with `permission_change` impersonation gate.

- `enroll_user_in_certification_path(p_user_id, p_cert_path_id, p_reason, p_due_at?)` — atomic fanout: INSERT `coach_certifications` (status=in_progress) + INSERT N `user_curriculum_assignments` with source='certification_path'. Idempotency: rejects duplicate active enrollment of same `certification_type`. Notifies via `certification_enrolled`.
- `unassign_mentor(p_assignment_id, p_end_reason, p_reason)` — stamps `coach_mentor_assignments.ended_at + end_reason`. Two reason params: `p_reason` is SOC 2 audit justification (≥10 chars), `p_end_reason` is operational label stored on row (e.g. `mentor_unavailable`, `trainee_completed`). No notification in v1 (catalog doesn't include mentor_unassigned).
- `unassign_curriculum(p_assignment_id, p_reason)` — stamps `user_curriculum_assignments.status='unassigned' + unassigned_at + unassigned_by + unassigned_reason`. Historical `content_item_completions`, `quiz_attempts`, `written_submissions` preserved (CC7.2 audit retention). No notification in v1.

### 27.6 Pre-existing tables discovered during Phase 3.5 recon

Both tables existed before Group C work began and do not need to be created:

- `coach_certification_actors` — Q5 actor flow target. Existing columns: `coach_user_id`, `certification_id`, `actor_type`, `actor_email`, `actor_first_name`, `instrument_id`, `access_code`, `status`, `created_at`, `completed_at`. Phase 7 will likely add `skills_practice_content_item_id` to link actor invitations to specific skills_practice items.
- `coach_invitations` — Q4A invitation lifecycle target. Existing columns: `email`, `first_name`, `last_name`, `invited_by`, `token`, `certification_type`, `status`, `created_at`, `accepted_at`, `expires_at`. No current function creates a `coach_certifications` row on acceptance — `accept_coach_invitation` RPC remains a deferred gap.

### 27.7 Group C deferred backend gaps

These are real gaps but do not block Phase 4. Tracked so they're not lost:

1. **`accept_coach_invitation` RPC** — Q4A. Coach invitation accept does not currently create `coach_certifications` row. Build when coach-onboarding UX is in scope (likely between Phase 4 and Phase 5).
2. **Phase 7 actor flow RPCs** — Per scope, build at Phase 7.
3. **Audience tag runtime computation** — `curricula.audience_tags` text[] exists but no function resolves user-qualifying tags. Phase 5 trainee learning UI consumes; defer until Phase 5 design.
4. **content_items.config JSONB validation** — permissive v1; tighten per-item-type at Phase 4 design.
5. **Authoring CRUD pattern decision** — RPC-wrapped vs direct table writes from frontend. Phase 4 prompt-time decision.
6. **Q13 post-certification benefit hook full implementation** — currently no-op stamp.
7. **Phase 3 14-type acceptance test pass** — systematic walkthrough under impersonation deferred to a dedicated test session.

### 27.8 Locked architectural constraints carried forward

These all surfaced or were reconfirmed during Session 54:

- `apply_migration` reports success without confirming DB state — always follow with `execute_sql` verification
- Multi-statement `execute_sql` returns only the last result — split intermediate checks
- `information_schema.columns` is insufficient for CHECK constraints — always query `pg_constraint` (`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'table'::regclass`)
- PL/pgSQL `RETURNS TABLE` columns become OUT parameters shadowing same-named table columns — prefix with `out_`
- Edge Function Secrets not readable from Postgres; vault is. When credential routing matters, prefer vault.
- `pg_net` schema is `extensions`, not `public`; call `extensions.net.http_post(...)` or rely on `search_path` including extensions (default Supabase posture does)
- `auth.getClaims` is the canonical JWT verification method
- `deploy_edge_function` requires `verify_jwt: false` passed explicitly every time
- Two sequential Anthropic Opus calls cannot be bundled in one Edge Function — Supabase's ~150s timeout ceiling forces split

## 28. Group C Phase 4 prep — backend deltas (Session 55)

### 28.1 Notification catalog additions for unassign flows

Three new notification types added to `notification_types_catalog` and wired into `compose_notification_email` + their source RPCs:

- `curriculum_unassigned` (category `learning`, important, both channels, user_configurable=true) — fired by `unassign_curriculum` to the trainee.
- `mentor_unassigned_trainee` (category `mentor_review`, important, both channels, user_configurable=true) — fired by `unassign_mentor` to the trainee.
- `mentor_unassigned_mentor` (category `mentor_review`, important, both channels, user_configurable=true) — fired by `unassign_mentor` to the mentor.

`unassign_mentor` therefore now writes **two** `notify_user` calls per invocation (one per role), distinct dedup_keys, distinct templates. This was a deliberate split (Option Y from Session 55 design) so trainees and mentors can independently configure their unassign notification preferences.

Dedup_key shape: `<notification_type>:<assignment_id>`.

### 28.2 Pattern: separate catalog types for separate audiences on the same event

When a single DB event fires notifications to multiple audiences with different framings (trainee being informed vs mentor being informed), create one catalog type per audience rather than one type with a `recipient_role` payload field. Reasons:

- Users can independently configure preferences per role
- `compose_notification_email` stays a clean `CASE notification_type` dispatch with no payload-branching inside a single WHEN clause
- Auditability: `user_notifications` rows carry distinct notification_type values that match the recipient's role at a glance

Cost: one extra catalog row per audience. Negligible.

### 28.3 Verification pattern for new compose_notification_email branches

After adding a WHEN clause to `compose_notification_email`, smoke-test by direct invocation:

```sql
SELECT subject FROM compose_notification_email(
  '<any-uuid>'::uuid,
  '<new_notification_type>',
  '<minimum-payload-shape>'::jsonb,
  '<test-full-name>'
);
```

This catches typos in subject lines and payload key references without firing a real notification. Session 55 ran this for all 3 new types pre-Phase-4-build.

### 28.4 content_items per-type CHECK constraints

Phase 1 (Session 54) shipped `content_items` with value-validity CHECKs only (enum membership, range bounds). Per-type required-field enforcement (e.g., "if item_type='video' then video_source_type IS NOT NULL") was NOT shipped. Migration 02 retrofitted both presence and cleanup CHECKs:

**Presence CHECKs (7)** — one per pre-lesson_blocks item_type. Pattern: `CHECK (item_type <> 'X' OR (<required fields IS NOT NULL>))`.

**Cleanup CHECKs (7)** — one per item_type. Pattern: `CHECK (item_type = 'X' OR (<other-type fields IS NULL>))`. Prevents stale per-type data on type-changed rows.

**Combined effect**: a `content_items` row of `item_type='video'` must have non-null video fields AND null everything-else. A `quiz` row must have non-null quiz fields AND null everything-else. And so on.

**Cleanup CHECKs apply across all 8 item_types** including `lesson_blocks` (Migration 03 added `lesson_blocks` to the item_type enum, so the cleanup CHECKs now require lesson_blocks rows to have all other item-type fields null — they do by default since nothing per-type is needed for lesson_blocks at the content_items layer; per-lesson content lives in the `lesson_blocks` table).

**Architectural decision: dual-layer enforcement.** Presence is enforced by both the RPC wrapper (friendly errors) and the DB (defense in depth). Direct-SQL ops by super admins bypassing the RPC still cannot create malformed rows. This matches the SOC 2 standing rule from Session 54.

### 28.5 lesson_blocks infrastructure (Phase 4 Rise-like authoring foundation)

Decision: build Rise-style lesson authoring as an 8th `content_items.item_type` value (`lesson_blocks`) plus a child `lesson_blocks` table holding ordered, typed blocks for one lesson.

**`lesson_block_types` lookup table** (Option C pattern, matches `super_admin_action_types`):
- PRIMARY KEY block_type text
- category text CHECK in ('content', 'display_interactive', 'interactive', 'scored')
- is_interactive, is_scored, description, is_v1_active

**17 v1 block types seeded** (4 categories):

- **content (7)**: text, heading, image, video_embed, divider, quote, list
- **display_interactive (4)**: callout, stat_callout, statement_a_b, embed_audio
- **interactive (5)**: tabs, flashcards, accordion, button_stack, scenario
- **scored (1)**: knowledge_check

Adding an 18th block type is a single `INSERT INTO lesson_block_types` row + frontend renderer + (optional) editor form. No DDL.

**`lesson_blocks` table**:
- id uuid PK
- content_item_id uuid FK → content_items.id ON DELETE CASCADE
- block_type text FK → lesson_block_types.block_type ON UPDATE CASCADE ON DELETE RESTRICT
- display_order integer (>= 0)
- config jsonb DEFAULT '{}' — per-block-type data (e.g., for tabs: `{tabs: [{label, body_markdown}]}`)
- created_at, created_by, updated_at, updated_by, archived_at

**Indexes**:
- UNIQUE (content_item_id, display_order) WHERE archived_at IS NULL — enforces dense ordering on active blocks
- (content_item_id, display_order) WHERE archived_at IS NULL — trainee renderer hot path

**RLS (two policies)**:
- `lesson_blocks_super_admin_write`: FOR ALL TO authenticated, USING(super_admin), WITH CHECK(super_admin AND NOT public.is_impersonating()) — Standing Rule 2 (Session 54)
- `lesson_blocks_trainee_read`: FOR SELECT TO authenticated, USING(archived_at IS NULL AND EXISTS active curriculum assignment chain)

**`content_items.lesson_completion_mode` column**:
- text, nullable for non-lesson_blocks rows
- CHECK: when item_type='lesson_blocks' must be NOT NULL and IN ('scroll_and_checks', 'explicit_continue'); when item_type<>'lesson_blocks' must be NULL
- Both modes selectable per-content-item by the author. Default in UX layer: `explicit_continue`.

### 28.6 Phase 4 authoring CRUD RPC catalog (10 RPCs)

All SECURITY DEFINER, all gated by `assert_super_admin()` + `assert_impersonation_allows('permission_change')`. All require `p_reason` with min 10 chars (SOC 2 CC7.2 audit justification). All write to `super_admin_audit_log` via `log_super_admin_action()` using the 14 new content_authoring action_types seeded in Migration 04a.

**Pattern locked**: every authoring RPC follows the same template — auth → super_admin → impersonation gate → input validation → write + audit (+ notify if applicable) → return as jsonb.

**RPC catalog**:

| RPC | Action types | Notes |
|---|---|---|
| `upsert_certification_path` | certification_path_created/updated | Unified create+update; create when p_id IS NULL |
| `archive_certification_path` | certification_path_archived | Soft-delete via archived_at, also sets is_published=false |
| `upsert_curriculum` | curriculum_created/updated | Handles curriculum row AND optional certification_path_curricula attachment (single transaction) |
| `archive_curriculum` | curriculum_archived | Soft-delete |
| `upsert_module` | module_created/updated | Handles module row AND optional curriculum_modules attachment |
| `archive_module` | module_archived | Soft-delete |
| `upsert_content_item` | content_item_created/updated | Polymorphic; takes `p_type_config jsonb` envelope + extracts per-type fields. **Forbids item_type changes on existing rows** — delete + recreate instead |
| `archive_content_item` | content_item_archived | Soft-delete via archived_at |
| `reorder_content_items` | content_items_reordered | Bulk-update display_order; validates array covers ALL active items in module |
| `replace_lesson_blocks` | lesson_blocks_replaced | Atomic-replace pattern: archives all current active blocks, inserts new array in order |

### 28.7 replace_lesson_blocks atomic-replace pattern

The lesson_blocks editor sends the entire block array on Save, not per-block CRUD. The RPC:

1. Validates every block's block_type up front (before any writes) against `lesson_block_types`
2. Archives all currently-active lesson_blocks rows for the content_item (UPDATE … SET archived_at = now())
3. Inserts new rows with display_order = array index

Trade-off: no per-block audit history (only "blocks replaced at T"). Acceptable for authoring (versus a regulated content-versioning workflow). If per-block diff history becomes needed, can be added internally to this RPC without changing API contract.

### 28.8 Polymorphic content_item upsert: server-side validation

`upsert_content_item` extracts per-type fields from `p_type_config` JSONB via per-type CASE branches and validates required-by-type presence BEFORE inserting. Friendly error messages like `video_required_fields_missing: video_source_type and video_source_id` instead of raw `23514` CHECK violation messages.

Defense-in-depth: even if the RPC's per-type validation is bypassed (impossible from the application layer, but for direct-SQL super admins), the DB-level CHECKs from Migration 02 still fire.

`p_type_config` envelope structure varies by item_type:

```jsonc
// video
{"video_source_type": "mux", "video_source_id": "abc123", "video_completion_threshold_pct": 95}

// quiz
{"quiz_pass_threshold_pct": 80, "quiz_show_correct_mode": "after_pass"}

// written_summary
{"written_completion_mode": "auto", "written_min_chars": 500, "written_max_chars": 2000}

// skills_practice
{"skills_signoff_required": "both_required", "skills_actor_invitation_required": false, "skills_optional_attachment": true}

// file_upload
{"file_upload_max_bytes": 10485760, "file_upload_allowed_extensions": ["pdf","docx"]}

// external_link
{"external_url": "https://..."}

// live_event
{"event_scheduled_at": "2026-06-01T15:00:00Z", "event_external_id": "zoom-12345"}

// lesson_blocks (no type_config needed; lesson_completion_mode goes in separate p_lesson_completion_mode param)
{}
```

### 28.9 Impersonation gate coverage on all Phase 4 backend

Every Phase 4 prep RPC calls `assert_impersonation_allows('permission_change')`. This means even a super admin in act-mode impersonation cannot create, edit, archive, reorder, or replace authoring content. The category `permission_change` is denylisted unconditionally in `assert_impersonation_allows` (Session 49 lockdown). This is Standing Rule 2 from inception.


## 29. AI authoring infrastructure (Session 55)

### 29.1 Tables added

**`ai_authoring_context`** — versioned context blocks injected into AI authoring Edge Function system prompts.
- `id`, `context_name`, `version`, `body_markdown`, `is_active`, `notes`, audit fields
- UNIQUE constraint: only one active version per `context_name` at a time (partial index)
- 5 v1 context blocks seeded: `platform_overview`, `framework_terminology`, `scientific_foundations`, `output_format_rules`, `guardrails`
- RLS: super admin read/write only, impersonation gate from inception (Standing Rule 2)
- Service-role read used by Edge Functions to fetch active context for injection

**`ai_authoring_voice_presets`** — voice/tone presets for AI authoring drafts.
- `id`, `preset_key`, `display_name`, `short_description`, `example_paragraph`, `voice_guidance_markdown`, `display_order`, `is_active`, `is_system`, audit fields
- 5 system presets seeded:
  1. `conversational_coach` — warm, second-person, shared experience
  2. `tactical_direct` — short sentences, numbered steps, action-oriented
  3. `reflective_inquiry` — questions over assertions, encourages introspection
  4. `academic_grounded` — formal, citation-aware, precise terminology
  5. `scenario_storyteller` — paints scenes, concrete client encounters
- `is_system=true` marks seed presets (immutable in v1 UX); `is_system=false` reserved for future user-added presets
- "Custom" voice handled at request layer via `voice_preset_key='custom'` + free-text body fields; no row needed
- RLS: super admin read/write only, impersonation gate from inception

### 29.2 Action type added

`ai_authoring_draft_generated` — category `content_authoring`, NOT `requires_justification` (low friction during drafting), NOT `is_mutation` (no DB write of authored content; the downstream `content_item_created/updated` covers that), `denylist_during_impersonation=true`.

Logged by AI authoring Edge Functions each time a draft is generated, regardless of whether the author accepts it. Provides usage audit without polluting `content_authoring` action stream with abandoned drafts.

### 29.3 Voice handling pattern (sticky default within a lesson)

UX rule locked Session 55: voice is selected per-draft, but each lesson_blocks content_item remembers the last voice used; subsequent draft requests within the same lesson pre-fill that voice. Author can override at any draft. Voice does NOT persist as a column on `content_items` — it's a frontend-only sticky default in the lesson editor's local state.

Reason for not persisting: a "lesson voice" attribute would imply all blocks in the lesson MUST share a voice, which is too rigid. Sticky default gets the cohesion benefit without the rigidity.

### 29.4 Context-injection strategy (Option I, deferred Option II to Phase 4.5)

Option I shipped: `ai_authoring_context` table holds versioned ~500-word blocks injected verbatim into Edge Function system prompts. Refining the AI voice/framing requires editing rows, not redeploying code.

Option II (RAG against books, podcast transcripts, papers, shipped content) deferred to Phase 4.5 as a separate workstream. Both options use the same injection point in the Edge Function code — switching is additive, not breaking.

### 29.5 AI Edge Functions — SHIPPED Session 56

Three Edge Functions deployed v1 ACTIVE Session 56 against the source bodies preserved in the Session 55 → 56 handoff artifact `ai-edge-functions-session-55-drafts.md`:

- `draft-lesson-block` v1 — generates a single block matching the requested `block_type`'s config schema; supports 17 v1 block types via internal `BLOCK_SCHEMAS` dispatch; calls `claude-opus-4-7`; `MAX_OUTPUT_TOKENS = 3000`
- `scaffold-lesson` v1 — generates a full ordered lesson_blocks array (mixed block types); calls `claude-opus-4-7`; `MAX_OUTPUT_TOKENS = 8000`; validates every returned block has `{block_type, config}` shape and `block_type` is in the allowed set
- `draft-text` v1 — generic short-prose drafts for description / title / overview fields; supports refinement mode (passes `current_value`); 7 supported `target_field` keys via `FIELD_SPECS` dispatch; calls `claude-opus-4-7`; `MAX_OUTPUT_TOKENS = 1500`

All three share identical auth/gate/context-fetch/voice-resolution/Anthropic-call/audit-log scaffolding:

- `verify_jwt: false` at the deploy layer; JWT verified manually inside the function via `callerClient.auth.getClaims()` (canonical Class A pattern per arch-ref §10.7)
- Super admin gate: `account_type !== "brainwise_super_admin"` returns 403 `super_admin_required`
- Impersonation gate: `enforceImpersonationGate(callerClient, "permission_change")` from `_shared/impersonation_gate.ts`. Both observe and act mode blocked because `permission_change` is denylisted globally. Returns 403 `IMPERSONATION_DENIED`.
- Context: `ai_authoring_context` rows fetched via service-role client and concatenated in canonical order (`platform_overview` → `framework_terminology` → `scientific_foundations` → `output_format_rules` → `guardrails`) for system prompt injection
- Voice: `voice_preset_key` resolved from `ai_authoring_voice_presets` (`is_active = true`), or `'custom'` falls through to `custom_voice_guidance` + `custom_voice_example` in request body
- Anthropic call: `https://api.anthropic.com/v1/messages` with `anthropic-version: 2023-06-01`, system + single user message
- Output cleaning: code-fence stripping (` ```json ... ``` `) before `JSON.parse`; `draft-text` also strips wrapping quotes including curly quotes
- Audit log: every successful draft writes a `log_super_admin_action` row with `action_type = 'ai_authoring_draft_generated'`; `p_after` carries function name + block_type/target_field/scaffold metadata + voice_preset_key + prompt excerpt + model
- Sanitized error envelope: stable string codes (`missing_bearer_token`, `invalid_jwt`, `super_admin_required`, `IMPERSONATION_DENIED`, `invalid_json_body`, `author_prompt_required`, `author_prompt_too_long`, `unknown_block_type`, `unknown_target_field`, `unknown_voice_preset`, `context_fetch_failed`, `anthropic_api_key_missing`, `anthropic_api_failure`, `ai_output_unparseable`, `ai_output_not_array`, `ai_output_empty_array`, `ai_output_empty`, `internal_error`)

Differences across the three: output shape (single object vs array vs plain text), per-function schema validation depth, output token budget. No other behavioral divergence.

**Deploy parameters used** (canonical pattern for future shared-import functions, see §23.7):

- `entrypoint_path: "<function-name>/index.ts"` (NOT naked `"index.ts"`) — the subdirectory prefix is required so `../_shared/...` traversal resolves correctly under the bundle's `source/` root
- `files`: array containing the function source at `<function-name>/index.ts` AND `_shared/impersonation_gate.ts` (verbatim from production `set-account-type` v43)
- `verify_jwt: false`

**Verification performed Session 56**:

- Anonymous probe (no Authorization header): all three return HTTP 401 `missing_bearer_token` ✓
- Source diff against canonical drafts in `ai-edge-functions-session-55-drafts.md`: structural landmarks match (ANTHROPIC_MODEL, MAX_OUTPUT_TOKENS, BLOCK_SCHEMAS/ALLOWED_BLOCK_TYPES/FIELD_SPECS dispatch tables, super_admin gate string, impersonation gate category, missing_bearer_token error code) ✓
- Bundle integrity: `get_edge_function` confirms each function's deploy package includes `_shared/impersonation_gate.ts` alongside `<function-name>/index.ts` ✓
- Prerequisite data: 5 active `ai_authoring_context` rows, 5 active `ai_authoring_voice_presets` rows, `ai_authoring_draft_generated` action_type seeded, 2 brainwise_super_admin users available for live testing ✓

**Deferred verification** (requires live super-admin session token, lands when AI buttons land in Lovable Prompt 5):

- Super-admin authenticated, valid payload → 200 with parsed AI output and audit row written
- Super-admin authenticated during impersonation → 403 `IMPERSONATION_DENIED`
- Non-super-admin authenticated → 403 `super_admin_required`

## 30. Branding recon — standing protocol (Session 55)

### 30.1 The rule

Before any Lovable prompt is written, the recon checklist requires three passes:

1. **Backend recon** — schema, RLS, RPCs, Edge Functions verified end-to-end (existing protocol, no change)
2. **Frontend recon** — existing components, route patterns, hooks, shared utilities cached locally (existing protocol, no change)
3. **Branding recon (NEW)** — actual brand tokens, typography, and design patterns pulled from source rather than assumed (locked Session 55)

The branding recon is non-negotiable. userMemories contains brand color hex values but says nothing about how they're exposed in the codebase, which token system is canonical for which surface, or what conventions existing pages already follow.

### 30.2 What branding recon pulls

For internal-admin pages (super-admin/* and similar):

- `tailwind.config.ts` — fontFamily mapping, boxShadow tokens, Tailwind extensions
- `src/index.css` — shadcn HSL token values, `--bw-*` hex token mirror, dark-mode overrides
- `src/styles/marketing-tokens.css` — full brand palette (mustard, plum, forest, all shade variants), `--bw-marketing-root` scope rules, button system classes (`.bw-btn-*`)
- One or two cached super-admin or internal-admin pages to confirm:
  - h1/h2 style conventions (heading classes, font-display vs font-sans)
  - Badge variant patterns (status pills: which variants map to which states)
  - Button variant patterns (CTA vs secondary vs ghost)
  - Card and layout conventions

### 30.3 The two token systems

The codebase has two distinct token systems serving distinct surfaces:

**Shadcn HSL tokens** (`bg-primary`, `bg-accent`, `bg-muted`, `text-foreground`, `text-muted-foreground`, etc.):
- Used by app chrome including super-admin/*, /dashboard, /coach, /learning
- Defined in `src/index.css` `:root` block
- Mapped to brand colors via HSL conversions (`--primary: 211 94% 11%` = navy, `--accent: 25 92% 53%` = orange)
- Tailwind utilities resolve via `tailwind.config.ts` color block

**Marketing tokens** (`var(--bw-navy)`, `var(--bw-orange)`, `.bw-btn-primary`, etc.):
- Used by public marketing site under `.bw-marketing-root` scope
- Defined in `src/styles/marketing-tokens.css`
- Raw hex variables (not HSL), button system classes (`.bw-btn-*`), elevation/shadow/spacing tokens
- NOT exposed as Tailwind utility classes

**Rule: never mix the two systems in one component.** Internal admin tools use shadcn HSL tokens; public marketing pages use marketing tokens with `.bw-marketing-root` scope. If a brand color is needed in an admin tool that doesn't have a shadcn equivalent (e.g., mustard for NAI Saturation), use inline style with the `--bw-*` variable: `style={{ color: 'var(--bw-mustard)' }}`.

### 30.4 Brand system gap noted Session 55

`--bw-mustard #7a5800` (NAI Saturation color locked Session 38/39 per userMemories) does NOT exist as a variable in either `index.css` or `marketing-tokens.css`. NAI components must be referencing the hex inline. Build queue item added: "Add `--bw-mustard: #7a5800` to marketing-tokens.css + index.css mirror; audit NAI components for inline hex references and refactor to use the token."

### 30.5 Font convention for internal admin tools

Verified Session 55 against `super-admin/Users.tsx`, `super-admin/PlatformHealth.tsx`, `super-admin/CreateOrganization.tsx`: **no `font-display` reach-throughs in any super-admin page**. All h1/h2 elements use the default `font-sans` (Montserrat). Heading typography varies slightly across pages (`text-2xl font-semibold` vs `text-2xl font-bold` vs `text-2xl font-semibold tracking-tight`), but Montserrat is universal.

Convention: **for internal admin tools, do not specify `font-display` on headings — it deviates from existing pattern.** Reserve `font-display` (Poppins) for public marketing site only.

userMemories had this backwards ("Montserrat headings, Poppins body"). The actual `tailwind.config.ts` mapping is `sans: ['Montserrat']` (default body) + `display: ['Poppins']` (marketing site headings). userMemories will be updated in a future session via memory_user_edits.

### 30.6 Status badge pattern for internal admin tools

Verified Session 55 against `super-admin/Users.tsx` (accountTypeBadgeVariant helper):

Stock shadcn Badge variants only — no inline color styles for status pills. Pattern:
- Most-prominent / "active" state → `<Badge>` (default = navy primary)
- Muted / "in-progress" state → `<Badge variant="secondary">` (cream)
- Destructive / "blocked" state → `<Badge variant="destructive">` (red)
- Subtle / "neutral" state → `<Badge variant="outline">` (transparent + border)

Applied Session 55 in Lovable Prompt 1 for Published/Draft pills: Published → default (navy), Draft → secondary (cream).

## 31. invite-coach hardening (Session 55)

### 31.1 Diagnosis from Session 55

Cole reported a coach invitation sent to `cheryl@defineconsulting.com` on 2026-05-01 never arrived. Investigation found:

1. The `coach_invitations` row had been created successfully (super admin RLS-allowed direct INSERT via Edge Function)
2. No corresponding row in `email_logs` for that recipient
3. Of 5 coach invitations created since April 2026, ZERO had email_logs rows — but `email_logs` table only started logging on 2026-05-09, so April invitations were before the logging window
4. Empirical test mirroring invite-coach's exact fetch pattern to send-email succeeded (200 OK with Resend message ID). The Edge Function Secret was correctly configured.
5. Cole's later re-invite of Cheryl through the Coach Management UI worked end-to-end (email_logs row written, email delivered, accepted by Cheryl)

Conclusion: the May 1 failure was either a transient infrastructure issue or a pre-May-2-deploy bug that has since been resolved. Cannot fully diagnose without May 1 email_logs data.

### 31.2 Structural problems found in invite-coach v10 (still present at Session 55 start)

Independent of the May 1 failure, invite-coach v10 had three real structural problems that warranted hardening:

**(a) Swallowed email send failures.** The function called send-email via fetch and only logged a console warning on non-OK responses. The caller-facing response treated row-insert success as overall success regardless of email outcome. Failure modes (network blip, send-email returning 401, send-email returning 4xx-validation) were not surfaced to the frontend.

**(b) Resend button was broken.** `handleResend` in `src/pages/super-admin/CoachManagement.tsx` called invite-coach with the same email as the existing pending row. invite-coach's dedup guard returned `{success: false, error: "Pending invitation already exists for this email"}` for that recipient, and the top-level HTTP status was 207 (Multi-Status). `supabase.functions.invoke()` treats any 2xx as success (populates `data`, leaves `error` null). The frontend's `if (error) ... else success-toast` pattern silently swallowed the 207 failure. Toast said "Resent" but no email was actually re-sent.

**(c) email_logs rows from invite-coach were labeled `email_type='unknown'`, `source='unknown'`.** invite-coach didn't pass `email_type` or `source` to send-email's body, so send-email's `emailTypeForLog = email_type || "unknown"` fallback kicked in, making coach-invite emails impossible to filter from other email types in logs.

### 31.3 Schema migration applied Session 55

Added three columns to `coach_invitations` via migration `coach_invitations_email_tracking_columns`:

- `email_send_status text` — NULL / 'sent' / 'failed' (CHECK constraint enforces)
- `email_send_error text` — error message when failed
- `email_last_attempt_at timestamptz` — timestamp of last email send attempt

Plus a partial index `coach_invitations_email_send_status_idx` on (email_send_status) WHERE email_send_status = 'failed' for surfacing failed-email rows in the pending invitations list.

Backfill: accepted invitations marked `email_send_status='sent'` with `email_last_attempt_at = COALESCE(accepted_at, created_at)`. Pending and expired rows left NULL (true historical unknown).

### 31.4 invite-coach v11 changes

Five surgical changes from v10:

1. **Detects existing pending row and resends.** Instead of refusing, the function uses the existing row's token, first_name, last_name, certification_type and proceeds to send the email. Single function now handles both create-new and resend paths. Mode tag in result: `'created' | 'resent' | 'failed' | 'rejected'`.

2. **Passes `email_type: 'coach_invitation'` and `source: 'invite-coach'`** to send-email so email_logs rows are properly labeled.

3. **Parses send-email response body** and treats a non-2xx response OR a 2xx with explicit `success: false` as a hard per-recipient failure.

4. **Treats email send failure as hard per-recipient failure** — returns `{success: false, error: emailSendError}` instead of swallowing.

5. **Persists email_send_status, email_send_error, email_last_attempt_at** on the `coach_invitations` row after every email attempt (success or failure).

HTTP status semantics: 200 (all success), 207 (mixed), 400 (all failed), 500 (transport/auth error). Frontend MUST inspect `data.results[]` regardless of status.

Verification: a test invitation row was inserted, the Resend button was clicked from the UI, and all four hardening goals were verified — `email_send_status='sent'` written to row, email_logs entry created with `email_type='coach_invitation'`/`source='invite-coach'`, Resend message ID returned, no duplicate row created. Test row cleaned up after verification.

### 31.5 Frontend hardening (Lovable prompt at Session 55 close)

The Lovable prompt at session close updates four call sites in `src/pages/super-admin/CoachManagement.tsx` to use a new shared helper `inspectInviteCoachResponse` that inspects `data.results[].success` for per-recipient outcomes. Plus:

- Surfaces email send failures via destructive-variant toasts with the actual error message
- Adds an Email Status column to the pending invitations table (Sent/Failed/Pending badges)
- Failed badge has `title` attribute tooltip showing `email_send_error`
- Resend button becomes "Retry Email" with destructive styling when last send failed

Prompt drafted Session 55, ready to land in Session 56.

### 31.6 Build queue items surfaced by this work

1. **MEDIUM**: Audit ALL Edge Function callers in the frontend for the same `data.results[]` inspection bug. This pattern is likely repeated for departure emails, assessment invitations, bulk operations.
2. **MEDIUM**: Add `assert_impersonation_allows('outbound_user_communication')` to invite-coach. Currently has only manual super_admin check (Tier 2 rollout item per §21.10).
3. **LOW**: Delete the throwaway `diag-env-check` Edge Function (id `c57588a3-910f-4ee8-8102-4e33d8829229`) from Supabase Dashboard. MCP has no delete-function method.
4. **LOW**: invite-coach v11 retains the v10 manual super_admin check via service-role client + auth.getUser. Migrate to canonical `auth.getClaims` pattern + assert_super_admin RPC when the impersonation gate is added.


## 32. Soft-archive slug uniqueness (Session 56)

### Problem

The three authoring-content tables with slugs (`certification_paths`, `curricula`, `modules`) all use soft-archive (`archived_at` timestamp). They originally enforced slug uniqueness with global UNIQUE constraints (`*_slug_key`). Result: archiving a row left its slug occupying the constraint forever, blocking the author from recreating the same slug on a fresh row.

Discovered Session 56 when Cole archived the PTP-Coach cert path and tried to recreate it, hitting a 23505 toast that incorrectly suggested the slug was in use by an active row.

### Fix shipped Session 56

Migration `slug_unique_only_among_active_for_authoring_tables`:

```sql
ALTER TABLE public.certification_paths DROP CONSTRAINT certification_paths_slug_key;
CREATE UNIQUE INDEX certification_paths_slug_active_uniq
  ON public.certification_paths (slug) WHERE archived_at IS NULL;

ALTER TABLE public.curricula DROP CONSTRAINT curricula_slug_key;
CREATE UNIQUE INDEX curricula_slug_active_uniq
  ON public.curricula (slug) WHERE archived_at IS NULL;

ALTER TABLE public.modules DROP CONSTRAINT modules_slug_key;
CREATE UNIQUE INDEX modules_slug_active_uniq
  ON public.modules (slug) WHERE archived_at IS NULL;
```

Matches existing precedent in `lesson_blocks_active_order_uniq`. `content_items` doesn't have a slug column so no change there.

### Semantics after the fix

- Two ACTIVE rows with same slug → still rejected with 23505 (correct)
- Archived row + new active row with same slug → coexist (the desired behavior)
- 23505 error code unchanged — frontend `mapRpcError` still maps to "Slug already in use" for the active-active collision case which is the only case where 23505 now fires
- Archived rows retain their original slug verbatim, no rename/suffix needed — keeps audit log readable

### Standing pattern for future authoring tables

Any new authoring-content table with `slug` + `archived_at` should use the partial-index pattern, never a global UNIQUE constraint. Established as the convention Session 56.

## 33. PostgREST FK-disambiguation in embedded selects (Session 56)

### Problem

When a child table has two or more foreign keys pointing to the same parent table, PostgREST's implicit embed cannot disambiguate which FK to traverse. The result is silently null embeds and dropped rows downstream.

Discovered Session 56 in `AttachedCurriculaSection`. `certification_path_curricula` has two FKs to `curricula`:
- `curriculum_id` → `curricula(id)` (the actual attachment)
- `prerequisite_curriculum_id` → `curricula(id)` (the prerequisite chain)

The query `select("id, display_order, is_required, curriculum:curricula(...)")` returned rows where `curriculum` was null. The downstream `.filter(r => r.curriculum && !r.curriculum.archived_at)` dropped everything, producing a false "No curricula attached yet" empty state even though the join row existed in the database.

### Standing fix pattern

Any embedded select traversing a child→parent relationship where the child table has multiple FKs to that parent MUST use explicit FK-column-name disambiguation:

```ts
.select("id, ..., curriculum:curricula!curriculum_id(id, name, ...)")
```

The `!curriculum_id` shorthand tells PostgREST: use the FK whose source column is `curriculum_id`. More robust than the constraint-name form (`!certification_path_curricula_curriculum_id_fkey`) because it survives FK constraint renames.

### Standing recon protocol for Prompts 4+

When writing any new join-table embed, the recon checklist now includes:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.<join_table>'::regclass
  AND contype = 'f'
  AND confrelid = 'public.<parent_table>'::regclass;
```

If more than one row returns, the embed MUST use `!<column_name>` disambiguation. If exactly one row, the implicit embed is safe but the explicit form is still preferred for grep-ability and future-proofing.

Same applies to:
- `curriculum_modules` once added (likely will have a `curriculum_id` + `prerequisite_curriculum_id` mirror pattern)
- Any future join table linking content items, lesson blocks, etc., that supports prerequisite or sequence relationships

## 34. Content authoring tree: "All" sections include attached items (Session 56)

### Pattern locked

The left-tree navigator in `/super-admin/content-authoring` uses three sections: "Certification Paths" (hierarchical), "All Curricula" (flat list of every non-archived curriculum), "All Modules" (flat list of every non-archived module).

Previously named "Standalone Curricula" / "Standalone Modules" with `!linkedCurriculumIds.has(c.id)` / `!linkedModuleIds.has(m.id)` filters that excluded attached items. Renamed and unfiltered Session 56 via Prompt 3.4 — the same curriculum now appears both nested under its cert path AND in the flat "All Curricula" list. Selection state shares `nodeKey` (`cu:<id>`), so clicking either highlights both.

### Selection ancestor auto-expand

When `selectedKey` changes to a `cu:<uuid>` node, `selectNode` looks up the curriculum's parent cert paths via the `certPathsByCurriculum` Map (built from `cpcLinks`) and adds `cp:<parent-id>` to the `expanded` Set. Same for `mo:<uuid>` selections: looks up parent curricula via `curriculaByModule`, expands those, AND chains to expand each parent curriculum's parent cert paths.

This ensures clicking an item from anywhere in the tree (attached row's pencil button, "All Curricula" flat list, deep-link URL) surfaces its hierarchical context in the "Certification Paths" section.

Selection only ADDS to `expanded`; manual collapse via chevron remains a separate user concern. Auto-expand is harmless when ancestors are already expanded.

### Forward-compat for Prompts 4+

When Module editor lands (Prompt 4), the existing tree logic already shows all modules in "All Modules" regardless of attachment status. Module-curriculum attachment writes will need to invalidate analogous AttachedModulesSection caches (when that section is built), and `cm_links` reverse-lookup is already built into the parent component's `curriculaByModule` Map.

When Content Item editor lands (Prompt 5), content items don't appear in the tree top-level sections (they're always under their parent module). So no "All Content Items" section. Tree depth caps at 4 levels: cp → cu → mo → ci.
