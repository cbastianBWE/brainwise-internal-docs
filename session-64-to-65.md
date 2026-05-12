# Session 64 → 65 Handoff

**Session 64 closed**: 2026-05-12, ET evening
**Session 65 opens**: TBD (Cole's discretion)

## What Session 64 shipped

### Backend (3 Edge Function deploys)

| Edge Function | Was | Now | Key changes |
|---|---|---|---|
| `scaffold-lesson-outline` | v4 | **v5** | Request-aware specificity rule (don't pad with unrequested blocks when user names specific types); accordion/tabs 2-6 minimum stated in block intent guide; mandatory "end with important callout" rule loosened to natural ending |
| `expand-lesson-from-outline` | v4 | **v5** | accordion/tabs **CRITICAL min-2** rule in `BLOCK_SCHEMA_HINTS`; defensive pad-to-2 backstop in `transformConfigForCanvas`; button_stack gains optional `caption` field |
| `draft-lesson-block` | v5 | **v6** | Same min-2 rule for accordion/tabs in `BLOCK_SCHEMAS`; same defensive pad-to-2; button_stack caption field |

All `_shared/` modules byte-identical across deploys. All anon-probed clean (HTTP 401 `missing_bearer_token`).

### Frontend (4 Lovable prompts, all shipped & verified)

| Prompt | Size | Scope |
|---|---|---|
| 6b.1 | 27.7K chars | stat_callout + statement_a_b: BlockType union + defaultConfig entries, BlockEditorPane dispatch + scaffolding + siblingBlocks prop threading, EditorSlidePane/LessonBlocksEditor pass-through, ALL 5 render components in BlockRenderer with switch cases + data-block-client-id attribute, CSS for all 5 types, StatCalloutBlockForm + StatementABBlockForm |
| 6b.2 | 29.5K chars | accordion + tabs + button_stack forms: AccordionBlockForm (Enter-to-add shortcut, dnd-kit reorder, 1-6 sections), TabsBlockForm (2-6 tabs, reorder-aware default_tab adjustment, style RadioGroup), ButtonStackBlockForm (1-4 buttons, link/jump_to_block action swap, siblingBlocks dropdown with friendly per-block-type labels) + BlockEditorPane dispatch cases |
| 6b.3 | 11K chars | Tabs CSS attempt (failed centering) + button_stack `caption` field (Textarea form + render below buttons + defaultConfig entry) |
| 6b.4 | 6K chars | Pills/underline centering fix via inline Tailwind override pattern on TabsList/TabsTrigger className props, deletes obsolete `.bw-tabs-list-*` and `.bw-tabs-trigger-*` CSS rules |

### 5 new block types — fully live

| Type | Schema highlights | Locked decisions |
|---|---|---|
| **stat_callout** | `stat` (plain text e.g. "47%", "1 in 3", "$2.4M"), `label`, optional `body` | stat is plain text, never numeric — handles "1 in 3" and "5x" same as "47%" |
| **statement_a_b** | `a_label`, `a_body`, `b_label`, `b_body`, `variant` | Contrast (default): A=orange, B=teal borders. Neutral: both navy |
| **accordion** | `items[]` each with `client_id`, `title`, `body` | 2-6 sections, type="multiple" allowing multi-open, Enter-to-add-section shortcut |
| **tabs** | `tabs[]` each with `client_id`, `label`, `body`, plus `default_tab`, `style` | 2-6 tabs, reorder-aware default_tab. Styles: underline (default, learning-clean) / pills (app-UI feel). **Each tab visually separated with gap-2; tab strip horizontally centered above content** |
| **button_stack** | `buttons[]` each with `client_id`, `label`, `action_type` (link / jump_to_block), `url`, `target_block_client_id`, `variant`, plus `layout` (stacked/inline), optional `caption` | 1-4 buttons. Primary=orange, Secondary=navy outline. Caption is optional 240-char instructional subtitle |

### New standing rules (architecture-reference)

- **§65 — AI prompt-tightening pattern for multi-item block types.** When a block_type has internal items/tabs/sections with a minimum count requirement, that minimum must appear in THREE places: (1) outline-stage system prompt block intent guide saying "MUST have N-M items", (2) expansion-stage `BLOCK_SCHEMA_HINTS` marked **CRITICAL** inline within the JSON shape description, (3) defensive while-loop pad-to-min in `transformConfigForCanvas` as a backstop for when AI ignores the rule. Layered enforcement prevents degenerate output reaching the DB.

- **§66 — shadcn override pattern: inline Tailwind on `className` props, not custom CSS classes.** Custom CSS class names (e.g. `.bw-tabs-list-pills`) lose specificity battles against shadcn defaults applied via `cn()` merge (`inline-flex h-10 bg-muted p-1 rounded-md` on TabsList). When overriding shadcn component defaults, pass Tailwind utility classes directly on the component's `className` prop so they merge correctly. Custom CSS classes remain useful for additive styling that doesn't fight defaults (e.g. `.bw-stat-callout`, `.bw-button-stack-caption`).

### DB verification results (§63 close-out criteria — PASS)

Active lesson_blocks on test fixture (`32e0e966-4cb8-4e8b-abf8-5617de346f59`) after Session 64:
- **stat_callout × 1**: schema clean (`stat`, `label`, `body`), styled with `#E3EDED` bg + medium padding
- **statement_a_b × 1**: schema clean (`a_*`/`b_*`/`variant`), bold+italic marks preserved in B body
- **accordion × 2**: one 5-section AI-generated (real coaching content) + one 3-section AI-generated post-prompt-tightening
- **tabs × 3**: one manual 2-tab underline + one 4-tab pills AI-generated ("Listen deeply / Stay curious / Manage your ego / Hold the space") + one 3-tab underline AI-generated ("Safety / Insight / Change")
- **button_stack × 1**: pre-6b.3 (no caption key — graceful undefined handling confirmed)

**AI prompt-tightening confirmed working in production**: post-deploy AI output produces 3-tab + 3-section blocks where pre-deploy output had been degenerate 1-item blocks.

**Audit log**: 23 `ai_authoring_draft_generated` rows in last 24h across all 4 Edge Functions (`ai-authoring-chat`, `draft-lesson-block`, `expand-lesson-from-outline`, `scaffold-lesson-outline`).

---

## Session 65 opens with

### Priority 0: button_stack URL normalization fix (NEW Session 64 close)

**Status**: production bug discovered at Session 64 close when testing link-out buttons.

**Symptom**: User types `google.com` into a button_stack URL field. The renderer outputs `<a href="google.com">`. Browser treats this as a relative path and prepends current location, producing `https://brainwiseenterprises.com/super-admin/content-authoring/lessons/google.com` instead of going to google.com.

**Root cause**: `<a href>` with no scheme is a relative URL by HTML spec. Renderer at `BlockRenderer.tsx` `ButtonStackRender` passes user-typed URL directly to href without normalization.

**Fix**: at render time, normalize the URL before passing to href. If `url` is non-empty AND does NOT start with `http://`, `https://`, or `/`, prepend `https://`. Pseudocode:

```tsx
const normalizedUrl = url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")
  ? url
  : `https://${url}`;
```

Apply in ButtonStackRender where the existing `const url = b.url ?? ""` line is, before the `isExternal` detection. The isExternal check should remain based on the original `url.startsWith("http://") || url.startsWith("https://")` to correctly drive `target="_blank"` behavior — relative paths (starting with `/`) are internal routes, normalized-https URLs are external.

**Alternative consideration**: could ALSO normalize at save time in the form (Input onChange), but render-time normalization is safer because (a) it doesn't require migrating existing data, (b) author can still see and edit the raw URL they typed in the form, (c) the change is local to one render function with no schema/DB impact.

**Scope**: small surgical Lovable prompt — single file `BlockRenderer.tsx`, single function `ButtonStackRender`, ~5K chars. Ships before any other Session 65 work because it's a production-visible bug on every button_stack link button.

**Test**: after fix, type `google.com` in a button URL → click button → goes to `https://google.com/`. Type `/super-admin/dashboard` → stays internal. Type `https://example.com` → unchanged behavior. Type empty → button stays disabled (existing behavior).

### Priority 1: Gate-button action_type (PULLED FORWARD from Phase 5)

**Status change**: was deferred to Phase 5 trainee-learning-UI build; **now scheduled for Session 65 alongside 6c**.

**Scope**: add a third action_type to button_stack — `gate_to_next` (or similar; final name TBD) — that progresses the trainee through structured lesson stages. Requires understanding what "next" means: next block? next section? next lesson within a module? Likely just the simplest "scroll to next major section heading" or "advance to next module" wired to whatever progression infrastructure is available at Session 65 open.

**Open design questions** (resolve at Session 65 open):
1. What's the minimum "progression" the button needs? Just scroll-to-next-heading? Or actual completion tracking?
2. Does it require new DB schema (e.g. `lesson_progress` table) or is it purely UI navigation?
3. Naming: `gate_to_next`, `continue`, `advance` — which reads best to authors picking from the action_type RadioGroup?
4. Should it be a separate `action_type` value, or a `link` with a special URL pattern like `/lesson/next-section`?
5. How does it interact with the existing `siblingBlocks` Select for `jump_to_block`?

**Likely separate prompt** from 6c — both can ship in Session 65 but as distinct Lovable prompts. Sequencing:
- 6c first (flashcards / scenario / knowledge_check — likely 2-3 prompts, possibly more)
- gate-button next (smaller scope, depends on 6c being clean first to avoid stomping siblingBlocks logic)

OR reverse order if gate-button is small/independent enough — to be decided at Session 65 open based on scope walkthrough.

### Priority 2: Prompt 6c — flashcards / scenario / knowledge_check

The 3 remaining block types from the original v1 catalog of 17 (current whitelist is 14 of 17). Block-by-block design decisions needed before writing prompts:

**flashcards**:
- Front/back content shape (rich text both sides? image on front?)
- Flip animation (CSS 3D transform or library?)
- Card-to-card navigation (next/prev buttons, swipe, auto-advance?)
- Completion criteria for Phase 5 progression tracking (flip all cards? mark known/unknown?)

**scenario**:
- Branching graph vs linear-with-decisions vs choose-your-own-adventure?
- Resolution shape (does it end with a callout? a knowledge_check?)
- Storage structure (one block with embedded graph, or one block per node?)
- Revisit behavior (can trainee re-do? saved state?)

**knowledge_check**:
- May overlap with Phase 4 quiz authoring infrastructure
- Likely simpler than flashcards/scenario
- Single question + answer reveal? Multiple choice? Free-response?

### Concern A (§61) — STATUS UPDATE

The "backend-ahead-of-frontend block parity" concern from Session 63 is now **CLOSED for 5 of the 8 new types**. Remaining gap for flashcards / scenario / knowledge_check — Edge Functions don't yet whitelist these because frontend isn't built. When 6c ships, expand the `ALLOWED_BLOCK_TYPES` array in `scaffold-lesson-outline` + `expand-lesson-from-outline` + add schemas to `draft-lesson-block` `BLOCK_SCHEMAS`.

---

## Build queue snapshot at Session 64 close

**Active priorities (Session 65)**:
1. **Priority 0** — button_stack URL normalization fix (production bug, single-file surgical)
2. Gate-button action_type (pulled forward from Phase 5) + 6c block types (flashcards / scenario / knowledge_check)
3. Post-launch test of internal-link routing in button_stack (production push needed to test — separate from URL normalization fix)

**Remaining Phase 4 (deployment readiness)**:
3. Group E deployment readiness items
4. Six security warnings from Lovable scan deferred from Session 36
5. Phase 4.3 (email deliverability), 4.4 (smoke test), final publish

**Post-launch**:
6. Action-Oriented Voice Redesign across six surfaces (NAI dashboard UI/PDF, PTP dashboard UI/PDF, NAI individual results UI/PDF, PTP individual results UI/PDF)
7. Pricing-reads refactor (eliminate hardcoded price IDs in favor of `subscription_plans` lookups)
8. Corporate contract renewal schema change (drop `UNIQUE (organization_id)`, add `is_current` semantics)
9. Clarity Engine (featured in marketing) not yet built

**SOC 2 roadmap**: written policies deferred until feature-complete; technical security work (pre-pen-test code review, quarterly security runbook) ongoing in parallel.

---

## Session 64 prompt artifacts (in repo)

All four Lovable prompts at `/docs/lovable-prompts/session-64/`:
- `prompt-6b-1-stat-and-statementab.md` (27.7K) — shipped & verified
- `prompt-6b-2-accordion-tabs-buttons.md` (29.5K) — shipped & verified
- `prompt-6b-3-tabs-css-and-button-caption.md` (11K) — shipped (partial: caption ✅, tabs CSS deferred to 6b.4)
- `prompt-6b-4-tabs-centering-fix.md` (6K) — shipped & verified

---

## Working style invariants (re-locked)

No em-dashes. Backend-first always. Backend recon before any fix. SQL verification after every backend deploy. Closeout docs edited in place via `str_replace` as decisions land, never full rewrites. Markdown-only closeouts unless explicitly requested otherwise. GitHub MCP READ-ONLY — Cole uploads manually at session close via web UI drag-and-drop. AI Edge Function rule: each multi-item block type's minimum count enforced in 3 places (system prompt + schema hint + transformConfigForCanvas backstop) per new standing rule §65.
