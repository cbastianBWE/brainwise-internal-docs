# Session 67 → 68 Handoff

**Closed: 2026-05-13**
**Subject: Flashcards image-flip backend, AI grounding fix, per-card background color support, draft-lesson-block author_prompt cap hot-fix**

---

## What Session 67 follow-up shipped

This session was a continuation of Session 66's interactive-block-types backend batch. Five distinct things landed, in order:

1. **Flashcards FRONT-image flip** — backend deploy of `draft-lesson-block` v9→v10. The locked design moved the optional image from BACK to FRONT of each flashcard (per design C1). Fields renamed: `back_image_asset_id` → `front_image_asset_id`, `back_caption` → `front_caption`. Schema, rules text, and `transformConfigForCanvas` flashcards branch updated. End-to-end regression test passed on test fixture `32e0e966-4cb8-4e8b-abf8-5617de346f59`.

2. **Frontend ship of Lovable Prompt 6c** — `prompt-6c-frontend-flashcards.md` (829 lines) was applied. Five files shipped to `cbastianBWE/brainwise-blueprint` `main` branch and verified via `curl` from `raw.githubusercontent.com`. Two cosmetic findings logged: `gatingRequired` prop declared but unused (Phase 5 future wiring), and "All cards reviewed" text duplicated in the progress panel + done panel. Neither blocks anything.

3. **Issue A — AI grounding fix** — `ai_authoring_context.platform_overview` row UPDATEd in place. Prior body listed instruments inline with `INST-001` / `INST-002` codes and glossed NAI wrong; new body includes the full canonical names (Personal Threat Profile, Neuroscience Adoption Index, AI Readiness Skills Assessment, Habit Stabilization Scorecard) pulled directly from `public.instruments` table. Five verification checks passed. AI Edge Functions read this row at runtime — no Edge Function redeploy needed.

4. **Issue C — per-card background color support** — backend deploys of `draft-lesson-block` v10→v11 and `expand-lesson-from-outline` v10→v11. Both functions added a `BRAND_COLORS` module-level `Set<string>` of the 8 locked brand hex values, added `"background_color": null` to the flashcards `BLOCK_SCHEMAS` per-card shape, documented the auto-pair text-color behavior in the rules text, extended `transformConfigForCanvas` flashcards branch to pass through `c.background_color` validated against `BRAND_COLORS.has(...)` (any other string coerced to `null`), and added a system-prompt rule that AI emits `null` always — author picks post-generation. Block parity §61 preserved between the two functions. `expand-lesson-from-outline` v11 also fixed a stale `v9` header that v10 had left behind.

5. **Critical hot-fix — `draft-lesson-block` v11→v12** — `AUTHOR_PROMPT_MAX_CHARS` raised from 4000 to 50000. **This was the bug that blocked the Refine flow for the rest of the session until fixed.**

### The author_prompt cap bug — full diagnosis

User reported "Edge Function returned a non-2xx status code" on Refine immediately after the v11 deploy. Two `400` statuses visible in the network panel under `draft-lesson-block:1`. First instinct was that the v11 deploy had introduced something. The actual cause was different.

Diagnosis path:

- **Synthetic anon request via `pg_net`** to the deployed function returned `401 invalid_jwt` cleanly. Function compiled, auth gate fired correctly, no syntax errors from the inline-paste deploy. Module-level code (including `BRAND_COLORS` Set + `BLOCK_SCHEMAS`) loaded fine.
- **Audit log query** for `ai_authoring_draft_generated` in the last 30 minutes: **zero rows**. Function was failing before the audit-log write step (which lives near the end of the success path).
- **Last successful `draft-lesson-block` flashcards call**: 17:33:45 UTC. v11 deploy was at 18:13 UTC. So the v11 deploy was not the cause — the system had been broken for 40 minutes before v11 went live.
- **Most recent successful flashcards Refine row in audit log** showed `author_prompt_excerpt` starting with `{"cards":[{"client_id":"d5df7722...` — meaning the frontend serializes the existing block config as JSON and sends it as `author_prompt`.
- **Active flashcards blocks on test fixture**: 4790 chars and 7851 chars (10 cards each).
- **v10/v11 validation gate**: `if (body.author_prompt.length > 4000) return jsonError(400, "author_prompt_too_long")`.

