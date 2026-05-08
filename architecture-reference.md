# BrainWise System Architecture Reference

*v40 - Session 46 closeout (Group C Phase 8 Order Assessment gating SHIPPED, Shared Results supervisor toggle SHIPPED)*

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

