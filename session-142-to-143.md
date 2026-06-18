# BrainWise Session 142 to 143 Handoff

*Closeout: Session 142. Open: Session 143.*

## Where Session 142 left off

INT-3, the `hotspot` interactive lesson-block type (Phase 3 of the Lesson Experience uplift), shipped end to end with full §61 5-surface parity. The block is STATELESS (no table, no block-specific RPC): a labeled image with 2-12 clickable Popover markers; completion rides the existing sticky `upsert_lesson_block_progress` path. Backend (three migrations) + a new Opus vision edge fn `lesson-hotspot-autoplace` v1 + two SHA-verified frontend commits + three versioned generators are all deployed and verified. Phase 3 continues with INT-4, INT-5, INT-8.

## Session 143 opening priorities, in order

### 1. Continue Phase 3 with the remaining new block types

Cole's directive: "we will pick the next session up with what is remaining in phase 3." Each is a NEW block type, so §61 5-surface parity is MANDATORY per type (lesson_block_types row + config schema; editor form + blockTypeMeta; BlockRenderer editor+trainee; draft-lesson-block; scaffold-lesson-outline + expand-lesson-from-outline). Suggested order (lightest to heaviest):

- **INT-4 click-to-reveal.** A set of click-to-expand items. Before building, lock a one-line differentiation vs the existing `accordion` (collapsible titled sections), `button_stack` (continue/jump/link), and `tabs` (parallel branches) so it is not a duplicate; the distinguishing intent is likely a grid/card reveal of short hidden answers rather than a vertical accordion. Likely STATELESS like hotspot (completion = all revealed).
- **INT-5 drag-to-order.** Drag items into the correct sequence. Precedent already exists: `card_sort` (dnd-kit bucket sorting) for the drag mechanics and `knowledge_check` ranking/timeline question types for the ordered-answer model. Decide whether it is its own block or a thin wrapper over the ranking pattern.
- **INT-8 activation poll.** A lesson-level cover poll. Architecturally distinct from the per-block types (it is a lesson-cover element, not an inline block), the heaviest of the four, and should be built last. Lock where it lives (cover vs block) and how responses are stored before any build.

Verification per type: apply_migration then separate execute_sql verify; boot-probe the three generators after Cole deploys them (OPTIONS 204 + no-auth POST 401); SHA-verify the frontend at the new HEAD.

### 2. (Carryforward, non-blocking) Cole-side functional tests

- Live hotspot end-to-end test: build a hotspot via AI chat (image resolved at outline review), run "Auto-place with AI", confirm trainee marker reveals + completion.
- The carried INT-1 in-app end-to-end test + AI-authoring functional check (from S140).

## Decisions locked in Session 142 (recap)

- Hotspot is STATELESS: no table, no block-specific RPC; completion via the existing sticky `upsert_lesson_block_progress` path; empty-hotspots auto-completes; gating_required defaults false.
- Config schema is FLAT, matching the image block (`asset_id`, `alt`, `attribution`, `instructions`, `hotspots[]`, `gating_required`, `background_color`, `padding`); marker x/y are 0-100 percentages.
- Reveal UI is a Popover anchored to the marker; image picker reuses the Pexels+upload pipeline.
- AI vision auto-placement is a separate edge fn (`lesson-hotspot-autoplace` v1) behind an "Auto-place with AI" button, rate-limited 10/hr.
- Text generators emit hotspot label + content with PLACEHOLDER marker coords (even x-spread, staggered y), NOT image-accurate; accurate placement comes only from the vision button or manual drag.
- SUPERSEDED: the earlier "generators emit `image_query`" plan was dropped after reading the code; hotspot rides the existing AiPane outline-stage `image_resolved` path (no `image_query` field exists).

## Open questions / things to lock in Session 143

- INT-4: the one-line differentiation vs accordion/button_stack/tabs (above).
- INT-5: own block vs wrapper over the ranking pattern; stateless vs stored attempts.
- INT-8: cover-level vs block-level placement and where poll responses are stored.

## Bugs surfaced in Session 142 added to Build Queue

- None. (Carryforward Cole-side tests are functional checks, not bugs.)

## What's NOT in scope for Session 143

- Phase 4 (INT-2 personalization / INT-6 branching / INT-7 confidence) and VIS-4 (media-beside-text two-column) until Phase 3 is complete.
- The standing carryforwards untouched this arc: SCORM export + API setup; BQ-SUPERVISOR-DASH; Operations externalization arc; newsletter BUG-NWS-1 + Group H closure; the `newsletter-sitemap` STATIC_ROUTES manual-edit reminder (still standing whenever a new public marketing page or sitemap/SEO work comes up).

## Architecture additions in Session 142

Recorded in architecture-reference.md v143:

- `public.lesson_block_types` row `hotspot` (interactive, not scored, v1-active).
- `public._walk_block_config_for_asset_refs` extended: `hotspot` -> `ref_field 'hotspot_asset'` (the one walker that all three asset RPCs route through, so it covers ref-tracking + editor signing + trainee signing).
- New table `public.lesson_hotspot_autoplace_log` (rate-limit; RLS on; REVOKE authenticated/anon).
- New edge fn `lesson-hotspot-autoplace` v1 (verify_jwt true; super-admin + impersonation-gated; 10/hr; one Opus vision call returning `{client_id,x,y}` placements).
- Generators versioned: `draft-lesson-block` v17, `scaffold-lesson-outline` v28, `expand-lesson-from-outline` v29.
- Pattern reaffirmed: hotspot is image-bearing on the AiPane `image_resolved` outline-stage path (same as the image block).

## Test fixture state at end of Session 142

Test org: BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`).

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Test lesson content_item: `e5c208f2-6885-482e-8d8b-8325f9cbaf5d`. No fixtures were created or left dirty this session (hotspot is stateless; the autoplace log was created empty). `lesson_hotspot_autoplace_log` will accumulate rows once the auto-place button is exercised; no cleanup needed (rate-limit audit, prunes by time window in the count query).

## Documents this session leaves behind

- build-queue.md (v148)
- architecture-reference.md (v143)
- session-142-to-143.md (this document)

Markdown only (Session-74 decision; no .docx). Cole uploads all three manually to `cbastianBWE/brainwise-internal-docs` (flat repo root); GitHub MCP is READ-ONLY.
