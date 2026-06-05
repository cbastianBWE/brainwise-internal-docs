# Session 114 → 115 Handoff

**Session 114 shipped two streams. (1) Operations Platform P2-extras frontend (time/expense depth) — slices 1–5 complete + verified, plus 4 supporting backend migrations and a Phase-4 recurring-invoice smoke test. (2) A PTP psychometric reverse-scoring audit + correction + full historical rescore of 15 real assessment results, a `generate-all-facets` v6 super-admin/coach auth fix, and three shipped assessment-integrity frontend changes. Also: the Operations Doc-1 v1 build was re-cut into a clean 9-phase standing roadmap (below).**

Canonical docs bumped: build-queue **v122**, architecture-reference **v116** (§152 corrected to point at §140; new reverse-scoring + rescore-pattern + tiered-auth records). Markdown only (Session-74 rule).

---

## Locked decisions (do not re-litigate)

- **Operations Doc-1 v1 is now a 9-phase roadmap (standing).** Recorded in build-queue. P1–P4 are shipped (with two exceptions, below); P5 Reports is the next major phase. See "Operations Doc-1 standing roadmap" below for the full phase list and status.
- **PTP reverse scoring keys off the per-response snapshot, never the live items flag.** `assessment_responses.is_reverse_scored` is stamped at submit time by `AssessmentFlow.tsx` from `items.reverse_scored`. Flipping the items flag only affects NEW assessments; historical reports require a snapshot backfill + in-place recompute + facet-cache delete + regen.
- **Do not expose the reverse-scoring flip mechanic at the per-item level.** The per-item callout warns "read carefully, the labels may run opposite" but never explains the score flip. Telling a respondent how the math works invites pre-compensation (answering to game the flip), which corrupts the data. Normalization is explained conceptually only at the acknowledgement level, with an explicit anti-compensation instruction ("answer based on the two labels shown; our scoring takes care of the rest").
- **Rescore is done in place via SQL, not by re-running calculate-scores.** `calculate-scores` INSERTs a new result row (not upsert) and facet narratives are cached per `assessment_result_id`, so a clean historical rescore is: backfill snapshots → set-based in-place UPDATE of `dimension_scores`/`overall_profile` → DELETE `facet_interpretations` for the result → reset `narrative_status=null` → regen via the report's on-view self-heal. A parity gate runs first: the recompute fed the CURRENT (pre-backfill) snapshots must reproduce the stored values exactly before any mutation.
- **Server-side completeness guard for `calculate-scores`: declined.** The frontend submit gate is the chosen fix; do not build the backend guard unless asked. Residual gap = rare silent dropped-save case.

---

## What shipped Session 114

### Stream 1 — Operations P2-extras (frontend depth) + supporting backend

Four backend migrations (all `apply_migration` then `execute_sql`-verified):
- `session114_p4_revoke_public_eight_rpcs` — REVOKE EXECUTE FROM PUBLIC on the 8 Phase-4 RPCs (the carried S114 opener task). Verified anon=false / authenticated=true. This closed the §152 question: the real mechanism was anon inheriting EXECUTE via PUBLIC, not a "grant reconciler" — `REVOKE FROM anon` was a no-op; `REVOKE FROM PUBLIC` is the fix (§140). §152 corrected accordingly.
- `session114_p2x_project_users_org_created_defaults` — `project_users.org_id` DEFAULT `current_org_id()`, `created_by` DEFAULT `auth.uid()` (extends the direct-CRUD default pattern; Insert type made optional to match).
- `session114_p2x_timer_rpcs` — `ops_start_timer(p_project, p_task, p_description)` + `ops_stop_timer(p_entry)`, server-side single-running-timer invariant (auto-stops any prior running entry on start), §140 grants from creation, anon=false verified, functional test passed (auto-stop-prior 0.50h, stop 1.50h, single-running invariant held).
- `session114_p2x_project_financials_rollup_view` — `operations.project_financials_rollup` (security_invoker): cost = logged time × cost_rate + expenses; revenue = invoiced-to-date (excludes draft/void/written_off); plus margin, margin_pct, and a `cost_untracked_hours` flag. GRANT SELECT authenticated + service_role.

