# BrainWise Internal Operations Platform

## Doc 3 of 5: Bookkeeping Approach + Export Spec (Reduced Scope)

**Version:** 1.0
**Author:** Claude (drafted with Cole Bastian, BrainWise Enterprises)
**Date:** May 21, 2026
**Status:** Decision document, not a build scope

**Key decisions locked at session:**

- Q-BOOKS1: Originally scoped as full double-entry bookkeeping replacement.
- Q-BOOKS2: Hybrid bookkeeping arrangement (Cole does day-to-day, bookkeeper reviews quarterly).
- **Decision after pushback:** Books is **out of v1 build scope.** QuickBooks Online (QBO) remains the books of record, used standalone. Bookkeeper continues with QBO.
- **Doc 1 gains a "Quarterly Bookkeeper Package" export function** to support the hand-off.
- **Stripe → QBO native integration is in scope as a v2 build item** (the bridge that eliminates manual quarterly CSV exports).

---

## 1. Why Doc 3 was reduced

This document was originally scoped to specify a full Zoho Books replacement: chart of accounts, journal entries, bank reconciliation, P&L, balance sheet, cash flow, year-end close, 1099s. That work was estimated at 5-7.5 months for one developer.

During scoping, the build-vs-buy analysis surfaced five reasons not to build:

1. **Tax and legal liability.** Accounting software produces filings that have real legal weight. Misclassification, missed depreciation, dropped journal entries, mismatched periods — any of these create audit risk and potential restatement liability. QuickBooks has been the subject of litigation when their software produced incorrect outputs; building in-house inherits the same exposure with no team to defend it.

2. **Bookkeeper trust.** The hybrid model (Cole + bookkeeper quarterly) depends on the bookkeeper accepting the books-of-record system. ~85% of US small-business bookkeepers use QBO; the rest use Xero, Sage, or Wave. None are trained on a custom Lovable + Supabase system. If books were built in-house, the realistic outcomes are: (a) bookkeeper refuses the engagement, (b) bookkeeper agrees but charges 3-5x normal rate due to learning cost, or (c) bookkeeper relationship ends and Cole becomes solo-responsible.

3. **Commodity features, non-differentiated.** Every accounting system has the same chart of accounts, the same double-entry mechanics, the same P&L/BS/CF structure (GAAP-defined). There is nothing about BrainWise's books that benefits from custom code.

4. **Cost.** ~5-7.5 months of full-time engineering vs. $30-90/month QBO subscription. The buy-side is a rounding error against the build cost, with a vastly better product on the other end.

5. **Existing native integrations.** QBO has mature native integrations with Stripe (free app in QBO marketplace), payroll providers (Gusto, ADP), tax filing services, and bookkeeper workflow tools. Building from scratch starts from zero on each.

The combined weight of these reasons is unusual in this scope series — Doc 1 (build invoice engine) and Doc 2 (build CRM) both had defensible build-vs-buy cases. Doc 3 did not.

---

## 2. The bookkeeping stack (decision)

### 2.1 Books of record

**QuickBooks Online** is the books of record. (Xero is an equivalent option if Cole prefers; this document uses QBO as the assumed choice but the integration spec in §6 applies to both with minor API differences.)

QBO Plan recommendation: **QBO Essentials or Plus.** Essentials ($75/month USD, 3 users) covers AR/AP, bill pay, multi-currency, basic reporting. Plus ($115/month, 5 users) adds project profitability, inventory, and class tracking. For BrainWise's current scale, Essentials is sufficient; upgrade to Plus only when project-level books-side profitability becomes useful (which mostly duplicates what Doc 1 provides).

### 2.2 Subscription and payment processing

**Stripe** remains the payment and subscription processor (locked from Doc 1 D1). Stripe Tax handles sales tax calculation (locked from Doc 1 Q4). Stripe transactions flow into QBO via the native Stripe app in the QBO marketplace (free); this happens with or without BrainWise's internal platform.

### 2.3 Bookkeeper workflow

- **Day-to-day:** Cole records invoices, expenses, and payments in Doc 1 (the BrainWise platform). Stripe transactions auto-sync to QBO via the Stripe-QBO native integration.
- **Quarterly:** Bookkeeper reviews QBO directly. Cole provides the "Quarterly Bookkeeper Package" export from Doc 1 (see §5) to reconcile any transactions that exist in Doc 1 but not yet in QBO (manual journal entries, offline payments, expense edits).
- **Year-end:** Bookkeeper closes books in QBO, generates tax-prep package, hands to CPA.

