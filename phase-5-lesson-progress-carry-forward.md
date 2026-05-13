# Phase 5 carry-forward — lesson sub-section progress + interactive-block gating

**Origin**: Session 65, Priority 1. Backend schema landed; trainee-facing behavior deferred to Phase 5 because the trainee renderer doesn't yet exist.

**Reconciliation note**: Originally drafted at Session 65 mid (when only three of the four v1 interactive block types had been designed — flashcards, scenario, knowledge_check — and several details about each were still unsettled). Updated at Session 65 CLOSE to reflect the locked v1 interactive block list of four types (adds card_sort), the corrected per-block-type completion_data shapes (scenario is LINEAR not branching, knowledge_check has 7 question types per block not single question, flashcards uses Got-it/Review-again self-rating not flipped/known), and the three new standing rules added at close (§69 plain-text choice cards, §70 knowledge_check-vs-quiz boundary, §71 nested-asset-ref walker pattern). Sections that didn't change in the locked design (the schema contract from Migration A + Migration B, the RPCs Phase 5 will add, the trainee renderer sub-section grouping + reveal-state derivation + Continue-click handler + gating evaluator, the 5 open questions) are unchanged from the Session 65 mid draft.

**What this doc is**: a single source of truth for everything the Continue-button + lesson-progress design committed to but couldn't ship in Session 65. When Phase 5 begins, read this first — it captures locked design decisions, schema contracts, and open questions so nothing has to be re-derived.

**What this doc is NOT**: a build queue. The actual sequencing of Phase 5 work belongs in build-queue.md. This doc is just the "what was decided and why" reference.

---

## Quick orientation

The Continue button is a `button_stack` button with `action_type: "continue"`. Authors drop it to mark sub-section breaks within a lesson. In the authoring view (shipped Session 65) it renders visibly but with no reveal behavior. In Phase 5, the trainee renderer needs to:

1. Read the lesson's blocks in document order
2. Group them into sub-sections delimited by Continue buttons
3. Show only the sub-sections the trainee has revealed (up to `lesson_furthest_continue_client_id`)
4. Enable/disable each Continue button based on gating policy
5. On Continue click: reveal the next sub-section, write progress to DB, scroll to it
6. Track per-block completion for interactive blocks (flashcards / card_sort / scenario / knowledge_check)
7. Allow free back-and-forth navigation between already-revealed sub-sections

The schema is ready for all of this. The renderer is not built.

---

## 1. Schema contract (shipped Session 65, NO MIGRATIONS NEEDED FROM PHASE 5)

### 1.1 `content_item_completions` — two columns added

```
lesson_furthest_continue_client_id  text       NULL  -- client_id of furthest Continue past
lesson_last_block_id                uuid       NULL  -- FK lesson_blocks(id) ON DELETE SET NULL
```

Both are meaningful only when the parent `content_item.item_type = 'lesson'`. NULL otherwise.

**`lesson_furthest_continue_client_id` semantics**:
- NULL = trainee has not advanced past any Continue button (still in first sub-section, OR lesson has no Continue buttons at all)
- Set = trainee has clicked through the Continue button with that `client_id`. All sub-sections up to and including the one ENDED by this Continue button are revealed; the next one (started by this Continue button) is the current sub-section.

**Important edge case**: if the stored `client_id` no longer exists in the lesson (author deleted that Continue button between trainee sessions), fall back to "show only the first sub-section." Don't guess at a near-match. Safer to under-reveal than over-reveal.

**`lesson_last_block_id` semantics**:
- NULL = no resume position recorded; renderer puts trainee at top of current sub-section.
- Set = lesson_blocks.id the trainee was last viewing. Renderer scrolls to that block on lesson re-open.

ON DELETE SET NULL: if the author deletes the block the trainee was last on, `lesson_last_block_id` becomes NULL automatically and renderer falls back to "top of current sub-section."

### 1.2 `lesson_block_progress` — new table

