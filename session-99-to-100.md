# Session 99 → 100 Handoff

## What shipped Session 99

**H2-FE-Pass 6 = COMPLETE.** **H2-FE-Pass 7 = COMPLETE.** 10 of 12 Group H Cycle H2 frontend nodes shipped across two full passes plus avatar infrastructure backend and newsletter category infrastructure backend.

### Lovable build cycles (5 effective ships)

| Cycle | Scope | Notes |
|---|---|---|
| P6a | FooterMeta + Citations composite + FurtherReading | Type-check clean. CSS counter auto-numbering precedent established for Citations entries. |
| P6b | AuthorBio + full avatar infrastructure | Type-check clean. β scope (full avatar infra) shipped instead of α (defer avatars) per mid-session call. |
| P7a | CTA + SubscribeBlock + Disclosure + Definition | Type-check clean. New INTERACTIVE slash category. Disclosure click-suppression in editor only (per Cole β). |
| P7b | RelatedArticles + category-aware article-edit form | Two-pass ship — pass 1 hit Lovable time budget; pass 2 finished items 1-5. Type-check verified by Claude locally (EXIT=0). |
| P7c | FootnoteRef mark + Footnotes block | Single-pass ship. Architecture Option C (refs own text, block aggregates at render time). Type-check verified locally (EXIT=0). |

### Backend migrations (8 + 2 mid-apply fixes)

**Avatar infrastructure (P6b prerequisite):**
- `H2-MIG-9b` — users.avatar_asset_id + content_asset_refs.user_id + CHECK extended 7→8 parents + user-avatars bucket + 5 RLS policies + bundled fix for 4 missing newsletter-article-images super-admin RLS policies
- `H2-MIG-9d` — reap_pending_uploads Sweep 2 parent enumeration extended to include user_id (without this, every avatar would auto-reap 24h after upload)
- `H2-MIG-9c` — request_asset_upload DROP+CREATE adding p_user_id + user mode in 5 ladders; new set_user_avatar RPC; user_avatar_set action_type INSERT under content_authoring category
- `H2-MIG-9a` — new get_newsletter_author_bio anon-callable RPC
- **Mid-apply fix**: set_user_avatar initially wrote to wrong audit log table name + columns; rewrote to call log_super_admin_action helper RPC verbatim mirroring update_user_bio

**Newsletter category infrastructure (P7b prerequisite):**
- `H2-MIG-10a-1` — newsletter_categories table + RLS + index + 4 RPCs (list/create/update/archive) + newsletter_articles.category_id FK + 3 action_type rows under content_authoring
- `H2-MIG-10a-2` — 4 function body rewrites: upsert_article 25→26 args (DROP+CREATE), list_admin_newsletter_articles 5→6 args (DROP+CREATE), get_article_for_reader + preview_article_as_viewer_class (CREATE OR REPLACE, payload extended with category metadata)
- `H2-MIG-10b` — 3 new anon-callable read RPCs: get_related_articles_by_tags, get_related_articles_by_category, get_related_articles_by_ids
- **Mid-apply fix**: initial H2-MIG-10a-1 used category='newsletter_management' which CHECK constraint rejected; re-applied with 'content_authoring' (no schema change needed)

### Edge Function redeploys (1)

- `request-asset-upload` v5 → v6 — adds user_id to RequestBody interface and forwards p_user_id to the RPC. Without this, P6b AuthorBio avatar uploads would have failed at runtime. Caught BEFORE first user-facing call (§147 candidate rule validated).

### Standing-rule updates

- **§147 NEW** — SQL RPC signature changes require Edge Function audit. Pattern observed twice (Session 95 Bug 1 + Session 99 v5→v6 deploy). Diagnose-before-prescribe protocol expands to: after every SQL RPC signature change, audit all Edge Function callers.
- **§142 correction** — actual boolean columns on super_admin_action_types are `requires_mfa`, `requires_justification`, `is_mutation`, `denylist_during_impersonation` (NOT the names §142 originally documented). Mirror existing row exactly via SELECT pattern.
- **§136 correction** — content_asset_refs now has 8 nullable parent FK columns (added user_id in H2-MIG-9b). Restores the original Session 95 count after the Session 96-97 correction removed the never-shipped podcast_episode_id.

### New patterns locked Session 99 (described in architecture-reference v101)

- CSS counter auto-numbering for ordered composites (P6a Citations + P7c FootnoteRef/Footnotes)
- 3-mode NodeView state machine pattern (P6b AuthorBio + P7b RelatedArticles)
- Editor preview chrome reusing reader CSS via `.newsletter-prose` container (P7a CTA)
- Reader-NodeView wrapper for stateful/RPC-coupled embeds (P7a SubscribeBlock + P7b RelatedArticles + P7c Footnotes)
- Bubble menu Mode union additive extension for marks with editable text (P7a Definition + P7c FootnoteRef)
- Editor NodeView intercepts native HTML interaction (P7a Disclosure click-suppression); reader keeps native behavior
- Cmd/Ctrl+Enter Apply shortcut for multi-line bubble menu mode textareas (P7c FootnoteRef)

### Informal patterns surfaced (not §-locked yet)

- TypeScript type-escape patterns in TipTap/Supabase integration: `as any` for NodeViewContent `as` prop accepting only `"div"` in library types; `as unknown as T` two-step cast for PostgREST `Json` return values to typed interfaces. Two recurring instances each across P6a/P6b/P7b. Worth folding into a future §-rule once a third instance surfaces.

