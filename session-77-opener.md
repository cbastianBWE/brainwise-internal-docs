# Session 77 Opening Prompt

Paste this as your opening message at the top of a fresh Claude conversation to start Session 77.

---

## Opening message (copy-paste below)

We are starting Session 77. Group Z (content item viewers) is the workstream — we ship Prompt 0 (unified viewer chrome) first, then each per-type viewer prompt in sequence until all 8 viewers are live.

**Session opening protocol (do this BEFORE responding to anything else):**

1. Read the three canonical docs from `cbastianBWE/brainwise-internal-docs` via GitHub MCP `get_file_contents`:
   - `build-queue.md` (current state, v84 at session open)
   - `architecture-reference.md` (current state, v80 at session open)
   - `session-76-to-77.md` (last session handoff)
2. Read the comprehensive scope doc from the same repo:
   - `content-item-viewer-scope.md` — this is the AUTHORITATIVE scope for all Group Z viewer work. Every Prompt's scope derives from a section of this doc.
3. Save all four locally at `/home/claude/internal-docs/` mirroring repo structure.

**Standing rules in effect (these do not change):**

- §59 overload-drop discipline
- §61-§100 (all standing rules, including §96 CHECK-constraint audit, §97 detach pattern, §98 duplicate pattern, §99 FK lookup tables for auditable actions, §100 structured response shapes)
- Lovable Credit Conservation Protocol — backend-first ALWAYS, verify before any Lovable prompt, gather actual code before writing prompts, single comprehensive prompts batching multiple files
- Closeout doc workflow — edit in place via str_replace, never rewrite at close, present .md files only (no docx)
- Test fixture credentials sanitized in repo; query Supabase directly when test UUIDs needed
- No em-dashes, no sycophancy, disagree directly first

## Session 77 workstream — finish Group Z viewers end-to-end

The order is fixed:

### Step 1 — Prompt 0 (unified viewer chrome + 3 viewers at FULL v1 quality)

This step ships the chrome AND three of the eight viewers at v1 quality (NOT stubs). Distinctive features per scope doc §3.1 / §3.3 / §3.5 are INCLUDED in this prompt, not deferred. After this step, 3 of 8 viewers are production-live (video, written summary, external link); 5 remain (quiz, skills practice, lesson blocks, file upload, live event).

**Backend recon first.**
- `view` the relevant Supabase tables and existing RPCs that the chrome needs to read (content_items, content_item_completions, modules, curricula, certification_paths, the cascade trigger machinery)
- Verify `get_user_learning_state` returns enough data for the cascade-detection diffing the chrome needs
- Identify exactly what the new `get_content_item_for_viewer(p_content_item_id)` RPC must return per scope doc §4.2
- Verify the existing Anthropic infrastructure for the video AI summary card distinctive feature (`generate-dashboard-narrative` or similar pattern in use)
- Verify the existing `draft-text` Edge Function (already used by authoring AI Draft buttons) can be reused for the written summary AI starter prompt distinctive feature
- Inventory `content_item_completions` columns to confirm what's there for `external_link_reflection_text` migration

**Backend migrations (4 total in this step):**

M1: `get_content_item_for_viewer(p_content_item_id)` — SECDEF, search_path locked, REVOKE anon / GRANT authenticated, no audit (read RPC).
- Returns content_item row + completion state + access check (trainee enrolled in parent module's curriculum/cert path) + "next item" hint (next content_item in same module trainee hasn't completed)
- For quiz items: caller will follow up with `get_quiz_for_trainee` — this RPC doesn't duplicate quiz Q&A data
- For lesson_blocks items: same pattern — caller follows up with `get_lesson_block_assets` (widened in Step 4)
- Smoke test end-to-end as a trainee user

M2: Additive migration — `ALTER TABLE content_item_completions ADD COLUMN external_link_reflection_text text NULL`. Plus extend `confirm_external_link` to accept optional `p_reflection_text` parameter (writes the column if non-null, ignores if null). Smoke test that existing single-arg callers still work and that new 2-arg form writes the column.

M3: Video AI summary cache. Either: (a) extend `content_item_completions` with `video_ai_summary_text text NULL` + `video_ai_summary_generated_at timestamptz NULL` for per-user-per-item caching; or (b) build a separate `video_ai_summaries` table keyed by (user_id, content_item_id). Decide which during recon. Smoke test the generation flow end-to-end calling whichever Edge Function the recon identified.

M4: Optional — verify whether written summary needs any new schema for AI starter prompt history tracking, or whether the prompt is ephemeral (just a one-off call to draft-text returning a string the trainee can copy). Default to ephemeral (no schema change) unless recon reveals a reason to persist.