### 2.4 What Doc 1 still does

Doc 1 remains the canonical operational system for:

- Customer relationship and contact management (shared with Doc 2 CRM).
- Project management and time tracking.
- Estimates / proposals / contracts.
- Invoice creation and PDF generation.
- Recurring invoice scheduling.
- Retainer tracking.
- Credit notes.
- Expense capture (with project attribution).
- Payment recording.
- AR aging and customer balance reports.
- Project profitability.
- All operational reporting.

Doc 1 does **not** maintain a general ledger, a chart of accounts, journal entries, a balance sheet, or any other accounting-specific structure. QBO does that.

---

## 3. The two systems and what each owns

```
DOC 1 (BrainWise Operations)              QBO (Books of Record)
─────────────────────────────             ─────────────────────────────
Customers + contact persons               Chart of Accounts
Projects + tasks + time entries           Journal Entries (every transaction)
Estimates + proposals                     General Ledger
Invoices (creation, PDF, send)            Bank feeds + reconciliation
Recurring invoice schedules               Vendor bills / AP
Retainers + credit notes                  Customer accounts (AR)
Expenses (operational)                    P&L, Balance Sheet, Cash Flow
Payment recording                         Trial Balance
AR aging, customer balances               Sales tax filing reports
Project profitability                     1099 contractor tracking
Operational dashboards                    Year-end close
Stripe → invoices/payments                Stripe → revenue/AR (via native app)
                                          Multi-currency translation
                                          Depreciation schedules
                                          Retained earnings rollover
                                          Audit trail (accounting-grade)
```

### 3.1 Data flow

```
Customer pays Stripe invoice
  ├─→ Doc 1 marks invoice Paid + records Payment
  └─→ Stripe → QBO native sync: revenue recognized, AR cleared, Stripe fees recorded

Cole records an expense in Doc 1
  └─→ Doc 1 stores expense with project attribution
       │
       └─→ Quarterly: appears in Bookkeeper Package CSV
            └─→ Bookkeeper enters in QBO as vendor bill or expense

Cole sends an invoice from Doc 1 (not via Stripe Checkout, e.g., wire/ACH/check)
  └─→ Doc 1 stores invoice + records Payment when received
       │
       └─→ Quarterly: appears in Bookkeeper Package CSV
            └─→ Bookkeeper records in QBO

Recurring invoice fires in Doc 1, customer charged via Stripe
  ├─→ Doc 1 marks invoice Paid
  └─→ Stripe → QBO native sync: revenue + AR + fees recorded
```

The two arrows shown as "Quarterly" are the manual reconciliation step. These exist because Stripe → QBO native handles only Stripe-mediated transactions. Anything that happens in Doc 1 without touching Stripe (offline payments, manual journal corrections, non-Stripe expenses) needs to flow to QBO separately.

The Quarterly Bookkeeper Package automates this hand-off.

---

## 4. v1 build impact

Doc 3 reduction means Doc 1's effort estimate gains a small addition for the export functions.

### 4.1 Quarterly Bookkeeper Package (added to Doc 1 v1 scope)

A one-click export function in Doc 1 that produces a zip file containing:

- **Customers.csv** — all customers with QBO-compatible field shape (legal name, billing address, tax ID, payment terms, status).
- **Invoices.csv** — all invoices in the date range with line items flattened, status, applied retainers, applied credit notes.
- **Payments.csv** — all payments in the date range with allocation to invoices, payment mode (Stripe/Check/Cash/Wire/Other), reference number.
- **Expenses.csv** — all expenses in the date range with category, vendor, project attribution, billable flag, tax amount.
- **Credit Notes.csv** — all credit notes with applied invoices.
- **Refunds.csv** — all refunds with original payment reference.
- **Retainer Activity.csv** — retainer creations, payments, applications, refunds.
- **Reconciliation Summary.pdf** — totals by category, period start/end balances per customer, expected totals for QBO reconciliation.

