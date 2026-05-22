# BrainWise Session 85 to 86 Handoff

*Closeout: Session 85. Open: Session 86.*

## Where Session 85 left off

Session 85 was a production bug cluster. Five fix workstreams shipped end-to-end
and verified: coach actor-order gate (Caroline / Patrice / Ryan blocked),
module archive CHECK constraint extension, My Learning blank cert-path tile
(Symptom 1 RPC flat fields + Symptom 2 trainee tier-thumbnail RPC plus RLS
alignment), coach-can't-see-client-results (Fix A + Fix B-Level-2 + Fix
B-Level-3), and PTP paired-assessment UX consistency (Option C2 — coach tile
and client dropdown both collapse paired PTPs into one entity).

Cohorts were formally confirmed not needed and marked deferred indefinitely.
The module reorder gap surfaced during Session 85's recon work — backend RPCs
exist at the content-items tier but not at curriculum→module or
cert-path→curriculum — and is logged to the queue as a scoped fresh-session
item, not built.

Carried forward to Session 86 unchanged: notifications Phase 3 closeout
(`results_available` firing-point wiring with paths A and B documented in
Session 84 but not yet executed), Phase 10 polish pass, and the existing tail
of long-running items (AIRSA Phases 3e-8, SOC 2 written policies, voice
redesign, pricing refactor, contract renewal schema change, Clarity Engine).

## What shipped in Session 85

### 1. Coach actor-order gate fix (Bug 1)

Caroline Perry, Patrice Love, and Ryan Carey — all
`coach_certifications.status = 'in_progress'` — were blocked at three frontend
gates in `src/pages/coach/CoachClients.tsx`. Their actor-only paths
(`certified` is the only branch the UI considered "can order assessments")
fell through.

Fix: introduced two derived booleans — `canOrderAssessment` (covers both
`certified` and `in_progress` with non-zero `free_assessment_uses`) and
`actorOnlyMode` (forces the modal into actor-debrief flow when the coach is
not certified but has a pool credit). Modal force-sets `isActorDebrief = true`
on submit. Plus a toast typo fix: "3 actor debriefs" → "4". Pure frontend fix
via Lovable. No backend touched.

### 2. Module archive CHECK constraint extension (Bug 2)

Module-tier archive cascade was failing because the
`content_assets.archive_reason` CHECK constraint did not whitelist
`module_archived`, `curriculum_archived`, or `certification_path_archived`.
Cascade attempted to write the reason, hit the CHECK, transaction rolled back.

Migration `session85_content_assets_archive_reason_check_extend_tier_cascade_reasons`
dropped the old constraint and recreated with the 8-value whitelist — the
5 pre-existing values (`content_item_archived`, `lesson_block_replaced`,
`replaced_by_author`, `manual_archive`, `orphaned_pending_expired`) plus the
3 new tier-cascade values (`module_archived`, `curriculum_archived`,
`certification_path_archived`). Standing rule reinforced (§115 candidate):
tier-archive cascades must whitelist the tier's `archive_reason` in the CHECK
before the cascade trigger reaches the row.

### 3. My Learning blank cert-path tile (Bug 3 — Symptom 1 + Symptom 2)

User reported a cert-path tile on My Learning was rendering with no name, no
description, and the orange-circle placeholder thumbnail. Two independent
defects under one symptom; fixed in sequence.

**Symptom 1 — RPC return shape.** `get_user_learning_state` (the RPC backing
the My Learning tab) was not projecting the cert-path tier's `name`,
`description`, or `thumbnail_asset_id` as flat columns. Frontend had no way to
render the tile.

A first attempt at the fix fully rewrote the RPC and accidentally introduced a
`GROUP BY` bug. Caught during verification (no production traffic hit it).
Recovered the known-good version by reading
`supabase_migrations.schema_migrations` for the Group Z m4 source
(version `20260516010830`), then applied a surgical edit:

- Migration `session85_get_user_learning_state_project_flat_tile_fields` — BROKEN attempt
- Migration `session85_revert_get_user_learning_state_to_z_m4` — rollback to last-known-good
- Migration `session85_get_user_learning_state_add_flat_tile_fields` — three targeted changes only: LEFT JOIN to `certification_paths` in the `v_assignments` CTE, flat `name`/`description`/`thumbnail_asset_id` in `v_assignment_rows` via `COALESCE(cp_*, curriculum_*)`, and the same flat fields propagated to `v_module_assignment_rows`.

Lesson locked as candidate standing rule: when a complex RPC needs a small
change, surgical edits with a diff against the live function definition. No
full rewrites from memory. (See §-candidate in architecture-reference v89.)