```sql
CREATE TABLE lesson_block_progress (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  completion_id   uuid NOT NULL REFERENCES content_item_completions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  block_id        uuid NOT NULL REFERENCES lesson_blocks(id) ON DELETE CASCADE,
  attempt_number  int  NOT NULL,
  status          text NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started','in_progress','completed')),
  completion_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

Indexes: PK, UNIQUE(completion_id, block_id, attempt_number), idx_user_item_attempt(user_id, content_item_id, attempt_number), idx_block(block_id), idx_completed partial WHERE completed_at IS NOT NULL.

**Who writes here**: only interactive block types. Confirmed v1 list (locked Session 65 close): `flashcards`, `card_sort`, `scenario`, `knowledge_check`. Future interactive types added in later phases will join this list. (Note: in Session 65 the schema shipped before all four block types were fully designed — the original carry-forward listed only three. The full v1 list is now four after the Session 65 design lock conversation; the schema accommodates the addition without changes.)

**Who does NOT write here**: every other block type — text, heading, callout, accordion, tabs, button_stack, stat_callout, statement_a_b, list, quote, divider, image, video_embed, embed_audio. Their "completion" is implicit (rendered = seen).

**`attempt_number` semantics**:
- Denormalized copy of `content_item_completions.attempts_count` at the time the row was written.
- On re-attempt, application increments `attempts_count` on `content_item_completions`, then writes new `lesson_block_progress` rows with the new `attempt_number`. Prior rows retained for history/audit.
- Querying "current attempt's block progress" requires `WHERE attempt_number = (SELECT attempts_count FROM content_item_completions WHERE id = ...)`. This will be common enough to consider wrapping in an RPC.

**`completion_data jsonb` per-block-type shapes** (locked Session 65 close — these are the v1 shapes the trainee renderer in Phase 5 will read and write):

| Block type | completion_data shape |
|---|---|
| flashcards | `{"cards_completed": ["c1","c2","c3", ...], "cards_review_count": {"c1": 0, "c2": 2, ...}}` — `cards_completed` is the list of card client_ids the trainee marked "Got it" (the completion criterion is every card in this list). `cards_review_count` is per-card count of how many times the trainee chose "Review again" before settling on "Got it" — useful for analytics. |
| card_sort | `{"final_score_pct": 100, "attempts_count": N, "incorrect_cards_history": [{"attempt": 1, "card_ids": [...]}, {"attempt": 2, "card_ids": [...]}, ...]}` — `final_score_pct` is always 100 at completion (completion criterion is 100% correct after any number of retries). `attempts_count` is how many "Check my answers" rounds it took. `incorrect_cards_history` retains which cards were misplaced on each attempt for analytics and revisit-pattern study. |
| scenario | `{"moments_submitted": {"<moment_client_id1>": {"type": "mc", "choice_id": "<choice_client_id>"}, "<moment_client_id2>": {"type": "reflection", "text": "<trainee's response, max 2000 chars>"}, ...}}` — one entry per moment; type discriminates MC vs reflection. For MC moments, `choice_id` is the client_id of the choice the trainee picked. For reflection moments, `text` is the trainee's submitted response. Scenarios are LINEAR (not branching) — there is no `path_taken`; all moments in the scenario are visited in order and each gets exactly one entry here. |
| knowledge_check | `{"answered": {"<question_client_id1>": {"type": "mc", "selected": ["<choice_id>"], "attempts": 1}, "<question_client_id2>": {"type": "fitb", "filled": {"blank_0": "value", "blank_1": "value"}, "attempts": 3}, ...}}` — one entry per question (1-5 per block). `type` discriminates which of the 7 question types this is (`"mc"`, `"multi_select"`, `"true_false"`, `"fitb"`, `"match"`, `"ranking"`, `"timeline"`). The shape of the trainee's response varies by type: MC/multi-select/true-false use `selected: ["choice_id", ...]`; FITB uses `filled: {"blank_0": "...", ...}`; match uses `pairs: {"<left_id>": "<right_id>", ...}`; ranking uses `order: ["<item_id>", ...]`; timeline uses `placements: {"<event_id>": position_index, ...}`. `attempts` counts how many retries the trainee took before this question was answered correctly. The completion criterion for the block is that every question is answered correctly eventually (`attempts >= 1` and the final response is correct). |

**Note on shape stability**: These four shapes are the locked v1 design from Session 65 close. They differ from the proposals that were drafted at Session 65 mid (when only three of the four block types had been designed and several details — like the self-rating model for flashcards and the linear-not-branching shape for scenario — were unsettled). The shapes above replace those proposals.

**Locked design note on knowledge_check**: knowledge_check is the only v1 interactive block type with `gating_required` defaulting to **`true`**. The other three (flashcards, card_sort, scenario) default to `false`. Authors can toggle per-block in the form (see §4). This default reflects the intended pedagogy: knowledge_check is a check-for-understanding that should gate progression by default; the other three are learning-tools that augment understanding without policing it. Quiz (a future content_item type, NOT a block — see new architecture-reference §70) is the high-stakes assessment surface that will reuse knowledge_check's 7 question types with scoring thresholds added on top.

### 1.3 RLS policies (shipped Session 65)

Six policies on `lesson_block_progress` matching `content_item_completions` exactly:

- trainee SELECT own (`user_id = auth.uid()`)
- trainee INSERT own NOT impersonating (`user_id = auth.uid() AND NOT is_impersonating()`)
- trainee UPDATE own NOT impersonating
- mentor SELECT assigned trainees (via `coach_mentor_assignments` active)
- super_admin ALL NOT impersonating on writes
- service_role ALL using `true`

Same pattern is already on `content_item_completions`; the two new columns there inherit those existing policies. No new RLS work needed for Migration A's two columns.

---

## 2. RPCs Phase 5 needs to add

**None shipped in Session 65.** Reason: no callers exist. The trainee renderer is what calls these RPCs, and it doesn't exist yet.

Three RPCs are anticipated. Names and signatures are proposals — Phase 5 owns the final shape:

### 2.1 `upsert_lesson_progress(p_content_item_id, p_furthest_continue_client_id, p_last_block_id)`

Writes to `content_item_completions`:
- Upserts the row for `(auth.uid(), p_content_item_id)`.
- Sets `lesson_furthest_continue_client_id = p_furthest_continue_client_id`.
- Sets `lesson_last_block_id = p_last_block_id`.
- Sets `updated_at = now()`.
- If row is new: also sets `status = 'in_progress'`, `started_at = now()`, `attempts_count = 1`.
- If row exists and was `not_started`: sets `status = 'in_progress'`, `started_at = COALESCE(started_at, now())`.

**Important**: this RPC should NOT touch `completed_at` or `attempts_count` on existing rows. Completion and re-attempts have their own RPCs (below) because the side effects differ.

### 2.2 `upsert_lesson_block_progress(p_block_id, p_status, p_completion_data)`

Writes to `lesson_block_progress`:
- Resolves `completion_id` by looking up `content_item_completions.id` for `(auth.uid(), <block's parent content_item_id>)`. If no completion row exists yet, create it via `upsert_lesson_progress` first (this RPC may need to do the creation inline, or callers may need to ensure the completion row exists first — design choice).
- Resolves `attempt_number` from `content_item_completions.attempts_count`.
- Upserts on UNIQUE (completion_id, block_id, attempt_number).
- Sets `started_at = COALESCE(started_at, now())` on first write.
- Sets `completed_at = now()` if `p_status = 'completed'` and `completed_at` was NULL.
- Sets `updated_at = now()` on every call.

### 2.3 `start_lesson_reattempt(p_content_item_id)`

Increments `content_item_completions.attempts_count` by 1, resets `lesson_furthest_continue_client_id = NULL`, `lesson_last_block_id = NULL`, `started_at = now()`, `completed_at = NULL`, `status = 'in_progress'`. Does NOT touch `lesson_block_progress` rows from prior attempts — those are retained via their `attempt_number` column.

Phase 5 must decide: does this RPC exist as a separate call, or is "start re-attempt" implicit in some other flow (e.g., a "Re-do lesson" button)? The UX hasn't been designed yet.

### 2.4 RPC permission grants

All three should be `SECURITY DEFINER`, `SET search_path = 'public, pg_temp'`, with `GRANT EXECUTE ... TO authenticated` and `REVOKE ... FROM anon`. Pattern matches every other progress-writing RPC in the codebase (no specific examples here but check `quiz_attempts`-related RPCs as the closest reference).

---

## 3. Trainee renderer responsibilities

The trainee renderer is the biggest piece of Phase 5 work. Below is the locked behavioral spec for the parts that relate to Continue buttons and progress. Other Phase 5 concerns (video playback, quiz attempts, written-response submission, file uploads, skills signoff) are separate and not covered here.

### 3.1 Sub-section grouping

Read lesson_blocks in `display_order`. Walk the list. A sub-section is the run of blocks between two consecutive Continue buttons (or between the start of the lesson and the first Continue, or between the last Continue and the end of the lesson).

```
[block A, block B, Continue X, block C, block D, Continue Y, block E]
                  ^^^^^^^^^^                    ^^^^^^^^^^

sub-section 1: [A, B, Continue X]   ← Continue X is the LAST block of sub-section 1
sub-section 2: [C, D, Continue Y]   ← Continue Y is the LAST block of sub-section 2
sub-section 3: [E]                  ← no terminal Continue; this is the final sub-section
```

The Continue button itself belongs to the sub-section it ENDS, not the next one. This matters for two reasons:
1. The button needs to be visible to the trainee in the current sub-section so they have something to click.
2. The "next sub-section" reveal logic needs to know which sub-section was just completed.

### 3.2 Reveal state derivation

From `content_item_completions.lesson_furthest_continue_client_id`:

```
let furthestId = completion.lesson_furthest_continue_client_id
let revealedThroughSubSection = 0  // 1-indexed count of revealed sub-sections

if (furthestId == NULL) {
  revealedThroughSubSection = 1   // first sub-section always visible
} else {
  // Walk sub-sections in order. The one ENDED by furthestId is the last completed sub-section.
  // The NEXT one is the current sub-section, also visible.
  for (i = 0; i < subSections.length; i++) {
    let lastBlock = subSections[i][subSections[i].length - 1]
    if (lastBlock.block_type == 'button_stack' &&
        lastBlock.config.buttons.some(b => b.action_type == 'continue' && b.client_id == furthestId)) {
      revealedThroughSubSection = i + 2   // i+1 is completed, i+2 is current
      break
    }
  }
  // If furthestId not found (button was deleted), fall back to revealedThroughSubSection = 1
  if (revealedThroughSubSection == 0) revealedThroughSubSection = 1
}

// Cap to total count
revealedThroughSubSection = Math.min(revealedThroughSubSection, subSections.length)
```

Render sub-sections `1..revealedThroughSubSection`. Hide `revealedThroughSubSection+1..end`.

### 3.3 Continue button click handler

When trainee clicks a Continue button in sub-section N:

1. Check gating policy (see §3.4). If not satisfied, button should be disabled in the first place — but defensive check on click is cheap insurance.
2. Call `upsert_lesson_progress(content_item_id, button.client_id, button.id)`.
3. Reveal sub-section N+1 (update local state).
4. Smooth-scroll to the top of sub-section N+1.
5. On the next page load, the schema will reflect the new state and `revealedThroughSubSection` will be N+1 naturally.

If sub-section N+1 doesn't exist (Continue button is in the last sub-section): treat this as "lesson complete." Call `upsert_lesson_progress` with the final Continue's client_id, then call a separate "mark lesson complete" RPC (Phase 5 designs this — likely an existing pattern from other content_item types like video). The trainee then sees whatever "lesson complete" UI Phase 5 builds.

### 3.4 Gating policy — Model X (`require_all_interactive_above`)

When `button.gating_mode === 'require_all_interactive_above'`:

1. Find all blocks in sub-section N (the one being ended by this Continue button).
2. Filter to blocks where `block.config.gating_required === true`. (Per the locked design: `gating_required` defaults to `true` for knowledge_check, and `false` for flashcards / card_sort / scenario. Author can override per block in the form.)
3. For each such block, look up its current-attempt `lesson_block_progress` row.
4. If every required block has `status === 'completed'`, enable the Continue button. Otherwise disable it.

UI affordance when disabled: tooltip or inline hint saying "Complete [block label] above to continue." Specific wording is a Phase 5 UX decision.

**Edge case**: a sub-section with no `gating_required = true` blocks always enables Continue (no blocks to check). This is consistent with `gating_mode === 'none'` semantics for that sub-section.

### 3.5 Back-and-forth navigation

Trainees can freely scroll between any revealed sub-sections. No additional UI control needed for "go back to previous sub-section" beyond scrolling — they're all on the same page once revealed.

If Phase 5 wants a left-side TOC (mentioned in the original design discussion), that's an additive UI feature, not a structural change. The TOC reads sub-section titles via:

1. Continue button's `section_title` field (if author entered one), else
2. First `heading` block's text in the preceding sub-section, else
3. "Section N" fallback.

The last sub-section has no terminal Continue button, so its title falls back to (2) or (3) since there's no Continue to read `section_title` from.

### 3.6 Block-level interactions

For interactive blocks (flashcards, card_sort, scenario, knowledge_check): each block's renderer is responsible for:

1. Reading its own current state from `lesson_block_progress` on mount (filtered to current `attempt_number`).
2. Rendering UI controls (flip cards, drag cards to buckets, choose scenario moment responses, answer questions across 7 types).
3. Calling `upsert_lesson_block_progress` when meaningful interactions occur.
4. Updating its visual state.

The block renderer doesn't need to know about the Continue button or sub-sections — it just reads/writes its own row.

**One coordination concern**: when a block transitions from `in_progress` to `completed`, the parent sub-section's Continue button should re-evaluate its disabled state. This means the trainee renderer needs some form of state propagation (React context, query invalidation, etc.) so the Continue button re-renders when a block it depends on completes. Phase 5 picks the mechanism.

**Image rendering for interactive blocks with nested asset refs**: three of the four v1 interactive block types can carry per-element image refs nested inside arrays — `flashcards.cards[N].back_image_asset_id`, `card_sort.cards[N].image_asset_id`, `scenario.moments[N].setup_image_asset_id`. Per §71 added to architecture-reference at Session 65 close, the platform uses a new `_walk_block_config_for_asset_refs` PL/pgSQL helper (designed for Session 66 backend work) and a reworked `get_lesson_block_assets` function to surface these asset_ids and their signed URLs. The trainee renderer for these blocks must:

1. Call `get_lesson_block_assets(content_item_id)` (or equivalent — Phase 5 picks the call surface; this may be folded into a broader lesson-load RPC). The result includes every active asset referenced by every lesson_block in the content_item, regardless of nesting depth, paired with bucket + path so the renderer can construct signed URLs.
2. For each interactive block, look up the asset_id values from the block's `config` JSONB at the nested paths (e.g., for a flashcards block read `block.config.cards[N].back_image_asset_id` for each card N).
3. Map each asset_id to its signed URL from the get_lesson_block_assets result.
4. Render the image inside the card / moment.

This is invisible to the per-block renderer's progress logic — the asset resolution happens at lesson-load time, not at interaction time. The renderer just consumes signed URLs that were resolved upstream.

---

## 4. `gating_required` flag — interactive block forms

**Where it lives**: in each interactive block's `config` jsonb, as a top-level boolean.

**Defaults** (locked Session 65 close):
- flashcards: `gating_required: false`
- card_sort: `gating_required: false`
- scenario: `gating_required: false`
- knowledge_check: `gating_required: true`

**Authoring UI**: each of the four interactive block forms (FlashcardsBlockForm, CardSortBlockForm, ScenarioBlockForm, KnowledgeCheckBlockForm) needs a checkbox or toggle labeled something like "Require completion to advance" with help text "When checked, the next Continue button in this section will be disabled until the trainee completes this block."

**Why this is deferred to Prompt 6c and not Session 65's Continue-button prompt**: the four interactive block forms don't exist yet — they ship in Prompt 6c (split across multiple Lovable prompts per the Session 65→66 handoff: flashcards first, then card_sort, then scenario, then knowledge_check broken into 2-3 question-type-family prompts). Adding the `gating_required` field to each block's config and form is one extra checkbox per form, low marginal cost. Doing it in Session 65 would require pre-creating the forms, which was out of scope.

**Note for Phase 5**: the trainee renderer's gating check (§3.4) reads `config.gating_required` directly. The flag is per-block, not per-block-type — so the trainee renderer needs to check `block.config.gating_required === true`, not "is this block a knowledge_check?". This keeps the policy explicit and author-controlled even when defaults are sensible.

---

## 5. Open questions Phase 5 must resolve

These were surfaced in Session 65 design discussion but deferred because they depend on trainee-renderer UX decisions that haven't been made.

### 5.1 Sub-section display mode

Three options were discussed:
- **B**: paginated (only current sub-section visible, plus Back button to revisit)
- **C**: collapsed (completed sub-sections shrink to a "✓ Section title" line, re-expandable)
- **TOC**: left-side rail listing all sub-sections, clickable

Cole expressed interest in "left-side TOC + collapse" — a hybrid. Phase 5 designs the actual UI. Whatever is picked, the schema doesn't change.

If a left-side TOC is built, it needs sub-section titles (see §3.5 for resolution chain). The `section_title` field on the Continue button (shipped Session 65) is sufficient for this.

### 5.2 Lesson completion semantics

When does a lesson count as "completed"? Three plausible rules:

- Trainee clicked Continue on the last Continue button in the lesson.
- Trainee scrolled past every block in the final sub-section (no Continue button defines its end).
- Trainee explicitly clicked a "Mark complete" button at the end.

The existing `content_item_completions.lesson_completion_mode` column (already in the schema, currently NULL/unused) was probably intended to hold this enum. Phase 5 defines the values and the trainee renderer respects them.

Until Phase 5 picks, the safest default: trainee clicked Continue on the last Continue button → `completed_at = now()`, `status = 'completed'`. If the final sub-section has no Continue (Continue is the LAST block of any sub-section that ends with one, but the FINAL sub-section may not end with one), then completion needs an explicit trigger.

### 5.3 Re-attempt UX

Phase 5 decides whether trainees can re-attempt a lesson, and if so, how. The schema supports re-attempts (attempts_count + attempt_number on lesson_block_progress) but doesn't require them. Three plausible behaviors:

- No re-attempts. Lesson is one-shot. Trainees who want to re-read just scroll through the already-revealed sub-sections.
- Re-attempt resets all sub-section reveal state but preserves history. Trainee starts fresh from sub-section 1; previous attempt's `lesson_block_progress` rows stay as audit trail.
- Re-attempt is per-block, not per-lesson. Trainees can re-do a flashcards block, re-sort a card_sort block, replay a scenario, or re-take a knowledge_check without resetting their sub-section progress.

These are mutually exclusive. Phase 5 picks.

### 5.4 Mentor visibility

Mentors can read `lesson_block_progress` and `content_item_completions` for their assigned trainees (RLS already permits). But what should they SEE in their mentor UI?

- Trainee X is on sub-section 3 of 7 in Lesson Y.
- Trainee X completed the knowledge_check in sub-section 2 with 100% on attempt 1.
- Trainee X has been on this lesson for 12 days (started_at to now).

Phase 5 designs the mentor-facing analytics. The schema supports all of the above; the queries and views are TBD.

### 5.5 Lesson-level audit log entries

Should trainee progress events (sub-section advanced, lesson completed, re-attempt started, gating block completed) write to `super_admin_audit_log` or a separate `trainee_activity_log`?

This is a SOC 2 question. The platform's standing rule is "every meaningful state change is auditable" but progress events are high-volume (every flashcard flip could write a row). Aggregating at the lesson-completion level may be sufficient; per-flip auditing may not be.

Phase 5 decides whether new action_types need to be added to `super_admin_action_types`, or whether progress writes are logged elsewhere, or whether they're not logged at all and just live in the progress tables.

---

## 6. Test fixtures Phase 5 will need

To validate the trainee renderer end-to-end, Phase 5 will need:

- A test lesson with multiple Continue buttons (at least 3 sub-sections) on test fixture content_item `32e0e966-4cb8-4e8b-abf8-5617de346f59`.
- At least one Continue button with `section_title` filled, one without.
- At least one interactive block (flashcards, card_sort, scenario, or knowledge_check, after Prompt 6c ships) with `gating_required: true` in a sub-section that has a Continue button after it.
- A test trainee user (one of the `testclientbwe+...@gmail.com` accounts) without super_admin privileges, so the trainee path can be tested under realistic auth.
- A `content_item_completions` row for the test trainee + test lesson — initially with NULL lesson_furthest_continue_client_id to test the "starting state" path.

Build these as part of Phase 5 setup, not as part of the schema migration. The migration doesn't seed data.

---

## 7. Things explicitly NOT in this carry-forward

The following came up in Session 65 design discussion but are explicitly OUT of scope for Phase 5's lesson-progress work:

- **Block-type-specific progress tables.** We chose Shape P (single `lesson_block_progress` with JSONB) instead of Shape Q (per-type tables). If Phase 6+ analytics needs per-type columns for query performance, add separate tables alongside `lesson_block_progress` without breaking it. Do NOT migrate Shape P → Shape Q.
- **Threshold gating** ("require 80% of flashcards flipped"). Out of Model X scope. If Phase 6 wants this, add columns to the Continue button's button shape and extend the gating evaluator.
- **Per-block gating ("pick which specific blocks gate this Continue")**. Out of Model X scope. The current policy is "all `gating_required=true` blocks above." If authors want finer control, that's Model Y and is a future addition.
- **Lesson-level pacing analytics** (time-on-section, scroll depth, etc.). Not blocked by Session 65 schema, but not designed yet. Phase 6+.
- **Resume position INSIDE a sub-section.** `lesson_last_block_id` provides "which block was I last viewing." It does NOT provide "scroll position within that block" (e.g., for long text blocks the trainee scrolled halfway through). If that fidelity is needed, add a `lesson_last_block_scroll_offset` column. Probably overkill.
- **Nested asset-ref backend rework.** The `_walk_block_config_for_asset_refs` PL/pgSQL helper, the rework of `replace_lesson_blocks`, and the rework of `get_lesson_block_assets` to surface signed URLs for images nested inside flashcards.cards / card_sort.cards / scenario.moments arrays are committed Session 66 backend work, NOT Phase 5 work. Phase 5 assumes those functions are already shipped and just CALLS `get_lesson_block_assets(content_item_id)` (or whatever the final read-side surface is) to get a flat list of (asset_id, bucket, path, kind) for every active asset in the content_item's blocks. See architecture-reference §71 for the standing rule and `session-65-to-66.md` for the verbatim backend recon that surfaced this concern.

---

## 8. Cross-references

- Build queue v71 (Session 65 CLOSE) — Continue button frontend ship + four block type design lock + Session 66 backend queue.
- Architecture reference v67 (Session 65 CLOSE) — Continue button + design lock + three new standing rules added at close: §69 (plain-text choice cards in scenario and knowledge_check), §70 (knowledge_check vs quiz semantic boundary — quiz is a future content_item type, not a block), §71 (nested-asset-ref walker pattern — `_walk_block_config_for_asset_refs` + indexed-path ref_field naming convention).
- Architecture reference v66 (Session 65 mid) — `lesson_block_progress` schema definitions + §67 (schema-first recon for progress features) + §68 (re-attempt history preservation pattern).
- `session-65-to-66.md` — full handoff with backend recon verbatim, four block type spec tables, Session 66 phased sequence.
- `_template.md` in this repo — session handoff template.
- Existing reference tables: `content_item_completions`, `quiz_attempts`, `coach_mentor_assignments`. The new schema follows these for RLS, indexes, and constraint patterns.

---

## 9. Sign-off check

Before Phase 5 begins lesson-renderer work, the lead should confirm:

- [ ] All decisions in §5 (open questions) have been resolved or explicitly deferred.
- [ ] The three RPCs in §2 have been designed in detail (parameter types, return shapes, error handling).
- [ ] At least one test lesson with multiple Continue buttons exists on the test fixture.
- [ ] Prompt 6c has shipped all four interactive block types (flashcards / card_sort / scenario / knowledge_check), each including the `gating_required` flag on its authoring form. Per Session 65→66 handoff this is expected to take 4-6 sessions, broken into one Lovable prompt per block type with knowledge_check potentially split further across its 7 question-type families.
- [ ] The Continue button author UI (Session 65 frontend prompt) has shipped, so test lessons can actually be authored with Continue buttons.

If any are unchecked, the trainee renderer work will hit a blocker that's cheaper to resolve upstream than mid-build.