**Frontend recon.**
- `get_file_contents` on existing detail page files (CertPathDetail, CurriculumDetail, ModuleDetail) — they have reusable hero band patterns
- Identify the abstraction interface for `useCompletionReporter` and `useAssetResolver` hooks per scope doc §2.3
- Read existing AI Draft button pattern from ContentItemEditor.tsx to inform the AI starter prompt UX for written summary viewer
- Note: this prompt is the FOUNDATION for all per-type viewers. Prompts 2-5 plug into the `item_type` branch the chrome provides.

**Frontend prompt (single comprehensive prompt batching chrome + 3 viewers + their distinctive features):**
- Per scope doc §5 (chrome contract) and §2.10 (foundational UX principles)
- Page at `/learning/content-item/:contentItemId`
- Include the abstraction hooks per §2.3 (SCORM/API export readiness)
- Three-tier celebration modal sequence per §2.10 with auto-dismiss timing
- Skip-allowed within-module navigation + Prev/Next chrome + "Next item" CTA wrapping rules
- Sidebar hybrid TOC (desktop open, mobile hamburger)

**Three viewers shipped at full v1 quality:**

(a) **Video viewer** per §3.1 — react-player install + all 5 source types (youtube_unlisted / vimeo / mux / cloudflare_stream / supabase_storage), 3-second back-step, variable playback speed 0.75x-2x, captions toggle where source provides them, resume from `video_last_position_seconds`, debounced progress reporting every 10s, completion at threshold (no un-complete on backup). Distinctive: AI summary card surfaced after completion, cached per scope doc §3.1.

(b) **Written summary viewer** per §3.3 — RichTextEditor textarea (compact variant), live character counter with min/max enforcement, submit button disabled until min met. Distinctive: AI starter prompt suggestion ("Help me get started" button → small dialog → trainee describes direction → AI returns starter sentence/outline they can use as jumping-off point, NOT a full draft). Calls draft-text Edge Function.

(c) **External link viewer** per §3.5 — URL preview, "Open link" button (target=_blank rel=noopener noreferrer), return prompt "Have you completed the linked content?" → `confirm_external_link`. Distinctive: optional reflection prompt textarea ("What did you take away from that?") submitted via extended `confirm_external_link` RPC with `p_reflection_text`. Completion fires regardless of whether trainee fills the reflection.

**Verify (proportional to scope — likely 20+ verification steps):**
- Chrome route renders for each of 3 item types
- Breadcrumbs correct at each nesting level
- Sidebar TOC opens on desktop, hamburger on mobile, jumps to other items
- Skip-allowed navigation: click a future content item, verify no gate
- Prev/Next chrome walks the module
- Next-item CTA wraps to next module / next curriculum / cert path end correctly
- Video viewer: each of 5 source types plays, resume position works, completion fires at threshold, AI summary card renders after completion
- Written summary viewer: char counter accurate, min enforced, AI starter prompt button generates and inserts content
- External link viewer: opens new tab, return prompt fires, reflection text persists when filled, completion fires when blank
- Cascade modal: content_item completion → micro-feedback only; force a module-completion edge case → modal renders with 3-5s auto-dismiss; force curriculum completion → require-dismiss modal; force cert_path completion → full-screen marquee
- Pause for Cole's review before proceeding to Step 2

### Step 2 — Prompt 2 (quiz viewer)

**Status:** Frontend prompt ALREADY DRAFTED in Session 76 at `prompts/prompt-2-quiz-viewer.md` (in repo). Backend RPCs `get_quiz_for_trainee` and `get_quiz_attempt_results` ALREADY SHIPPED + verified in Session 76.

**Pre-flight check:**
- Read the drafted prompt fresh
- Verify chrome contract from Prompt 0 actually matches what the prompt assumes — adapt if needed
- Confirm test fixture state is intact (test quiz `0e365d0e-81e6-4d28-a0fe-ccd749714a9d`, 4 questions, 1 attempt logged)

**Frontend prompt.**
- Send the (possibly adapted) prompt to Lovable
- Confirm Lovable's plan before approval

**Verify.**
- Walk the 14-step checklist baked into the prompt
- Pause for review before proceeding to Step 3

### Step 3 — Prompt 3 (skills practice viewer)

**Backend recon first.**
- Verify `mark_skills_practice_signoff` signature handles all 3 signoff types (trainee_only / mentor_only / both_required)
- Check whether new schema columns needed for the "Request revision" status distinctive feature (per scope doc §3.4)
- Verify `notify_user` infrastructure supports async mentor notification

