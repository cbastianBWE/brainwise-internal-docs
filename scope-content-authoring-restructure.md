# Scope: Content Authoring Restructure + Rise as First-Class Authoring Entity

**Scoped:** Session 75 close
**Status:** Design-locked on UX direction. Architecture decisions pending. Build deferred.
**Owner:** Cole + Claude (next session opens here or later)

---

## Why this scope doc exists

The current Content Authoring page works but is friction-heavy for routine tasks. Two specific UX problems have been observed:

1. **Tree navigation is the only way to find anything.** Editing a known content item requires expanding cert path → curriculum → module → item every time. There's no flat search across all entities. The tree is good for *understanding hierarchy* but bad for *getting work done.*

2. **Rise lessons (lesson_blocks) are buried 3 layers deep.** To author a Rise lesson, the user has to: (a) create or pick a module, (b) create a content_item inside it with item_type=`lesson_blocks`, (c) click "Edit lesson blocks" to navigate to the actual Rise editor. The lesson itself is hidden inside a content_item shell that doesn't really do anything for that type. Authors think of lessons as first-class entities; the system treats them as configuration.

This scope doc captures the locked design intent for fixing both. The actual build is deferred — these are real workstreams that deserve their own focused session(s), not session-tail additions.

---

## Part 1: Content Authoring page restructure

### Current state (what exists today)

**File:** `src/pages/super-admin/ContentAuthoring.tsx`

**Layout:**
- Two-column grid: 380px left sidebar (tree navigator) + 1fr right pane (editor)
- Left: search input, three "+ Create" buttons (Cert Path / Curriculum / Module), then a recursive tree of cert paths → curricula → modules → content items
- Right: editor opens for whatever node is selected. Renders one of CertPathEditor / CurriculumEditor / ModuleEditor / ContentItemEditor based on type prefix in `selectedKey` (`cp:` / `cu:` / `mo:` / `ci:` / `cp:new` / `cu:new` / `mo:new` / `ci:new`)
- Selection state encoded in URL params (`selected`, `expanded`)

**Strengths:**
- Hierarchical relationships visible at a glance
- Breadcrumb in right pane shows ancestry
- One source of truth (no flat list to keep in sync with tree)
- Search filter on tree expands matching nodes automatically

**Weaknesses:**
- Every interaction goes through the tree
- Finding a content_item requires knowing its parent module, curriculum, and cert path
- Multi-parent relationships (curriculum attached to 2 cert paths) show up twice in the tree; no clean way to deduplicate
- No surface for "show me everything I've created in the last week" or "show me all draft modules"
- Tree gets unwieldy at scale — fine with 1 cert path, painful with 10
- No empty-state guidance for new authors ("you haven't created anything yet" → big create buttons)

### Proposed state (what we're building toward)

**Layout:**

```
┌──────────────────────────┬──────────────────────────────────────────┐
│ Sidebar (380px)          │ Main area (1fr)                          │
│                          │                                          │
│ ┌── Create new ────┐     │ ┌─ Cert paths ──────────────────────┐    │
│ │ + Cert path      │     │ │ [Tile] [Tile] [Tile]              │    │
│ │ + Curriculum     │     │ │ Filter: ▢ Draft ▢ Published       │    │
│ │ + Module         │     │ └────────────────────────────────────┘   │
│ │ + Content item   │     │                                          │
│ │ + Rise lesson    │     │ ┌─ Curricula ───────────────────────┐    │
│ └──────────────────┘     │ │ [Tile] [Tile] [Tile] [Tile]       │    │
│                          │ │ Filter: ▢ Standalone ▢ Attached   │    │
│ ┌── Find / edit ───┐     │ └────────────────────────────────────┘   │
│ │ 🔍 Search...     │     │                                          │
│ │ (across all      │     │ ┌─ Modules ─────────────────────────┐    │
│ │  entity types)   │     │ │ ...                                │    │
│ └──────────────────┘     │ └────────────────────────────────────┘   │
│                          │                                          │
│ ┌── Duplicate ─────┐     │ ┌─ Rise lessons ────────────────────┐    │
│ │ 🔍 Search...     │     │ │ ...                                │    │
│ │ (then duplicate  │     │ └────────────────────────────────────┘   │
│ │  dialog opens)   │     │                                          │
│ └──────────────────┘     │ ┌─ Content items ───────────────────┐    │
│                          │ │ ...                                │    │
│ ┌── Recent ────────┐     │ └────────────────────────────────────┘   │
│ │ • Cert path X    │     │                                          │
│ │ • Module Y       │     │                                          │
│ │ • Lesson Z       │     │                                          │
│ └──────────────────┘     │                                          │
└──────────────────────────┴──────────────────────────────────────────┘
```

