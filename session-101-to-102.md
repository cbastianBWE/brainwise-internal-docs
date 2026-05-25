# Session 101 → 102 handoff

## Session 101 ship summary

**H4 SHIPPED** (Group H Cycle 4). Backend `import-html-images` Edge Function deployed; frontend `ImportHtmlModal.tsx` refactored client-side via Lovable single cycle. Type-check clean. Three documentation artifacts updated for Session 101 close: build-queue v109, architecture-reference v103 (with §150 + §151 NEW), this handoff file.

**H5 gap discovered + audited.** Cole's smoke test of `ptp_test_article.html` revealed most H2 nodes have parseHTML rules that match round-trip output but NOT external HTML. Full 33-node + 10-mark audit completed via script; results at `/mnt/user-data/outputs/H5_AUDIT_RESULTS.txt`. H5 cycle deferred to Session 102 with full inventory in hand.

## Backend state Session 102 opens against

### Edge Functions ACTIVE
- `import-html-images` v1 — Function ID `53d32929-6e0d-4c0c-9e7c-479dcc544d04`, verify_jwt:true, ezbr_sha256 `bb2fd15e894b9910628d6c0d573dd1ce180a6bb3ea23517fce58665e96e9de6c`. Shipped Session 101.
- `convert-html-to-tiptap` v2 — UNTOUCHED Session 101; remains ACTIVE as soak fallback. ezbr_sha256 `ffe538f1f4ecd886efed9ef83b5d955d0cf4e4b3bf9bd468153d153e0ac569a5` (unchanged from Session 95 deploy).

### Per D6=a (Session 101 reconciliation lock)
Delete `convert-html-to-tiptap` Edge Function in Session 102 IF AND ONLY IF Cole confirms ≥1 successful real-article import through the new `import-html-images` path during soak window. If Session 102 opens before any real import has run, keep both ACTIVE and revisit deletion at Session 103+ open.

### Frontend state
- HEAD `5288c63` "Refactored client-side HTML import" on main, brainwise-blueprint repo.
- `ImportHtmlModal.tsx` is 846 LOC, new `rewriteImgsToSyntheticFigures` helper at line 174, 8-step `runConversion` pipeline at lines 296-476, subLabel rendered at line 549.
- `package.json` byte-identical to pre-H4. `@tiptap/core` provides `generateJSON` via transitive dep on `@tiptap/starter-kit@^3.23.0` — no new top-level deps.

### No SQL migrations Session 101. Backend SQL state identical to Session 100 close.

## Session 102 primary work: H5 cycle scoping + ship

### Audit data location
`/mnt/user-data/outputs/H5_AUDIT_RESULTS.txt` — full classification of every parseHTML selector across all node + mark files.

Key numbers from the audit:
- **47 node schemas analyzed across 37 node files** (10 are composite parent+child pairs in single file).
- **41 schemas ROUND-TRIP ONLY** — need H5 import-fallback rule additions.
- **6 schemas already IMPORT-FRIENDLY**: Aside, Byline, Eyebrow, Lead, Masthead, SectionRule.
- **10 mark schemas analyzed**, 2 round-trip only (Definition, FootnoteRef), 8 import-friendly.

### Round-trip-only node schemas needing H5 fix
Full list (41 schemas, alphabetical):
- Audio
- AuthorBio
- CTA
- Callout
- Chart
- Checklist (parent + item)
- Citations (parent + entry)
- CodeDiff
- Disclosure (parent + summary)
- DomainGrid (parent + row)
- Embed
- FooterMeta
- Footnotes
- FourColumn (parent + pane)
- FurtherReading
- Image
- ImageCompare
- ImageGallery
- IndexRow (parent + card)
- KeyMoments (parent + moment)
- Math
- Poll
- Pullquote
- RelatedArticles
- StatCallout
- StatGrid
- StepList (parent + step)
- SubscribeBlock
- Terminal
- ThreeColumn (parent + pane)
- TwoColumn (parent + pane)

### H5 cycle shape (likely; finalize at Session 102 open)
For each round-trip-only node, add ONE new parseHTML rule at priority 51 using a generic class selector or bare-tag match. Canonical `data-newsletter-*` rule stays as-is (no removal, no priority downgrade). `getAttrs` callback in import-fallback rule reads from rendered text children (not `data-*` attrs).

Pattern example for DomainGrid:
```ts
parseHTML() {
  return [
    { tag: "section[data-newsletter-domain-grid]" },     // canonical - round-trip
    { tag: '[class~="domain-grid"]', priority: 51 },     // NEW - import fallback
  ];
}
```

For composite parents (DomainGrid, IndexRow, Citations, Checklist, FourColumn, KeyMoments, StepList, ThreeColumn, TwoColumn, Disclosure): both parent and child schemas need import-fallback rules. The parent rule matches the outer container class; the child rule matches the inner item class.

