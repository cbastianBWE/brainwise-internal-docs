# Session 162 to 163 Handoff

**Docs bumped:** Build Queue v163 to v164 (Session 162 DELTA banner). Architecture Reference v162 to v163 (header + v163 changelog entry). This handoff: session-162-to-163.md. Markdown only (Session-74 decision). Repo is flat-root; upload all three files to the repository root.

**Session shape:** Two queued items shipped: F1 (MFA trust-this-device) and G1 (quiz AI authoring). G1 was expanded from the narrow queued scope into a full quiz image subsystem plus an AI question generator across six layers. All backend applied and verified; all frontend shipped and GitHub-verified except the F1 in-app confirm, which Cole will run.

---

## F1 - MFA trust-this-device

**Status:** Backend complete and verified. Frontend delivered as two Lovable prompts. F1 in-app smoke test carried (Cole to signal).

**Decisions (locked):**
1. Login trust skips ONLY the login-time MFA challenge. The session stays AAL1; impersonation step-up is untouched.
2. Auto-revoke via two auth-schema triggers (password change on auth.users, MFA factor change on auth.mfa_factors).
3. Config in a singleton settings table.
4. Impersonation ALSO gets device trust, but a separate 7-day (168h) window versus the 30-day login window, and only for super admins. Cole insisted on this over the blast-radius objection; 7 days was the compromise.

**Schema:**
- `trusted_devices` (id, user_id FK auth.users CASCADE, token_hash unique SHA-256, label, created_at, login_trusted_at, impersonation_trusted_at nullable, last_used_at, revoked_at). RLS on, NO authenticated grants; all access via SECDEF RPCs.
- `trusted_device_settings` singleton (window_days default 30, impersonation_window_hours default 168, enabled default true, updated_by, updated_at).

**RPCs (nine, all SECDEF, search_path pinned, REVOKE PUBLIC+anon, GRANT authenticated+service_role):** mint_trusted_device (requires live TOTP via check_mfa_freshness, sets the impersonation clock only for super admins, returns the raw token once, hashes via extensions.digest), check_trusted_device, check_trusted_device_for_impersonation (super-admin only), reanchor_trusted_device_impersonation, revoke_trusted_device, list_trusted_devices, revoke_all_trusted_devices(uuid,text), get_trusted_device_settings, set_trusted_device_settings(int,int,boolean,text).

**Migrations:** f1_trusted_devices_tables_and_settings; f1_trusted_device_rpcs; f1_trusted_device_autorevoke_triggers; f1_trusted_device_admin_rpcs_reason_and_audit (DROP+CREATE to add reason params + audit writes); f1_register_trusted_device_action_types (registered trusted_device_settings_updated + trusted_devices_revoked_all in super_admin_action_types, category mfa_management, required by the super_admin_audit_log FK).

**Edge:** impersonation-start v17 (verify_jwt false preserved). Gate 3 accepts an optional device_token: passes if live MFA is fresh OR a valid impersonation device token is presented; re-anchors the impersonation clock on a live pass; MFA_REQUIRED response shape unchanged; fails closed.

**Frontend (delivered, pending in-app confirm):** localStorage key bw_trusted_device_token. Prompt 1 (user-facing): new src/lib/trustedDevice.ts + src/hooks/useTrustedDevices.ts; edits to Login.tsx, MfaChallenge.tsx, ImpersonationProvider.tsx, JustificationModal.tsx, Settings.tsx. Prompt 2 (admin): window-config card on src/pages/super-admin/PlatformFeatures.tsx; revoke-all on src/components/members/MemberDrawer.tsx.

**Verification:** All migrations applied then verified with separate execute_sql; two full rolled-back DO-block functional tests passed with zero residue; impersonation-start v17 boot-probed.

---

## G1 - Quiz AI authoring, expanded to a full quiz image subsystem + AI generator (six layers)

**Status:** All six layers complete and verified. Backend applied and SQL-verified; edge fns boot-probed; frontend GitHub-verified on main. G1 live in-app smoke test carried.

