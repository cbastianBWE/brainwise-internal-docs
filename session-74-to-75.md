# BrainWise Session 74 to 75 Handoff

*Closeout: Session 74. Open: Session 75.*

## Where Session 74 left off

Group Y (My Learning + Resources tabs) shipped end-to-end: 8 backend migrations + 1 new Edge Function (`get-resource-signed-url` v1) + 2 Lovable prompts (B = super-admin authoring extensions, A = trainee surfaces). Prompt B fully verified live with DB round-trip; Prompt A verified via GitHub `get_file_contents` end-to-end pattern checks. The locked Group C completion arc order remains **X (Session 72) → Y (this session) → Z → V → W**. Session 75 opens with content authoring by Cole (not yet done) before functional testing of Prompt A can run.

## Session 75 opening priorities, in order

### 1. Read the three canonical docs from GitHub

Per session-open protocol, the first action is:

```
get_file_contents on cbastianBWE/brainwise-internal-docs:
  - build-queue.md (now v82)
  - architecture-reference.md (now v78)
  - session-74-to-75.md (this document)
```

Then save locally at `/home/claude/internal-docs/` mirroring the GitHub structure.

### 2. Cole authors content via the new super-admin UIs

This is **the gating prerequisite for any Prompt A functional verification**. Full prerequisite list lives in build-queue.md v82 entry (item 13) — copying here for convenience:

- At least 1 published article with URL-only (`url_or_content` set, `content_asset_id` null)
- At least 1 published article with file-only (`content_asset_id` set, `url_or_content` null)
- At least 1 published guide (file required)
- At least 1 published video with YouTube URL
- At least 1 published video with file (mp4)
- At least 1 published worksheet
- At least 1 published template
- All 7 above tagged to "All Resources" tab with broad enough access grants that the super_admin test account can see them
- At least 1 published resource on the "Coach Resources" tab
- At least 1 published, self-enrollable, free standalone curriculum
- At least 1 published, self-enrollable, free cert path
- At least 1 published, self-enrollable, paid (any price) cert path — for the `payment_required` toast test
- At least 1 published resource with a `corporate_level` grant — to test locked overlay for super_admin without matching level

Estimated 1-2 hours of content work. Claude can help with sample content drafts if Cole wants.

### 3. Functional verification of Prompt A end-to-end

Once content is loaded, the test matrix is:

**All Resources tab:**
- Content-type grouping order verified (video → guide → article → worksheet → template)
- Search filter works
- Article URL click → ResourceReader renders HTML via dangerouslySetInnerHTML
- Article file click → file download via signed URL
- Video URL click → ResourceReader embeds YouTube via VideoEmbed
- Video file click → ResourceReader plays via `<video>` element
- Guide/worksheet/template click → file download (no inline render)

**Coach Resources tab:**
- Same as All Resources for visible resources
- Empty state correct on coach-only tab when super_admin has no cert grant

**My Learning tab:**
- Smart-default Enrolled vs All Available — defaults to All Available when no enrollments, Enrolled otherwise
- `status_group` sort verified: in_progress → not_started → completed
- Enroll button shown on self-enrollable + accessible + not-enrolled tiles
- Free self-enroll succeeds → toast "Enrolled!" → both queries invalidate → tile moves to Enrolled view
- Paid self-enroll returns `payment_required` → toast with formatted price + "Payment flow coming soon — contact support" message
- Search filter works across both views

**ResourceReader:**
- Article URL renders HTML correctly
- Video URL embeds YouTube via VideoEmbed
- Video file plays via native `<video>` element with controls
- Guide/worksheet/template fallback shows Download CTA card with original_filename + size

**Locked tile flow:**
- Resource with `corporate_level` grant that super_admin lacks renders with Lock icon overlay + backdrop-blur
- Hover overlay suppressed on locked tile
- Click locked tile → opens UpgradeNudgeModal
- Modal copy reads "Upgrade to access this [entityName]"
- Upgrade button navigates to `/pricing` (PricingRouter resolves to /settings/plan or /dashboard per account_type)

**Edge Function `get-resource-signed-url`:**
- Signed URL download succeeds for authorized trainee
- Fails (403 access_denied) for unauthorized resource
- 15-minute expiry honored — URL stops working after window
- No client-side `supabase.storage.createSignedUrl()` calls anywhere in resource flow (verified by code grep)

