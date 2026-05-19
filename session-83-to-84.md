# BrainWise Session 83 to 84 Handoff

*Closeout: Session 83. Open: Session 84.*

## Where Session 83 left off

Session 83 shipped the carried Priority 1 — super-admin manual completion
control — end-to-end, backend-first, plus a real bug found during testing of it,
an Edge Function change, and a full security-scan triage pass. Five backend
migrations applied and verified, one Edge Function deployed to v2, one
multi-part Lovable frontend feature shipped, one Lovable frontend follow-up
shipped, and the Lovable security scanner's three errors and six warnings all
dispositioned. Priorities 2 through 6 were not reached — the session budget went
entirely to Priority 1, the reverse-recount bug it surfaced, and the security
pass. They carry to Session 84.

## What shipped in Session 83

### 1. Super-admin manual completion control (Priority 1)

A super admin can now, from the UI, mark any learning entity complete or
incomplete across four tiers — content item, module, curriculum, cert path. An
existing forward-only rollup trigger chain cascades completions upward; this
feature adds the deliberate-override path.

Four design decisions were locked before any code:

- Reverse cascade stops at the curriculum tier. A reverse that would drop a
  curriculum sitting under an already-certified cert path is REFUSED entirely
  (error `manual_incomplete_blocked_certified_cert_path`).
- Combined-cert cascade is out of scope by construction — reverse never reaches
  `coach_certifications`, so there is nothing to un-certify.
- Forward marks the full subtree complete; reverse is target-plus-ancestor
  recompute and never touches children.
- Forward CAN certify via rollup; reverse can NEVER un-certify. The cert tier
  reuses the existing `grant_certification` / `revoke_certification` RPCs.

Five migrations, all applied to production and verified by separate
`execute_sql`:

1. `manual_completion_control_action_types` — three audit `action_type` rows.
2. `manual_completion_control_rpcs` — three public RPCs
   (`set_content_item_completion`, `set_module_completion`,
   `set_curriculum_completion`) plus three internal helpers. All SECURITY
   DEFINER, search_path locked, `assert_super_admin` +
   `assert_impersonation_allows('permission_change')` + reason ≥10 chars,
   idempotent, audit-logged.
3. `manual_completion_helpers_revoke_authenticated` — the three helpers made
   service_role-only.
4. `manual_completion_reverse_recount_fix` — the reverse-recount bug fix (see
   below).
5. `storage_policies_content_and_skills_buckets` — the security-pass storage
   migration (see below).

Frontend (shipped via Lovable): a fourth "Completion Control" tab on
`LearningAdmin.tsx`, a separate admin learning-tree component (not the shared
`MentorProgressTree.tsx` — ~150 lines of duplication accepted to keep the mentor
portal blast radius at zero), an artifact inspector showing each content item's
real submission per type, a confirm dialog, and impersonation-aware disabling of
mark actions. New files under `src/components/learning-admin/`.

### 2. Reverse-recount bug — found during testing, fixed, verified

Testing the new feature on a test coach surfaced a real bug. The
`set_module_completion` and `set_curriculum_completion` reverse paths hard-wrote
a downgraded status (`not_started` / `active`) instead of recomputing the tier
from its children. That produced incoherent states — a `not_started` module
sitting above six completed required items.

Decision locked (Option A): module and curriculum status must ALWAYS be
recomputed honestly from children, never hard-written. You change a parent's
status by changing its children, not by overriding it. Migration
`manual_completion_reverse_recount_fix` rewrote both reverse branches to recount
inline. "Mark incomplete" on a tier whose children are all complete is now a
no-op returning `changed:false` plus a `note`. Two corrupted rows on the test
coach were repaired. The bug got through the original Migration 2 verification
because the test matrix tested reverse-from-below but never reverse-at-the-tier.

A frontend follow-up shipped via Lovable: `CompletionConfirmDialog` was
discarding the RPC result and always showing "Marked complete/incomplete." It
now captures `data` and branches the success toast on `data?.changed === false`
to a neutral "No change" toast carrying the backend `note`.

### 3. Edge Function `content-item-file-upload` v1 -> v2

Deployed to v2, `verify_jwt:false` preserved. The `read` action now accepts an
OPTIONAL `target_user_id`; when present and not equal to the caller, it is
passed to `get_content_item_for_viewer`, which gates on super_admin / mentor.
Absent, the function is byte-identical to v1. Reason: a super admin needed to
view another learner's uploaded file in the new completion-control artifact
inspector; v1 was hardwired to the caller's own id. Verified by logic and probe
(anon -> 401, super-admin resolves another user's item, non-privileged caller
rejected). NOT yet verified by a live signed-URL browser round-trip — see
carryover.

