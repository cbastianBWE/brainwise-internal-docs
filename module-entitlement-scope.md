# Module Entitlement — "Modularize and Sell" Scope

*Session 133. Scope/design doc; no build. Captures Cole's requirement to sell the platform's modules (Assessments, LMS, CRM, Operations) bundled or a la carte, and defines how that lands against the existing system.*

## 1. The requirement

Sell each module of the platform independently or in any combination: a company can buy just the LMS, just the CRM, just Operations, or Assessments, or any bundle. The LMS may be sold without Assessments and vice versa. Assessments can ride along with other modules.

## 2. The key distinction: entitlement vs isolation vs branding

Three orthogonal axes, often conflated:

- **Isolation** (5.3): org A cannot see org B's data. Already enforced via `current_user_org_id()` + RLS.
- **Branding** (5.1/5.2/A2): an org's logo and colors. Shipped.
- **Entitlement** (this doc): which modules an org is licensed to use.

Modular selling is an entitlement problem. It does **not** change 5.3's isolation design for the public schema. The only way it touches isolation is by pulling a new schema (`operations.*`) into the customer-facing surface, covered in section 5.

## 3. Existing entitlement machinery (live recon, Session 133)

The platform already has a per-org entitlement system, but it is assessment-centric:

- `subscription_tiers`: tier defaults (instruments included, AI pull / chat / coaching allowances, `ai_chat_enabled`, `dashboard_access_level`, `seat_count_default`).
- `corporate_contracts`: per-org row with the same fields as nullable `*_override` columns, plus seats, dates, retention, `supervisor_dashboard_enabled`.
- `organization_features_view`: resolves effective per-org features as `COALESCE(contract_override, tier_default)`.
- `platform_features`: a **global** kill-switch registry keyed on a `feature` string with a `category`. Today it only registers the assessment instruments (PTP/NAI/HSS/AIRSA/EPN). Not per-org.
- `member_feature_overrides`: per-member feature toggles.
- Frontend enforcement: `SubscriptionGate feature="ai_chat"` wraps gated routes; `RoleGuard` gates by role.

**Gap:** there is no concept of LMS, CRM, or Operations as a licensable module. Entitlement granularity today is instruments (assessments), AI, and dashboards.

## 4. Per-module current state

**Assessments — already sellable.** Entitlement exists at instrument granularity (finer than "module"), resolved through `organization_features_view`. Selling Assessments standalone, or excluding it from an LMS sale, works with the existing model. No new isolation work; the assessment tables are already org-bounded (5.3 audit).

**LMS — needs a module flag, plus one product decision.** Learning surfaces (resources, my-learning, cert paths, curricula, modules, content items) have no org-level on/off today. Two flavors of "sell the LMS":
- *Resell BrainWise's catalog* behind an `lms_enabled` flag. Small: a flag, route/nav gating, done. The buying org consumes BrainWise-authored content.
- *Per-org authored/imported catalog.* The buying org authors or imports their own courses. Large: content tables (`content_items`, `curricula`, `modules`, `lesson_blocks`, etc.) are **not** org-partitioned today and authoring is BrainWise-super-admin-only. This means org-scoped authoring, an org content catalog, and it ties directly to SCORM import (item 6). 
- Recommendation: v1 = resell-catalog flavor behind a flag. Per-org authoring is a later arc, sequenced with item 6.

**CRM and Operations — not customer-facing at all today; the big arc.** These are the internal back office (the Zoho replacement) in the separate `operations.*` schema. Every `/operations/*` route is gated to `brainwise_super_admin`, and the app itself carries a note that access is super-admin-gated "for now" pending an `operations.users` membership that does not exist. The `operations.*` schema is org-partitioned (it has `org_id` across ~100 tables), but it was built single-tenant-ish with Cole's own org as the real tenant. Selling either externally requires:
- an operations-side membership and role model (`operations.users` or equivalent),
- de-gating the UI from super-admin-only,
- a full tenant-isolation audit of `operations.*` (it has never been audited for external multi-tenant use; this is new isolation surface beyond 5.3),
- module entitlement gating.
- This is a substantial multi-step arc, larger than the LMS or Assessments work. Size it before committing.

## 5. Proposed entitlement model

Define a module vocabulary: `ASSESSMENTS`, `LMS`, `CRM`, `OPERATIONS`.

**v1 mechanism (public-schema modules, reuses what exists):** add additive module flags (`lms_enabled`, and later `crm_enabled`, `operations_enabled`) to `subscription_tiers` (bundle defaults) and `corporate_contracts` (per-org override), surfaced through `organization_features_view`, mirroring `ai_chat_enabled` exactly. Bundled sale = a tier turns several on; a la carte = per-org overrides. Assessments stays as the existing instruments entitlement.

**Alternative for non-assessment customers:** the contract/tier model is assessment-seat-centric (it assumes instruments and seats). A customer who buys only CRM still needs a `corporate_contracts` row, which carries assessment-flavored fields. If standalone non-assessment sales become common, a dedicated `org_modules` table (`org_id`, `module`, `enabled`, `source`) is cleaner. Decision can wait until the CRM/Operations externalization is scoped, since that is who needs decoupling from the assessment-centric contract.

**Enforcement must be two layers.** A hidden nav item is not security.
- Frontend: extend the `SubscriptionGate` pattern to module-level gating of routes and nav.
- Backend: the module's RPCs and RLS must deny non-entitled orgs. Critical for CRM and Operations, which hold sensitive business data; entitlement there has to be enforced server-side, not just hidden in the UI.

## 6. Interaction with the rest of the white-label track

- **5.1/5.2/A2 branding:** unaffected. Branding is per-org regardless of modules.
- **5.3 isolation:** public-schema modules (Assessments, LMS) unaffected, isolation already holds. CRM/Operations externalization **adds `operations.*` to the isolation surface**, which is its own audit, separate from and larger than 5.3's public-schema scope.
- **5.4 custom domains:** unaffected by modules.
- **Items 6/7 (SCORM / tracking):** the per-org-authored LMS flavor and SCORM import are the same arc; a modular LMS sale that includes customer-authored content intersects there directly.

## 7. Recommended sequencing

1. **Phase 1 (small):** module-entitlement scaffolding for public-schema modules. Add the module vocabulary and `lms_enabled` flag, extend `organization_features_view`, add frontend + backend gating. Outcome: Assessments (already works) and LMS (resell-catalog flavor) sellable bundled or a la carte.
2. **Phase 2 (medium):** per-org authored/imported LMS catalog (org-scoped content + authoring), sequenced with SCORM import (item 6).
3. **Phase 3 (large):** CRM and Operations externalization. Operations-side membership/role model, UI de-gate, full `operations.*` isolation audit, and module entitlement. This is the heavy one and should get its own scope pass before any build.

## 8. Net

Modular selling does not change 5.3. It is a new entitlement layer that mostly extends the existing tier/contract machinery for the public-schema modules (Assessments already done, LMS small), with one genuinely large arc hiding inside it: turning the internal CRM and Operations back office into externally sellable multi-tenant products, which is where the real engineering and a new isolation audit live.