**Symptom 2 — trainee tier-thumbnail RLS gap.** Even after Symptom 1 shipped,
the tile still rendered the orange-circle placeholder. Root cause:
`content_assets_trainee_read` RLS policy anchored its EXISTS chain on
`content_items`. Tier thumbnails (cert_path, curriculum, module, resource) are
attached to entities where `content_item_id IS NULL`. The EXISTS clause
returned false; trainees could not read the thumbnail asset metadata, even
though the bytes were in a public-tier bucket and the thumbnail URL itself
would be readable if the trainee had a path to it.

Two migrations:

- `session85_align_content_asset_refs_trainee_read_status_filter` — changed `status = 'active'` to `status IN ('active', 'completed')` on the trainee read alignment, fixing an unrelated edge case discovered in the same recon.
- `session85_create_get_thumbnail_urls_for_entities_rpc` — new SECURITY DEFINER RPC `get_thumbnail_urls_for_entities(p_entity_type text, p_entity_ids uuid[])` returning `[{entity_id, asset_id, bucket, path, dominant_color}]`. Branches per entity_type: cert_path / curriculum / module require `is_published = true AND archived_at IS NULL` and accept any authenticated user. Resource branch mirrors `get_user_resources` is_visible rules with super_admin bypass.

The architectural decision: thumbnails are public-tier per §84. RLS on the
metadata when the bytes are world-readable is the wrong protection model. A
SECURITY DEFINER RPC that enforces "entity is published AND not archived"
(the actual access constraint) at the API layer is correct. This is a new
candidate standing rule (§-candidate in architecture-reference v89).

Frontend shipped via Lovable: new `resolveTierThumbnailUrls` and
`resolveTierThumbnailRows` helpers in `src/lib/assetUrls.ts`, called from five
sites — `MyLearningTab.tsx`, `ResourceGridTab.tsx`, `CertPathDetail.tsx`,
`CurriculumDetail.tsx`, `ModuleDetail.tsx`. Verified end-to-end against the
test cert path that was rendering blank.

### 4. Coach can't see client results (Bug 4)

Cheryl Kish could not load Edgar Vazquez Encarnacion's PTP results — page
flashed empty. Diagnosis: `src/pages/MyResults.tsx` line 437 queried
`coach_clients_client_view`, which filters
`WHERE client_user_id = auth.uid()`. The view is correct for client-side
callers but returns zero rows when the caller is the COACH viewing a client.

Three related fixes deployed in one Lovable PR:

- **Fix A** — `MyResults.tsx` line 437: `.from("coach_clients_client_view")` → `.from("coach_clients")`. The base table's RLS handles coach access correctly; the view was the wrong choice for this caller class.
- **Fix B-Level-2** — `src/pages/coach/ClientResults.tsx` Level 2 (`AssessmentList`) data fetch: extended the linked-id union to include `paired_assessment_id`, so paired PTP sibling rows surface in the tile list.
- **Fix B-Level-3** — `CoachResultsView` permission resolver:`.eq("assessment_id", X)` → `.or(\`assessment_id.eq.${X},paired_assessment_id.eq.${X}\`)`. Clicking a paired or personal tile no longer degrades to `score_summary` permission level.

Cheryl→Edgar verified end-to-end via impersonation: tile renders, click loads
the report, all three tabs (Professional / Personal / Combined) populated.
Standing rule (§-candidate in architecture-reference v89): coach-vs-client
view-vs-base-table discipline — `coach_clients_client_view` is for client
callers exclusively. Coach callers query the base table.

### 5. PTP paired-assessment UX consistency (Bug 5 — Option C2)

After Bug 4 shipped, a polish issue surfaced: Cheryl saw two visually
identical tiles for Edgar's paired PTP ("Personal Threat Profile / 5/14/2026"
twice); Edgar's own dropdown showed two entries ("PTP Professional" /
"PTP Personal"). Same underlying data, inconsistent UX shapes across coach and
client surfaces.

Decision locked — **Option C2**: paired PTP collapses to ONE user-visible
entity on BOTH surfaces. Coach tile labeled "Personal Threat Profile /
Professional + Personal · {date}". Client dropdown shows ONE umbrella entry;
if only paired PTP and no other instruments, dropdown hides entirely (the
in-PTP tabs ARE the navigation).

Lovable diagnose-then-implement cycle landed two file changes:

