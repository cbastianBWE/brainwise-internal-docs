# Session 105 → 106 Handoff

Doc versions at this close: build-queue.md **v113**, architecture-reference.md **v107**, this handoff.

## What shipped in Session 105 (all backend-first, all verified)

1. **Assessment auto-advance fix** — `AssessmentFlow.tsx`: removed the 0.5s setTimeout auto-advance + unused advanceTimer ref/cleanup; Next left ungated. Cole-confirmed.

2. **Platform feature-flag system (backend)** — 3 migrations + test-corp contract:
   - `platform_features` table + seed (PTP enabled, NAI/EPN/AIRSA/HSS disabled).
   - `user_has_feature` extended: super_admin → true; corp branch unchanged (org ceiling, member override subtracts only); NEW non-corp branch (override → platform default → true).
   - `individual_feature_override_set` (super-admin, audited, rejects corp targets, null clears).
   - Test-corp `instruments_included_override` set PTP-only.

3. **Gating-support RPCs (backend)** — `user_has_features_bulk` (self-or-super-admin bulk check), `platform_feature_set` (writable platform flag setter, audited, stamps updated_at/updated_by). Both NOT in types.ts.

4. **One-time chat credits (backend)** — `users.one_time_chat_credits`, `chat_credit_grants` ledger (idempotent on source_ref), `grant_one_time_chat_credits` + `consume_one_time_chat_credit`; **check-ai-usage v49** (200/400 limits + credit consumption order + additive response fields); **stripe-webhook v29** (grants +10 per per-assessment purchase). No backfill (Cole: all non-PTP results today are test users).

5. **Subscription / pricing reconfig** — chat limits 200/400; prices Base $10/$90, Premium $15/$130, per-assessment $29.99. Stripe-immutability finding resolved → DB-sourced dynamic pricing (we maintain `subscription_plans.price_usd`; anon read RLS broadened). Stripe price_ids unchanged.

6. **Frontend (4 Lovable prompts, all type-check clean + repo-verified)**:
   - Pricing + AI-chat (credit-aware gate/counters, dynamic prices).
   - Gating Prompt 1 — individual picker + autostart gating (`useInstrumentFeatureAccess`).
   - Gating Prompt 2 — super-admin Features page (`PlatformFeatures.tsx` at `/super-admin/features`).
   - Gating Prompt 3 — corp dashboard contract gating (`useOrgInstrumentAccess`).

## Open / pending for Session 106

- **Commit deployed Edge Function sources to the repo**: `check-ai-usage` v49 and `stripe-webhook` v29 (the latter is not in the repo — §92 drift). Sources were built on disk this session; regenerate from `get_edge_function` if the working dir reset.
- **Confirm Cole's $130 checkout test** was the in-app Subscribe button, not a Stripe Payment Link.
- **Smoke-test the credit path in-app**: only meaningful for a non-subscriber WITH credits now that SubscriptionGate is relaxed — set `users.one_time_chat_credits` via SQL on a test user, send a chat, confirm consume + UI.
- **Marketing-copy pass** (not code): `Pricing.tsx` and `marketing/Pricing.tsx` may still advertise all 4 instruments in the Premium tier.

## Carryforward (not blocking)

- PTP narrative fan-out: BQ-NARRATIVE-FANOUT-STATUS (calculate-scores terminal-status server-side fix, Option 1 defense-in-depth), BQ-FANOUT-COLDFAIL (cohort-wide pre-warm failure; service-role JWT under signing-keys suspect), BQ-PDF-EXPORT-COLDCACHE.
- NAI / AIRSA PDF rebuilds; narrative regeneration on score changes; interpretation row consolidation; pre-export readiness check for PTP.
- BUG-NWS-1 (newsletter attachment-send hang) + Group H formal closure (pending one fix + smoke test).

## Standing reminders

- **STATIC_ROUTES**: the marketing-route list inside `newsletter-sitemap/index.ts` is hardcoded. Article URLs are automatic; a NEW public marketing page requires a manual STATIC_ROUTES edit + redeploy. Surface on any newsletter/sitemap/SEO/new-marketing-page work.
- **Pricing decoupling**: displayed price (`subscription_plans.price_usd`, ours) and charged price (Stripe under the price_id) are independent — change BOTH.
- **Typing**: new DB objects (platform_features table, user_has_features_bulk, platform_feature_set, individual_feature_override_set) aren't in types.ts yet → frontend casts with `(supabase.rpc as any)` / `from("x" as any)`.

## Working discipline that held

Backend-first then Lovable; every Lovable claim verified against live source (raw.githubusercontent + grep) and every migration verified with execute_sql before approval. Two Lovable adjustments this session were correct catches against the real code: the AiChat peer-toggle is corp-only (so individual gating there was a no-op), and `instruments_included` is a jsonb array (narrow with Array.isArray, no row-level cast).