For atoms with stored attrs that come from DB rows (Poll → poll_id, AuthorBio → user_id, Audio → asset_id, etc.): import-fallback rule for these is structurally different — no DB row exists for externally-imported instances. Options for Session 102 design:
1. Skip import-fallback for DB-row atoms (Poll, AuthorBio, Audio, ImageCompare, Embed, SubscribeBlock, RelatedArticles): external sources don't have BrainWise's polls/users/assets so the data wouldn't resolve anyway. Acceptable gap.
2. Import-fallback creates a "broken-reference" placeholder node that renders a re-bind affordance in the editor (analogous to Image's `data-import-failed-src` pattern). More work; defer to H5b sub-cycle.

Lean toward option 1 for Session 102's first pass. Revisit option 2 only if a real third-party article exposes need.

### Lovable cycle count estimate (refine at Session 102 open)
- ~14-18 simple node schemas (single-tag import-fallback rule each) — 1 Lovable cycle bundled.
- ~10 composite parent+child pairs — 1 Lovable cycle bundled.
- ~7 DB-row atoms — likely no work per option 1 above.

Plausible total: 2 Lovable cycles. Could compress to 1 if Lovable handles the bundled prompt cleanly.

### Pre-H5 cycle verification
At Session 102 open, before drafting any Lovable prompt:
1. Pull each round-trip-only node's parseHTML body via `cat src/components/newsletter/tiptap/nodes/<NodeName>.ts` from local repo (or GitHub raw fetch). Verify the audit script's classification — script's `IMP_UNCERTAIN` markers on `[class~="..."]` selectors are false positives from regex truncation; the underlying selectors are properly written and DO match.
2. For each composite parent+child pair, pull both schema declarations to understand the parent-child content expression and how getAttrs reads from children.
3. Decide bundle granularity (one Lovable cycle for all 33 nodes vs split into composites + simples + DB-row).
4. Draft prompt with explicit "do not modify renderHTML for any node — import-side only" guard.

### Cosmetic carryforward
- StatCard grid responsive variant restoration in ImportHtmlModal SuccessView: Lovable used plain `grid-cols-3`; restore `grid-cols-1 sm:grid-cols-3` for narrow-mobile readability. One-line fix, not blocking.

## Carryforward deferred list (unchanged from Session 100 close + Session 101 additions)

- **H5 cycle scope + ship** (NEW, primary Session 102 work)
- **Delete convert-html-to-tiptap** per D6=a after Cole confirms real-article import success
- Poll NodeView phantom audit-row fix (5-line patch — post-hydration first-render ref skip)
- Masthead/FooterMeta published_label cosmetic patch (one-line patch — format article.published_at)
- results_available notification firing point wiring (Phase 10 polish)
- AIRSA facet-interpretation generation gap investigation
- coach_messages + messaging subsystem
- Action-Oriented Voice Redesign
- §110 cert-path enrollment asymmetry from Session 84
- H2-MIG-9e SVG bucket tightening (drop image/svg+xml from user-avatars bucket allowed_mime_types)
- content_assets_archive_reason_check whitelist extension
- newsletter-categories admin UI
- related-article RPC gate-relaxation
- tiptapDocToPlainText.ts as real initiative if body-text search gets a consumer (note: file EXISTS at `src/components/newsletter/versions/`, used by ImportHtmlModal; Session 100 phantom-file claim was wrong, corrected Session 101)
- StatCard grid responsive variant restoration (cosmetic, ImportHtmlModal SuccessView)

## Session 102 opening discipline reminders

- GitHub MCP is READ-ONLY. Pull canonical docs (build-queue.md, architecture-reference.md, this handoff) via `get_file_contents` at session open; save locally; edit in place as decisions land.
- Test fixture password `BrainWiseTest2026!` lives in userMemories only.
- Backend recon BEFORE Lovable prompt drafting. For H5, that means: pull each affected node's full parseHTML body via local repo or raw GitHub before drafting the bundle prompt.
- §147 SQL RPC signature audit not relevant Session 102 (H5 is parseHTML-only, no SQL changes).
- §150 SSRF pattern applies to any new Edge Function fetcher (no such function planned Session 102).
- §151 verify-import-path discipline applies to every new node schema going forward.

## Key files staged for Cole upload at Session 101 close

1. `/home/claude/internal-docs/build-queue.md` — v109 prepended above v108. Upload to `cbastianBWE/brainwise-internal-docs/build-queue.md`.
2. `/home/claude/internal-docs/architecture-reference.md` — v103 prepended above v102 with §150 + §151. Upload to `cbastianBWE/brainwise-internal-docs/architecture-reference.md`.
3. `/home/claude/internal-docs/session-101-to-102.md` — this file. Upload to `cbastianBWE/brainwise-internal-docs/session-101-to-102.md`.

Audit script + results NOT in internal-docs repo — they live at `/home/claude/h4/audit_parsehtml.py` + `/mnt/user-data/outputs/H5_AUDIT_RESULTS.txt`. Re-run the audit at Session 102 open to refresh against any node files added since Session 101 close (none expected, but verifying is cheap).