- **`src/pages/coach/ClientResults.tsx` Level 2** — extended `AssessmentInfo` with `context_type`, `paired_assessment_id`, `instrument_id`. Added `assessments` lookup for context info. Grouping pass with mutually-paired check (prevents retake collapse). Tile subtitle renders "Professional + Personal · {date}" for paired, "{Context} · {date}" for single. Click handler always sends the professional `assessment_id`.
- **`src/pages/MyResults.tsx` dropdown** — extended fetch with `paired_assessment_id`. Built `dropdownEntries` memo collapsing pairs. Visibility gate switched from `assessments.length > 1` to `dropdownEntries.length > 1` (so Edgar's dropdown hides when his only assessment is the collapsed paired PTP). Selected paired entry uses the professional `result.id`. Did NOT touch `effectiveSelected`, PTP tabs, Combined synthesis, narrative providers, PDF export, narrative status polling, `ptpContextTab` initialization, AI chat session anchoring, or the "Complete other half" prompt.

Mutually-paired check protects against retake collapse: only collapse when
each side's `paired_assessment_id` mirrors the other (which is how the DB
stores the link). Two professional retakes can never collapse together.

Verified end-to-end via impersonation: Cheryl sees one tile, three tabs work.
Edgar sees no dropdown (single collapsed entry), three tabs work, PDF export
from Personal tab generates the personal report.

## Decisions locked in Session 85

- **Cohorts are deferred indefinitely.** Q11 scoped them as schema-seam-only (the `cohorts` and `cohort_members` tables exist for forward compatibility); v1 UI was always a non-goal. Group C is closeable without cohorts. Re-opening requires a deliberate product decision, not implicit creep at Group C closeout.
- **Surgical edits to complex RPCs.** When a non-trivial RPC needs a small change, the correct approach is a diff against the live function definition (read via `pg_get_functiondef` or migration history) and a surgical edit. Full rewrites from memory introduce regression risk (Session 85 hit this — recovered cleanly via the migration history). Standing rule candidate.
- **Thumbnails are public-tier per §84. RLS on metadata when bytes are world-readable is the wrong protection model.** A SECURITY DEFINER RPC enforcing "entity published AND not archived" at the API layer is the correct architecture. Standing rule candidate.
- **Tier-archive cascades must whitelist the tier's `archive_reason` in the CHECK constraint before the cascade trigger can write.** Standing rule candidate.
- **`coach_clients_client_view` is for client callers exclusively.** Coach callers query the base table. Mixing them produces empty results because the view's WHERE clause filters on `auth.uid()` matching the CLIENT slot. Standing rule candidate.
- **Paired-PTP collapse pattern: mutually-paired check, not instrument-equality.** Use `paired_assessment_id` mirroring (each side points at the other) as the collapse predicate. Retakes do not mirror; the check protects against accidental collapse. Standing rule candidate.
- **RPC wrapper shape discipline (§111 reinforce).** Never cast a wrapper object directly to a bare array via `as unknown as`. Define proper wrapper interfaces matching the RPC's actual return shape; unwrap `.items` / `.preferences` / etc. at the call site. Session 84 hit this in the notification dropdown; Session 85 verified the discipline held.

## Discovered but not built — module reorder gap

During Session 85 recon, surfaced an asymmetry in the reorder RPC pattern:

- **Exists**: `reorder_content_items(p_module_id, p_ordered_item_ids[])` — drag-and-drop content items inside a module.
- **Missing**: `reorder_curriculum_modules(p_curriculum_id, p_ordered_module_ids[])` — to drag modules inside a curriculum.
- **Missing**: `reorder_certification_path_curricula(p_cert_path_id, p_ordered_curriculum_ids[])` — to drag curricula inside a cert path.

Frontend: `CurriculumEditor.tsx` (~lines 40-110) renders the attached modules
list with `display_order` as read-only text. No drag handle. No dnd-kit
wiring. Same gap in `CertPathEditor.tsx` for attached curricula.
`ModuleEditor.tsx` may also lack dnd-kit wiring on content items even though
the backend RPC exists; needs verification.

Scope approved: complete the pattern — build the two missing RPCs (same shape
as the existing one, SECURITY DEFINER, super_admin gate), wire dnd-kit
drag-and-drop in three editors. Estimated ~30 min backend + one full Lovable
cycle on the three editor files. Deferred to its own session — non-trivial
enough to deserve clean context, not tacked onto bug cluster.

## Untouched, carried forward to Session 86

