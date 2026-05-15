# BrainWise Session 72 to 73 Handoff

*Closeout: Session 72. Open: Session 73.*

## Where Session 72 left off

Group C completion arc opened with the locked sequence: Group X (tile primitive + Resources page shell) shipped via Lovable; Y, Z, V, W queued. Five backend migrations shipped: §82 fix on `module_completions`, `get_user_learning_state` extended to surface thumbnails and module completion status, new `lesson-thumbnails` public storage bucket with proper RLS, `request_asset_upload` routing thumbnails to the new bucket, and new `resource_access_log` table with `log_resource_access` RPC. 21 visual primitive design decisions locked. Group X routing sweep prompt drafted (3 surgical edits to make Resources reachable for free users, corporate admins, and super admin) — Cole ships it whenever convenient. Pattern C super-admin-as-coach scoped to a standalone one-off session.

## Session 73 opening priorities, in order

### 1. Ship Group X routing sweep prompt (if not yet done)

`/home/claude/internal-docs/lovable-prompts/prompt-group-x-routing-sweep.md` — 96 lines, 3 file edits. Cole pastes into Lovable, Lovable applies, verifies the four user types now reach the Resources page:
- Free individual user → `/resources` (no redirect to `/settings/plan`)
- Subscribed individual user → `/resources` (unchanged)
- Corporate org_admin/company_admin → `/admin/resources` lands on `Resources` component
- Super admin → new sidebar entry visible, clicks to `/resources`

### 2. Cole re-uploads 5 test thumbnails through existing super-admin authoring UIs

PTP-Coach cert path thumbnail, PTP VILT 1 curriculum thumbnail, Test Module C module thumbnail, Test Video Item content_item thumbnail, Test External Link content_item thumbnail. New uploads automatically land in `lesson-thumbnails` public bucket via the updated `request_asset_upload` RPC. ~5 minutes. After this, Group X tile previews show real thumbnails instead of placeholder.

### 3. Draft Group Y Lovable prompt: My Learning tab + All Resources + Coach Resources tab content

The locked design is documented in build-queue.md v79 entry. Group Y wires real content into the three "Coming soon" placeholder tabs from Group X:

- **My Learning tab**: smart-default Enrolled vs All Available toggle (Option B). Enrolled view: 3 horizontal carousels (cert paths / standalone curricula / standalone modules), sorted most-recently-engaged first. All Available view: same 3 sections, showing PTP-Coach in cert paths section with self-enroll. Empty states with inline messaging per section.
- **All Resources tab**: grid of resource tiles from `get_user_resources`, sorted by display_order. Click resources via content-type-aware destination (article/guide → reader page; video → reader with embedded player; worksheet/template → download new tab; external_link → new tab). Fire `log_resource_access` on every click via `useResourceAccessLog()` hook from Group X.
- **Coach Resources tab**: same shape as All Resources but only resources tagged for coaches. Visible only to coaches (server-side filtering via `get_user_resources`).
- **Locked-tile pattern for free users**: `get_user_resources` extension — returns `is_accessible` boolean per resource. Tile component gains `locked` prop showing lock-icon overlay + altered click behavior (clicking a locked tile shows upgrade nudge modal instead of opening). Free users see all resources, locked ones visually gated. Visible-but-locked is the conversion design, NOT hidden.

Group Y prompt estimated 600-900 lines. Consumes Group X tile primitive + helpers. Should NOT modify `Tile.tsx` or `tileVariants.ts` — only consume them.

### 4. After Group Y ships: draft Group Z (detail pages)

Cert path detail page, curriculum detail page, module detail page. Each with hero header + child tiles grid. Back navigation (browser-history-first with data-inferred fallback). Inline CTAs on child tiles. Orange left-border on in-progress tile. Empty states with role-aware messaging. Completion modal sequence with collapse-to-highest-tier behavior. Stubs for Restart, Review, Request Access (buttons exist, click → "Coming soon" modal).

### 5. After Group Z: draft Group V (certification page)

`/certifications/<id>` route with Cole-provided certificate image + personalization (name + date overlay) via Canvas API browser composition. PNG download for v1; PDF generation deferred to Build Queue.

### 6. Before Group W: lesson_blocks interactive widget recon

Read `BlockRenderer.tsx`, document the existing trainee-mode behavior, understand the contract between BlockRenderer and `upsert_lesson_block_progress`, figure out how `gating_required` flows. One session of pure analysis, no code shipped. Prerequisite for Group W.

### 7. Group W: content item viewers

Video viewer, External Link viewer, Lesson blocks viewer. Other 5 viewer types deferred to Phase 5.5 work — the published test tree has only video/external_link/lesson_blocks content items, so launch only needs those three.

## Decisions locked in Session 72 (recap)