### 4. Security-scan triage pass

The Lovable security scanner (flagged "Out of date") surfaced three errors and
six warnings. Lovable did an independent diagnose-only pass; Claude verified
every claim against the live database; the two sides agreed a fix split. Final
disposition:

- **E1 / E3** — `content-item-file-uploads` and `skills-practice-attachments`
  buckets had zero `storage.objects` RLS policies. REAL defense-in-depth gap, not
  exploitable (RLS on + no policy = default deny held; Edge Functions use
  service-role and bypass storage RLS anyway). Fixed this pass via migration
  `storage_policies_content_and_skills_buckets` — eight path-segment ownership
  policies (four per bucket). Path layouts verified against live objects:
  content bucket `{contentItemId}/{userId}/{file}` so user is segment 2; skills
  bucket `{contentItemId}/{role}/{userId}/{file}` so user is segment 3. Skills
  SELECT keys on segment 3 (a trainee may see both their own and the mentor
  feedback file under their own id); skills write policies additionally require
  segment 2 = `'trainee'`. Behaviorally verified — owner matches, non-owner
  blocked, trainee cannot write the mentor path. Path-segment match was chosen
  over the scanner-suggested table join — simpler, no per-access subquery, and
  consistent with the existing `departure-exports` policies.
- **E2** — "quiz answers readable" — NOT a bug. `quiz_answer_options` has only
  service_role + super_admin policies, no authenticated/public SELECT;
  `is_correct` is locked; the trainee path is `get_quiz_for_trainee`, which
  strips it. The scanner asked us to confirm a negative; confirmed.
- **W1 / W2 / W3** — three real XSS vectors (javascript: URLs in link hrefs,
  unsanitized HTML in resource articles, TipTap link XSS). Moderate severity —
  the writers are super-admin-only. Fixed by Lovable: `isSafeHttpUrl` in
  `src/lib/safeUrl.ts` is now the single allowlist used by all three href sites
  (`ExternalLinkViewer`, `ResourceReader` VideoEmbed, `BlockRenderer`
  button-block) and both TipTap `Link.configure` sites; resource articles are
  sanitized with DOMPurify (`USE_PROFILES: { html: true }`).
- **W4 / W5 / W6** — cohort / bulk-batch SELECT warnings. Design-intentional /
  deferred per the Session 73 dispositions. No work.

### 5. Q13 post-certification benefit hook — verified

Confirmed at Session 83 close: `apply_post_certification_benefits(uuid)` exists
as the v1 no-op placeholder the Group C scope (Q13) specifies — it stamps
`post_certification_benefit_applied_at`, is idempotent, carries the marked TODO
and the documented future fan-out, and returns `hook_version:'v1_noop'`.
`grant_certification` invokes it and logs the audit row. Q13 is satisfied for
v1; no Group C work is owed here. The full benefit build stays deferred until
subscription tiers are decided.

## Open items carried to Session 84

### Pending actions for Cole (scanner / GitHub)

- Mark E2, W4, W5, W6 as ignored in the Lovable security scanner with the
  rationale (E2 already secure; W4/W5/W6 are the Session 73 dispositions), then
  re-run the scan to confirm it comes back clean.
- Commit the `content-item-file-upload` v2 source to GitHub
  `cbastianBWE/brainwise-blueprint` at
  `supabase/functions/content-item-file-upload/index.ts`. GitHub MCP is
  read-only; Cole commits manually.

### Verification still owed

- One browser-console check of the file_upload signed-URL path as super admin
  in the completion-control artifact inspector. The Edge Function v2 was
  verified by logic and probe, not by a live signed-URL round-trip.

### Group C completion status (mapped this session)

A pass over the Group C scope (`BrainWise_Group_C_Scope_Coach_Certification_v1`,
the 10-phase plan) against the build-queue history v79-v90:

- **Cohorts are NOT owed.** Q11 scoped cohorts as "schema seam built; PTP
  launches self-paced; cohort UI deferred to v2." The `cohorts` and
  `cohort_members` tables exist (this is what security warnings W5/W6 referred
  to). There was never any cohort UI in Group C v1. Do not build cohort work to
  close Group C.
- **Phases 1, 2, 4, 5, 6, 7, 8, 9 — done** across Sessions 72-83 (schema, core
  RPCs, authoring, trainee learning UI, mentor portal, actor flow, order-
  assessment gating, Resources redesign).
- **Phase 3 Notifications — NOT done.** The known carryover. The schema and the
  `notify_user` primitive may exist in part, but no read surface (bell, panel,
  `/notifications` page, `/settings/notifications`) has been built. Multiple
  features write notifications with nowhere to read them.