CSV schemas are designed to match QBO's import format directly (bookkeeper can import most files directly via QBO's IIF/CSV import for the small subset of cases where bulk import is appropriate).

Build cost: **~3-5 days.** Most of this is existing report logic in Doc 1; the package is a bundler that runs all relevant reports for a date range and zips them.

### 4.2 What gets dropped from the original 5-7 month estimate

Everything else from the original Doc 3 scope:

- Chart of accounts engine — not built.
- Journal entry posting engine — not built.
- Bank feed integration via Plaid — not built (QBO has this natively).
- Bank reconciliation UI — not built.
- Vendor bills / accounts payable — not built (QBO does this).
- Recurring journal entries / depreciation — not built.
- Year-end close — not built.
- 1099 contractor tracking + form generation — not built (QBO does this).
- P&L, Balance Sheet, Cash Flow reports — not built (QBO produces these).
- Trial Balance, General Ledger detail — not built.
- Sales tax filing reports — not built (Stripe Tax + QBO handles this).
- Migration from QuickBooks — not needed (you're not leaving QBO).

**Net savings: ~5-7 months of build time and the entire accounting liability surface.**

---

## 5. Quarterly Bookkeeper Package — detailed spec

The single deliverable Doc 1 produces for the books workflow.

### 5.1 Trigger

- **Manual trigger:** Cole or Admin clicks "Export Bookkeeper Package" from Settings or Reports.
- **Scheduled trigger (v2):** auto-runs on the 1st of each quarter for the prior quarter, packages and emails the bookkeeper.

### 5.2 Date range selection

- Quarter selector (Q1/Q2/Q3/Q4 of a chosen year) with start/end dates auto-populated.
- Custom date range option.

### 5.3 Output format

- ZIP file named `BrainWise_Bookkeeper_Package_{period}_{generated_date}.zip`.
- Inside the zip:
  - 7 CSV files as listed in §4.1
  - 1 PDF reconciliation summary
  - 1 README.txt with: period covered, generation timestamp, totals for cross-check (total invoiced, total received, total refunded, total expensed), expected QBO reconciliation deltas.

### 5.4 CSV schemas (QBO-compatible)

Field naming follows QBO's standard import format where possible (Customer Name, Transaction Date, Amount, etc.) so the bookkeeper can use QBO's bulk import for clean cases.

For invoices and expenses with mixed Stripe-vs-offline payment routes, the CSV includes a `Stripe Sync Status` column: "Already in QBO via Stripe app" / "Needs manual entry." This lets the bookkeeper skip rows that are already reconciled and focus on the manual-entry remainder.

### 5.5 Reconciliation summary PDF

Single-page summary suitable for emailing to bookkeeper:

- Period covered.
- Total invoices issued (count + amount).
- Total payments received (count + amount).
- Total refunds (count + amount).
- Total expenses (count + amount, broken down by category).
- AR opening balance, closing balance.
- Top 10 customers by revenue in the period.
- Customers with disputes or write-offs in the period.
- Any anomalies flagged (invoices missing payment after 90 days, expenses without categorization, retainers older than 6 months unapplied).

### 5.6 Required Doc 1 data discipline

For the package to be useful, Doc 1 must capture the following correctly at the source:

- **Customer tax ID** populated for any customer being invoiced.
- **Expense category** required (not optional) on every expense record.
- **Vendor name** required on every expense (free text is fine; QBO will normalize).
- **Project attribution** on every expense and time entry where applicable (drives project profitability).
- **Payment mode** required on every Payment record (Stripe/Check/Cash/Wire/Other).
- **Reference number** populated for offline payments (check #, wire ID, etc.).
- **Retainer vs. revenue distinction** preserved (retainers are liabilities until applied; the export must mark unapplied retainer balances).
- **Credit notes have reason codes** (allowance, write-off, refund, correction).

These data-discipline requirements should be enforced in Doc 1's UI (required fields, dropdown picklists, no free-text where a controlled vocabulary makes sense). Most are already in Doc 1 v1.0 scope.

---

## 6. v2 build item — Stripe → QBO Direct Integration

The Quarterly Bookkeeper Package is the v1 solution. It works but requires manual quarterly reconciliation. A v2 build item eliminates the quarterly hand-off entirely by syncing Doc 1 → QBO continuously.

### 6.1 What this v2 build covers

Two complementary integrations:

**6.1.1 Stripe → QBO (native, no build):** The Stripe app in the QBO marketplace already does this. Install once, configure account mapping (Stripe payouts → which QBO account, Stripe fees → which QBO account, etc.), and Stripe transactions flow to QBO automatically. **Build cost: 0. Setup time: ~2 hours.** This should happen at v1 launch regardless.

**6.1.2 Doc 1 → QBO (custom build at v2):** A sync layer that pushes non-Stripe transactions from Doc 1 to QBO via the QBO API.

Specifically, the v2 build syncs:

- **Customers** — Doc 1 customer creates/updates → QBO customer creates/updates. `qbo_customer_id` stored on Doc 1 customers.
- **Invoices** — Doc 1 invoices for non-Stripe payment routes (wire, ACH outside Stripe, check) → QBO invoices.
- **Payments** — offline payments recorded in Doc 1 → QBO payments applied to the right invoice.
- **Expenses** — Doc 1 expenses → QBO vendor bills or expenses with proper account mapping.
- **Credit notes** — Doc 1 credit notes → QBO credit memos.
- **Refunds** — Doc 1 refunds → QBO refund receipts.

Does NOT sync (these come from Stripe → QBO native):

- Stripe-collected invoice payments.
- Stripe fees.
- Stripe payouts.

### 6.2 Build cost estimate for v2 QBO integration

| Item | Estimate | Notes |
|---|---|---|
| QBO OAuth + API client setup | 2-3 days | Includes token refresh, sandbox vs. production environment handling. |
| Account mapping configuration UI | 2-3 days | User maps Doc 1 expense categories → QBO expense accounts; Doc 1 income types → QBO income accounts. |
| Customer sync (create/update/match) | 2-3 days | Includes duplicate detection by name + tax ID. |
| Invoice sync (Doc 1 → QBO, offline-payment routes only) | 3-5 days | Skip Stripe-mediated invoices (already in QBO via native). Line item mapping, tax handling. |
| Payment sync (offline payments) | 2-3 days | Apply to correct QBO invoice. |
| Expense sync | 2-3 days | Map category → QBO account; vendor name handling. |
| Credit note + refund sync | 2 days | |
| Sync queue + error handling + retry | 3-4 days | Async queue with idempotency. Failed syncs surface in admin UI for manual review. |
| Sync status dashboard | 2-3 days | Per-record sync state, retry button, error log. |
| Manual override / unsync option | 1-2 days | "This record should not sync to QBO" flag. |
| Two-way conflict handling | 2-3 days | What happens if a record changes in QBO after sync from Doc 1. |
| QA + edge cases | 5-7 days | Includes period-lock handling (can't sync into a closed period), tax-rate mismatches, currency edge cases. |

**v2 subtotal: ~28-41 days (6-8 weeks).**

### 6.3 v2 trade-offs

**What you gain from v2:**

- No quarterly manual reconciliation.
- Bookkeeper sees real-time books rather than quarter-end snapshot.
- Reduced data discipline burden on Cole (fewer "did I categorize that correctly?" decisions, since sync errors surface in real-time).
- Better tax-time readiness — books are continuously closed-quarter-ready.

**What you lose / risks:**

- Sync failures are a real ongoing operational concern. QBO API rate limits, token expiration, schema drift (QBO updates their API), period locks — each is a vector for sync failures that need monitoring.
- Two-way sync between systems creates the "which is source of truth?" question. Doc 1 stays source of truth at v2; QBO is downstream-only. Any change in QBO does not propagate back. This is the right call but it must be enforced (bookkeeper edits in QBO can drift from Doc 1).
- One more vendor dependency (Intuit / QBO API).

### 6.4 v2 timing

The v2 QBO integration should be built only after:

1. Doc 1 v1 is in production for 3+ months and quarterly export workflow has been used twice.
2. Bookkeeper relationship is established and the quarterly cadence is working.
3. There's actual pain in the manual reconciliation that justifies 6-8 weeks of build.

If the quarterly package works fine, the v2 integration is permanently unnecessary. Many small businesses run this exact pattern indefinitely.

---

## 7. Risks of the standalone approach

The decision to keep books in QBO standalone (rather than building in-house) is the right call. But it has real ongoing costs:

### 7.1 Operational risks

- **Two systems to keep in sync.** Doc 1 and QBO will diverge if the quarterly reconciliation is skipped or done poorly. Reconciliation discipline is required.
- **Data discipline at source.** Bad data in Doc 1 (uncategorized expenses, missing vendor names, wrong project attribution) becomes the bookkeeper's quarterly headache. Doc 1's UI must enforce data quality.
- **Stripe → QBO native integration drift.** Stripe's QBO app occasionally has sync issues that aren't visible from either Doc 1 or QBO directly. Monitor monthly.
- **QBO subscription cost.** ~$75-115/month. Modest but recurring.

### 7.2 Strategic risks

- **If BrainWise productizes the platform later (sells to other coaches/consultancies)** — those customers will expect built-in books. The standalone-QBO model means BrainWise as a SaaS platform doesn't include accounting. This is genuinely fine because (a) most coaching consultancies prefer to use their existing QBO, and (b) the platform can integrate with QBO as a feature rather than replace it.
- **If BrainWise's complexity grows** (multiple entities, international subsidiaries, complex revenue recognition) — QBO scales to this but at higher tiers. Build-vs-buy revisits in that scenario; for now QBO handles it.

### 7.3 Mitigations

- Doc 1 UI enforces required fields at source (already in scope).
- Quarterly reconciliation is a calendar event (auto-reminder on the 5th of each quarter to run the export and send to bookkeeper).
- Stripe → QBO native sync configured at v1 launch with a documented monitoring checklist for monthly review.
- "QBO connection health" notification in Doc 1 v2 if sync state diverges (post-v2 QBO integration build).

---

## 8. Open questions

These need answers but they're operational, not architectural:

1. **QBO vs. Xero.** Defaulting to QBO based on US market share and bookkeeper familiarity. If the bookkeeper uses Xero, defer the decision to them. (Recommend: ask the bookkeeper their preference; both products are fine.)

2. **QBO plan tier.** Essentials ($75/mo) or Plus ($115/mo) at v1. Plus adds project profitability tracking, which mostly duplicates Doc 1. Recommend: Essentials at v1, upgrade only if specific need.

3. **Bookkeeper sign-off on the Quarterly Package format.** Before Doc 1 ships, the export schemas should be reviewed by the actual bookkeeper. They may want different column ordering, additional summary fields, or have a preferred QBO import template.

4. **Stripe → QBO setup at v1 launch.** Confirm Cole will install the Stripe app in QBO at v1 launch and configure account mapping. This is the foundation that makes the Quarterly Package only need to cover the non-Stripe gap.

5. **CPA hand-off at year end.** Does the CPA work directly with QBO or take a different format? If they take a different format, the Doc 1 year-end export may need additional reports (tax-prep-specific summaries).

---

## 9. Connection to other docs

- **Doc 1 (Invoice):** gains the Quarterly Bookkeeper Package export feature (~3-5 days added). All data-discipline requirements in §5.6 are enforced in Doc 1's UI.
- **Doc 2 (CRM):** unaffected. Pipeline data does not flow to QBO.
- **Doc 4 (Sign):** unaffected.
- **Doc 5 (Cross-cutting):** the books-of-record-is-QBO decision is one of the locked architectural choices; v2 QBO integration is a future build item documented in the roadmap.

---

## 10. Decision log

Locked in this doc:

- **D3-1:** Books of record is QBO (or Xero), used standalone. Not built in-house.
- **D3-2:** Stripe → QBO native integration (free app in QBO marketplace) is configured at v1 launch.
- **D3-3:** Doc 1 generates a Quarterly Bookkeeper Package export (~3-5 days added to Doc 1 v1 estimate).
- **D3-4:** Bookkeeper continues to work in QBO directly; Doc 1 is the operational source of truth, QBO is the accounting source of truth.
- **D3-5:** Doc 1 → QBO custom integration is a v2 build item (~6-8 weeks), deployed only if the quarterly reconciliation workflow proves painful enough to justify the build.
- **D3-6:** All accounting-specific scope (chart of accounts, journal entries, bank feeds, P&L, BS, CF, 1099s, year-end close, sales tax filing reports) is permanently out of v1 scope. Stripe Tax + QBO + bookkeeper handle these.

---

*End of Doc 3.*