- 21 tile primitive design decisions (composition, status pills, hover overlay, inline CTA, current-location border, instrument badges, required/optional treatment, content-type pills for resources)
- Cert path restart NOT supported (curriculum/module-only restart) — simplifies state machine
- Public-tier vs private-tier asset classification — thumbnails public, content bodies private
- Lovable prompt order: X (shipped) → Y → Z → V → W
- Slice analysis: must-ship slice for coach cert end-to-end, stubbed surfaces with backend deferred, fully deferred surfaces
- Three forward-compat seams flagged (cert path state machine OK; curriculum/module attempts model needs `is_current` flag in future Restart schema; org licensing model is additive entitlement not replacement)
- Free users see the Resources page with locked tiles (visible-but-locked conversion design), NOT redirect to billing
- Corporate org_admin/company_admin and super admin all reach the same `Resources` component
- Pattern C super-admin-as-coach over Pattern B impersonation — separate one-off session
- `--bw-mustard #7a5800` token added to brand palette in `src/index.css`
- §86 brand variable extension protocol — new colors get named tokens, never hardcoded inline

## Open questions / things to lock in Session 73

- Group Y prompt scope: is "All Resources" tab rendering one flat grid or category sub-sections? Locked design says single grid sorted by display_order — confirm at Group Y design time, especially if resources grow beyond ~12 launch items
- Coach Resources tab: should resources be filterable by certification path (PTP / NAI / AIRSA / HSS) or one flat list? Currently no resources reference cert paths in the schema — defer until coach resources are seeded
- Locked tile click behavior: modal that says "Upgrade to access" with a button to `/settings/plan`, OR inline tooltip on hover, OR something else? Decide before Group Y drafts

## Bugs surfaced in Session 72 added to Build Queue

(None — Group X shipped clean. The one drift caught during Lovable reconstruction — current-location border condition was initially `detailPageMode && isCurrentLocation` instead of `isCurrentLocation` alone — was fixed before ship.)

## What's NOT in scope for Session 73

- AIRSA Phases 3e-8 (separate Group C track entirely)
- Phase 6 mentor review UI
- Phase 7 actor flow
- Phase 8 Order Assessment gating by certification
- Pattern C super-admin-as-coach (its own one-off session)
- Restart-with-attempts schema for curricula and modules (build queue, post-launch)
- Self-service access requests + org licensing model (build queue, post-launch, 2-3 sessions)
- Resource completion tracking (post-launch enhancement)
- Certification PDF generation (PNG ships v1, real PDF deferred)
- SOC 2 written policies (deferred until feature-complete)
- Action-Oriented Voice Redesign across six surfaces

## Architecture additions in Session 72

Recorded in architecture-reference.md v75:
- §84 — per-tier asset classification (public-tier thumbnails in `lesson-thumbnails`, private-tier content body files in `lesson-assets`)
- §85 — unified Tile primitive contract (one component, 5 variants, locked behavioral contract)
- §86 — brand variable extension protocol (new locked colors get `--bw-NAME` token in `src/index.css` `:root`, never hardcoded inline)

New backend:
- `lesson-thumbnails` storage bucket (public=true, 10MB ceiling, image MIMEs only)
- 5 RLS policies on `storage.objects` for `lesson-thumbnails` bucket
- `request_asset_upload` RPC extended with `v_bucket` local routing thumbnails to public bucket
- `resource_access_log` table + 3 indexes + 3 RLS policies
- `log_resource_access(p_resource_id)` SECURITY DEFINER RPC
- `get_user_learning_state` RPC extended to surface thumbnails on all tiers + module_completion on modules

New frontend (Group X shipped):
- `src/components/tile/Tile.tsx` — unified primitive
- `src/components/tile/tileVariants.ts` — types + lookup maps
- `src/lib/thumbnailUrl.ts` — `buildThumbnailUrl(bucket, path)` helper
- `src/hooks/useResourceAccessLog.ts` — fire-and-forget access logging hook
- `src/pages/Resources.tsx` — replaced placeholder with three-tab shell driven by `get_user_resources`
- `src/components/AppSidebar.tsx` — coach Resources entry unblocked
- `src/index.css` — `--bw-mustard: #7a5800;` added to `:root`
- `src/pages/_dev/TilePreview.tsx` — dev preview route for visual regression testing (kept in place)

Edge Function versions: unchanged from Session 71 close.

## Test fixture state at end of Session 72

Test org: BrainWise Test Corp (UUID `2633a225-e071-4a73-b0ad-09b46ec3025f`).

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Plus testcoach2 (existing `certified` ptp_coach from Session 70 published tree work).

Published learning tree fixtures (carried from Session 70):
- PTP-Coach certification path
- PTP VILT 1 curriculum (attached to PTP-Coach)
- Test Module C (attached to PTP VILT 1)
- 3 content items in Test Module C: Test Video Item, Test External Link, Test Lesson Blocks Item

5 existing test thumbnails are ORPHANED in `lesson-assets` bucket (super-admin-only) after Migration D. Cole's action: re-upload through existing super-admin authoring UIs to land in new public `lesson-thumbnails` bucket. Old assets auto-reaped by nightly orphan-sweep cron.

## Documents this session leaves behind

- BrainWise_Build_Queue_v79.docx (uploaded to project knowledge)
- BrainWise_System_Architecture_Reference_v75.docx (uploaded to project knowledge)
- BrainWise_Session_72_to_73_Handoff.docx (this document, uploaded to project knowledge)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs.