**Why it expanded:** The queued item was AI generation for item_type='quiz' content. Recon found quiz images absent end to end on the authoring side and match_picture hard-stubbed as unsupported in the trainee viewer, though the write path (upsert_quiz_question / upsert_quiz_answer_option) and the trainee read RPC already carried image columns. Cole chose the full bottom-up arc.

**Decisions (locked):**
- Path 1a (quiz rows carry asset-id FKs, resolved to signed URLs at read time, reusing the shared content-asset-ref system) over Path 2 (a parallel bucket). Chosen for consistency after extended deliberation.
- match_picture layout: text prompt on the left matched to a picture answer on the right; image on the answer option only.
- Bucket: the existing private lesson-assets bucket, signed at read time.
- Quiz image FK on-delete: CASCADE.
- Save-first image UX: image controls are disabled until the parent question/option row is saved, because both image edge fns require the parent row to exist. Matches ImageBlockForm.

**Layer 0 - asset-registrar generalization (migrations, all verified, full rolled-back functional test zero residue):**
- content_asset_refs gained quiz_question_id + quiz_answer_option_id (CASCADE FKs); the exactly-one-parent CHECK widened 8 to 10 anchors.
- request_asset_upload gained a quiz mode (now 19 args): ref-field whitelist question_image / option_image, bucket lesson-assets, path quiz/question|option/<id>/..., writes the quiz row's direct-column asset-id FK.
- reap_pending_uploads Sweep 2 gained the two quiz anchor branches with archived_at IS NULL liveness. WITHOUT this the daily cron would have swept every live quiz image.
- new _cascade_archive_asset_refs_for_quiz wired into archive_quiz_question + archive_quiz_answer_option.
- content_assets.archive_reason CHECK widened with quiz_question_archived + quiz_answer_option_archived.
- finalize_asset_upload is anchor-agnostic; unchanged.

