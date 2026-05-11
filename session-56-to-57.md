# BrainWise Session 56 to 57 Handoff

*Closeout: Session 56. Open: Session 57.*

## Standing operating protocol — applies every session

### Lovable Credit Conservation Protocol

Before writing any Lovable prompt:

1. Ask for all relevant current code sections. Never write a prompt based on assumed code.
2. Do Supabase/backend work first — SQL, RLS, Edge Functions, RPC. Verify it works before touching Lovable.
3. Diagnose before prescribing — gather evidence (logs, DB state, actual code) before writing a fix.
4. Think through the complete feature lifecycle upfront. Handle all cases (all user paths, edge cases, state cleanup) in one prompt. Never send a partial fix that leaves adjacent cases unhandled.
5. Only write the Lovable prompt when the backend is verified and the exact frontend code to be modified has been seen.
6. If something can be done in Supabase or another connected system, do it there first and confirm it works before going to Lovable.

### Branding recon — standing protocol (locked Session 55)

Before writing any Lovable prompt, the recon checklist requires three passes:

1. **Backend recon** — schema, RLS, RPCs, Edge Functions verified
2. **Frontend recon** — existing components, routes, hooks, shared utilities cached locally
3. **Branding recon** — actual brand tokens, typography, and design patterns pulled from source

See architecture-reference §30 for full detail.

### FK-disambiguation recon — NEW standing protocol (locked Session 56)

Before writing any embedded PostgREST select on a join table, enumerate FKs:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.<join_table>'::regclass
  AND contype = 'f'
  AND confrelid = 'public.<parent_table>'::regclass;
```

If more than one row returns, the embed MUST use `!<column_name>` syntax. See architecture-reference §33.

### Closeout document workflow

Source-of-truth at https://github.com/cbastianBWE/brainwise-internal-docs.

**Session opening protocol.** Read three canonical documents from GitHub at start of each session:

1. `build-queue.md` — current Build Queue (v59 at Session 56 close)
2. `architecture-reference.md` — current Architecture Reference (v55 at Session 56 close)
3. `session-56-to-57.md` (this file)

Save locally at `/home/claude/internal-docs/` mirroring repo structure (flat, no `docs/` subdir).

**During the session.** Edit in-memory markdown via targeted edits — not full rewrites.

**Session close.** Create new handoff, bump version markers, present markdown bundle for manual GitHub upload via web UI.

**GitHub MCP write limitation.** Read-only. Do not attempt `create_or_update_file` — returns 403.

**Sanitization rules.** brainwise-internal-docs is public. Never include passwords, API keys, tokens, secrets, plaintext test-user UUIDs, production emails, Stripe IDs, or DB connection strings. Architectural details are fine.

**Test fixtures.** Test org: BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`). Test users: testclientbwe+orgmember@gmail.com, +supervisor@, +employee@. Test password in userMemories.

### Communication preferences (standing rules across all sessions)

- No em-dashes
- No sycophantic openers
- No performative metacognition
- Direct answers; disagree first then soften
- Backend verified end-to-end before any Lovable prompts are written
- Lovable credit conservation: batch frontend changes into single prompts covering multiple files

## What shipped Session 56

### Backend

**Migration: `slug_unique_only_among_active_for_authoring_tables`**

Dropped global `*_slug_key` UNIQUE constraints on `certification_paths`, `curricula`, `modules`. Replaced with partial unique indexes `(slug) WHERE archived_at IS NULL`. Matches `lesson_blocks_active_order_uniq` pattern. Discovered when Cole archived PTP-Coach and tried to recreate — 23505 toast incorrectly suggested active-slug collision. Archive-recreate cycle now works; active-active slug collisions still rejected with 23505.

content_items doesn't have a slug column, so no change there. When Prompt 4 (Module editor) lands, the module side of this is already covered.

**No new Edge Functions deployed Session 56.** The three AI authoring functions deployed Session 56 Step 1 (`draft-lesson-block` v1, `scaffold-lesson` v1, `draft-text` v1) remain ACTIVE; live verification deferred to Lovable Prompt 5.

### Frontend — ContentAuthoring.tsx growth this session

- Pre-session: 473 lines
- Post-Prompt 2 (Cert Path editor): 1130 lines
- Post-Prompt 3 (Curriculum editor): 1897 lines
- Post-Prompt 3.4 (final bug-fix cycle): ~2000 lines

**Prompt 2 — Cert Path editor.** Verified end-to-end against 15 acceptance criteria. Sub-components: `CertPathEditor`, `AttachedCurriculaSection`. Sentinel parsing: `cp:new`, `cp:<uuid>`. 4-instrument Checkbox grid (PTP/NAI/AIRSA/HSS only — EPN excluded). PTP-Coach cert path created and archived/recreated during testing.

