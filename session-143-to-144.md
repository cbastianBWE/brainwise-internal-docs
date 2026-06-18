# BrainWise Session 143 to 144 Handoff

*Closeout: Session 143. Open: Session 144.*

## Where Session 143 left off

INT-4, the `reveal_cards` interactive lesson-block type (Phase 3 of the Lesson Experience uplift), shipped end to end with full §61 5-surface parity. The block is a responsive GRID of click-to-flip two-face cards: the learner clicks a card to flip it (3D flip) from its front to its back, and revealing every card completes the block. It is STATELESS (no table, no block-specific RPC); completion rides the existing sticky `upsert_lesson_block_progress` path; an empty `items` block auto-completes; `gating_required` defaults false. Front AND back are independently brandable. Backend (two migrations) + frontend (one Lovable arc, SHA-verified at main `5a9e62c0`) + three versioned generators (draft v18 / scaffold v29 / expand v30, deployed and boot-probed) are all in. No new edge fn and no new table this session.

Cole has NOT yet run the in-app smoke test; his directive is to run a single full smoke test of ALL lesson-block changes at once next session. Phase 3 continues with INT-5 and INT-8.

## Session 144 opening priorities, in order

### 1. Cole's full lesson-block smoke test (do this first)

Cole is deferring one combined functional test to the start of Session 144, covering every lesson-block change shipped across the recent arc:

- **reveal_cards (INT-4):** in the AI authoring chat, ask for a short lesson that warrants reveal cards; confirm `scaffold-lesson-outline` proposes `reveal_cards` and `expand-lesson-from-outline` builds cards with front/back text (front_image_asset_id null, front_color/back_color null). Then hit "Refine with AI" on a reveal_cards block to exercise `draft-lesson-block`. If a brand is set on the lesson, confirm a branded front/back face still reads legibly (the renderer derives text color from face luminance).
- **hotspot (INT-3, carried from S142):** build a hotspot via chat (image resolved at outline review), run "Auto-place with AI", confirm trainee marker reveals + completion.
- **open_response (INT-1, carried from S140):** first live Opus round-trip + AI-authoring functional check.

If the smoke test surfaces anything, fix it before starting new INT work so it lands in the same arc.

### 2. Continue Phase 3 with the remaining new block types

Each is a NEW block type, so §61 5-surface parity is MANDATORY per type (lesson_block_types row + config schema; editor form + blockTypeMeta; BlockRenderer editor+trainee; draft-lesson-block; scaffold-lesson-outline + expand-lesson-from-outline). Remaining, lightest to heaviest:

- **INT-5 drag-to-order.** Drag items into the correct sequence. Precedent already exists: `card_sort` (dnd-kit bucket sorting) for the drag mechanics and the `knowledge_check` ranking/timeline question types for the ordered-answer model. Decide whether it is its own block or a thin wrapper over the ranking pattern, and whether it is stateless (like reveal_cards/hotspot) or stores attempts.
- **INT-8 activation poll.** A lesson-level cover poll. Architecturally distinct from the per-block types (a lesson-cover element, not an inline block), the heaviest of the remaining two, and should be built last. Lock where it lives (cover vs block) and how responses are stored before any build.

Verification per type: apply_migration then a separate execute_sql verify; boot-probe the three generators after Cole deploys them (OPTIONS 204 + no-auth POST 401); SHA-verify the frontend at the new HEAD.

## Decisions locked in Session 143 (recap)

- reveal_cards is STATELESS: no table, no block-specific RPC; completion via the existing sticky `upsert_lesson_block_progress` path; all cards revealed completes; empty `items` auto-completes; `gating_required` defaults false.
- It is a GRID of click-to-flip cards, deliberately NOT flashcards (one-at-a-time recall carousel with self-rating) and NOT an accordion (titled long-form sections). Chosen as a distinct type for risk isolation.
- Config schema is FLAT, array key `items`: `{ instructions, items:[{client_id, front, front_image_asset_id, front_caption, back, front_color, back_color}], gating_required, background_color, padding }`.
- Front AND back are independently brandable (`front_color`/`back_color`); text contrast is auto-derived per face via `readableTextColorForBg`.
- The per-card image follows the FLASHCARDS pattern (author uploads post-generation); the AI generators emit `front_image_asset_id` null; NO AiPane image-resolution and NO vision change (the key contrast with hotspot).
- Icon `Eye`.

## Open questions / things to lock in Session 144

- INT-5: own block vs wrapper over the ranking pattern; stateless vs stored attempts.
- INT-8: cover-level vs block-level placement and where poll responses are stored.

## Bugs surfaced in Session 143 added to Build Queue

- **FlashcardsBlockForm config-drop (candidate fix, logged, not actioned).** `FlashcardsBlockForm`'s emit returns only `{ cards, gating_required }`, dropping any top-level `background_color`/`padding` the block carried. `RevealCardsBlockForm` avoids this by spreading `...value` first. Fix flashcards in a future arc.

## What's NOT in scope for Session 144

- Phase 4 (INT-2 personalization / INT-6 branching / INT-7 confidence) and VIS-4 (media-beside-text two-column) until Phase 3 is complete.
- The standing carryforwards untouched this arc: SCORM export + API setup; BQ-SUPERVISOR-DASH; the Operations externalization arc; newsletter BUG-NWS-1 + Group H closure; the `newsletter-sitemap` STATIC_ROUTES manual-edit reminder (still standing whenever a new public marketing page or sitemap/SEO work comes up).

## Architecture additions in Session 143

Recorded in architecture-reference.md v144:

- `public.lesson_block_types` row `reveal_cards` (interactive, not scored, v1-active).
- `public._walk_block_config_for_asset_refs` extended: a `reveal_cards` branch walking `items[]` and emitting each card's `front_image_asset_id` (the one walker all three asset RPCs route through, so it covers ref-tracking + editor signing + trainee signing).
- No new table (stateless block) and no new edge fn this session.
- Generators versioned: `draft-lesson-block` v18, `scaffold-lesson-outline` v29, `expand-lesson-from-outline` v30 (all dashboard-paste; boot-probed OPTIONS 204 + no-auth POST 401).
- Doc-correction: the live flashcards block uses `cards[N].front_image_asset_id` (the image is on the card front, per the Session-67 flip); earlier docs said `back_image_asset_id`. reveal_cards matches `front_image_asset_id`.
- Candidate fix logged: the `FlashcardsBlockForm` lossy emit (above).

## Test fixture state at end of Session 143

Test org: BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`).

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Test lesson content_item: `e5c208f2-6885-482e-8d8b-8325f9cbaf5d`. No fixtures were created or left dirty this session (reveal_cards is stateless; no new table). The smoke test next session will create lesson content under this item.

## Documents this session leaves behind

- build-queue.md (v149)
- architecture-reference.md (v144)
- session-143-to-144.md (this document)

Markdown only (Session-74 decision; no .docx). Cole uploads all three manually to `cbastianBWE/brainwise-internal-docs` (flat repo root); GitHub MCP is READ-ONLY.