**Layer 1 - quiz schema + trainee read (verified):**
- question_image_asset_id on quiz_questions, option_image_asset_id on quiz_answer_options (FK content_assets ON DELETE SET NULL).
- quiz_answer_options.option_text made nullable (image-only answers).
- upsert_quiz_question now 10-arg (added p_question_image_asset_id); upsert_quiz_answer_option now 9-arg (added p_option_image_asset_id); the option guard accepts option_text OR option_image_url OR option_image_asset_id.
- get_quiz_for_trainee returns question_image_asset_id + option_image_asset_id.
- new get_quiz_assets_for_trainee RPC (mirrors get_lesson_block_assets_for_trainee's access check exactly: self+assignment, mentor, super admin).
- edge fn get-quiz-asset-urls v1 (verify_jwt false, Class A, JWT-bound RPC access check then service-role signing, 2h URLs). Full read-path functional test passed, zero residue.

**Layer 2 - image pipelines (deployed, boot-probed):**
- lesson-ingest-pexels-asset v7 (parent-aware: content_item_id [lesson, byte-identical to v6] OR quiz_question_id OR quiz_answer_option_id; exactly one).
- openai-image-generate v3 (PARENT_PARAM gained quiz_question -> p_quiz_question_id, quiz_answer_option -> p_quiz_answer_option_id).

**Layer 3 - trainee render (shipped, GitHub-verified on main):**
- new src/hooks/useQuizAssets.ts (clone of useLessonBlockAssets pointed at get-quiz-asset-urls).
- new src/components/learning/quiz/QuestionRendererMatchPicture.tsx (image answer tiles keyed by option_image_asset_id via the signed map, text fallback, same pairing/lock/correctness as QuestionRendererMatch).
- QuizViewer.tsx: match_picture wired into the renderer, isAnswerComplete, and dot-state like match_definition; question-image header; imageUrlMap passed to multiple_choice + select_all; the unsupported stub removed. Option images on multiple_choice + select_all only (not true_false).

**Layer 4 - authoring (shipped, GitHub-verified on main):**
- new src/components/super-admin/quiz/QuizImagePicker.tsx (Pexels via newsletter-image-search + lesson-ingest-pexels-asset, DALL-E via openai-image-generate, disabled until the parent row is saved, reads e.context.json() for edge errors).
- new src/components/super-admin/quiz/MatchPictureOptionsEditor.tsx (text prompt + QuizImagePicker answer per pair).
- QuestionCard.tsx: match_picture added to QuizQuestionType, QUESTION_TYPE_OPTIONS, seedForType, validateQuestion, and the type-switch content check.
- asset ids threaded through DraftOption/DraftQuestion, useQuizAuthoring (10-arg question upsert, 9-arg option upsert), and QuizQuestionsEditor (rowsToDraft carry + saveQuestion pass-through).

**Layer 5 - AI generator (deployed, boot-probed, validator unit-tested):**
- draft-quiz-questions v1 (Class A, verify_jwt false, super-admin + impersonation gate, model via lms_authoring role -> Opus with hardcoded fallback via resolveModelId).
- Returns reviewable DRAFTS only, never writes the DB. Emits SHORT image_query strings (never URLs) for picture answers and optional question images.
- Server-side answer-key validation drops malformed questions: exactly-one-correct for multiple_choice/true_false, at least one for select_all, 2 to 6 balanced pairs for match types.
- No ai_usage write. ai_usage is a per-user monthly quota counter, not a per-generation ledger, and authoring is super-admin-only; accountability is the save-path audit log.
- Validator logic unit-tested in isolation with Deno: 14/14 cases passed.
- submit_quiz_attempt already grades match_picture identically to match_definition (pair-key equality + balanced-pairs count); no change needed.

---

## Four latent defects found and fixed this arc (all caught by functional tests)

1. quiz_answer_options.option_text was NOT NULL despite the RPC supporting image-only options.
2. The option text-or-image guard checked only the legacy URL column, not the asset-id FK.
3. The archive_reason CHECK had no quiz values.
4. reap_pending_uploads Sweep 2 would have swept every live quiz image because it did not enumerate the quiz anchors.

---

## Edge function versions this session

- impersonation-start v17 (F1 device-token gate)
- get-quiz-asset-urls v1 (new)
- lesson-ingest-pexels-asset v7
- openai-image-generate v3
- draft-quiz-questions v1 (new)

---

## Carried / next

- F1 live in-app smoke test (Cole to signal): trust a device at login, confirm the login MFA challenge is skipped within the window, confirm auto-revoke on password/MFA change, confirm the separate impersonation device trust.
- G1 live in-app smoke test: author a picture question with Pexels or DALL-E images, AI-generate a batch with draft-quiz-questions, then take the quiz as a trainee and confirm images render and pairing grades correctly. This single pass also serves as the live smoke test for Layers 2 and 5.
- Cosmetic known-nit (not fixed, not worth a Lovable credit): useQuizAuthoring mapQuizRpcError still maps option_text_or_image_required to "Each option must have text." (now inaccurate since image-only options are valid).
- Newsletter-sitemap STATIC_ROUTES reminder NOT triggered this session (no new public marketing pages).

## Standing discipline reminders (unchanged)

- Backend-first; apply_migration then a separate execute_sql verify; multi-statement execute_sql returns only the last result, so split verification queries.
- New SECDEF functions: REVOKE EXECUTE FROM PUBLIC, anon; GRANT authenticated, service_role; NOTIFY pgrst after new tables/RPCs.
- Adding a parameter to an existing function requires DROP of the old signature first.
- Functional tests: single rolled-back DO block with sentinel RAISE, zero residue.
- Edge deploys: verify_jwt passed explicitly every time; get_edge_function is authoritative for live source; boot-probe (OPTIONS 204/200, no-auth POST 401).
- Any new item_set or content_asset_refs anchor must widen every CHECK that enumerates them.
- Docs repo is flat-root; upload build-queue.md, architecture-reference.md, and this handoff to the root.