So: pre-existing 4000-char cap was sized for single-instruction Refine prompts. When the frontend switched to context-aware Refine that embeds the existing block config as the prompt, the cap broke for any flashcards block with substantial existing content. The bug had been latent since whenever the FE adopted that pattern; it only surfaced when the test fixture grew past 4000 chars of flashcards config.

Fix: deploy v12 with `AUTHOR_PROMPT_MAX_CHARS = 50000` extracted to a named constant. Single-character logical change. All other v11 logic preserved verbatim. Anthropic's input context easily accommodates 50K chars; the cap exists to reject pathological inputs, not to bound normal use. User verified Refine working end-to-end after v12.

### Edge Function final versions at Session 67 close

| Function | Live version | Notes |
|---|---|---|
| `draft-lesson-block` | **v12** | author_prompt cap raised to 50000; flashcards FRONT-image + background_color support; brand-color enforcement via `BRAND_COLORS` Set |
| `expand-lesson-from-outline` | **v11** | flashcards FRONT-image + background_color support; brand-color enforcement; v11 also fixed stale v9 header from v10 |
| `scaffold-lesson-outline` | v11 (unchanged) | |
| `scaffold-lesson` | v5 (unchanged) | |

---

## Pending work for Session 68

### Immediate (next session opener)

1. **Ship Lovable Prompt 6d** — `prompt-6d-flashcards-color-and-centering.md` (348 lines, drafted but not sent). Adds the per-card color picker UI + centered/larger flashcard text. Files modified: `blockTypeMeta.ts`, `FlashcardsBlockForm.tsx`, `BlockRenderer.tsx`, `lesson-blocks.css`. Reuses existing `BrandColorSwatch` component (at `src/components/super-admin/lesson-blocks/BrandColorSwatch.tsx`) with `palette="full"` + `allowDefault` props. Locked auto-pair lookup table (`FLASHCARD_TEXT_COLOR_FOR_BG`): null/Sand → Navy text; Navy/Orange/Teal/Mustard/Slate/Purple/Forest → White text. Twelve acceptance criteria including legacy-compatibility. No new dependencies.

2. **Verify after 6d ships** — author can pick a color via the swatch, the card front+back both render the picked color with auto-paired text, save round-trips through DB clean, legacy flashcards blocks (no `background_color` field at all) still render correctly.

### Post-launch structural fix (not blocking)

3. **Refactor FE to stop embedding existing block config in `author_prompt`.** The `lesson_context` field already exists in the `DraftRequest` schema for context-aware operations. Refine should move the config from prompt→lesson_context. This is the correct structural fix; v12's raised cap is a workaround that protects against the symptom but leaves the underlying design fragility in place. Logged as a post-launch Build Queue item.

### Housekeeping

4. **Stale draft row** on test fixture. One row in `lesson_block_drafts` with `content_item_id = 32e0e966-4cb8-4e8b-abf8-5617de346f59`, `author_id = 1d14e510-d0d0-4687-9741-4ddfc0c37253`, 20 blocks including 1 flashcards block. Cole can delete or resume editing as he prefers.

### Already queued (no change)

- AIRSA Phase 3e through 8 (BUG-1 `MyResults.tsx` `isAIRSA` detection always-false bundled into 3e).
- Group E deployment readiness items.
- Six security warnings from Lovable scan, deferred from Session 36.
- Phase 4.3 (email deliverability), 4.4 (smoke test), final publish action.
- Action-Oriented Voice Redesign across six surfaces.
- Pricing-reads refactor (eliminate hardcoded price IDs).
- Corporate contract renewal schema change.
- Phase 5 trainee renderer carry-forward (blocked behind the interactive-block frontend batch, which is now in flight via prompts 6c + 6d).