### 4. Group Z opens

After Prompt A functional verification passes (likely 1-2 patch prompts for whatever surfaces), the next group in the locked arc is **Z = detail pages**:

- `/learning/cert-path/:id` — cert path detail page
- `/learning/curriculum/:id` — curriculum detail page
- `/learning/module/:id` — module detail page
- Completion modal sequence (Option B per Session 72 design lock: collapse to highest-tier on cascaded transitions)
- Stubs for Restart, Review, Request Access (full features deferred per Session 72 slice analysis)

Z is shaped like Y in size and complexity — expect backend recon + Lovable prompt + verification cycle. Locked section orders + visual contracts already locked in Session 72 (architecture-reference §85).

## Decisions locked in Session 74 (recap)

- **Gap 1**: Locked-tile = plan_tier-gated visible-but-locked; org/role/cert/account_type-gated hidden entirely
- **Gap 2**: Resources sort by content_type group (video → guide → article → worksheet → template) then published_at DESC + search bars on All / Coach / My Learning
- **Gap 3**: My Learning sort by status_group (in_progress → not_started → completed) then last_engaged_at DESC
- **Gap 4**: New `list_available_learning(p_user_id)` RPC for the All Available view
- **Gap 5**: Standalone modules get full `user_module_assignments` schema parallel to user_curriculum_assignments
- **Gap 6**: Worksheet/template content reuses private `lesson-assets` bucket; new `content_asset_id` column on resources; server-side signed URLs via `get-resource-signed-url` Edge Function
- **Self-enrollable model**: Per-entity boolean `is_self_enrollable` + nullable `self_enroll_price_cents` (NULL=free) + `self_enroll_currency` default 'usd'. Wipe-on-toggle-off. Backend safety net forces price NULL when not self-enrollable.
- **Upgrade modal copy**: "Upgrade to access this {entityName}". Routes to in-app `/pricing` (PricingRouter, no branching needed in the modal)
- **Content-field model (revised mid-session, Migration 7)**: guide/worksheet/template → file required when published; article/video → exactly ONE of file OR URL when published (XOR), never both; drafts have no field requirements
- **Tile inline CTA**: Drop `detailPageMode &&` gate so `inlineCtaLabel` + `onInlineCtaClick` render whenever both provided (additive, no existing call sites affected outside detail pages)

## Open questions / things to lock in Session 75

None blocking. Cole will author the content prerequisites, then we run the test matrix. If Prompt A verification surfaces issues, those become Session 75 patch work. If verification passes cleanly, Group Z scope-lock and design-lock work opens.

## Bugs surfaced in Session 74 added to Build Queue

- **Paid self-enroll soft-stub**: Frontend currently toasts "Payment flow coming soon — contact support" on `payment_required`. Full Stripe Checkout integration for cert path / curriculum / module purchase enrollment deferred to post-launch.
- **`user_curriculum_assignments` §82 violations**: 3 policies with `roles: {public}` instead of `{authenticated}`. Pre-existing, NOT fixed Session 74. Next §82 audit pass.
- **`get_lesson_block_assets` is super-admin-only**: Trainees can't use; needs own resolver RPC when Group W (lesson_blocks content item viewer) ships.
- **Tile.tsx latent footgun**: Locked tile would render inline CTA if both `inlineCtaLabel` and `onInlineCtaClick` were provided. MyLearningTab call site correctly gates via `shouldShowEnrollButton` which checks `is_accessible`, so theoretical only. Add defensive `&& !locked` to Tile.tsx inline CTA render block on next touch.

## What's NOT in scope for Session 75

- AIRSA Phases 3e-8 (still queued, separate Group C track)
- SOC 2 written policies (deferred until feature-complete)
- Action-Oriented Voice Redesign across six surfaces
- Pricing-reads refactor
- Corporate contract renewal schema change
- Clarity Engine (not built yet)
- 6 §82 RLS issues on `coach_disclosure_acceptances` (pre-Session-71 leftovers)
- Group D Phase 6 polish items still pending
- Anything in Groups A or B
- Group W (content item viewers) — comes AFTER Z and V per locked arc

## Architecture additions in Session 74

Three new standing rules added to architecture-reference §93-§95:

- **§93 — Per-content_type field model with publish-gate validation in upsert RPC.** When an entity has multiple content shapes that vary by a discriminator column and validation rules differ per shape, the CHECK constraint covers invariants only; publish-state-conditional rules go in the SECDEF upsert RPC's `IF NEW.is_published THEN ... END IF` block. Distinct error codes per failure mode. XOR shapes explicit. Applies forward to any entity with discriminator-driven content shape.
- **§94 — RPC-read-before-rewrite discipline.** Extends §92 from Edge Functions to PL/pgSQL RPCs. Before rewriting any existing RPC, run `pg_get_functiondef('rpc_name'::regprocedure)` to read the deployed source. Never reconstruct from memory. Same logic covers RLS policies (`pg_policies`), CHECK constraints (`pg_get_constraintdef`), and trigger bodies (`pg_get_triggerdef`). Caught a legacy guardrail in `request_asset_upload` this session that would have cost 30+ minutes to diagnose without reading the deployed body first.
- **§95 — Server-side signed URL pattern.** When storage RLS blocks the client-side `supabase.storage.createSignedUrl()` path for an end-user class, build a SECDEF access-check RPC + service-role Edge Function proxy. Storage RLS stays locked. Frontend uses `supabase.functions.invoke()`, never `supabase.storage.createSignedUrl()`. 15-minute default expiry. Applied to `get-resource-signed-url` v1 this session. Extends naturally to lesson_block assets (Group W), assessment file uploads, certification PDF downloads (Group V).

New tables and RPCs added Session 74 (full inventory in build-queue.md v82 entry):

- `user_module_assignments` table — parallel to user_curriculum_assignments, for standalone module enrollments
- `resources.content_asset_id` column with FK to content_assets
- 3 new columns on cert_paths / curricula / modules: `is_self_enrollable`, `self_enroll_price_cents`, `self_enroll_currency`
- `get_resource_content_asset(p_resource_id)` SECDEF RPC — access-checked resolver
- `list_available_learning(p_user_id)` SECDEF RPC — All Available catalog
- `assign_module_directly` + `unassign_module` super-admin RPCs (tier 2, MFA, justification)
- `self_enroll_in_module` / `self_enroll_in_curriculum` / `self_enroll_in_certification_path` authenticated RPCs (paid path returns `payment_required`)
- Extended `get_user_resources` with `is_accessible` + `content_asset_id` + content_type sort group
- Extended `get_user_learning_state` with `last_engaged_at` + `status_group` + `module_assignments[]`
- Extended `upsert_certification_path` (15 params), `upsert_curriculum` (17), `upsert_module` (16), `upsert_resource` (10) — old signatures DROPPED
- Extended `request_asset_upload` to support ref_field='content' for resource scope with content_asset_id pointer-stamp
- 2 new super_admin_action_types: `module_directly_assigned`, `module_unassigned`
- New Edge Function `get-resource-signed-url` v1 (verify_jwt:true, Class A custom auth)

## Test fixture state at end of Session 74

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

**Group Y fixtures state at session close (post-wipe testing):**

- PTP-Coach cert path (`57db528d-9715-4e23-9b40-82fc17a5b371`): is_published=false, is_self_enrollable=false (toggle-off wipe verified)
- PTP VILT 1 curriculum (`aa221e50-e504-4568-a882-63a4ac567619`): is_self_enrollable=false (toggle-off wipe verified)
- Test Module C (`ece0a34f-b1ac-460b-a9eb-4cc38ee20750`): is_self_enrollable=false (toggle-off wipe verified)
- 1 test guide resource with file uploaded post-Migration 8 fix — Cole has NOT published yet (content authoring opens Session 75)

**Cert path active comp coupon**: super_admin_comp 100% off, Stripe coupon ID `Z69K5abZ`, redeem_by Session 73 + 60 days (renew via /super-admin/coupons before Session 90 or so).

## Documents this session leaves behind

- BrainWise_Build_Queue_v82.docx (uploaded to project knowledge)
- BrainWise_System_Architecture_Reference_v78.docx (uploaded to project knowledge)
- BrainWise_Session_74_to_75_Handoff.docx (this document, uploaded to project knowledge)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs.

**Edge Function source pending GitHub upload:** `supabase/functions/get-resource-signed-url/index.ts` (v1 deployed Session 74 via Supabase MCP, repo upload pending per §92). Cole uploads via web UI alongside the closeout markdown.
