# Session 95 → Session 96 Handoff

**Closing session:** 95
**Opening session:** 96
**Status:** Group G newsletter platform shipped end-to-end. Group H scoped + spec'd, ready for execution.

---

## What shipped this session

### G4-0 — Shared TipTap extensions module
11 files. 9 custom node schemas + buildExtensions factory + buildEmbedSrc helper. Foundation for editor, reader, and Edge Function parsing.

### G4-A — Editor primitive
14 files. 9 NodeViews + editor shell with toolbar, bubble menu, slash menu (16 commands × 4 categories), floating "+", and inline image upload pipeline.

### G4-B — List + detail pages
`/super-admin/newsletter` list + `/super-admin/newsletter/:articleId` detail with auto-save, version history sheet, schedule dialog, SEO tab.

### G4-C — HTML import modal
File-drop primary + paste textarea secondary. Drag-and-drop with drag-counter. 5MB ceiling. AbortController via raw fetch. Preview pane reuses G6 reader NodeViews. Success screen IS the confirm gate.

### G5 — Version history + diff viewer
7 files using diff@7.0.0 for inline word-level diff. Day-grouped list. Pre-restore checkpoint default-ON.

### G6 — Public reader
4 marketing pages (Newsletter archive, NewsletterArticle reader, NewsletterConfirm, NewsletterUnsubscribe), 3 components (SubscribeForm 3 variants, NewsletterArticleCard, PaywallCard with 3 access states), 2 reader NodeViews. Routes ordered specific-before-generic.

### Backend migrations (7)
Orphan-sweep enumeration fix; archive_reason CHECK constraint addition; list_articles_for_archive dead-param cleanup; list_admin_newsletter_articles RPC with ILIKE search; explicit anon REVOKE on that RPC (Supabase default-grants trap); request_asset_upload extended to 16-arg signature with `p_newsletter_article_id`; publish_article + schedule_article auto-snapshot version landmarks via `_snapshot_article_version`.

### Edge Function deploys (2)
- `request-asset-upload` v5 — routes to `newsletter-article-images` bucket
- `convert-html-to-tiptap` v2 — BUG FIX: now passes `p_reason` to `finalize_asset_upload`

---

## Bugs found and fixed during end-to-end test

**Bug 1: PGRST202 on image finalize.** Edge Function v1 called `finalize_asset_upload(p_asset_id)` but RPC signature requires `(p_asset_id, p_reason)`. PostgREST returned "function not found" because no single-arg overload exists. Six orphaned `pending` rows in content_assets from failed v1 runs — orphan-sweep cron will clean nightly. v2 deployed.

**Bug 2: Editor empty after import.** TipTap's `useEditor` only consumes `initialContent` on first mount; subsequent prop changes are ignored. Fix: `forwardRef` + `useImperativeHandle` on NewsletterEditor exposing `setContent(next)` that calls `editor.commands.setContent(next, { emitUpdate: true })`. AdminNewsletterArticle.tsx now calls `editorHandleRef.current?.setContent(newBody)` in onImported. Documented as §139.

---

## New Group H — Newsletter visual vocabulary + layout-preserving HTML import

**Scoped during Session 95 close.** Cole identified G4-C strips all source layout (45 unique CSS classes in test file get unwrapped). For prospect-facing newsletter content this is unacceptable.

**Cycle H1 (this session): COMPLETE.** Deep recon of test files + spec document produced.

**Spec file: `group-h-spec.md`** (430 lines, uploaded as part of Session 95 closeout).