**Sidebar contents (left column):**

1. **Create new** — vertical button stack. One button per entity type. Clicking opens the creation form in the main area (or a dedicated create route — TBD).
   - Cert path
   - Curriculum
   - Module
   - Content item (requires parent module to be selected/passed; sidebar shows a "pick parent module" dialog first)
   - Rise lesson (if Part 2 ships — see below)

2. **Find / edit** — search box. Typing filters across all entity types by name + slug. Results dropdown shows entity type + parent context. Click → opens editor.

3. **Duplicate** — same search affordance but the destination is the Duplicate dialog instead of the edit view.

4. **Recent** (nice-to-have) — last 5–10 entities the current super admin has edited, for quick context return.

**Main area contents (right):**

Tile sections grouped by entity type. Each section header is collapsible. Within each section:
- Tiles styled like the existing Tile component used in Resources / My Learning
- Tile shows: thumbnail (if any) + name + status badge (Published/Draft/Archived) + **parent context badge** ("Part of: PTP-Coach" — see open question 1 below)
- Section-level filter chips (e.g., for Curricula: "Standalone" vs "Attached to cert path"; for all types: "Published" vs "Draft")
- Empty states with create CTA

**Editor surface:**

The editors themselves don't change shape — CertPathEditor / CurriculumEditor / ModuleEditor / ContentItemEditor stay as-is. What changes is *how the user arrives at them*. Options:
- (A) Inline replacement of main area (current pattern — right pane becomes the editor)
- (B) Modal dialog over the tile view
- (C) Dedicated route per entity (`/super-admin/content-authoring/cert-path/:id`)

**Recommendation: (A)** — preserves the existing component layout, no routing changes needed, simplest to implement. The tile view is restored when the editor is dismissed via a back button or breadcrumb.

### Open design questions

**Q1: How do tiles handle many-to-many parent relationships?**

A curriculum can be attached to multiple cert paths simultaneously. A module can be in multiple curricula. The "Part of: X" badge breaks down here.

Options:
- (a) Show comma-separated parents: "Part of: PTP-Coach, AI-Coach"
- (b) Show count: "Part of: 2 cert paths" — click to expand
- (c) Skip the badge for multi-parent entities, show "Used in N places" instead
- (d) No badge by default; surface in tile hover/preview

**Recommendation: (b)** — keeps tiles uniform-sized; click-to-expand handles the rare multi-parent case without cluttering.

**Q2: Do content_items belong as their own section, or are they only accessible via their parent module?**

The current tree shows content_items as children of modules. In a tile view, surfacing all content_items as a flat section means a module with 30 items contributes 30 tiles — overwhelming.

Options:
- (a) Skip content_items in the main tile view entirely. Access them only by drilling into a module (click module tile → opens ModuleEditor → click content item link there).
- (b) Surface content_items as their own section but hidden behind a "Show content items" toggle.
- (c) Surface only orphan/recently-edited content_items.

**Recommendation: (a)** — content_items are intrinsically scoped to their parent module. Flat list adds noise without value. The "Find/edit" search box still finds them.

**Q3: Where does Rise lesson authoring fit in the new structure?**

Two sub-questions depending on Part 2 outcome:
- If Rise stays as a content_item subtype: same answer as content_items (drill in via module)
- If Rise becomes first-class: its own tile section, parent badge shows attached module(s) or "Unattached"

**Q4: Does the new layout replace ContentAuthoring entirely, or coexist?**

Replacement is cleaner. Coexistence (e.g., a "Tree view" toggle) adds maintenance burden. Replacement removes the tree code entirely.

**Recommendation: replace.** Add a one-time migration note for the team. The tree is preserved in git history if anyone misses it.

**Q5: What about the URL params (`selected`, `expanded`)?**