- Notifications Phase 3 closeout — `results_available` firing-point wiring; paths A and B documented in Session 84 transcript but not yet executed. Need to recover the notes from Session 84 transcript or recreate before wiring.
- Phase 10 polish pass.
- After those two, Group C is closeable.
- AIRSA facet-interpretation generation gap investigation (Session 84 deferred).
- Messaging subsystem (prerequisite for `coach_messages` notification type).
- Module reorder gap (Session 85 discovery — scope approved, fresh session needed).
- MFA trusted-device feature (Session 84 logged).
- Editor thumbnail-loss-on-republish hardening (Session 84 logged).
- Coach-paid invitation email verification (Session 82 carryover).
- `create-checkout` graceful-degradation hardening (~60-day recurrence from Session 82 comp coupon).
- AIRSA Phases 3e-8.
- SOC 2 written policies.
- Action-Oriented Voice Redesign across six surfaces.
- Pricing-reads refactor.
- Corporate contract renewal schema change.
- Clarity Engine.
- Session 71 anon EXECUTE audit on 95 SECDEF functions.
- Post-launch `coach_clients_client_view` → SECURITY DEFINER RPC refactor.

Edge Function GitHub-sync carryover per §92: unchanged from Session 84.
No Edge Functions deployed via MCP this session; all backend work was
migrations and the new `get_thumbnail_urls_for_entities` RPC.

## Session 86 opening priorities, in order

1. **Notifications Phase 3 closeout.** Recover the Session 84 notes on the `results_available` firing-point wiring (paths A and B). Execute the chosen path. Flip `notification_types_catalog.is_v1_active = true` on `results_available` after the firing point is verified. Backend-first: confirm the firing-point write site reaches `notify_user` before drafting any UI.
2. **Phase 10 polish pass.** Deliberate sweep of the new Group C screens: empty states, loading skeletons, error boundaries on RPC calls, brand styling, accessibility baseline. Tag in scope before starting; do not let scope creep.
3. **Group C closeout.** After 1 and 2, Group C is closeable. Record the closure formally — what is owed vs. delivered vs. deferred.

After Group C closes, optional candidates for Session 86 budget if time
allows: the module reorder gap (~half session), coach-paid email verification,
or `create-checkout` hardening.

## Standing rules recap (Session 85 candidates)

These are recorded as §-candidates in architecture-reference v89 and are
operational immediately:

- **§114 candidate — UI cert-status gates must distinguish "no cert" from "in-progress with active cert-pool credit."** `canDoFeature = certified || (in_progress && hasActivePool)`. Session 85 Bug 1 hit this; the existing gates only checked `certified`.
- **§115 candidate — tier-archive cascades must whitelist the tier's `archive_reason` in the CHECK constraint before the cascade trigger can write.** Session 85 Bug 2 hit this on module archives.
- **§116 candidate — thumbnails are public-tier per §84.** RLS on metadata when bytes are world-readable is the wrong protection model. A SECURITY DEFINER RPC enforcing "entity published AND not archived" at the API layer is the correct architecture.
- **§117 candidate — `coach_clients_client_view` is for client callers exclusively.** Coach callers query the base table. The view's WHERE clause filters on `auth.uid()` matching the CLIENT slot; coach callers get empty results.
- **§118 candidate — paired-PTP collapse uses mutually-paired check, not instrument equality.** Each side's `paired_assessment_id` must mirror the other. Retakes do not mirror.
- **§111 reinforce — never cast wrapper objects directly to bare arrays via `as unknown as`.** Define proper wrapper interfaces; unwrap `.items` / `.preferences` / etc. at the call site.
- **Surgical edits to complex RPCs.** Diff against the live function definition; never rewrite from memory. (Process discipline; not a §-numbered rule.)

## Test fixture state at end of Session 85

Test org: BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`).

Three test users (look up current UUIDs via Supabase MCP; password is in
Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Bug 4 and Bug 5 used Cheryl Kish (production coach,
`cf3ccc21-a7e4-4b1b-bd77-b06c8add736e`) → Edgar Vazquez Encarnacion (production
client, `db586ec5-08f9-435c-89db-8e60d2240fe1`) for impersonation testing. No
fixture cleanup needed — those are real production accounts; impersonation
session for Cheryl was closed at session close via UPDATE on
`impersonation_sessions.ended_at`.

Bug 1 verification used Caroline Perry / Patrice Love / Ryan Carey — all real
production accounts with `coach_certifications.status = 'in_progress'`. No
fixture changes; the fix was frontend-only and they immediately benefited from
the corrected gate.

## Documents this session leaves behind

- `build-queue.md` v93 (new Session 85 close entry).
- `architecture-reference.md` v89 (§114 through §118 candidates plus surgical-edit process discipline).
- `session-85-to-86.md` (this document).

Markdown only — Session-74 decision. Cole uploads all three manually to
`cbastianBWE/brainwise-internal-docs` (flat repo root); GitHub MCP is
READ-ONLY.