Phase-4 smoke test (live): the recurring-invoice runner (with the S113 `line_total` COALESCE fix) was validated by forcing `next_run_date` to today — generated an invoice with correct subtotal from a template line that had no precomputed `line_total`. Test invoice + template hard-deleted afterward; one invoice number was consumed (expected, non-resettable once real invoices exist).

Frontend slices (all SHIPPED + verified against the live repo):
1. **Project members** — Team card on `OperationsProjectDetail` + `TeamMemberDialog` (staff-hours members + cost rates).
2. **Live timer** — start/stop on the project Time card; stop chains into the LogTime edit dialog.
3. **DurationPicker** (15-min increments) retrofit into LogTimeDialog; per-project weekly card; standalone **My Time** weekly page (`/operations/my-time`, super-admin guarded, sidebar entry). Current-user-only for v1; append write model for grid cells.
4. **Project financials card** on `OperationsProjectDetail` reading `project_financials_rollup` (Number()-coerce the numeric-as-string view columns). Invalidation wired on LogTime save + time-entry delete (project-financials, project-time-rollup, customer-time-rollup).
5. **My Time tabs** (Entry / Overview) + entry-enabled month calendar on the Overview tab; month query keyed under the existing `["ops","my-time"]` prefix so addTime invalidations cover it.

P2-extras (slices 1–5) is complete.

### Stream 2 — PTP reverse-scoring correction + historical rescore

**Audit.** Of 89 PTP items, only 3 were originally flagged reverse (8 Resilience, 17 Self-esteem, 43 Curiosity) — all correct. Found 7 more with the same descending-anchor structure that should reverse: items 37, 66, 42, 68, 40, 45, 72 (ambiguity/risk/doubt tolerance + flexibility/flow capacity, work + social). All 10 reverse items live in DIM-PTP-03; dimensions 01/02/04/05 are unaffected.

**Applied to the instrument.** Fixed anchor text on items 17 and 76; flipped `items.reverse_scored=true` on the 7. All 10 now true and verified — ongoing assessments score correctly from here.