- **Phase 10 Polish — NOT cleanly closed.** Most cross-cutting items (empty
  states, skeletons, error boundaries, brand styling) were absorbed per group
  as it shipped, but no deliberate Phase 10 pass has been done. The notification
  UI surfaces the scope lists under Phase 10 collapse into the Phase 3 work.
- Q13 — verified satisfied (see above).

So, to finish Group C: notifications (Phase 3 plus its UI surfaces), then a
deliberate Phase 10 polish pass. Caveat: phase completion was read off the
build-queue summaries, not re-verified live; if certainty is wanted before
declaring Group C closed, a short backend pass confirming the Phase 2 RPC set
and Phase 8 gating is the cheap check.

### Thumbnail sizing (answered this session)

Cole asked what size to upload thumbnails at, for cert paths / curricula /
modules / content items / resources. Answer, one spec for all five entity types
because they all flow through the single `Tile.tsx` primitive (§85):

**Upload 1280x720, 16:9, JPG or WebP, subject centered with edge margin.**

Reasoning: each thumbnail renders two ways. As a Tile it is `aspect-video`
(16:9) with `object-cover`. As a detail-page hero (cert path / curriculum /
module, identical code) it is a `bg-cover bg-center` banner, `320px` tall on
desktop and full content width, with a dark gradient overlay. Both renders crop
— the hero to a wide letterbox strip, the tile to 16:9 — so keep meaningful
content centered with margin and nothing important near the top or bottom edge.
1280x720 is the standard HD thumbnail size, crisp at every tile size and at 2x
on the hero well past its 320px height, ~100-250KB at JPG quality 80, well
inside the bucket's 10MB ceiling. 1920x1080 is the only upgrade worth
considering, and only if the hero looks soft on very large monitors. Use JPG or
WebP, not PNG — PNG is 3-5x larger for no gain on photographic images. Content
items and resources render as tiles only; resources have no image hero.

### Deferred Build Queue items added this session

- **Option B reverse-cascade-down.** Marking a module or curriculum incomplete
  and optionally cascading the downgrade DOWN to children. Session 83 shipped
  only the target-plus-ancestor-recompute (Option A); a cascade-down variant is
  a separate feature. The status-only vs full-wipe question for the child
  downgrade is still open.
- **`revoke_certification` combined-cert audit.** Confirm that revoking one
  component certification correctly handles the auto-derived Combined
  Certification — out of scope for the manual-completion feature by
  construction, but worth an explicit check.

### Untouched, carried

AIRSA Phases 3e-8, SOC 2 written policies, Action-Oriented Voice Redesign,
pricing-reads refactor, corporate contract renewal schema change, Clarity
Engine. Edge Function GitHub-sync carryover per §92 (the long-standing list)
plus the new `content-item-file-upload` v2.

## Session 84 opening priorities, in order

1. **Confirm cohorts are not needed**, then close that question — the Group C
   pass this session already concluded they are scoped-and-done (schema seam
   only, no UI in v1). Session 84 should formally confirm and record it so
   Group C closeout does not re-open it.
2. **Notifications** (Phase 3 + the Phase 10 notification UI surfaces) — the
   `notify_user` primitive and the read surfaces (bell, dropdown,
   `/notifications`, `/settings/notifications`). Backend-first: confirm what of
   the Phase 3 schema and `notify_user` already exists before drafting UI.
3. **Phase 10 polish pass** — a deliberate sweep of the new Group C screens:
   empty states, loading skeletons, error boundaries on RPC calls, brand
   styling, accessibility baseline.

After those three, Group C is closeable. Priorities not reached in Session 83
(coach-paid email verification, `create-checkout` hardening) also remain
available if budget allows.

## Decisions locked in Session 83 (recap)

- **Manual completion control: reverse stops at the curriculum tier.** A reverse
  that would drop a curriculum under an already-certified cert path is refused
  entirely. Forward can certify via rollup; reverse can never un-certify.
- **Reverse is recompute, not hard-write (Option A).** Derived parent status
  (module, curriculum) is always recomputed from children, never hard-written.
  Hard-writing a downgraded status produces incoherent states. "Mark incomplete"
  on a tier whose children are all complete is a no-op.
- **Separate admin learning-tree component.** The completion-control tab uses
  its own tree component rather than editing the shared
  `MentorProgressTree.tsx`. ~150 lines of duplication accepted to keep the
  mentor portal blast radius at zero.
- **Security storage policies use path-segment ownership, not table joins.**
  Ownership on `storage.objects` for the two content buckets is a path-segment
  equality match, consistent with the existing `departure-exports` pattern — no
  correlated subquery per object access.
- **Cohorts are scoped-and-done for Group C v1.** Schema seam only; no cohort
  UI was ever in v1 scope. No cohort work is owed to close Group C.
