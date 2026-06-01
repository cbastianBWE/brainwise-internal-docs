# BrainWise Session 104 to 105 Handoff

*Sanitized for public repo: no passwords, no plaintext test UUIDs, no secrets. Test password lives in user instructions only.*

## Where Session 104 left off

Two big bodies of work shipped end to end and verified: newsletter SEO/AEO/RSS (G3 + G9), and newsletter email dispatch in full (G8a + G8b + G8c, backend and frontend). Group H's H6 v1 (AI co-pilot) was discovered already-shipped at session open (built in a separate chat). G8 is now COMPLETE.

## Session 105 opening priorities (Cole's choice — none are blocking)

No mandatory next step; G3/G9/G8 are done. Candidates, in rough priority:

### 1. PTP/narrative backend carryforward (oldest debt)
- **BQ-NARRATIVE-FANOUT-STATUS** — server-side terminal-status fix in `calculate-scores` (Option 1 from Session 103; read-time reconciliation already shipped as the Option 2 mitigation).
- **BQ-FANOUT-COLDFAIL** — the pre-warm fan-out is failing cohort-wide; prime suspect is `admin.functions.invoke` + service-role JWT under signing-keys mode. Worth a focused root-cause pass.
- **BQ-PDF-EXPORT-COLDCACHE** — PDF export reads cached narrative sections; exporting before lazy on-view generation completes can drop per-context sections. Confirm/мitigate.

### 2. NAI and AIRSA PDF rebuilds
The PTP PDF rebuild pattern (Session 103) is the template; NAI and AIRSA still need their rebuilds.

### 3. Newsletter polish (small, optional)
- Optional marketing-page SEO cleanup (cookie-banner link text, /products heading-level skip, marketing-route meta/canonical fallbacks, shared OG image) — deferred from the SEO review this session.
- OG-image publishing checklist: real articles need a cover/OG image set (LinkedIn showed "no image" on the test article, which has none).
- Custom tracking subdomain in Resend (deliverability polish, needs a DNS record) — Resend flagged the shared tracking domain.

## Decisions locked in Session 104 (recap)
- **Consent model:** explicit opt-in only, strictest-fits-all (US+EU+UK+Canada → GDPR/CASL/CAN-SPAM). No silent auto-subscribe. Paid status ≠ newsletter consent. One unified `newsletter_subscribers` list. (Not legal advice; real compliance review warranted before EU/CA scale.)
- **Email format:** summary + opening (first 4 TipTap text blocks) + Read-full-article button + compliant footer (physical address + per-recipient unsubscribe). Not full-content.
- **Dispatch trigger:** manual/automatic toggle, default manual. Per-recipient tracking (delivered/opened/clicked/bounced) via the existing email_logs + resend-webhook.
- **Bounced/complained on opt-in:** do NOT auto-resurrect; link the user for record only, return delivery_problem.
- **Re-publish:** never auto-dispatches (manual or scheduled); only genuine first publish (prevStatus draft/scheduled) auto-sends in automatic mode.
- **G3 rendering:** Option A (Lovable native prerendering + markdown surface), no SSR proxy.
- **Open tracking:** intentionally OFF in Resend (flagged Not Recommended); opened_at stays empty by choice. Click tracking ON.

## G8 coverage summary (automatic mode)
- Manual UI publish (draft/scheduled→published) in automatic mode → frontend fires dispatch.
- Scheduled publish (cron) in automatic mode → server-side cron fires dispatch via the secret path.
- Re-publish (unpublished→published) → never auto-dispatches; manual Send button only.
- Manual mode → nothing auto-sends; Send-to-subscribers button is the only path.

## Architecture additions this session (see arch-ref v106)
- RPC `list_public_published_articles()` (single source of public-article truth).
- Three public discovery Edge Functions: newsletter-sitemap, newsletter-feed, newsletter-llms.
- Dispatch schema: newsletter_settings, newsletter_dispatches, email_logs +dispatch_id/opened_at/clicked_at.
- newsletter-dispatch dual-auth (JWT OR x-dispatcher-secret), verify_jwt:false, both paths enforced in-function.
- In-product opt-in RPCs (opt_in/opt_out/get_my_newsletter_subscription).
- Scheduled-publish engine: scheduled_by_user_id, process_due_scheduled_articles(), cron_publish_and_dispatch_due_articles(), 15-min cron.
- Two reusable patterns recorded: dual-auth Edge Function; cron-context actor attribution for SECDEF helpers that need auth.uid().

## Key facts confirmed this session
- `newsletter_subscribers.email` is UNIQUE — opt-in is upsert-by-email.
- `newsletter_articles_scheduled_consistency` CHECK requires future scheduled_for while status=scheduled; publish UPDATE passes because status leaves 'scheduled'; CHECK is write-time only.
- `super_admin_audit_log` is immutable (UPDATE/DELETE blocked by trigger).
- MCP Edge Function deploy: import shared modules as `./_shared/` NOT `../_shared/`.
- Verified Resend sender domain `mail.brainwiseenterprises.com`.

## Standing reminder (also in memory)
The `STATIC_ROUTES` list inside `newsletter-sitemap/index.ts` is HARDCODED. Article URLs are automatic; new public marketing pages are NOT — adding one needs a manual STATIC_ROUTES edit + redeploy. Surface this on any newsletter/sitemap/SEO/new-marketing-page work.

## Test fixture / dashboard state at end of Session 104
- Newsletter subscribers: zero confirmed. A real end-to-end dispatch test needs ≥1 confirmed subscriber (G8b creates these via opt-in, or insert a confirmed test row). With zero, a send correctly reports 0 recipients + zero stat tiles — not a bug.
- One immutable audit row remains from the G8c scheduled-publish verification test (harmless, accurate).
- Resend: click tracking ON, open tracking OFF, email.clicked subscribed on resend-webhook.
- One published public article ("New Article Test") + one archived article (correctly excluded from sitemap/feed/llms).

## Documents this session leaves behind
- build-queue.md (v112)
- architecture-reference.md (v106)
- session-104-to-105.md (this file)

Three markdown files for Cole to upload manually to `cbastianBWE/brainwise-internal-docs` (flat repo root) via GitHub web UI.
