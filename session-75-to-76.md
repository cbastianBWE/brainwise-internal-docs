# Session 75 → 76 Handoff

**Session 75 closed:** Resources flow + detach/duplicate workstream shipped end-to-end. 10 bugs fixed. Content Authoring restructure + Rise first-class scoped for future sessions. ~95% functional verification on Group Y complete.

**Session 76 opens with:** Cole's decision on Path A (Content Authoring restructure + Rise first-class) vs Path B (Group Z detail pages per locked arc).

---

## What shipped Session 75 (summary)

Full detail lives in build-queue.md v83. Brief inventory:

**Backend:** 11+ migrations. Major workstreams: detach/duplicate RPCs (2 detach + 3 duplicate + 2 helpers + 5 action_types), video chicken-and-egg fix (2 migrations: RPC relaxation + CHECK constraint relaxation), get-resource-signed-url v2 with `as_attachment` parameter, request_asset_upload v5 content-type-aware, locked-tile defaulting backend support, several resources flow bugfixes.

**Frontend:** 8 Lovable prompts. Resources flow bugfixes, PaidEnrollmentNudgeModal, MyLearningTab locked-tile fix, Browse & Enroll relabel, detach + duplicate UI across 3 editors, video content_item create flow fix.

**Test verification:** 18+ scenarios PASSED end-to-end. All 7 resource content types, Coach Resources tab, file downloads with friendly filenames, locked tile overlay, inline video player, paid enrollment modal, free cert path self-enroll, detach curriculum from cert path, detach module from curriculum, duplicate module (assets SHARED by reference — verified via SQL), duplicate curriculum, duplicate cert path, video content_item chicken-and-egg create flow, source-type switch stale state.

**Standing rules added:** §96 (relax-RPC-validation requires matching CHECK-constraint audit), §97 (detach pattern — hard delete link rows, preserve user enrollments), §98 (duplicate pattern — deep copy with assets SHARED, new entities start unpublished).

---

## Session 76 opener — decision required

Cole, pick one of these paths to open Session 76:

### Path A — Content Authoring restructure + Rise first-class

Read the scope doc first: `cbastianBWE/brainwise-internal-docs/scope-content-authoring-restructure.md` (437 lines). Two workstreams scoped:

**Part 1: Content Authoring page restructure**
- Replace left tree with action sidebar (Create / Find-edit / Duplicate / Recent)
- Main area: tile/carousel grouped by entity type with parent context badges + filter chips
- 6-8 hours, 2 focused sessions
- Editors (CertPathEditor / CurriculumEditor / ModuleEditor / ContentItemEditor) unchanged

**Part 2: Rise lesson as first-class authoring entity**
- Surface "Create Rise lesson" in sidebar directly
- Allow standalone lesson_blocks content_items (Option B recommended: nullable module_id for lesson_blocks)
- 7-9 hours, 2 focused sessions
- 9 RPCs reference content_items.module_id, all need updates (full list in scope doc)

**Sequencing recommendation:** Part 1 first, then Part 2. Don't do both same session (14-17 hours combined).

**Pre-build decisions Cole must lock before either part starts:**

Part 1:
- Q1: Multi-parent badge strategy (recommended: count + click-to-expand)
- Q2: Surface content_items in tile view? (recommended: no, drill via parent module)
- Q4: Replace tree entirely or coexist? (recommended: replace)
- Q5: URL params strategy (recommended: keep `selected`, drop `expanded`, add `tab`/`filter`)

Part 2:
- Architecture: Option A, B, or C? (recommended: B for v1)
- Detach semantics: preserve enrollments parallel to curriculum detach? (recommended: yes)
- Publish state for unattached lessons: inherit from module or independent? (recommended: inherit for v1)

### Path B — Group Z detail pages

Continue locked X→Y→Z→V→W Group C completion arc.

**Group Z scope:**
- Detail pages for cert path, curriculum, module
- Completion modal sequence (per Session 72 locked design — Option B collapse to highest tier on cascaded transitions, full notification audit history preserved)
- Stubs for Restart, Review, Request Access (Restart on cert paths NOT supported per Session 72 locked design — curriculum/module only)
- Per-item type completion behavior already implemented in Session 70 Phase 5 backend (video auto on watch_pct, quiz auto on quiz_passed, etc.)

Then Group V (Certification page at `/certifications/<id>` with Canvas API PNG personalization), then Group W (Content item viewers — Video / External Link / lesson_blocks minimum, requires lesson_blocks interactive widget recon first).

---

## Test fixture state at Session 75 close

Cole should be aware of these state details when opening Session 76:

**PTP VILT 1 curriculum is DETACHED from PTP-Coach cert path** during Session 75 detach testing. Re-attach via super-admin UI or SQL if full hierarchy testing needed:

```sql
INSERT INTO certification_path_curricula (certification_path_id, curriculum_id, display_order, is_required)
VALUES ('57db528d-9715-4e23-9b40-82fc17a5b371', 'aa221e50-e504-4568-a882-63a4ac567619', 1, true);
```

**PTP-Coach cert path is currently PAID** (toggled during paid modal test). Reset to free if needed:

```sql
UPDATE certification_paths
SET is_self_enrollable = true, self_enroll_price_cents = NULL
WHERE id = '57db528d-9715-4e23-9b40-82fc17a5b371';
```

**`testclientbwe+coupontest@gmail.com`** (`ab99d5de-7a07-4bcb-88ac-8e7b3ead4ae3`) was promoted to active+base subscription tier during Session 75 locked tile test. Revert to inactive if cleanup desired (check subscription_status before deciding).

**Test fixtures created during Session 75 verification:**
- Test resource `43f46e7f-2581-44b2-aa6e-d4de09dfabef` "Premium Only — Locked Tile Test" — keep as ongoing fixture for locked-tile testing
- Test duplicate module `498f4422-dbb4-4221-abc9-91d39b9b20a5` — archived for cleanup

**Test user credentials** — request password from Cole if needed (not stored in docs):
- testclientbwe+orgmember@gmail.com
- testclientbwe+supervisor@gmail.com
- testclientbwe+employee@gmail.com
- testclientbwe+coupontest@gmail.com

---

## Session 76 opener protocol

1. GitHub MCP `get_file_contents` on `cbastianBWE/brainwise-internal-docs` root files:
   - `build-queue.md` (Session 75 = v83)
   - `architecture-reference.md` (Session 75 = v79, new §96-§98)
   - `session-75-to-76.md` (this file)
   - `scope-content-authoring-restructure.md` (full scope for Path A — only if pursuing Path A)
2. Save locally at `/home/claude/internal-docs/`
3. Cole picks Path A or Path B at session open
4. Edit markdown in place via `str_replace` AS decisions land mid-session — never rewrite from scratch at session end

---

## Edge Function versions at Session 75 close

- `get-resource-signed-url` **v2 ACTIVE** verify_jwt:true (added `as_attachment` boolean parameter, applies via Supabase Storage `?download=` URL parameter for Content-Disposition: attachment)
- `request_asset_upload` (RPC) **v5 ACTIVE** (content-type-aware asset_kind, allows video MIME types as `video` asset_kind not hardcoded `document`)
- All other Edge Functions unchanged from Session 74 close:
  - `create-checkout` v56
  - `customer-portal` v41
  - `create-comp-coupon` v2
  - `stripe-webhook` v26
  - All AI authoring functions (draft-lesson-block v15, expand-lesson-from-outline v13, scaffold-lesson v6, scaffold-lesson-outline v11)

---

## What did NOT move Session 75

Carried forward unchanged:
- AIRSA Phases 3e-8 (separate Group C track, BUG-1 isAIRSA bundled)
- SOC 2 written policies (deferred until feature-complete)
- Action-Oriented Voice Redesign across six surfaces
- Pricing-reads refactor
- Corporate contract renewal schema change
- Clarity Engine (deferred to Group C resources build-out)
- Six §82 RLS issues on `coach_disclosure_acceptances` + `user_curriculum_assignments` (pre-existing, deferred to next §82 audit)
- 95 SECDEF functions with anon EXECUTE (Session 71 deferred to dedicated audit session)

---

## Standing patterns reinforced Session 75

- **§94 read-RPC-before-rewrite** caught the same legacy-guardrail anti-pattern TWICE this session (get_resource_content_asset stale content_type guardrail + request_asset_upload hardcoded asset_kind). Standing query before any RPC change: `SELECT pg_get_functiondef('rpc_name'::regprocedure);`
- **§96 NEW: relax-RPC-validation requires CHECK-constraint audit in same migration.** Standing query: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = '<table>'::regclass AND contype='c';`
- **§97 NEW: detach pattern = hard DELETE link rows.** UNIQUE constraints would block reattach if soft-deleted. User enrollments preserved (Option A).
- **§98 NEW: duplicate pattern = deep copy with assets SHARED.** Storage-efficient, new entities `is_published=false`.
- **Defensive frontend pattern:** `entity.is_accessible === false` instead of `!entity.is_accessible` — treats undefined as accessible (fail-open for UI tile rendering, fail-closed enforcement remains backend RLS).
- **Approval-gated workflow held throughout** — Cole locked decisions before code shipped.
- **Closeout workflow:** edit markdown in place via str_replace as decisions land, present `.md` files for Cole to upload manually. NO `.docx` per Session 74 decision. GitHub MCP READ-ONLY.

---

*End of handoff. Session 76 picks up at Cole's path choice.*