---

## Key learnings (Session 67 follow-up)

### Diagnosis discipline

- **MCP `Supabase:get_logs` for `edge-function` is broken in this project.** Returns `INVALID_ARGUMENT: User specified reservation projects/supabase-analytics-ext-queries/locations/EU/reservations/queries-short-12hr is not found.` Don't waste a tool call on it. Use `pg_net` synthetic HTTP requests + `super_admin_audit_log.after_value->>'edge_function'` filter for diagnosis instead.
- **`super_admin_audit_log` after-state column is `after_value` not `after_json`** (correction to a name I tried first). Full column list: `id, super_admin_user_id, action_type, company_id, affected_user_id, session_id, detail, created_at, ip_address, user_agent, reason, before_value, after_value, mode, expires_at, ended_at, end_reason`.
- **The right first question on a "function broke" report is "what does the response body actually say"** — not "what did I change last." In this case, the response body said `{"error":"author_prompt_too_long"}`, and the size math from the audit log made the cause obvious within a few queries. I went down the "v11 deploy must be the regression" path first because of how the user framed it; the audit-log timestamps disproved that framing within one query.

### Pre-existing fragility surfaced

- **`draft-lesson-block`'s `author_prompt` cap was sized for single-instruction refinement.** The frontend's later switch to context-aware Refine (embedding existing block config in the prompt for the AI to reason about) was never reconciled with this cap. The frontend should be using the existing `lesson_context` field; until that refactor lands, the 50000-char cap is the right buffer.

### Source-of-truth for instrument naming

- **`public.instruments` table is the canonical source** for instrument abbreviation → full name mapping. Not userMemories. Not any markdown doc. When updating AI grounding content (or anywhere else that references instruments by name), query `public.instruments` directly and use those values verbatim. Verified Session 67 — the four rows are:
  - INST-001 / PTP / **Personal Threat Profile**
  - INST-002 / NAI / **Neuroscience Adoption Index**
  - INST-003 / AIRSA / AI Readiness Skills Assessment
  - INST-004 / HSS / **Habit Stabilization Scorecard**

### In-place UPDATE for ai_authoring_context

- **`ai_authoring_context` rows are UPDATEd in place** despite the schema having a `version` column. The convention in this table is in-place edits (no historical row preservation, no `updated_at` column either). Don't insert a new row with bumped version; UPDATE the active row directly. AI Edge Functions read the active row at runtime — no redeploy needed after content edits.

### Block parity §61 preserved

- Both `draft-lesson-block` v11 and `expand-lesson-from-outline` v11 received the same `BRAND_COLORS` constant + flashcards background_color schema/transform additions in matching surgical-edit pairs. The two functions remain byte-equivalent for the flashcards canvas output path. Future changes touching flashcards (or any block_type) must preserve this parity per §61.

---

## Standing code-style patterns (unchanged from Session 66)

PL/pgSQL function structure, Edge Function structure, migration discipline, per-AI-Edge-Function role boundaries, and JSONB schema invariants for interactive blocks all carry forward from Session 66 unchanged. See `session-66-to-67.md` for the full list. The Session 67 follow-up work stayed within these patterns.

One pattern reinforced this session: **the named-constant extraction trick.** When raising a magic number (like the 4000 char cap), extract it to a named module-level constant first (`const AUTHOR_PROMPT_MAX_CHARS = 50000`), then reference it from the validation gate. This makes the new value greppable, the intent self-documenting, and any future tuning a one-line change.

---

## Tool/MCP notes for Session 68

Carry forward from Session 66:

- Multi-statement `execute_sql` returns only the last statement's result.
- `information_schema.columns` is insufficient for CHECK constraints — query `pg_constraint`.
- `deploy_edge_function` requires `verify_jwt: false` explicitly every deploy for custom-auth functions.
- `apply_migration` does not confirm DB state — verify with `execute_sql`.
- Lovable silent redeploys are real.
- GitHub MCP is READ-ONLY.

New for Session 67:

- **`Supabase:get_logs` for `edge-function` is broken — analytics endpoint returns `INVALID_ARGUMENT`.** Use `pg_net` synthetic requests + audit-log inspection instead. The pattern:
  ```sql
  SELECT net.http_post(
    url := 'https://svprhtzawnbzmumxnhsq.supabase.co/functions/v1/<function>',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer not-real'),
    body := '...'::jsonb
  ) AS request_id;
  -- Then in a separate execute_sql (pg_net is async):
  SELECT pg_sleep(2);
  SELECT status_code, content::text FROM net._http_response WHERE id = <request_id>;
  ```
- **`list_edge_functions` returns are stale within a single conversation.** After a `deploy_edge_function` call, subsequent `list_edge_functions` may still show the old version. Use `get_edge_function` against the specific slug for fresh state.
- **`super_admin_audit_log.after_value` (NOT `after_json`)** — column name verified Session 67.

---

## Key identifiers

- Supabase project ref: `svprhtzawnbzmumxnhsq`
- Super admin UUID: `1d14e510-d0d0-4687-9741-4ddfc0c37253`
- Test fixture content_item: `32e0e966-4cb8-4e8b-abf8-5617de346f59` (one stale draft row, 20 blocks with 1 flashcards block — Cole's discretion to resume or clean up)
- GitHub repos: `cbastianBWE/brainwise-blueprint` (app code, READ-ONLY MCP), `cbastianBWE/brainwise-internal-docs` (canonical docs at repo root, flat structure)
- Edge Function IDs (unchanged from Session 66):
  - `scaffold-lesson-outline` `5d52afb6-0f90-4e2e-a7c4-e65e78f6275a`
  - `scaffold-lesson` `76c6a445-2d78-4799-a15a-93cf5a283c7e`
  - `expand-lesson-from-outline` `05aa797e-552d-443c-8058-92f9f6ade576`
  - `draft-lesson-block` `a5094e4d-19e6-44cf-92e6-6ac783344c37`
- AI authoring context row: `10908e38-3947-4b4c-b0df-c9fd65ccb98a` (`context_name='platform_overview'`, updated in place Session 67 with new canonical body)

---

## Suggested Session 68 opening

Ship Lovable Prompt 6d. The drafted markdown is at `/mnt/user-data/outputs/lovable-prompts/prompt-6d-flashcards-color-and-centering.md` (348 lines, 15.4KB). Cole hands it to Lovable, Lovable applies the 4-file change set, then verify against the 12 acceptance criteria — particularly:

- Color swatch renders 8 saturated colors + a "Default" option.
- Picked color applies to BOTH faces of the card (one picker per card, not per face).
- Text color auto-pairs via the locked lookup table (null/Sand → Navy text; Navy/Orange/Teal/Mustard/Slate/Purple/Forest → White text).
- Flashcard text is larger (1.5rem) and centered both axes (Anki/Quizlet standard).
- Legacy flashcards blocks (no `background_color` field) still render with Default/Navy-on-Sand behavior.
- DB save round-trip preserves `background_color` per card.

After 6d ships and verifies, the interactive-block frontend batch is one step closer to closing. Remaining types: card_sort, scenario, knowledge_check (split into 2-3 prompts). Realistic estimate from Session 68 to all four block types fully shipped: 3-5 more sessions, one block type per Lovable prompt.

If 6d ships clean fast, opportunistic pickup is reasonable: either the structural fix to move flashcards Refine context from `author_prompt` to `lesson_context` (low risk, single-FE-file change), or one of the queued post-launch items.