**Prompt 3 — Curriculum editor.** Verified end-to-end against 20 acceptance criteria. Sub-component: `CurriculumEditor`. Sentinel parsing: `cu:new`, `cu:new:<cert-path-id>`, `cu:<uuid>`. `upsert_curriculum` handles curriculum + optional attachment in single transaction (returns `{curriculum, attachment}` jsonb). "Add curriculum to this path" Dialog with two tabs: "Pull in existing" (author-configurable display_order + is_required defaults, display_order seeded to next-available position to prevent collisions) and "Create new" (routes to `cu:new:<cp-id>` sentinel). Key prop on all four editor JSX usages fixes useState-stale-on-mount.

**Prompt 3.1 — Auto-expand parent after attach/create.** `onSaved` callback now accepts `attachedCertPathId` second arg and uses it to add `cp:<id>` to expanded set. `await refetch()` before swapping selectedKey. New `onExpandSelf` prop on CertPathEditor for the pull-existing flow's analogous auto-expand.

**Prompt 3.2 — Cache invalidation for AttachedCurriculaSection.** Added `useQueryClient` import. New `onInvalidateAttachedList` prop threaded through CertPathEditor. Both write paths (create-with-attachment + pull-existing-and-attach) now call `queryClient.invalidateQueries({ queryKey: ["cert-path-attached-curricula", cpId] })`.

**Prompt 3.3 — FK-disambiguation (the actual blocker).** Root cause of "attached curriculum not displaying" was PostgREST FK-ambiguity, not cache invalidation. `certification_path_curricula` has two FKs to `curricula` (`curriculum_id` and `prerequisite_curriculum_id`). Implicit embed returned null. One-line fix to `curriculum:curricula!curriculum_id(...)`. Prompts 3.1 and 3.2 were correct improvements but didn't address the actual failing query.

**Prompt 3.4 — Tree rename + pencil icon + ancestor auto-expand.** Three coupled changes:
- "Standalone Curricula" → "All Curricula", "Standalone Modules" → "All Modules". Filters removed so all non-archived items show regardless of attachment status.
- Pencil button (`Pencil` from lucide) on each AttachedCurriculaSection row navigates right pane to that curriculum's editor via new `onSelectCurriculum` callback.
- `selectNode` rewritten to auto-expand ancestor chain when selecting `cu:` or `mo:` nodes. Two new reverse-lookup Maps: `certPathsByCurriculum` and `curriculaByModule`. Same curriculum/module now appears in both "Certification Paths" (nested) and "All <type>" (flat) — selection highlights both because they share `nodeKey`.

## Standing patterns locked Session 56

Two patterns to apply to all subsequent editor sub-components (Module, Content Item, Quiz, Mentor, etc.):

1. **Key prop on all editor JSX usages.** `<EditorComponent key="cp:new" />`, `<EditorComponent key={`cp:${id}`} />`, etc. Forces React remount on selection swap so useState initializers re-run with correct `initial` values. Eliminates useState-stale-on-mount.

2. **PostgREST FK-disambiguation in embedded selects.** Any join-table embed traversing a child→parent relationship where the child has multiple FKs to that parent MUST use `!<column_name>` syntax. Standing recon check before writing any embed.

3. **Tree "All <type>" sections include attached items.** When Prompt 4 adds Module editor with curriculum-attachment flows, "All Modules" already lists every non-archived module. No additional tree logic needed.

## End-of-session DB state

- 1 active cert path: PTP-Coach (`57db528d-9715-4e23-9b40-82fc17a5b371`)
- 1 active curriculum: PTP VILT 1 (`aa221e50-e504-4568-a882-63a4ac567619`), attached to PTP-Coach
- 0 active modules, 0 active content items (Prompt 4+ scope)
- 1 archived cert path + 1 archived curriculum from earlier test churn (cosmetic; not blocking)

Test fixture is clean and useful for Prompt 4 recon: PTP-Coach with attached PTP VILT 1 is exactly the parent context Prompt 4 needs to attach modules to.

## Session 57 priority — Prompt 4 (Module editor) recon

**Goal of Session 57:** Complete full backend + frontend + branding recon for Prompt 4 (Module editor). Write the Lovable prompt. Do NOT send the prompt — leave it ready for Session 58 to send and verify. Same pattern that worked Session 56 for Prompt 3.

Expected effort: ~1-1.5 hours of recon work. Recon outputs should be detailed enough that Session 58 sends the prompt without rework.

### Step 1: Backend recon (Supabase MCP, no Lovable yet)