**Scope summary (FULL CATALOG — Cole's explicit Session 95 close decision):**
- ~33 new block nodes covering complete editorial vocabulary: Eyebrow, Lead, SectionRule, Byline, Masthead, Aside, FootnoteRef+Footnotes, Definition, Disclosure, DomainGrid+DomainRow, IndexRow+IndexCard, StepList+Step, Checklist+Item, ThreeColumn+Pane, FourColumn+Pane, ImageGallery, ImageCompare, Audio, StatGrid, Chart, Table, CodeDiff, Terminal, Math, Poll, CTA, SubscribeBlock, RelatedArticles, FooterMeta, AuthorBio, Citations, FurtherReading
- 7 new marks: accent, smallCaps, superscript, subscript, underline, highlight, keyboard, abbr
- 6 refined existing nodes: Callout, Pullquote, StatCallout, Image, Embed, TwoColumn, KeyMoments, codeBlock (add attrs + parseHTML rules)
- 6 new article-level fields: eyebrow_text, is_issue_based + issue_label, tags[], masthead_publication + masthead_logo_glyph, default_layout_width, theme_variant
- Architectural shift: client-side `generateJSON(html, extensions)` with image pre-pass server-side via new `import-html-images` Edge Function (deprecates `convert-html-to-tiptap`)
- 6 cycles (H1 done, H2-H6 remaining), **8-13 sessions estimate, 30-42 Lovable cycles**
- H2 + H3 each split into 8 sub-passes per §4.13 for incremental ship discipline
- Spec is 712 lines (was 430 in initial draft; expanded after Cole's "build everything" directive)

**Session 96 opens on Cycle H2 — Schema + parseHTML for new nodes.** Cole reviews spec, then we execute H2 directly.

---

## Active deferred items (carried forward)

- `results_available` notification firing point wiring + AIRSA facet-interpretation generation gap + AIRSA Phases 3e-8 + messaging subsystem prerequisite for `coach_messages` notification type + `platform_updates` notification type + module reorder gap + MFA trusted-device + editor thumbnail-loss-on-republish + coach-paid invitation email verification + create-checkout graceful degradation + SOC 2 written policies + Action-Oriented Voice Redesign + pricing-reads refactor + corporate contract renewal schema change + Clarity Engine + Session 71 anon EXECUTE audit + coach_clients_client_view SECDEF refactor + results_available NAI/AIRSA/HSS coverage + users.last_active_at infrastructure + user_ui_preferences dedicated table + Bulk Phase 11 v2 + /super-admin/coaches consolidation + Members Surface v2 polish + Mentor Portal v2 MQ-1 through MQ-4 + G3 SEO/AEO infrastructure + RSS combined pass + G9 RSS feed + newsletter_categories v2 + users.bio column + author bio edit UI
- **NEW: internal subscriber inclusion** (paid product users auto-receive newsletter) — queued for G8
- **NEW: Group H — visual vocabulary + layout-preserving import** — spec ready, H2-H6 to execute

---

## Six orphaned `pending` content_assets rows

From Session 95 G4-C test runs (Edge Function v1 PGRST202 failures). All created by Cole's UUID. All status='pending'. Orphan-sweep cron runs nightly — will be cleaned automatically. Explicit cleanup not required.

---

## Standing rules / patterns locked Session 95

- **§136 — Orphan-sweep parent enumeration discipline.** When adding a new parent type to content_asset_refs (a new nullable FK), update Sweep 2 enumeration AND CHECK constraint AND cascade function in same migration. Otherwise orphan-sweep misses the new parent type silently.

- **§137 — Supabase default-grants trap on function creation.** Supabase default privileges grant EXECUTE to anon + authenticated automatically at function creation in public schema. `REVOKE FROM PUBLIC` is a no-op against role-specific defaults. For super-admin-only RPCs: explicit `REVOKE FROM anon` AFTER CREATE, regardless of explicit GRANTs.

- **§138 — publish/schedule auto-snapshot landmark pattern.** `publish_article` and `schedule_article` should call `_snapshot_article_version(article_id, version_type, "{Type} v{N}", NULL)` after state transition to create named landmarks in version history. Pattern: count prior versions of same type, increment, name accordingly. Becomes the canonical rollback point for these transitions.

- **§139 — forwardRef + useImperativeHandle pattern for TipTap content replacement.** TipTap's `useEditor` does NOT reactively consume `content`/`initialContent` prop changes after mount. For dynamic content replacement (e.g., HTML import), use `forwardRef` + `useImperativeHandle` exposing `setContent(next)` that calls `editor.commands.setContent(next, { emitUpdate: true })`. The `emitUpdate: true` ensures `onUpdate` fires so React state stays in sync. Reactive prop approach does NOT work for TipTap.

---

## What Session 96 should open on

**Cole reads `group-h-spec.md`** (or skim §4 node list, §5 architecture decision, §6 cycle sequencing, §8 deferred list at minimum) before Session 96 starts.

**At Session 96 open, confirm:**
- [ ] Cole approves the 8 new nodes + 1 mark + 3 extensions list (spec §4)
- [ ] Cole approves Option B (client-side generateJSON) over Option A or C (spec §5)
- [ ] Cole comfortable with 5-6 session investment (spec §7)
- [ ] Cole's 5 open questions answers (spec §9): DomainGrid+KeyMoments coexist, Eyebrow as both body+field, accent mark scope, FooterMeta auto-render, source_type='html_import_v2'

**Then Session 96 executes Cycle H2:**
- Backend: 4 migrations (newsletter_articles columns + tags audit + upsert_article signature + get_article_for_reader return)
- Frontend: 6 Lovable cycles (8 new node schemas + 1 mark + buildExtensions update + tiptapDocToPlainText update + CSS for all new nodes + Pullquote/Callout/Embed extensions)

After H2 ships, Sessions 97-100 cover H3 (NodeViews) + H4 (Edge Function refactor) + H5 (fidelity iteration) + H6 (Claude prompt template).

---

## Test fixtures referenced

- `ptp_test_article_alt.html` — 21KB unbranded version (0 images, structural test)
- `ptp_test_article_alt_media.html` — 25KB branded version (2 Pexels images + 1 YouTube embed, full visual vocabulary test)
- Test article in DB: `id = 26fcbaef-fb10-4ab5-aaf6-798e31a2e2f5`, slug `session-95-curl-test-article`, title "Testing New Article"
- Newsletter article images bucket: `newsletter-article-images`
- Turnstile site key: `0x4AAAAAADVBROvQ5jLUUIxJ`

---

## Edge Function version state at Session 95 close

| Function | Version | Status | Notes |
|---|---|---|---|
| convert-html-to-tiptap | v2 | ACTIVE | Bug 1 fix (p_reason added) |
| request-asset-upload | v5 | ACTIVE | newsletter_article_id support |
| sync-resend-audience | v1 | ACTIVE | Unchanged from Session 94 |
| resend-webhook | v3 | ACTIVE | Unchanged from Session 94 |
| send-email | (existing) | ACTIVE | Unchanged |

---

## Migrations applied Session 95 (in order)

1. `session95_reap_pending_uploads_parent_enumeration_fix`
2. `session95_content_assets_archive_reason_check_add_active_orphan_swept`
3. `session95_list_articles_for_archive_remove_dead_category_param`
4. `session95_list_admin_newsletter_articles_rpc`
5. `session95_list_admin_newsletter_articles_revoke_anon`
6. `session95_request_asset_upload_add_newsletter_article_param`
7. `session95_publish_schedule_auto_snapshot_versions`

All applied + verified. No rollbacks needed.

---

End of Session 95 → 96 handoff.
