# BrainWise Session 152 to 153 Handoff

*Closeout: Session 152. Open: Session 153.*

## Where Session 152 left off

SCORM export shipped end to end (a backend-first four-step build). A SCORM 2004 4th Edition export pipeline: a `scorm_exports` ledger table + a private `scorm-exports` bucket, the `scorm-export` edge function (Class A auth, self-authenticating, verify_jwt false, 30/hr) that renders the SAVED lesson to static HTML and zips it as a valid single-SCO 2004 package returned as a 1-hour signed URL, and an "Export to SCORM" panel wired into the lesson blocks editor toolbar. The renderer walks TipTap to HTML, handles every current block type with graceful degradation (video to a note, knowledge_check/scenario to answer-revealed), bakes the lesson brand colors into static CSS, and inlines image/audio assets. SCORM 1.2 export, SCORM import, and the course/open API are queued for Session 153.

## Session 153 opening priorities, in order

### 1. Close the real-LMS validation gap (do this first)

Neither the minimal package nor the renderer has been through a real LMS yet (Cole skipped the manual console pre-test). The Export button now makes this a one-click in-app test: open the test lesson, click Export, Generate package, Download .zip, then import it at cloud.scorm.com (free account), launch, complete (scroll or the Complete button), and confirm the registration shows completed (and passed if a passed_* reporting pair was chosen). This is also the first live run of the authenticated generate path (the auth'd zip build, asset download/inline, storage upload, signed URL, and the non-fatal audit write could not be exercised without a super-admin token). If SCORM Cloud flags missing schema files, bundle the 2004 XSD set into the package (currently the manifest declares the namespaces + schemaversion but omits schemaLocation).

### 2. SCORM 1.2 export (the second emitter)

Additive to the existing `scorm-export` function, selected by the `scorm_version` body param (the ledger CHECK already allows `1.2`). Needs a 1.2 manifest builder (1.2 namespaces, `schemaversion 1.2`) and a 1.2 wrapper that discovers the `API` object (not `API_1484_11`) and uses `LMSInitialize` / `LMSSetValue` / `LMSGetValue` / `LMSCommit` / `LMSFinish` with the `cmi.core.lesson_status` model instead of 2004's `cmi.completion_status` + `cmi.success_status`. Map the four reporting pairs onto the single 1.2 `lesson_status` (passed / completed / incomplete / failed). The renderer, asset inlining, and the export panel's now-disabled "1.2" option stay as-is.

### 3. SCORM import (the heavy piece: a runtime, not a packager)

Accept a third-party SCORM zip as a content item. Materially heavier than export because it is a runtime: parse `imsmanifest.xml`, store the unzipped tree in a private bucket, serve it (a `scorm-serve` edge function signing the unzipped files, or signed-URL-per-file), render it in an iframe with a SCORM API shim (both `API_1484_11` for 2004 and `API` for 1.2) that maps the incoming CMI calls (`cmi.completion_status` / `cmi.core.lesson_status` / `cmi.score.raw` / `cmi.suspend_data`) onto `content_item_completions` and the §109 completion cascade. Likely needs a new `content_items.item_type` (e.g. `scorm_package`) with its presence/cleanup CHECKs (a new item_type does NOT trip §61, which is lesson-block-only). The main runtime risk is the API shim plus serving the unzipped tree privately. Read the current content-item + progress model so SCORM status maps onto the existing completion path rather than a parallel system.

### 4. Course API, then the open API it rides on

Hold until SCORM is done, per Cole's sequence. The course API is a read-mostly customer-facing surface; the open API is the versioned edge-function layer it rides on. The real work is productization: a stable versioned surface, authentication for external callers (API keys or OAuth client-credentials, distinct from end-user JWTs), per-key scoping + rate limits, audit, and a versioning commitment, calling existing read RPCs (get_module_detail, get_learning_report_detail, get_user_learning_state, curriculum/assignment reads) behind the Class A auth pattern. Settle at open: audience (customer org admins vs third-party developers), read-only vs read-write, and the auth model. Check first whether an API-key table already exists.

## Decisions locked in Session 152 (recap)

- Export FIRST, then import (export is a lower-risk packager touching no live learner surface).
- SCORM 2004 4th Edition FIRST, then 1.2.
- Export fidelity: a server-side STATIC HTML render of the lesson, NOT the live interactive renderer. Client-only presentation is preserved; backend-dependent interactivity (knowledge_check scoring, scenario branching) degrades to a static answer-revealed presentation; video degrades to a note (Mux mp4_support none cannot inline); audio (MP3) inlines.
- The export reads the SAVED `lesson_blocks`, so unsaved canvas edits are not included; the export panel surfaces this.
- `scorm-export` set verify_jwt FALSE (self-authenticating, Class A), matching the `openai-image-generate` precedent.
- The 2004 XSD schema files are NOT bundled (namespaces + schemaversion declared, schemaLocation omitted); add only if a target LMS requires strict validation.
- The audit write (`scorm_export_created`) is non-fatal: an export succeeds even if the audit log fails.
- Export settings mirror Articulate Rise: SCORM version, LMS reporting pair (Passed/Incomplete default, Passed/Failed, Completed/Incomplete, Completed/Failed), completion percentage (default 100, scroll-to-N%), exit-course link.

## Open questions / things to lock in Session 153

- SCORM 1.2 reporting: how the four 2004 reporting pairs collapse onto the single 1.2 `cmi.core.lesson_status`.
- SCORM import: a new `scorm_package` item_type vs reusing an existing type; how CMI completion/score maps onto `content_item_completions` and the §109 cascade; private serving of the unzipped tree.
- API: audience (customer org admins vs third-party developers), read-only vs read-write, auth model (API keys vs OAuth client-credentials), versioning + rate-limit posture; whether an API-key table already exists.
- None blocking; the real-LMS validation in priority 1 should be cleared before building 1.2 on top.

## Bugs surfaced in Session 152 added to Build Queue

- None new.

## What's NOT in scope for Session 153 (deferred / carried)

- The authenticated end-to-end generate and the SCORM Cloud import are Cole-side (priority 1 above); everything else builds on top once that is green.
- Carried, untouched: live OpenAI image generate (waits on the OpenAI org showing verified); live Mux round-trip of the lesson-block video upload; live ElevenLabs round-trip; live HeyGen end-to-end; per-supervisor company-dashboard disable toggle (BQ-SUPERVISOR-DASH); live Stripe refund test (waits on a real Stripe-paid transaction); the newsletter `STATIC_ROUTES` manual-update reminder whenever a new public marketing page is added; the Phase 4 newsletter editor Generate-with-AI control; formal Group C closure documentation.

## Architecture additions in Session 152

- Table `public.scorm_exports` (export ledger: rate-limit + audit; settings cols scorm_version [CHECK 2004_4th|1.2] / tracking_mode / completion_pct [1-100] / reporting_pair / exit_link; status queued|building|ready|failed; RLS super-admin SELECT + service_role ALL, authenticated SELECT only, anon revoked).
- Private bucket `scorm-exports` (50MB, zip mime; service_role ALL + per-user-folder read, mirroring departure-exports).
- Audit action `scorm_export_created` (content_authoring, is_mutation, requires_justification; inserted in the same migration per §99).
- Edge fn `scorm-export` (verify_jwt FALSE, self-authenticating; Class A auth + enforceImpersonationGate('permission_change'); 30/hr; input `{ content_item_id, scorm_version, tracking_mode, completion_pct, reporting_pair, exit_link }`; loads saved lesson_blocks + lesson_brands, resolves + inlines assets via `get_lesson_block_assets`, renders static HTML via a TipTap-to-HTML walker + per-block renderers + brand-baked CSS, zips via fflate, uploads to scorm-exports, returns a 1-hour signed URL; non-fatal audit via `log_super_admin_action`).
- Frontend: new `ScormExportPanel.tsx` + an Export toolbar button + 5 edits in `LessonBlocksEditor.tsx` (SHA-verified at main).
- No new standing rule (§1-§158 hold; §61 does not trigger because export is not a new lesson-block type). No new secret.

## Test fixture state at end of Session 152

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

The 42-block test lesson (item_type `lesson_blocks`) is the standard SCORM-export target; its content_item id is in Claude's userMemories, not in these public docs. No new fixtures or cleanup this session. No `scorm_exports` rows of consequence exist yet (the first real generate is Cole-side in Session 153).

## Documents this session leaves behind

- build-queue.md (v154)
- architecture-reference.md (v153)
- session-152-to-153.md (this document)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs (flat root). Upload all three via the GitHub web UI.