**1a. modules table schema**

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'modules'
ORDER BY ordinal_position;
```

Confirm:
- `id`, `slug`, `name`, `description`, `mode` (sequential/free_order?), `audience_tags`, `estimated_minutes`, `is_published`, `archived_at`, `created_at/updated_at`, `created_by/updated_by`, `display_order` if present
- Whether `modules` has an analog to curricula's `mode` column (sequential vs free order at module level)

**1b. upsert_module RPC signature**

```sql
SELECT proname, pg_get_function_arguments(oid), pg_get_function_result(oid)
FROM pg_proc
WHERE proname IN ('upsert_module', 'archive_module')
  AND pronamespace = 'public'::regnamespace;
```

Document parameter list verbatim. Expected to mirror `upsert_curriculum` shape: `p_id, p_slug, p_name, p_description, p_mode, p_audience_tags, p_estimated_minutes, p_is_published, p_curriculum_id, p_attachment_display_order, p_attachment_is_required, p_prerequisite_module_id, p_reason`.

If the signature differs from this expectation, document the differences. The single-transaction upsert+attachment pattern from `upsert_curriculum` is the desired shape; if `upsert_module` doesn't support optional attachment in one txn, that's a backend gap to fix before frontend work.

**1c. curriculum_modules join table FKs (CRITICAL — apply §33 disambiguation up front)**

```sql
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.curriculum_modules'::regclass
  AND contype = 'f'
ORDER BY conname;
```

Based on the cpc pattern, `curriculum_modules` is highly likely to have:
- `module_id` → `modules(id)`
- `prerequisite_module_id` → `modules(id)` (if prerequisite chains exist at module level)
- `curriculum_id` → `curricula(id)`

If TWO FKs point to `modules`, the AttachedModulesSection embed MUST use `module:modules!module_id(...)` from inception. Do NOT repeat Prompt 3's FK-ambiguity bug.

**1d. curriculum_modules table schema**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'curriculum_modules'
ORDER BY ordinal_position;
```

Confirm: `id`, `curriculum_id`, `module_id`, `display_order`, `is_required`, `prerequisite_module_id` (likely), `created_at`, `updated_at`.

**1e. RLS policies on modules and curriculum_modules**

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('modules', 'curriculum_modules')
ORDER BY tablename, policyname;
```

Confirm: super_admin full access (with `NOT is_impersonating()` in with_check), authenticated read for published rows. If policies differ from the cert-path/curricula pattern, document the gap.

**1f. Slug uniqueness partial index**

Verify `modules_slug_active_uniq` exists (it should — shipped Session 56 in the migration).

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'modules' AND indexname LIKE '%slug%';
```

### Step 2: Frontend recon (curl, no Lovable yet)

**2a. Pull current ContentAuthoring.tsx**

```bash
curl -sL "https://raw.githubusercontent.com/cbastianBWE/brainwise-blueprint/main/src/pages/super-admin/ContentAuthoring.tsx" \
  -o /home/claude/blueprint-cache/ContentAuthoring.tsx
wc -l /home/claude/blueprint-cache/ContentAuthoring.tsx
```

Expected ~2000 lines. Confirm Session 56's changes landed (key props, FK-disambiguated AttachedCurriculaSection, "All Curricula"/"All Modules" section labels, pencil icons, selectNode auto-expand).

**2b. Find Prompt 4 insertion points**

Identify the lines where Module editor needs to mount:

- `selectedNode?.type === "mo"` branch in right-pane JSX (around line 1865+ if patterns hold)
- `mo:new` / `mo:new:<curriculum-id>` / `mo:<uuid>` sentinel parsing in `selectNode` and the right-pane decision tree
- New `isModuleCreate` and `moduleCreateAttachToCuId` computed values mirroring `isCurriculumCreate` / `curriculumCreateAttachToCpId`
- `+ Module` button currently calls `handleComingSoon` — replace with `setSelectedKey("mo:new")`

**2c. Inside CurriculumEditor — Attached Modules section seam**

The CurriculumEditor in edit mode currently has NO AttachedModulesSection. Prompt 4 needs to add one, mirroring CertPathEditor's AttachedCurriculaSection. Find where it should mount inside CurriculumEditor's CardContent — likely at the end after the reason field, before the closing CardContent, conditional on `mode === "edit" && initial?.id`.

CurriculumEditor needs the same set of new props that CertPathEditor got:
- `attachedModuleIds: Set<string>` (computed from cmLinks for this curriculum)
- `allModules: any[]` (from data.modules)
- `onRequestCreateAttachedModule`, `onRefetch`, `onExpandSelf`, `onInvalidateAttachedModulesList`, `onSelectModule`

**2d. Tree-build extension for modules under curricula**

Already wired via `modulesByCurriculum` Map and `buildModuleNode` recursion. Confirm by reading the tree-build useMemo. No changes needed there — it just hasn't had any data to render yet.