These currently encode tree navigation state for deep-linking. In the new model, only `selected` matters (which entity's editor is open). `expanded` becomes meaningless.

**Recommendation:** keep `selected` for deep-linking; drop `expanded`. Consider adding `tab` (which entity-type section is focused) and `filter` (active chip filters) for URL preservation of view state.

### Frontend touch points

**Files to modify or replace:**

1. `src/pages/super-admin/ContentAuthoring.tsx` — heavy rewrite. The current 33KB file is ~80% tree logic and ~20% editor routing. Most of the tree logic gets deleted. Editor routing stays.

2. `src/pages/super-admin/editors/_shared.tsx` — `TreeNode` type may be retained for the search-results dropdown but renamed to `EntitySearchResult`. `NodeTypeIcon` stays useful as a generic icon picker.

**Files to create:**

3. `src/components/super-admin/EntityTileSection.tsx` — reusable section component (header + filter chips + tile grid + empty state). Used 4-5 times in the main area, one per entity type.

4. `src/components/super-admin/EntitySearchDialog.tsx` — used by "Find / edit" and "Duplicate" sidebar buttons. Search input + results list + click handler.

5. `src/components/super-admin/CreateSidebar.tsx` — the left column. Wraps the Create / Find / Duplicate / Recent sections.

**Files unchanged:**

- `CertPathEditor.tsx`, `CurriculumEditor.tsx`, `ModuleEditor.tsx`, `ContentItemEditor.tsx` — editor logic stays as-is, just invoked from new entry points.

### Backend touch points

**No new RPCs strictly required.** The existing list/CRUD RPCs cover the needs:
- `list_published_cert_paths` / `list_curricula` / `list_modules` / `list_content_items` — TBD if these exist; otherwise the page can fetch via Supabase client directly (which is what ContentAuthoring.tsx does today).

**Potential new RPC:** `search_authoring_entities(p_query, p_entity_types, p_include_archived)` returning a unified search across all entity types. Cleaner than 4 parallel queries. But not strictly required for v1.

### Realistic cost estimate

- Recon already done in this scope doc
- New components: ~3-4 hours of Lovable prompts + iteration
- ContentAuthoring.tsx rewrite: ~2 hours
- Testing: ~1 hour

**Total: ~6-8 hours, plus 1-2 inevitable bug-fix cycles. Plan for two focused sessions.**

---

## Part 2: Rise lesson as first-class authoring entity

### Current state

Rise lessons (the BrainWise term for our equivalent of Articulate Rise — a sequence of typed content blocks like text / video / quiz / interaction) live as `lesson_blocks` rows attached to a `content_item` row of type `lesson_blocks`.

**Schema:**

```
content_items
├── id
├── module_id (FK, NOT NULL)
├── item_type ('lesson_blocks' for Rise)
├── lesson_completion_mode ('scroll_and_checks' | 'explicit_continue')
└── (other type-specific fields, mostly NULL for lesson_blocks)

lesson_blocks
├── id
├── content_item_id (FK to content_items, NOT NULL)
├── block_type (text / video / quiz / etc.)
├── display_order
├── config (jsonb)
└── created_at / updated_at / archived_at
```

To author a Rise lesson today:
1. Pick a module (or create one)
2. Add a new content_item to the module, item_type = `lesson_blocks`
3. Save the content_item
4. Click "Edit lesson blocks" inside the content_item editor — this navigates to `/super-admin/content-authoring/lessons/:content_item_id`
5. The actual Rise editor (LessonBlocksEditor.tsx) opens, where blocks are authored

### Why the current model exists

Originally, lesson_blocks was scoped as "one of many content_item types," parallel to video / quiz / external_link / etc. This was correct for the v1 thinking: a module contains content items, one of which might be a Rise lesson.

What's changed: **Rise lessons are the primary authoring surface for most content.** Other content_item types (video, external link) exist but Rise is where the real instructional design happens. The current model makes the most-used surface the hardest to reach.

### Proposed state

Rise lessons become a first-class authoring entity, surfaced directly in the sidebar (Part 1's "Create new" section) and the main area's tile view.

**Authoring flow:**
1. Sidebar → "Create Rise lesson" → name + reason → save
2. Lesson exists as a top-level entity (no parent module required)
3. Sidebar option appears: "Attach this lesson to a module" — picks any module and creates the parent content_item shell
4. Once attached, the lesson behaves exactly as today: shows up inside the parent module as a `lesson_blocks` content_item

### Architecture options

**Option A: Decouple lesson_blocks from content_items entirely**

Promote lesson_blocks (or a new `lessons` table) to a top-level entity. The current content_items + lesson_blocks pairing becomes a join: a `lesson_blocks_content_item_attachments` table (or similar) ties a top-level lesson to its position inside a module.

Pros:
- Cleanest data model long-term
- Lesson can exist independent of any module
- Re-using the same lesson across multiple modules becomes possible (today you'd have to duplicate)

Cons:
- Schema migration touches ~9 RPCs that reference `content_items.module_id`
- `get_user_learning_state` rollup logic needs updating
- Duplicate RPCs we just shipped need updating
- Touches a lot of code

**Option B: Make `module_id` nullable on content_items, only for lesson_blocks**

Keep the existing schema. Allow `content_items.module_id` to be NULL when `item_type = 'lesson_blocks'` (CHECK constraint enforces). An "unattached" lesson is a content_item with NULL module_id. Attaching means filling in the module_id.

Pros:
- Minimal schema change (one nullability change + one CHECK constraint)
- Existing RPCs mostly work; only the ones that join `content_items` to `modules` need to filter for non-null `module_id`
- Easier rollback if we change our minds

Cons:
- Schema becomes weirder (mixing attached and unattached states via NULL)
- "One lesson reused in multiple modules" still requires duplication (not supported)
- Reordering content_items in a module needs to skip unattached lessons
- The chicken-and-egg we just fixed for video gets a sibling here (unattached lessons exist with no parent)

**Option C: Hybrid — keep current schema, add a "lesson library" view**

Don't change the schema at all. Add a UI surface that shows all `lesson_blocks` content_items across all modules in one flat tile section. Authoring still requires a parent module, but **at create time the system silently creates a "Lesson library" hidden module** that holds unattached lessons. When the author attaches the lesson to a real module, the content_item gets reparented (module_id update).

Pros:
- Zero schema migration
- Existing RPCs unchanged
- All the user-facing flow of Option B without the data weirdness

Cons:
- Hidden "Lesson library" module is a hack
- Reparenting via UPDATE on module_id needs to handle audit logging
- Confusing if someone queries the DB directly and sees the hidden module
- Doesn't enable lesson reuse across modules (same as Option B)

### Recommendation

**Option B for v1.** Allow `module_id` nullable specifically for `lesson_blocks`. The schema change is small, the UI is clean, the data model is comprehensible. Lesson reuse across modules is a v2 feature that's worth its own scope doc when it surfaces as a real need.

If lesson reuse becomes a frequent ask within 2-3 months, migrate to Option A. The migration path is:
1. Add `lessons` table with the current `lesson_blocks` schema minus `content_item_id`
2. Add `lesson_attachments` join table
3. Backfill: each existing `lesson_blocks` content_item becomes a row in `lessons` + a row in `lesson_attachments`
4. Update RPCs
5. Drop `lesson_blocks.content_item_id` and `content_items` rows with `item_type = 'lesson_blocks'`

That's a real migration but doable in a focused session.

### Open design questions (Part 2)

**Q1: What does "unattached lesson" mean for trainees?**

If a lesson exists but isn't attached to any module, it's invisible to trainees. Fine. But what if a lesson is detached from its module (using the detach pattern we just built for curricula/modules)? Today, detaching curriculum-from-cert-path preserves user enrollments in the curriculum. If we add detach-lesson-from-module, what happens to user progress on that lesson?

Options:
- (a) Same as curricula: progress preserved, lesson stays standalone
- (b) Block the detach if any user has progress
- (c) Archive the user's progress automatically

**Recommendation:** (a), parallel to existing detach semantics. Consistency wins.

**Q2: Can a lesson have multiple authoring states (draft, published) independent of its parent module?**

Today, a content_item is "live" iff its parent module is published AND its cert path is published. A standalone lesson has no parent. Two interpretations:
- (a) Standalone lessons have `is_published` of their own; trainees see them only via module attachment
- (b) Standalone lessons inherit publish state from their attached module(s)

**Recommendation:** (a) — lessons have their own `is_published`. An author can finish a lesson, publish it, then attach to a module when ready. This decouples authoring lifecycle from publishing lifecycle.

But this raises a new schema question: `content_items` doesn't have `is_published` today (it inherits from module). If we go Option B for the schema, we'd need to add `content_items.is_published` for `lesson_blocks` rows specifically. That's a real change.

**Trade-off:** (b) is simpler schema-wise but means unattached lessons are always "in draft." (a) requires schema change but matches author intent.

**Recommendation refined:** (b) for v1. A standalone lesson is implicitly draft; publish happens by attaching to a published module. If authors push back, escalate to (a).

### Schema changes for Option B

```sql
-- Allow module_id NULL for lesson_blocks type only
ALTER TABLE content_items ALTER COLUMN module_id DROP NOT NULL;

ALTER TABLE content_items ADD CONSTRAINT content_items_module_required_except_lesson_blocks
CHECK (
  module_id IS NOT NULL
  OR item_type = 'lesson_blocks'
);
```

### RPC changes for Option B

1. **`upsert_content_item`** — allow null `p_module_id` for lesson_blocks (parallel to the supabase_storage video fix we just shipped). When module_id is null at upsert time, do not write any audit log entry for "added to module"; treat as standalone.

2. **`get_user_learning_state`** — already filters by module_id IS NOT NULL in joins; just make sure unattached lessons are excluded from user-facing rollups. Should be automatic if joins use INNER JOIN.

3. **`reorder_content_items`** — needs WHERE clause to ignore null module_id.

4. **New RPC: `attach_lesson_to_module(p_content_item_id, p_module_id, p_display_order, p_reason)`** — sets `module_id` on a previously-standalone lesson_blocks content_item, with audit logging.

5. **New RPC: `detach_lesson_from_module(p_content_item_id, p_reason)`** — sets `module_id` back to NULL, with audit logging. Parallel to the detach pattern we built for curricula/modules. User progress preserved.

6. **`_duplicate_module_children`** — already filters by `archived_at IS NULL`. Verify it also handles the case where someone is duplicating a module that has no lesson_blocks attached (should be fine — the loop just doesn't iterate).

7. **`_rollup_content_item_to_module` and `_rollup_module_to_curriculum`** — need to skip rollups for content_items with NULL module_id.

8. **`reap_pending_uploads`** — verify it handles NULL module_id correctly when reaping orphan upload entries.

9. **`request_asset_upload`** — accepts `p_content_item_id` parameter; doesn't reference module_id directly. Should be unchanged.

### Frontend changes for Option B

1. New file: `src/pages/super-admin/lessons/StandaloneLessonEditor.tsx` — or possibly just reuse `ContentItemEditor.tsx` with a flag indicating standalone mode.

2. New file: `src/components/super-admin/AttachLessonDialog.tsx` — picks a parent module from the existing modules dropdown, calls `attach_lesson_to_module` RPC.

3. `ContentItemEditor.tsx` — when editing a standalone `lesson_blocks` item, hide module-specific UI and show "Attach to module" button.

4. New section in tile view (Part 1): "Rise lessons" — shows all lesson_blocks content_items, with "Standalone" or "Attached to: X" badge.

5. Sidebar "Create new" item: "Rise lesson" — opens StandaloneLessonEditor or routes to create form.

6. `LessonBlocksEditor.tsx` (the actual block-by-block editor) — unchanged. Works the same whether the parent content_item is attached or not.

### Realistic cost estimate (Part 2)

- Schema migration: ~30 min (small change but real)
- 8 RPC updates: ~2-3 hours
- 2 new RPCs (attach/detach lesson): ~1 hour
- Frontend (new components, updates to existing): ~3 hours
- Testing: ~1.5 hours, including edge cases (orphan lesson archived, lesson attached to archived module, etc.)

**Total: ~7-9 hours. Plan for two focused sessions.**

---

## Sequencing recommendation

**Two workstreams. Do Part 1 (UI restructure) first, Part 2 (Rise first-class) second.**

Reasoning:
- Part 1 establishes the tile-based authoring surface. Part 2 plugs into it (the new "Rise lessons" tile section).
- Doing Part 2 first means we'd still have to update its UI again when Part 1 lands.
- Part 1 surfaces no schema risk. Part 2 has real migration risk and benefits from being done in isolation.

If we do them in the same session, it's a 14-17 hour build. That's too much for one session.

**Cleanest sequencing:**
- Session N: Part 1 backend + frontend (or split N and N+1)
- Session N+2: Part 2 backend (schema + RPCs)
- Session N+3: Part 2 frontend (plugs into Part 1's surface)

---

## Pre-build decisions required

Before either part starts, Cole needs to lock answers to these:

**Part 1:**
- Q1: Multi-parent badge strategy (suggested: (b) count + click-to-expand)
- Q2: Surface content_items in tile view? (suggested: no, drill via parent module)
- Q4: Replace tree entirely or coexist? (suggested: replace)
- Q5: URL params strategy (suggested: keep `selected`, drop `expanded`, consider adding `tab`/`filter`)

**Part 2:**
- Architecture: Option A, B, or C? (suggested: B for v1)
- Q1: Detach semantics (suggested: preserve enrollments, parallel to curriculum detach)
- Q2: Publish state for unattached lessons (suggested: inherit from module for v1, revisit if authors push back)

---

## Notes on what NOT to do

- **Don't** ship Part 1 without the duplicate/detach features Cole asked for. Those already exist (just shipped in Session 75). The new UI must surface them prominently in the tile actions.

- **Don't** ship a tile view that doesn't include Archive as a primary action. Archiving is the only way to clean up; hiding it in a context menu adds friction.

- **Don't** start Part 2 by changing the schema before the RPC-update list is verified. The 9 RPCs that reference `module_id` need to be confirmed updated before the migration runs.

- **Don't** introduce two ways to author a Rise lesson (the old "create content_item with type lesson_blocks" path AND the new "create standalone lesson" path). Pick one — the new path — and remove the old entry point.

---

*End of scope doc. Build can start when Cole locks the pre-build decisions and a session is allocated.*