**Edge deploy.** `generate-all-facets` **v6** — added a super-admin + linked-coach branch to the JWT auth path (mirrors `generate-facet-interpretations`'s tiered auth). It was owner-only, so super-admin debrief views 403'd and the 89-row `facet_insights_all` master never built. internal-secret + owner paths unchanged; verify_jwt=false. Note: the v6 frontend self-chain (batches of 10 across a ~110s budget) is unreliable — it stalled mid-build on the pilot fixture (70/89) and needed an accordion re-open to finish. For batches, prefer a server-side fire (resumable) when the internal secret is reachable.

**Rescore applied to 15 real result rows / 14 people** (one result done first as the pilot, then 14 more in the batch; the 2 anonymized "Deidentified User" rows included per Cole). Demo accounts and all test accounts excluded.
- Parity gate passed: 15 results / 73 dimension rows, 73/73 matched (old-snapshot recompute vs stored, 0 mismatch) before any mutation.
- Phase 1 (applied): backfilled the 7 item snapshots across the 15 assessments; recomputed `dimension_scores` + `overall_profile` in place (set-based UPDATE, stable result ids). DIM-PTP-03 band dropped for 4 results (high→moderate_high ×3, moderate_low→moderate ×1); their high/low bands rebuilt. The other 11 shifted within band.
- Phase 2 (applied): reset `narrative_status=null` + deleted all `facet_interpretations` for the 15 (0 sections remaining, all confirmed).

**One real assessment found incomplete (one-off).** A single production PTP was at 69/89 responses (40/47 professional, 29/42 personal) — status `completed`, saved continuously across the full session, all 20 missing items long-present in the catalog. It is the only assessment in this state (every other completed `both` PTP has 89). Likely intermittent silent per-item save failures; its scores/report are internally consistent on its 69 items. Decision: have that user retake for a full 89.

### Stream 3 — Assessment-integrity frontend (Cole ran via Lovable; all verified in the live repo)

- **Submit completeness gate** (`AssessmentFlow.tsx`): `allAnswered = items.length>0 && items.every(it => responses[it.item_id] != null)` (uses `!= null` so a real 0 counts); submit dialog copy "you must answer all N items"; Submit action `disabled={submitting || !allAnswered}`. This is the durable fix for the partial-submission path. (Note: the gate trusts in-memory `responses` set before the DB write, so it does not catch a silent dropped-save — that residual is why the incomplete result above slipped through historically.)
- **Reverse-item callout** (`AssessmentFlow.tsx`): on `currentItem.reverse_scored`, an amber "Read this one carefully" note that the labels may run opposite from nearby questions. Deliberately no scoring-flip wording (psychometric rule above).
- **PTP acknowledgement normalization note** (`assessmentAcknowledgments.ts`, `INST-001:self`): a conceptual paragraph on directional wording + the anti-compensation instruction. Data-driven by instrument+rater so it covers all PTP contexts; editing the body auto-rebumps the content-version hash.

---

## OPEN / PENDING

**PTP rescore tail (carried into S115 only as verification, not new build):**
- 5 of the 13 reopened `both` reports were still one context short of their 5 per-context sections after repeated re-opens (the deficient context's 4 sections come from 3 sequential AI calls on tab-mount; switching tabs orphans in-flight calls). Masters are complete at 89. Fix: open each, land on the named tab, sit ~60s without switching. If a careful pass still fails, fire `generate-facet-interpretations` server-side per missing context (blocked on the internal secret, which is not DB/Vault-readable and has no invoke-from-MCP tool).
- The 2 Deidentified reports had scores corrected + facets deleted but were not yet reopened to regenerate.
- After all narratives regenerate, invalidate/regenerate the 1 affected org's stale caches: 5 `org_dashboard_narratives` (INST-001) + 3 `org_ptp_delta_narratives` rows (org PTP aggregates shifted).
- Have the incomplete-assessment user retake for a full 89.

**Operations Doc-1 — the two exceptions inside the "done" phases (S115 first work):**
- **P3 conversions incomplete.** Only `ops_convert_estimate_to_invoice` exists. `estimate → project` and `estimate → retainer` were never built.
- **P1 refund residuals.** The `charge.refunded` handler RPC + webhook branch shipped S109, but: subscribing the ops Stripe endpoint to `charge.refunded` in the Stripe dashboard is still a Cole-side item; the refund-flow UI was never built; and the first real invoice/reminder email has not been verified live.

**Build-queue (carried):**
- BQ-PTP-ANCHOR-REWRITE (MEDIUM, decision pending) — optional non-reverse anchor rewrites in `PTP_Reverse_Scoring_Review.docx`. Mutually exclusive with the flag flip; if adopted, set those items' `reverse_scored` back to false (applying both double-reverses).
- All-staff admin weekly timesheet view (multi-user time grid; needs user-select + read scope) — deferred from P2-extras; build after current-user My Time.

**Cole-side (carried):** subscribe ops Stripe endpoint to `charge.refunded`; GA sales-tax CPA confirmation.

---

## Operations Doc-1 v1 — standing 9-phase roadmap

The full-scope (A2) plan, in build order. P1–P4 shipped across Sessions 109–114 (with the two exceptions above); P5 is next.

- **Phase 1 — Money path. SHIPPED (S109/S111), residuals open.** Offline payment recording (`ops_record_payment`, all modes, overpayment→credit), invoice send (Resend + mark sent), void/write-off/clone/delete-draft, `charge.refunded` handler RPC + webhook branch, payment-receipt email, overdue cron. RESIDUAL: Stripe-dashboard `charge.refunded` subscription, refund-flow UI, first-email live verification.
- **Phase 2 — Time + expenses into billing (the differentiator). SHIPPED (S110 backend, S114 frontend extras).** Time logging vs tasks (modal, list/filter, weekly grid, server-side live timer, calendar), expenses (categories, billable + markup, receipt upload; mileage/recurring partly in P4), project members for staff-hours + cost rates, project dashboard (actual vs budget / unbilled / revenue / cost / margin), `ops_create_invoice_from_project`.
- **Phase 3 — Estimates + conversions. PARTIAL (S112).** Estimate create/edit, status lifecycle, accept/decline by email link (public token), convert → invoice. MISSING: convert → project, convert → retainer.
- **Phase 4 — Recurring, retainers, credit notes. SHIPPED (S113).** Recurring invoice templates + generation cron (v1 draft-only), retainer invoices (Stripe-collected → customer credit → apply → refund), credit notes (apply or refund).
- **Phase 5 — Reports. NOT STARTED (next phase).** ~11 missing SQL views (sales by customer/item, invoice details, payments received, project profitability, project revenue, time tracking, expense by category/customer, top customers, commission) then the reports UI with date filters, column customization, CSV/PDF export. The existing operations views are AR-aging/unbilled/balance only — none of the P5 set exists yet, so P5 is close to all 11 views + the whole UI.
- **Phase 6 — PDF engine + branding.** Three templates (Standard, Corporate, Detailed Services) for invoices/estimates/statements/receipts, template-per-customer, logo/colors. A minimal invoice PDF likely pulls forward into P1 so sent invoices carry one.
- **Phase 7 — Settings, automation, cross-cutting.** Settings UI (email templates + merge tags, numbering, currencies, custom-field definitions, per-customer tax exemption + Stripe Tax overrides, late-fee rules, salespeople), automated + manual payment reminders, late-fee application, salesperson/commission, activity log + comments per document, custom-fields engine.
- **Phase 8 — Customer depth + migration.** Full customer-detail tabs (Estimates/Payments/Credit Notes/Projects/Time/Expenses/Statements), contact persons, statement-of-account generator, unused-credit balance, inactivate-vs-delete, CSV import for customers + items, Zoho CSV import tooling with parallel-period reconciliation.
- **Phase 9 — QA, polish, deploy.** End-to-end passes, bug fixes, production monitoring, internal runbooks.

---

## Session 115 opener

**Order: P3 conversions → P1 residuals → P5 Reports.**
1. **P3 conversions** — build `ops_convert_estimate_to_project` and `ops_convert_estimate_to_retainer`, mirroring `ops_convert_estimate_to_invoice` (guarded source status, copy header/lines, flip the estimate, block double-convert via a converted-id guard). Backend-first, then the convert UI buttons.
2. **P1 residuals** — confirm the `charge.refunded` Stripe-dashboard subscription is live (Cole-side), build the refund-flow UI against the existing `ops_handle_stripe_refund` path, and verify the first real invoice/reminder email end-to-end (Resend-direct from `invoices@`/`reminders@`).
3. **P5 Reports** — the ~11 views as `security_invoker` views (canonical operations pattern), then the reports UI. Largest remaining phase.

**Session-open protocol:** GitHub MCP `get_file_contents` on `cbastianBWE/brainwise-internal-docs` for `build-queue.md`, `architecture-reference.md`, and this handoff; save to `/home/claude/internal-docs/`. Backend-first: `execute_sql` verify after every `apply_migration`; functional tests as one rolled-back DO block; mirror existing RPCs rather than write from memory; verify each Lovable plan against the live repo before approval and each shipped file after (curl `raw.githubusercontent.com`, not the chat preview).

**Fixtures:** ops admin (auth uid / JWT sub) = `<super-admin-uuid>`; ops org_id = `<ops-org-uuid>`; PTP instrument `INST-001` (version `INST-1.0.0`), 89 items = 47 professional + 42 personal, the 10 reverse items all in DIM-PTP-03. Create throwaway customers/invoices inside a rolled-back test block rather than depending on standing fixtures. For real test-user UUIDs, query Supabase directly (`SELECT id, email FROM users WHERE email LIKE 'testclientbwe+%@gmail.com'`).