## Session 100 opens on

**H2-FE-Pass 8 — Poll node.** The last big interactive node in Group H Cycle H2. Backend prerequisite: precursor H2-MIG-9 list_admin_polls RPC needs creation. Architecture call required at session open: do polls have:
- Voting persistence (database table for vote records keyed by article_id + voter_session_id)?
- Aggregate result rendering (anon-callable RPC returning poll results)?
- Closing date / open-indefinitely toggle?
- Single-vote-per-session enforcement vs. allow-revote?

These are real product decisions that should be made deliberately at Session 100 open, not assumed. The spec mentions Poll as "Phase 2" for voting backend; question for Session 100 is whether to ship Poll as schema-only (no voting, just display) or with full voting backend.

**H2-FE-Final — wireup cleanup.** After Pass 8:
- buildExtensions.ts final pass (ordering + completeness check)
- tiptapDocToPlainText.ts extensions (so search/excerpt extraction handles new nodes — this has been deferred across multiple passes)
- final newsletter-prose.css cleanup (consolidate duplicate selectors, verify CSS variable usage across all new nodes)

## Deferred items carried forward (cleanup list)

### Active deferred (from H2 work)

1. **Optional H2-MIG-9e** — drop `image/svg+xml` from user-avatars bucket `allowed_mime_types` for XSS layer-2 alignment. uploadUserAsset client filters SVG already; bucket policy still permits. Gap is harmless today (Edge Function gates super-admin), but layer-2 alignment opportunity.
2. **candidateAuthors query extension** — include `avatar_asset_id` for picker-row avatars when author roster grows past ~20 users.
3. **content_assets_archive_reason_check whitelist** — extend if user-avatar-specific lifecycle reasons surface (used `manual_archive` for smoke-test cleanup; not blocking).
4. **Admin UI for managing newsletter_categories** — `/super-admin/newsletter-categories` management page. Cole will seed categories via direct RPC call when needed for now.
5. **`_walk_tiptap_for_image_asset_refs` walker mismatch** — targets `node->>'type'='image'` not `newsletterImage`. Carried from Session 98. Cleanup needed before any future code relies on the rebind path.
6. **Related-article RPC gate-filter scope** — currently all 3 RPCs filter to `gate = 'public'` only. Subscriber/plan_tier articles excluded from "you might also like" cards. Can be relaxed later by allowing all gate values + adding members-only badge in reader card.
7. **Reader-path AuthorBio hydration** — editor renders Mode 2 full author card via NodeView, but reader path currently renders only the empty `<aside>` skeleton because reader doesn't mount NodeViews. This is H3 scope per spec — published articles using AuthorBio will show empty placeholder until H3 hydration ships.

### Long-standing deferred (from earlier sessions, not Session 99 work)

- AIRSA Phases 3e-8
- `results_available` notification firing point wiring (Session 84 unfinished)
- AIRSA facet-interpretation generation gap investigation
- Messaging subsystem (prerequisite for `coach_messages` notification type)
- `platform_updates` notification type
- Module reorder gap (Session 80 era)
- MFA trusted-device
- Editor thumbnail-loss bug
- Coach-paid invitation email verification
- create-checkout graceful degradation
- SOC 2 written policies
- Action-Oriented Voice Redesign (NAI/PTP report copy refactor)
- Pricing reads refactor (centralize to subscription_plans table)
- Corporate contract renewal schema (drop UNIQUE on corporate_contracts, add is_current semantics)
- Clarity Engine
- Session 71 anon EXECUTE audit
- coach_clients_client_view SECDEF refactor
- `results_available` NAI/AIRSA/HSS coverage
- `users.last_active_at`
- `user_ui_preferences` dedicated table
- Bulk Phase 11 v2
- `/super-admin/coaches` consolidation
- Members Surface v2 polish
- Mentor Portal v2 (MQ-1 through MQ-4)
- G3 SEO/AEO + RSS combined pass
- G9 RSS feed
- `newsletter_categories` v2 — admin UI for management (currently RPCs exist but no UI page)
- Internal subscriber inclusion (G8)
- Newsletter asset-ref rebind walker mismatch (related to #5 above)

## Notes for session opening

When Session 100 opens, follow standard session-opening protocol:
1. Pull `docs/build-queue.md`, `docs/architecture-reference.md`, and this `docs/session-handoffs/session-99-to-100.md` via GitHub MCP `get_file_contents`
2. Read v106 build queue entry and v101 architecture reference entry for full Session 99 context
3. Note the §147 candidate rule, §142 correction, §136 column-count update
4. Make the architecture call on Poll voting backend before any migration drafting (see "Session 100 opens on" section above)

If Cole prefers to defer the Poll voting decision and ship Poll as schema-only first (like Math/Terminal/Chart/CodeDiff in Pass 5 A5a), that's a defensible path that matches H2 spec language. Voting backend would then ship in a later phase as its own initiative.

## Session 99 final ship totals

- 5 effective Lovable build cycles
- 8 backend migrations + 2 mid-apply fixes
- 1 Edge Function redeploy
- H2-FE-Pass 6 + H2-FE-Pass 7 BOTH COMPLETE
- 10 of 12 Group H Cycle H2 frontend nodes shipped (only Poll + H2-FE-Final wireup remain)
- 1 new standing rule (§147)
- 2 column-list corrections (§142 + §136)
- 7 new patterns documented in arch-ref v101