**Backend migration (if needed for distinctive feature).**
- Per scope doc §3.4: additive migration for `skills_revision_comment text NULL`, `skills_revision_requested_at timestamptz NULL`, `skills_revision_requested_by uuid NULL`
- New status_type `revision_requested`
- Smoke test

**Frontend recon.**
- Identify FileUploadField reuse for `skills_optional_attachment`
- Check existing mentor view patterns

**Frontend prompt.**
- Per scope doc §3.4
- Three-mode flow (trainee_only / mentor_only / both_required)
- Async signoff — trainee never blocked
- Optional attachment via FileUploadField → `skills_attachment_url`
- Mentor "Request revision" status with comment field

**Verify.**

### Step 4 — Prompt 4 (lesson blocks viewer)

**Backend recon first.**
- Read `get_lesson_block_assets` source — currently super-admin-only
- Decide: widen with access-check logic OR build parallel `get_lesson_block_assets_for_trainee`
- Verify `upsert_lesson_block_progress` covers all 14 active block types' completion shapes

**Backend migration.**
- Either widen RPC or build parallel resolver
- Smoke test as trainee user against a real lesson_blocks content_item

**Frontend recon.**
- Read existing authoring-side `BlockRenderer.tsx` (82KB)
- Identify shared visual primitives to extract to `src/components/lesson-blocks/shared/`
- Map which of 14 block types reuse vs fork per scope doc §3.8

**Frontend prompt.**
- Per scope doc §3.8
- LARGEST prompt of the set — may need to split into 2 sub-prompts if too large for credit budget
- Forked trainee `LessonBlockRenderer.tsx` (NOT a wrapper around authoring BlockRenderer)
- Stepped reveal + Continue gating per `lesson_completion_mode`
- Furthest-position tracking
- Per-block knowledge_check evaluation
- "More content below" affordance (down chevron + fade gradient)
- Sidebar TOC within lesson

**Verify.**

### Step 5 — Prompt 5 (file upload + live event viewers, paired)

**Backend recon first.**
- file_upload has NO completion RPC yet — `submit_file_upload_completion` needs design
- live_event has `mark_live_event_attendance` already — verify it covers all RSVP states per scope doc §3.7
- Verify cron + Resend integration pattern from prior sessions for the reminder email

**Backend migrations.**
- M1: `submit_file_upload_completion(p_content_item_id, p_asset_id, p_filename, p_size_bytes)` — validates type, asset ownership, writes completion row, triggers rollup
- M2: Resend reminder cron — pg_cron job querying upcoming live_events 1hr out, sends via Resend, marks reminded to avoid duplicates
- Smoke test both

**Frontend recon.**
- FileUploadField reuse for file_upload viewer
- Calendar .ics generation pattern
- RSVP state machine wiring

**Frontend prompt.**
- Per scope doc §3.6 (file upload) and §3.7 (live event)
- Both viewers shipped together since both are simple

**Verify.**

## Approach reminders

- Backend-first means ACTUALLY ship the migration, verify it works via SQL, THEN write the frontend prompt
- Each step's verification happens BEFORE proceeding to the next step
- Pause for Cole's review after each frontend prompt verifies
- If any step reveals scope-doc inconsistencies, update the scope doc inline via str_replace, do NOT silently deviate
- Update build-queue.md and architecture-reference.md inline as decisions land mid-session, NOT at session close
- Lovable Credit Conservation Protocol applies to every Lovable prompt — single comprehensive prompts, gather actual code first

## What done looks like at Session 77 close

All 8 content item viewers live in production at `/learning/content-item/:contentItemId` with per-`item_type` branch routing. The chrome's cascade-collapse modal sequence works end-to-end. Trainee can complete a quiz, a video, a written summary, a skills practice, an external link, a file upload, a live event, and a lesson_blocks item — each producing the right completion record and the right tier of celebration modal.

If we can't finish all 5 prompts in one session, the natural break points are:
- After Step 1 (chrome + video + written summary + external link live at v1 quality) — 3 of 8 viewers production-ready, defensible release
- After Step 2 (+ quiz live) — 4 of 8 viewers; covers most-used content type
- After Step 3 (+ skills practice) — 5 of 8; completes the social-flow viewers
- After Step 4 (+ lesson blocks) — 7 of 8; completes the core learning experience
- After Step 5 (+ file upload + live event) — Group Z fully complete (8 of 8)

Open the session by reading the four docs, then propose the Session 77 plan based on what you find. Confirm the plan with me before starting Step 1.