**2e. Reverse-lookup Map already exists**

`curriculaByModule` Map was added in Prompt 3.4 for the auto-expand logic. Confirm it's there and being used.

### Step 3: Branding recon

Same three sources as Session 55:
- `tailwind.config.ts`
- `src/index.css`
- `src/styles/marketing-tokens.css`

ContentAuthoring is super-admin scope → shadcn HSL tokens only. Inherit all patterns from CertPathEditor and CurriculumEditor. No new tokens needed. The recon pass is to confirm nothing has shifted, not to discover anything new.

### Step 4: Write Prompt 4 (do NOT send)

Output: a single Lovable prompt covering:

1. New `ModuleEditor` sub-component inside ContentAuthoring.tsx, mirroring CurriculumEditor's structure
2. New `AttachedModulesSection` sub-component, mirroring AttachedCurriculaSection (with `module:modules!module_id(...)` FK-disambiguated embed from inception)
3. Sentinel parsing for `mo:new`, `mo:new:<curriculum-id>`, `mo:<uuid>`
4. `+ Module` button wired to `setSelectedKey("mo:new")` (replacing `handleComingSoon`)
5. "Add module to this curriculum" Dialog inside CurriculumEditor with Pull-existing + Create-new tabs (mirrors the cert-path Dialog exactly)
6. CurriculumEditor gets the new prop set (analogous to CertPathEditor's Session 56 prop additions)
7. Parent ContentAuthoring wires all the props down with the same auto-expand + cache invalidation + select-with-ancestor-expand patterns
8. Key props on all four ModuleEditor JSX usages: `mo:new`, `mo:new:${cpId}`, `mo:<id>` — apply Session 56's standing pattern from inception
9. New `cuAttachedModuleIds` useMemo on the parent computing `Map<curriculumId, Set<moduleId>>` from cmLinks

Acceptance criteria target: ~20-25 items, mirroring Prompt 3 in scope.

### Step 5: Brief Cole on the plan

End Session 57 by presenting:
- A summary of all backend findings (signatures, FK shape, any deltas from expectations)
- The full Lovable prompt body
- Brief sanity-check of acceptance criteria
- Estimated ContentAuthoring.tsx line growth (~700-800 more lines based on Prompt 3 precedent)

Cole reviews, gives green light, Session 58 sends the prompt.

### What NOT to do Session 57

- Do NOT send any Lovable prompt this session
- Do NOT touch the frontend
- Do NOT mock or test the Module editor UI — backend recon + prompt drafting only
- Do NOT skip the FK-disambiguation recon step. This was the actual bug Cole hit in Session 56. Catching it preemptively in Prompt 4 design saves a 3.3-style late-session round trip.

## Open build queue items (deferred past Prompt 4)

These are NOT for Session 57 — listed for awareness only:

1. **[MEDIUM / Prompt 4-5 territory]** Generic `attach_*_to_*` RPC family. Refactor away from re-sending full field set through upsert_* RPCs.

2. **[DEFERRED]** `ai_authoring_drafts` capture table. Trigger to revisit: second author OR prompt-quality tuning needs.

3. **[HIGH / Phase 4.5d]** Voice dictation + file upload for AI authoring prompts. Web Speech API for voice (free), client+server parsing for files. Folded into Prompt 6 (lesson_blocks editor).

4. **[HIGH / Phase 4.5e]** Voice dictation + file upload extended to /ai-chat, /my-results bubble, /shared-results bubble. Requires ai-chat Edge Function extension + privacy policy update.

5. **[Phase 4.5 sequencing]**: 4.5a (image) → 4.5d (authoring inputs) → 4.5b (voiceover) → 4.5c (video) → 4.5e (end-user AI inputs)

## Doc versions at Session 56 close

- Build queue: **v59** (Prompts 3.1-3.4 + slug-uniqueness migration shipped)
- Architecture reference: **v55** (§32-§34 added — slug uniqueness, FK-disambiguation, tree "All" sections)

## Subsequent prompt sequence

After Prompt 4 ships:
- **Prompt 5**: Polymorphic content item editor (8 item_types) + AI Draft buttons (FIRST live AI Edge Function verification)
- **Prompt 6**: Lesson_blocks visual editor + 17 block types + AI per-block Draft + Scaffold + image generation (Phase 4.5a) + voice dictation + file upload (Phase 4.5d)
- **Prompt 7**: Mentor assignment on /super-admin/coaches/<id>
- **Prompt 8**: Quiz authoring inside content item editor
- **Prompt 9**: /super-admin/learning-assignments 4-step assigner
- **Prompt 10**: AI Scaffold-lesson UI integration
- **Prompt 11**: AI Draft-text button wiring across all description fields

Realistic budget: 3-4 sessions for Prompts 4-11.
