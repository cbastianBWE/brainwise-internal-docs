# BrainWise Internal Operations Platform

## Doc 1 of 5: Zoho Invoice Replacement Scope

**Version:** 1.1 (Decisions Q1-Q10 locked)
**Author:** Claude (drafted with Cole Bastian, BrainWise Enterprises)
**Date:** May 21, 2026
**Status:** Scope locked pending Doc 5 architectural decisions

**v1.1 changelog (Q1-Q10 resolution):**

- Q1: Own invoice engine (Option A). Baseline timeline holds.
- Q2: Customer portal v2 (deferred).
- Q3: Multi-currency v3 (single base currency, USD, at v1).
- Q4: Stripe Tax wrap in v1 (multi-state nexus today).
- Q5: 2-3 invoice PDF templates in v1 (Standard, Corporate, Detailed Services).
- Q6: Parallel run 1-2 months then hard cutover.
- Q7: No time rounding default (log actual time).
- Q8: No timesheet approval flow in v1 (data model preserves the option for v2).
- Q9: Late fees enabled in v1 (already in scope).
- Q10: Salesperson tracking in v1 (commission report included).

**Net v1 estimate after Q1-Q10: 5.5-8 months for one full-time developer.**

---

## 1. Purpose of this document

This is the first of five comprehensive scope documents covering a possible replacement of the Zoho One bundle (Invoice, Books, CRM, Sign) with internally-built functionality. The five documents in the series are:

1. **Doc 1 (this document):** Zoho Invoice replacement — customers, projects, tasks, time tracking, expenses, estimates, invoices, payments, customer portal (v2), and reports.
2. **Doc 2:** Zoho CRM layer — organizations, contacts, deals, pipeline, activities, email/calendar sync, reporting.
3. **Doc 3:** Zoho Books layer — chart of accounts, journal entries, bank reconciliation, vendor bills, financial reports, sales tax engine, year-end close.
4. **Doc 4:** Zoho Sign layer — document templates, e-signature flow, audit trail, build-vs-wrap decision.
5. **Doc 5:** Cross-cutting concerns — unified data model, architectural decision (module vs. separate product), Stripe integration architecture, multi-tenancy posture, migration path from Zoho data, sequencing across the four functional docs.

Stripe is the locked payment and subscription processor and is not part of this replacement scope. The platform integrates with Stripe but does not replicate Stripe's payment or subscription primitives.

This document covers Zoho Invoice's functional surface, what BrainWise needs from it today, what a built replacement must include, what the strongest competitor products do better than Zoho, the data model, effort estimates, and out-of-scope items.

---

## 2. Context and rationale

Cole Bastian currently uses Zoho Invoice as a personal-use tool tied to BrainWise Enterprises operations: tracking customers, organizing project work, logging hours, recording expenses, sending estimates, and issuing invoices that get paid via Stripe. The BrainWise platform itself runs on Supabase + Lovable + Stripe, and the operational tooling for running BrainWise Enterprises as a business currently lives outside that stack in Zoho.

The strategic question is whether the operational layer (invoicing, projects, time, CRM, books, e-sign) should consolidate into the BrainWise stack so that everything BrainWise touches — internal operations, customer-facing platform, billing, contracts — runs on a single technical foundation. That decision is the subject of Doc 5. This document scopes what would have to be built if the answer is yes.

### What's locked before this doc

- Stripe remains the payment and subscription processor.
- Architecture decision (module inside BrainWise vs. separate product) is deferred to Doc 5.
- End-user model: starts as Cole-only internal use, with a customer-facing portal in v2.
- Productizing to other coaches or consultancies is a maybe — Phase 2 if it happens at all.
- Project billing modes needed: fixed-fee, hourly, mixed, and retainer.
- Time tracking: just Cole today, designed for team later.
- 3-month target for full Zoho replacement is acknowledged as not realistic for one developer; this doc scopes the work honestly and Doc 5 sequences it.

---

## 3. Zoho Invoice feature inventory (the surface being replaced)

Zoho Invoice is a free product but is feature-rich. The features below are what Zoho Invoice actually ships, organized into functional modules. This inventory is the baseline a built replacement must meet or consciously decide to drop.

### 3.1 Customers (contacts and contact persons)

Zoho models customers as a top-level **Customer** record with one or more **Contact Persons** underneath. The customer record holds billing identity (legal name, billing address, shipping address, tax registration, payment terms, currency, language); contact persons are individuals at that customer (name, email, phone, role) who receive invoices, can be invited to the customer portal, and can be CC'd on outgoing communications. A customer can also be flagged as **Individual** vs. **Business** which drives label changes on PDFs and tax handling.

Other customer-level capabilities:

- **Custom fields** on customers (text, number, date, dropdown, checkbox).
- **Payment terms** (Net 15, Net 30, Net 45, Net 60, Due on Receipt, or custom). Drives invoice due-date calculation.
- **Default currency per customer** with multi-currency exchange rate handling.
- **Default language for invoices** (English, Spanish, French, German, Portuguese, others — 17 languages in Zoho).
- **Default tax authority and tax-exempt status.**
- **Unused credits** (credit notes that haven't been applied to invoices yet) and **excess payments** (overpayments) tracked at the customer level.
- **Statements of Account** — a PDF showing all transactions with a customer over a date range, with running balance and a list of unpaid invoices.
- **Customer review** capability — clients can rate the business and leave feedback through the portal.
- **Address book** for billing and shipping addresses with formatting customization (the order of fields on the PDF can be configured per country).
- **Contact import** via CSV or from Gmail/Outlook/Google Contacts.
- **Customer-level reminders** can be globally disabled if a customer needs special handling.

### 3.2 Items (products and services)

Items are the line-item catalog used on quotes and invoices. Each item has a name, description, SKU, selling price, default tax, optional cost price (for profitability tracking), and item type (Goods or Services). Items can be flagged as **Inventory items** in Zoho Books but Zoho Invoice keeps them simple. **Price lists** allow per-customer custom pricing for the same item.

### 3.3 Projects

This is the most operationally important module for the current use case. Zoho projects support **four billing methods**, which is the canonical service-business billing taxonomy:

1. **Fixed Cost for Projects** — flat project price. Time is tracked but does not feed the invoice amount. One invoice line item for the whole project.
2. **Based on Project Hours** — single hourly rate applied to all hours logged on the project regardless of who logged them or what task. Invoice = total hours × project rate.
3. **Based on Task Hours** — each task has its own hourly rate. Invoice = sum of (task hours × task rate) across all tasks.
4. **Based on Staff Hours** — each user has their own hourly rate. Invoice = sum of (user hours × user rate) across all users.

Other project capabilities:

- **Project budget** (in hours or dollars). Comparison of planned vs. actual is shown on the project dashboard.
- **Project status** (Active, Completed, Inactive).
- **Tasks** within a project (name, description, optional task rate, optional budget hours per task, billable/non-billable flag).
- **Users assigned to the project** with their hourly rate for that project (rates are project-scoped, not global).
- **Project-attributed expenses** rolled into invoices alongside time.
- **Retainer invoices** (advance payments) optionally created from a project.
- **Project notes** and project-level attachments.
- **Project-level reports**: actual hours vs. budgeted, unbilled hours, project profit and loss.
- **Multiple invoices per project** with date-range selection (e.g., monthly billing for ongoing engagements).
- **Convert estimate → project** (project is auto-created from an approved estimate with line items pre-populated as tasks).

### 3.4 Time tracking (timesheets)

Time entries belong to a (project, task, user, date) tuple and carry an hours value, description, and billable/non-billable flag. Zoho ships:

- **Live timer** (start/stop/pause) that runs in the web app, mobile apps, and via a Chrome extension.
- **Manual time entry** (log retroactive hours).
- **Weekly timesheet view** — grid of days × tasks, fill in hours per cell.
- **Calendar view** — see logged time in a month or week calendar layout.
- **Time entry rounding** — round logged hours up to nearest 6/15/30 minutes.
- **Bulk time entry import** from CSV.
- **Timesheet approval flow** — a manager (or the customer via portal) approves time entries before they can be invoiced. Approval is per time entry, not per timesheet.
- **Custom fields on time entries.**
- **Filtering**: by project, by task, by user, by date range, by billable status, by invoiced/uninvoiced status.
- **Unbilled hours dashboard** — running total of approved-but-not-yet-invoiced hours per project and per customer.
- **Mobile time tracking** — log hours on iOS, Android, and Apple Watch.

### 3.5 Expenses (and mileage)

Expenses are individual transactions (date, category, amount, vendor, tax, customer assignment, project assignment, billable/non-billable flag, receipt attachment, notes).

- **Expense categories** are user-configured (e.g., Travel, Meals, Software, Subcontractors).
- **Billable expenses** roll into invoices alongside time entries. Markup percentage is supported.
- **Receipt attachment** via photo upload or email-to-receipt inbox.
- **Auto-scan / OCR** receipts (extracts vendor, amount, date from photo).
- **Mileage expenses** — record miles driven; the system multiplies by the configured per-mile rate.
- **Recurring expenses** (e.g., monthly software subscriptions that should auto-create an expense each month).
- **Bulk expense import.**
- **Expense reports** by category, by customer, by project, by date range.

### 3.6 Estimates (quotes)

Estimates are pre-invoice proposals sent to a customer for approval. They contain the same line-item structure as invoices but have a different status lifecycle.

- **Estimate statuses**: Draft, Sent, Viewed, Accepted, Declined, Invoiced, Expired.
- **Expiration date** on estimates with auto-expiry.
- **Convert estimate → invoice** (one click; line items carry over).
- **Convert estimate → project** (auto-creates the project with tasks pre-filled).
- **Convert estimate → retainer invoice** (collects an advance payment percentage automatically when accepted).
- **Customer portal acceptance** — customer can accept, decline, or comment on the estimate from the portal. Status updates back to Zoho automatically.
- **Email acceptance** — accept-by-link in the estimate email with no portal login required.
- **E-signature via Zoho Sign integration** — get a digitally signed copy of the accepted estimate.
- **Estimate history** — full audit trail of when sent, viewed, accepted, comments exchanged.
- **PDF templates** — branded, customizable, multi-language.
- **Discount handling** — line-item or invoice-level, percentage or flat amount.
- **Tax handling** — line-item tax, invoice-level tax, multi-tax (state + city + special district stacking).
- **Custom fields** on estimates.
- **Reference number** (your internal reference) separate from estimate number (sequential).
- **Adjustment field** for rounding or arbitrary positive/negative adjustments.
- **Salesperson field** for tracking who created the estimate (commission attribution later).
- **Estimate cloning** to base a new estimate on an existing one.

### 3.7 Invoices

This is the operational core. Invoice statuses: Draft, Sent, Viewed, Partially Paid, Paid, Overdue, Void, Written Off.

Invoice creation paths:

- **Manual creation** from scratch with arbitrary line items.
- **From an estimate** (convert estimate to invoice, one click).
- **From a project** (bill unbilled hours and unbilled expenses; choose date range and grouping).
- **Recurring invoice** auto-fires on schedule.
- **From a retainer** (after retainer is paid, generate the real invoice and apply retainer credit).

Line items:

- **Item-based line items** (pulled from item catalog).
- **Free-form line items** (description + quantity + rate, no catalog item).
- **Time entry line items** (each billed time entry becomes a line, or grouped by task/user/project).
- **Expense line items** (billable expenses become lines with optional markup).
- **Header/section rows** to organize line items into groups (e.g., "Phase 1 — Discovery" header above several line items).

Invoice-level fields and behaviors:

- **Invoice number** (configurable prefix and starting number).
- **Reference number** (your customer's PO or contract number).
- **Issue date** and **due date** (auto-calculated from payment terms).
- **Currency** with FX rate snapshot.
- **Tax** — line-item taxes plus invoice-level tax, multi-tax stacking.
- **Discount** — line-item or invoice-level, percentage or flat.
- **Shipping charges** and **adjustment field**.
- **Notes to customer** (appears on PDF) and **terms and conditions** (also appears on PDF).
- **Salesperson assignment.**
- **Attachments** — additional files attached to the invoice (sample work, supporting docs).
- **Custom fields.**

Invoice operations:

- **Email send** with custom subject and body, CC recipients, BCC.
- **Schedule send** for future date.
- **Download as PDF**, **print**, **export**.
- **Mark as sent** for offline-delivered invoices.
- **Mark as void** (preserves the invoice in records but flags it as canceled).
- **Write off** (mark as uncollectible, removes from receivables).
- **Convert to recurring** (turn a one-off into a template).
- **Clone** an invoice.
- **Delete** (only allowed when in draft).
- **Comments and history** on each invoice with full audit trail (who did what, when).
- **Customer reviewed/viewed timestamp** automatically recorded when client opens the email or portal link.

### 3.8 Recurring invoices (and retainer invoices)

**Recurring invoices** auto-generate on a schedule (daily, weekly, monthly, quarterly, yearly, or custom intervals). Configuration includes: start date, end date or "never ends," number of occurrences, day of month, time of day, currency, line items (same options as a regular invoice), tax, auto-charge a stored card (requires Stripe customer with saved payment method), and auto-email on generation.

**Retainer invoices** are a separate doc type for collecting advance payments. They appear as a liability until applied to a regular invoice. Retainers can be created standalone, from an estimate (with a percentage of the estimate total as the retainer amount), or from a project. When a real invoice is generated, retainer credit can be applied to reduce the invoice balance.

### 3.9 Payments received

Payment records link to invoices and represent money received. Each payment has: payment date, amount, payment mode (Stripe/card/ACH/check/cash/wire/other), reference number, notes, allocation across one or more invoices, and any excess amount that becomes a customer credit.

- **Online payments** received through Stripe (or other gateways) auto-create a payment record and mark the invoice paid.
- **Offline payments** are recorded manually (e.g., "received check #1234 for $5,000 on May 15").
- **Bulk payment** — apply one received payment across multiple invoices in one action.
- **Partial payments** track running balance on the invoice.
- **Overpayment / advance payment** creates customer credit available for future invoices.
- **Refunds** — issue a refund through the payment gateway, recorded as a negative payment.

### 3.10 Credit notes

Credit notes reduce a customer's balance (returns, billing corrections, goodwill credits, write-offs of disputed amounts). Status lifecycle: Draft, Open, Closed, Void. A credit note can be applied to one or more invoices, or refunded to the customer.

### 3.11 Customer portal

The portal is a separate logged-in space for the customer (and their contact persons) where they can see all transactions with the business. Features:

- **Dashboard** showing outstanding balance, unread items, pending approvals.
- **Estimates** list with view/accept/decline/comment.
- **Invoices** list with view, pay now, download.
- **Payments** history.
- **Statements** of account, downloadable.
- **Projects** view (configurable) — show logged hours, unbilled hours, project status.
- **Timesheet approval** by the customer (when enabled).
- **Comments** on individual transactions — back-and-forth thread between business and customer.
- **Account information** — customer can update their own contact details (configurable).
- **Custom portal branding** — logo, colors, custom domain (with SSL).
- **Multi-contact access** — each contact person at the customer gets their own login.
- **Customer review** — leave a star rating and written feedback.

For BrainWise, this is explicitly v2 scope. v1 ships without the portal.

### 3.12 Reports

Zoho Invoice ships dozens of reports. The ones that matter for the operational use case:

- **AR Aging Summary** — outstanding receivables bucketed by 0-15, 16-30, 31-45, 46-60, 60+ days.
- **AR Aging Detail** — same buckets but listing each open invoice.
- **Sales by Customer** — revenue per customer over a date range.
- **Sales by Item** — revenue per item/service over a date range.
- **Sales by Salesperson** — for commission tracking.
- **Invoice Details** — every invoice in a date range with status.
- **Payments Received** — every payment in a date range.
- **Project Profitability** — actual revenue minus actual cost (time × user cost rate) per project.
- **Project Revenue Summary** — actual vs. budgeted revenue per project.
- **Time Tracking** — hours logged by user, by project, by task, by date.
- **Unbilled Hours/Expenses** — what's ready to be invoiced.
- **Expense by Category** — spending breakdown.
- **Expense by Customer** — billable expense pipeline.
- **Customer Balance Summary** — outstanding balance per customer.
- **Credit Notes Detail.**
- **Top Customers by Revenue, by Sales Volume.**
- **Tax reports** — sales tax collected by jurisdiction.
- **Activity Log** — audit trail of user actions.
- **Customer Review report** — list of customer-submitted ratings/feedback.

All reports support: date-range filter, customization of columns shown, export to PDF/CSV/XLSX, scheduled email delivery, drill-down to source transactions.

### 3.13 Settings, automation, and integrations

- **Email templates** — customizable templates for invoice send, payment receipt, reminders, estimate, retainer, statement, recurring invoice notice, credit note.
- **Email customization** — sender name, reply-to, subject, body, with merge tags.
- **Payment reminders** — multiple automated reminders before due date, on due date, after due date; manual reminders on demand; customer-level disable.
- **Late fee automation** — flat or percentage late fee applied to overdue invoices (FreshBooks has this; Zoho's is less mature).
- **Numbering schemes** — separate sequence prefixes for invoices, estimates, retainers, credit notes, payments. Auto-increment, with optional date-based reset.
- **Currency settings** — base currency, additional currencies, FX rates (manual or auto-pulled from a provider).
- **Tax settings** — tax authorities, tax rates, compound taxes, tax groups, exemption codes.
- **Custom field definitions** for customers, items, projects, tasks, time entries, expenses, estimates, invoices.
- **User roles and permissions** — Admin, Staff, Timesheet Staff (time entry only).
- **API access** — full REST API with all entities exposed.
- **Webhooks** for status changes.
- **Integrations** — native to Zoho Sign, Zoho CRM, Zoho Books, Zoho Expense, Zoho Projects; payment gateways (Stripe, PayPal, Square, Authorize.net, 2Checkout, Razorpay, others); email (Gmail, Outlook); calendar; Slack; Mailchimp.
- **Mobile apps** — iOS, Android, Windows.
- **Multi-language invoice PDFs** — 17 languages.
- **Multi-organization** — manage multiple businesses from one login.

---

## 4. Competitor cross-walk (what to steal from whom)

Zoho Invoice is feature-rich but its UI is dated and its UX is rough. The strongest competitors do specific things meaningfully better. This section identifies what to take from each.

### 4.1 FreshBooks (the polish leader)

FreshBooks is widely regarded as the best invoicing experience for small service businesses. The product surface is narrower than Zoho's but every visible piece is more polished.

**Take from FreshBooks:**

- **One-click time-to-invoice workflow.** From the time entry list, select unbilled entries, click "Invoice," and the invoice draft is pre-populated with grouping options offered as toggles (group by task, by user, by date, by week, single line). The flow takes 2-3 clicks vs. Zoho's 6-8.
- **E-signature on estimates and proposals built into the product**, not via a separate Sign integration. Client clicks "Accept" in the email, types their name, and the signed PDF is stored with the proposal. No separate Zoho Sign hop.
- **Project profitability dashboard** showing live revenue, cost (based on user cost rate, separate from billing rate), and margin per project. Updated as time is logged.
- **Late fee automation** — flat or percentage, configurable per-invoice or globally, with grace period before applying.
- **Automated expense receipt capture** — upload a receipt photo and the system extracts vendor, date, amount, and tax automatically using OCR + ML. Zoho's auto-scan is slower and less accurate.
- **Proposals (not just estimates)** as a first-class document type. Proposals contain a project description, deliverables, timeline, line items, and terms — meant to look like a small consulting proposal, not a price quote.
- **Client retainers** as a discrete object — set up a recurring "credit" that the client pays for in advance, and bill against the retainer balance until depleted. Subtly different from Zoho retainer invoices (which are advance payments tied to a single project) — FreshBooks retainers are ongoing relationships with periodic top-ups.
- **Client view of invoices** — clean mobile-friendly invoice page with one-click pay, no login required.
- **Sub-second invoice load and PDF generation.** Zoho can be slow.

**What FreshBooks does *worse* than Zoho:**

- 5-billable-clients cap on the Lite plan (Zoho Invoice is free).
- No real CRM (Zoho has light CRM features baked in).
- No customer portal as rich as Zoho's.
- Weaker reporting on the lower plans.
- Per-team-member fees.

### 4.2 Harvest (the time-tracking purist)

Harvest is dedicated time-tracking software with invoicing bolted on. The time-tracking model is the cleanest in the category.

**Take from Harvest:**

- **Effortless timer UX.** A persistent timer pill at the top of the screen, one-click start/stop, with the current task name visible. Switching tasks is instant. Browser extension adds timer buttons to Jira, GitHub, Asana, Trello tickets so time can be logged in context.
- **Weekly timesheet grid** that loads in milliseconds. Type hours into cells like a spreadsheet. Tab between cells. Bulk-edit with multi-select. The interaction model is what people who track time daily actually want.
- **Visual budget burn-down per project** — a horizontal bar showing budget consumed in real time as time is logged. Colors shift from green to yellow to red as you approach budget. This single visual is the most-cited reason Harvest users stay on Harvest.
- **Capacity reporting** — see who's overcommitted vs. has bandwidth, surfaced as a heatmap.
- **Forecast integration (sister product)** for scheduling future hours against capacity.
- **Round-up to nearest interval** — granular config (round up to nearest 6 min, 15 min, etc.) with per-project overrides.
- **"Already logged today" reminder** if a user hasn't logged time for the day by 5pm.

**What Harvest does *worse* than Zoho:**

- No recurring invoices.
- No e-signature on estimates.
- No CRM features.
- Per-seat pricing scales aggressively.
- Reporting customization is shallow.

### 4.3 Bonsai (the freelancer all-in-one)

Bonsai targets solo professionals with a tightly integrated proposal → contract → project → invoice flow.

**Take from Bonsai:**

- **Pipeline view: proposal → contract → project → invoice** as a single visible flow per client. You see the state of the engagement, not just the documents. Each engagement card shows where it is in the lifecycle.
- **Attorney-vetted contract templates** organized by service type (consulting, coaching, design, development, etc.) with plug-and-play fill fields. Customers don't need to write their own contract from scratch.
- **Service library** — pre-defined services (e.g., "Strategy Workshop — $5,000 — 8 hours") that can be dropped into proposals and contracts.
- **Onboarding forms** sent to new clients to collect intake info (brand assets, login credentials, project preferences) before work begins.
- **Auto tax estimates** for self-employed users based on income/expense data (a niche feature, but useful for any solo-operator user).

**What Bonsai does *worse* than Zoho:**

- Each individual module (invoicing, expenses, accounting) is shallower than the dedicated tool. The all-in-one breadth comes at a depth tax.
- Per-feature limits on lower plans.
- Less robust multi-currency support.
- Weak for team use (single-seat focus).

### 4.4 QuickBooks Online (the accountant standard)

QuickBooks Online is overkill for invoicing alone but ships features that matter as the business scales.

**Take from QuickBooks:**

- **Progress invoicing** — bill a percentage of an estimate (e.g., 30% on signing, 40% on milestone, 30% on delivery) with the estimate as the parent and invoices as children. Each invoice references the estimate and shows running totals.
- **Batch invoicing** — create multiple invoices at once with the same line items but different customers (useful for monthly retainer billing across many clients).
- **Sales tax engine with automatic rate lookup by jurisdiction** — for US sales tax across multiple states, the system pulls the correct combined state + county + city rate based on the customer's shipping address. This is genuinely hard to build and worth wrapping a vendor (Avalara, TaxJar) for.
- **Bank reconciliation** with rule-based auto-categorization (deferred to Doc 3 / Zoho Books layer).
- **1099 contractor tracking** for year-end vendor reporting.

**What QuickBooks does *worse* than the alternatives:**

- UI is dated and complex for non-accountants.
- Time tracking and project management feel bolted-on.
- Per-user pricing.
- Customer support is variable.

### 4.5 Wave (the free baseline)

Wave is free forever for invoicing and basic accounting, supported by payment processing fees.

**Take from Wave:**

- **Unlimited invoices and clients on the free plan.** The mental model of "no per-invoice or per-client friction" is the right starting posture for a service business — you don't want billing software to disincentivize sending more invoices.
- **Simple, fast invoice creation** — the form is opinionated and minimal. The trade-off is reduced customization.

**What Wave does *worse* than the alternatives:**

- No time tracking.
- No projects.
- Weak reporting.
- Limited customization.
- Payroll is US-state-limited.

### 4.6 Stripe Invoicing (the programmatic baseline)

Stripe Invoicing isn't direct competition for Zoho Invoice — it's a primitive. But it matters because the built BrainWise platform already has Stripe deeply integrated.

**Take from Stripe Invoicing:**

- **Smart payment retries with optimal-time logic** — when a card is declined, Stripe retries at times that statistically improve recovery rate. Recovers 25-35% of failed charges. This logic should be inherited automatically by using Stripe as the payment processor.
- **Hosted invoice pages** — every Stripe invoice has a public URL with a polished, mobile-friendly pay-now page. This can be the v1 customer portal substitute.
- **Webhook events for every invoice state change** — invoice.created, invoice.sent, invoice.paid, invoice.payment_failed, invoice.voided. Use these as the source of truth for invoice status sync.
- **PDF generation server-side** — Stripe will generate the PDF; you don't have to.

**What Stripe Invoicing doesn't do (and is why it's not the full answer):**

- No projects, no time tracking, no expenses.
- No estimates / proposals.
- No customer portal beyond the per-invoice pay page.
- No CRM.
- No reporting beyond payment data.
- Limited PDF customization.

### 4.7 Summary — the synthesis target

The product to build pulls:

- **Feature breadth** from Zoho Invoice.
- **UX polish and time-to-invoice workflow** from FreshBooks.
- **Timer UX and budget burn-down visual** from Harvest.
- **Proposal → contract → invoice pipeline view** from Bonsai.
- **Progress invoicing and tax-engine integration** from QuickBooks.
- **No-cost-friction posture and Stripe-native architecture** from Wave + Stripe Invoicing.

This is the design north star: Zoho's breadth, FreshBooks' polish, Harvest's timer, Bonsai's pipeline thinking, QuickBooks' tax accuracy.

---

## 5. v1 scope (the actual build for BrainWise internal use)

This is what gets built in the first delivery. v1 assumes Cole-only use, internal-only access, no customer portal.

### 5.1 Customers module

**In scope for v1:**

- Customer record with: display name, legal name, type (Individual / Business), email, phone, website, billing address, shipping address, tax registration ID, default currency, default payment terms, default tax rate, language preference, status (Active / Inactive), notes, custom fields.
- Contact persons (multiple per customer): name, email, phone, role, salutation, primary contact flag, portal access flag (off in v1).
- Customer search and filter (by name, status, balance).
- Customer detail page with transaction tabs: Estimates, Invoices, Payments, Credit Notes, Projects, Time Entries, Expenses, Statements.
- Statement of Account generator with date-range, with-or-without unpaid-only filter, PDF export.
- Customer-level unused credit balance (sum of unapplied credit notes and overpayments).
- CSV import for customers.
- Custom field definitions (text, number, date, dropdown, checkbox).
- Hard delete vs. inactivate distinction — inactivate is the default to preserve historical data.

**Deferred to v2 or later:**

- Customer portal access (v2).
- Gmail/Outlook contact sync (v3+).
- Automatic deduplication on import (v2).
- Customer-submitted reviews and ratings (v2).

### 5.2 Items module

**In scope for v1:**

- Item record with: name, SKU, description, item type (Goods / Services), default selling price, default cost price (optional, for profitability), default tax rate, status.
- Item search/filter.
- CSV import.

**Deferred:**

- Inventory tracking (out of scope — deferred to Doc 3 if ever needed).
- Per-customer price lists (v2).

### 5.3 Projects module

**In scope for v1:**

- Project record with: name, customer (required), billing method (Fixed Cost / Project Hours / Task Hours / Staff Hours), status (Active / Completed / Inactive), description, start date, end date, budget hours, budget amount.
- Tasks under projects with: name, description, billable flag, task rate (used when billing method is Task Hours), budget hours.
- Users assigned to project with: user-project rate (used when billing method is Staff Hours), cost rate (internal, for profitability).
- Project notes (free-form journal of project updates).
- Project file attachments.
- Project dashboard showing: actual hours vs. budget (with visual bar), unbilled hours, unbilled expenses, invoiced revenue to date, total revenue (invoiced + unbilled), actual cost (hours × user cost rate), margin, status of associated estimates/invoices/retainers.
- Multiple invoices per project with date-range selection (for monthly billing of ongoing engagements).
- Convert estimate → project (auto-create tasks from estimate line items).
- Project-level reports (rolled up into the global Reports module).

**Deferred:**

- Capacity / scheduling features (v3+, only relevant when team is added).
- Subtasks (v2 if needed).
- Project templates (v2).
- Gantt or Kanban visualizations (out of scope — projects here are billing containers, not project management).

### 5.4 Time tracking module

**In scope for v1:**

- Time entry record with: date, project, task, user (Cole-only at v1 but data model is multi-user from day one), hours, description, billable flag, invoiced flag, invoice link, approved flag (always true at v1; approval workflow is v2).
- **Live timer** — start/stop/pause with project + task selection. Currently-running timer is visible globally in the app. Closing the browser does not stop the timer (server-side state).
- **Manual time entry form** — date, project, task, hours, description.
- **Weekly timesheet grid** — days across, projects/tasks down, type hours into cells. Tab navigation. Save on blur.
- **Calendar view** — month/week with logged time as blocks.
- **Filter and list view** — by date range, project, customer, billable status, invoiced status.
- **Round-up rule** — default is **no rounding** (Q7 locked). The setting is configurable per-organization (no rounding / round to nearest 6 min / 15 min / 30 min) but the default-out-of-box value is no rounding.
- **Unbilled hours dashboard** — total approved-but-not-invoiced hours per project and per customer.

**Note on approval (Q8):** v1 does not enforce timesheet approval. All time entries are implicitly approved on creation. The data model preserves the `is_approved`, `approved_by`, and `approved_at` fields as nullable columns so v2 can add the approval workflow without schema migration.

**Deferred:**

- Mobile app timer (v2 — web-mobile-responsive at v1; native app later if ever).
- Timesheet approval workflow (v2 per Q8 — data model preserves the option).
- Chrome extension for context-aware timer (v3+).
- Bulk CSV import of time entries (v2).
- Per-user idle detection (out of scope).

### 5.5 Expenses module

**In scope for v1:**

- Expense record with: date, category, vendor, amount, currency, tax, customer (optional), project (optional), billable flag, markup percentage (when billable), receipt attachment (file upload), notes, custom fields.
- Expense categories (user-configurable).
- Mileage expense — record miles, system multiplies by configured per-mile rate (set the standard IRS rate by default, configurable).
- Recurring expenses (monthly subscriptions etc.) — auto-create on schedule.
- CSV import.
- Unbilled expenses dashboard.

**Deferred:**

- Receipt OCR / auto-scan (v3 — meaningful AI lift; vendor wrap candidates: Veryfi, Mindee, AWS Textract).
- Email-to-expense inbox (v2).
- Expense approval workflow (v2 — relevant for team).
- Per diem and travel rules (out of scope for v1).

### 5.6 Estimates / quotes module

**In scope for v1:**

- Estimate document with: customer, contact persons (CC list), estimate number (auto-incremented, configurable prefix), reference number, issue date, expiration date, currency, status (Draft / Sent / Viewed / Accepted / Declined / Invoiced / Expired), line items (item-based or free-form), discount, tax, adjustment, notes to customer, terms.
- Line items with: item / free-form, description, quantity, unit price, line discount, line tax, line total. Header/section rows for grouping.
- Status lifecycle automation: Sent (after email), Viewed (when client opens the email or pay-link), auto-expire (after expiration date passes).
- Customer accept/decline via email link (no portal login at v1).
- Convert estimate → invoice (one-click; line items carry over; ability to edit before saving).
- Convert estimate → project (one-click; tasks pre-populated from line items).
- Convert estimate → retainer invoice (with retainer percentage of estimate total).
- PDF generation with BrainWise branding.
- Estimate cloning.
- Estimate comments / history audit log.

**Deferred:**

- E-signature on estimates (deferred to Doc 4 — Zoho Sign replacement).
- Customer portal acceptance (v2).
- Proposal-style estimates with rich-text descriptions and embedded images (v2).

### 5.7 Invoices module

**In scope for v1:**

- Invoice document with: customer, contact persons, invoice number (auto, configurable), reference number, issue date, due date (auto from payment terms), currency, status (Draft / Sent / Viewed / Partially Paid / Paid / Overdue / Void / Written Off), line items, discount, tax, shipping, adjustment, notes, terms, attachments.
- Line items: item-based, free-form, time-entry-based (each entry becomes a line, with grouping options: by task, by user, by date, by week, single line per project), expense-based (with markup), header/section rows.
- **Invoice creation paths:**
  - Manual from scratch.
  - From an estimate.
  - From a project (select unbilled time + expenses for a date range).
  - From a recurring invoice template.
  - From a retainer (apply retainer credit).
- **Status lifecycle:** Draft → Sent (after email) → Viewed (when opened) → Partially Paid / Paid (on payment) → Overdue (auto after due date passes without full payment) → Void or Written Off (manual).
- **Invoice operations:** email send, schedule send, mark as sent, download PDF, print, void, write off, convert to recurring, clone, delete (draft only).
- **Stripe payment integration:**
  - "Pay Now" button on emailed invoice opens a hosted Stripe Checkout page.
  - Stripe webhook → invoice marked Paid; payment record auto-created.
  - Card-on-file storage for auto-charge on recurring invoices.
  - Refund flow.
- **Comments and history** with full audit trail.
- **Invoice PDF** — BrainWise-branded, configurable template.
- **Tax handling** — line-item taxes, invoice-level taxes, compound taxes (multi-tier stacking).
- **Discount handling** — line-item or invoice-level, percentage or flat.
- **Adjustment field** for rounding or arbitrary corrections.
- **Custom fields.**
- **Reference number** separate from invoice number.

**Deferred:**

- Progress invoicing (bill 30/40/30% of an estimate) — v2.
- Batch invoicing (one form, many invoices) — v2.
- Customer portal pay flow — v2.
- Multi-currency — v3 (single base currency USD at v1 per Q3).

### 5.8 Recurring invoices

**In scope for v1:**

- Recurring invoice template with: customer, line items, schedule (frequency, start date, end date or never-end, day of month, time), currency, auto-charge stored card flag, auto-email flag.
- Generation engine — cron job (or pg_cron in Supabase) that runs daily, generates due invoices, optionally auto-charges via Stripe, optionally emails the customer.
- Skip-next-occurrence and pause/resume.

**Deferred:**

- Per-line proration on mid-cycle changes (v3+; complex).
- Subscription upgrades/downgrades (out of scope — Stripe Subscriptions handles this if needed).

### 5.9 Retainer invoices

**In scope for v1:**

- Retainer invoice as a separate document type with: customer, project (optional), amount, status (Draft / Sent / Paid / Applied / Refunded).
- Retainer payment is a Stripe-collected payment; on payment, retainer becomes a customer credit.
- Apply retainer credit to a regular invoice on creation (full or partial application).
- Refund retainer back to customer if unused.

**Deferred:**

- Top-up retainers (FreshBooks-style ongoing retainer relationships with periodic top-ups) — v2.

### 5.10 Payments

**In scope for v1:**

- Payment record with: date, amount, currency, payment mode (Stripe / Card / ACH / Check / Cash / Wire / Other), reference, notes, allocation to one or more invoices, excess amount → customer credit.
- Online payment via Stripe — auto-created from webhook.
- Manual offline payment entry.
- Bulk payment (apply one payment across multiple invoices).
- Partial payment with running balance.
- Refund flow (Stripe-initiated for online, manual for offline).
- Payment receipt email to customer.

**Deferred:**

- ACH-specific reconciliation flows beyond what Stripe ACH provides (out of scope unless needed).
- Direct bank deposit recording with reconciliation (deferred to Doc 3).

### 5.11 Credit notes

**In scope for v1:**

- Credit note document with: customer, line items, reason, amount, status (Draft / Open / Closed / Void).
- Apply to one or more invoices, or refund to customer.
- PDF generation.

### 5.12 Customer portal

**Out of scope for v1.** Customer-facing access is via email + Stripe hosted invoice page only. Full portal is Doc 1.5 / v2 scope.

When built (v2), the portal includes:

- Per-contact-person login (passwordless email link or password).
- Dashboard with outstanding balance, pending approvals, recent activity.
- Estimates with view/accept/decline/comment.
- Invoices with view, pay, download.
- Payment history.
- Statements with date-range selection.
- Project view (logged hours, unbilled hours, status) — configurable per customer.
- Timesheet approval (when enabled).
- Comments thread per transaction.
- Custom subdomain (e.g., `clients.brainwiseenterprises.com`) with BrainWise branding.
- Multi-language support (deferred to v3).

### 5.13 Reports

**In scope for v1:**

- AR Aging Summary (0-15, 16-30, 31-45, 46-60, 60+).
- AR Aging Detail.
- Sales by Customer.
- Sales by Item.
- Invoice Details (date range, status filter).
- Payments Received (date range, mode filter).
- Project Profitability (revenue, cost, margin per project).
- Project Revenue Summary (actual vs. budget).
- Time Tracking (by user, by project, by task, by date).
- Unbilled Hours.
- Unbilled Expenses.
- Expense by Category.
- Expense by Customer.
- Customer Balance Summary.
- Top Customers by Revenue.

All reports support: date-range filter, column customization, CSV/PDF export.

**Deferred:**

- Scheduled email delivery of reports (v2).
- Sales tax reports (deferred to Doc 3 unless basic version is needed sooner).
- Custom report builder (v3+).

### 5.14 Settings and automation

**In scope for v1:**

- Email templates (invoice, estimate, payment receipt, reminder, retainer, statement, recurring invoice) with merge tags and rich-text editing.
- Automated payment reminders — multiple configurable schedules (e.g., 3 days before due, on due, 3 days after, 7 days after, 14 days after) with on/off toggles and customizable templates.
- Manual reminder send.
- Late fee automation (flat or percentage, grace period, capped/uncapped).
- Numbering schemes per doc type (prefix + auto-increment, with optional date-based reset like `INV-2026-001`).
- Base currency + additional currencies (manual FX rates at v1).
- Tax rates and tax authorities are managed via **Stripe Tax integration** (multi-state nexus is real today, Q4 locked). Stripe Tax handles jurisdiction-aware rate lookup, nexus monitoring, exemption certificates, and filing reports. Per-customer tax-exempt flag and exemption certificate upload are supported. Manual override of Stripe Tax calculation is supported for edge cases.
- Custom field definitions across modules.
- Branding (logo, colors, default invoice PDF template).
- User accounts (Cole-only at v1; multi-user is v2).
- API access (REST + webhooks) for future integrations.

**Deferred:**

- Auto FX rate pulling — v3 (multi-currency is v3 per Q3).
- Granular role-based permissions — v2.
- Scheduled actions / workflow automation (e.g., "when invoice is X days overdue, do Y") — v3+.

---

## 6. Data model (v1)

This is the canonical data model for the Zoho Invoice replacement layer. Schema is shown PostgreSQL-flavored. All tables include `id uuid primary key`, `created_at`, `updated_at`, `created_by`, `updated_by` unless noted. Multi-tenancy posture (org_id on every table vs. single-org) is deferred to Doc 5; this model is written as if org_id is present on every table for future-proofing.

### 6.1 Core entities

```
customers
  id, org_id, display_name, legal_name, type (individual|business),
  email, phone, website, billing_address (jsonb), shipping_address (jsonb),
  tax_id, default_currency_code, default_payment_terms_days,
  default_tax_rate_id, language_code, status (active|inactive),
  notes, custom_fields (jsonb), portal_access_enabled,
  unused_credits_amount (computed), outstanding_balance (computed)

contact_persons
  id, org_id, customer_id, first_name, last_name, email, phone,
  role, salutation, is_primary, portal_access_enabled

items
  id, org_id, name, sku, description, type (goods|services),
  default_selling_price, default_cost_price, default_tax_rate_id,
  status (active|inactive)

projects
  id, org_id, customer_id, name, description, status (active|completed|inactive),
  start_date, end_date, billing_method (fixed|project_hours|task_hours|staff_hours),
  fixed_cost_amount, project_hourly_rate, currency_code,
  budget_hours, budget_amount, notes

project_tasks
  id, org_id, project_id, name, description, task_hourly_rate,
  budget_hours, is_billable, sort_order

project_users
  id, org_id, project_id, user_id, billing_rate, cost_rate, added_at

project_attachments
  id, org_id, project_id, filename, storage_path, mime_type, size_bytes, uploaded_by

time_entries
  id, org_id, user_id, project_id, project_task_id, date, hours,
  description, is_billable, is_invoiced, invoice_line_id, is_approved,
  approved_by, approved_at, timer_started_at (nullable), timer_running

expense_categories
  id, org_id, name, default_tax_rate_id, parent_category_id (nullable, for nesting)

expenses
  id, org_id, date, expense_category_id, vendor_name, amount, currency_code,
  tax_amount, tax_rate_id, customer_id (nullable), project_id (nullable),
  is_billable, markup_percentage, is_invoiced, invoice_line_id,
  receipt_storage_path, notes, custom_fields (jsonb),
  is_mileage (bool), miles_driven, per_mile_rate

recurring_expense_templates
  id, org_id, expense_category_id, vendor_name, amount, currency_code,
  frequency (daily|weekly|monthly|quarterly|yearly), interval_count,
  next_run_date, end_date, is_active
```

### 6.2 Document entities (estimates, invoices, retainers, credit notes)

These are structurally similar and share a base shape. I'll use a discriminated approach: separate tables per document type to keep query plans clean, with a shared `document_lines` table referencing each parent.

```
estimates
  id, org_id, customer_id, estimate_number, reference_number, issue_date,
  expiration_date, status (draft|sent|viewed|accepted|declined|invoiced|expired),
  currency_code, exchange_rate, subtotal_amount, discount_amount,
  discount_percentage, tax_amount, adjustment_amount, total_amount,
  notes_to_customer, terms_and_conditions, salesperson_id,
  contact_persons_cc (uuid[]), sent_at, viewed_at, accepted_at, declined_at,
  declined_reason, converted_invoice_id (nullable), converted_project_id (nullable),
  custom_fields (jsonb)

invoices
  id, org_id, customer_id, invoice_number, reference_number, issue_date,
  due_date, payment_terms_days, status (draft|sent|viewed|partially_paid|paid|overdue|void|written_off),
  currency_code, exchange_rate, subtotal_amount, discount_amount,
  discount_percentage, tax_amount, shipping_amount, adjustment_amount,
  total_amount, amount_paid, balance_due (computed),
  notes_to_customer, terms_and_conditions, salesperson_id,
  contact_persons_cc (uuid[]), sent_at, viewed_at, paid_at,
  stripe_invoice_id (nullable, for Stripe Invoicing path),
  parent_recurring_id (nullable, if generated from recurring template),
  parent_estimate_id (nullable, if converted from estimate),
  project_id (nullable, if generated from a project),
  applied_retainer_amount, applied_credit_note_amount,
  custom_fields (jsonb)

retainer_invoices
  id, org_id, customer_id, project_id (nullable), retainer_number,
  issue_date, status (draft|sent|paid|applied|refunded),
  amount, currency_code, exchange_rate, applied_amount, available_balance,
  notes, stripe_payment_intent_id (nullable)

credit_notes
  id, org_id, customer_id, credit_note_number, issue_date,
  status (draft|open|closed|void), reason,
  currency_code, subtotal_amount, tax_amount, total_amount,
  amount_applied, amount_refunded, balance (computed),
  associated_invoice_id (nullable, the invoice it relates to)

document_lines
  id, org_id, document_type (estimate|invoice|credit_note), document_id,
  line_type (item|free_form|time_entry|expense|header),
  item_id (nullable), description, quantity, unit, unit_price,
  discount_amount, discount_percentage, tax_rate_id, tax_amount,
  line_total, sort_order,
  source_time_entry_ids (uuid[], when line is built from time entries),
  source_expense_ids (uuid[], when line is built from expenses)
```

### 6.3 Recurring documents

```
recurring_invoice_templates
  id, org_id, customer_id, name, status (active|paused|ended),
  frequency (daily|weekly|monthly|quarterly|yearly), interval_count,
  start_date, end_date, max_occurrences, occurrences_to_date,
  day_of_month, time_of_day, next_run_date, last_run_date,
  currency_code, payment_terms_days, auto_charge_stored_card,
  auto_email, notes, terms,
  template_lines (jsonb — same shape as document_lines but stored inline)
```

### 6.4 Payments

```
payments
  id, org_id, customer_id, payment_date, amount, currency_code, exchange_rate,
  payment_mode (stripe_card|stripe_ach|check|cash|wire|other),
  reference_number, notes,
  stripe_payment_intent_id (nullable), stripe_charge_id (nullable),
  excess_amount (overpayment → customer credit), refunded_amount

payment_allocations
  id, org_id, payment_id, invoice_id, allocated_amount

customer_credits
  id, org_id, customer_id, source_type (overpayment|credit_note|refund),
  source_id, amount, applied_amount, available_balance,
  created_at, applied_at
```

### 6.5 Configuration

```
tax_rates
  id, org_id, name, rate_percentage, tax_authority_id (nullable),
  is_compound, is_active

tax_authorities
  id, org_id, name, jurisdiction (country/state/county/city), tax_id

email_templates
  id, org_id, template_type (invoice_send|estimate_send|payment_receipt|
    reminder_before_due|reminder_on_due|reminder_after_due|recurring_notice|
    retainer_send|statement_send|credit_note_send),
  subject, body_html, body_text, is_default, is_active

reminder_schedules
  id, org_id, name, schedule_offset_days (negative = before due, positive = after),
  template_id, is_active, applies_to_overdue_only

late_fee_rules
  id, org_id, name, fee_type (flat|percentage), fee_amount,
  grace_period_days, max_total_fee_amount (cap), apply_to (all|selected_customers),
  is_active

numbering_schemes
  id, org_id, document_type, prefix, next_number, reset_frequency (never|yearly|monthly),
  last_reset_at, padding_zeros

custom_field_definitions
  id, org_id, entity_type (customer|item|project|task|time_entry|expense|estimate|invoice),
  field_name, field_type (text|number|date|dropdown|checkbox),
  dropdown_options (jsonb), is_required, sort_order, is_active

currencies
  id, org_id, currency_code, is_base, manual_exchange_rate, last_updated_at

users
  id, org_id, email, full_name, role (admin|staff|timesheet_staff),
  default_billing_rate, default_cost_rate, status (active|inactive),
  password_hash (or SSO with Supabase auth), last_login_at
```

### 6.6 Audit and history

```
document_activity_log
  id, org_id, document_type, document_id, actor_user_id, actor_email (for system or external),
  action (created|sent|viewed|paid|status_changed|edited|deleted|commented|attachment_added),
  details (jsonb), occurred_at

document_comments
  id, org_id, document_type, document_id, author_user_id, author_email,
  body, is_visible_to_customer (for portal v2), parent_comment_id (for threading)

document_attachments
  id, org_id, document_type, document_id, filename, storage_path,
  mime_type, size_bytes, uploaded_by
```

### 6.7 Integration tables

```
stripe_customers
  id, org_id, customer_id, stripe_customer_id, default_payment_method_id, synced_at

stripe_webhook_events
  id, org_id, event_id (unique), event_type, payload (jsonb),
  processed_at, processing_error
```

This gives roughly 25 tables for v1. The data model is intentionally normalized; denormalized computed fields (balance_due, available_balance) are materialized via triggers or computed in views to keep queries simple.

---

## 7. Effort estimates (v1)

Estimates are calendar-time for a single full-time developer using Lovable + Supabase + Stripe, with backend-first methodology. Each item assumes the data model in section 6 is built first and reused. Estimates are ranges, not commitments. They assume no major Lovable token cliffs and no rework from missed requirements.

### 7.1 Foundation and infrastructure

| Item | Estimate | Notes |
|---|---|---|
| Data model migration (25 tables + RLS) | 4-6 days | Heavy SQL; includes indexes, foreign keys, RLS policies, triggers for computed columns. |
| User auth + org_id scoping (single-tenant for v1, designed multi-tenant) | 2-3 days | Reuse Supabase auth; add org context. |
| File storage (Supabase Storage) + signed URLs for receipts/attachments | 1-2 days | |
| Email send infrastructure (Resend integration) | 1-2 days | Already in BrainWise stack; reuse. |
| Stripe customer + payment method storage layer | 2-3 days | Map our customer ↔ Stripe customer; store default payment method. |
| Stripe webhook receiver + event dispatcher | 2-3 days | Handle invoice events, payment events, refunds. |
| **Stripe Tax integration (Q4)** | **3-5 days** | **API integration for jurisdiction-aware tax calculation. Includes customer address validation, line-item tax breakdown, exemption certificate storage, manual override path.** |
| PDF generation engine with multi-template support (Q5) | 6-9 days | React PDF or Puppeteer. Three templates at v1: Standard, Corporate, Detailed Services. Template selection per-customer with default fallback. |
| Numbering scheme engine | 1 day | |
| Currency handling (single base USD at v1) | 0.5 day | Multi-currency deferred to v3 per Q3. |
| Tax rate engine (Stripe Tax wraps the complexity) | 1 day | Local tax rate cache for offline display; authoritative calculation via Stripe Tax. |
| Custom fields engine | 2-3 days | Generic CRUD across all entity types. |
| Activity log + comment system | 2 days | |

**Foundation subtotal: ~28-41 days (~6-8 weeks).**

### 7.2 Module-by-module build

| Module | Estimate | Notes |
|---|---|---|
| Customers (with contact persons) | 3-5 days | CRUD, list, detail, statement generator. |
| Items | 1-2 days | |
| Projects (4 billing methods) | 5-8 days | The 4 billing methods drive different invoice generation paths; each method needs its own UI and test coverage. |
| Time tracking — manual entry + weekly grid | 4-6 days | Weekly grid is non-trivial UI; tab nav, save-on-blur, conflict handling. No approval flow at v1 (Q8) saves 2 days vs. original. |
| Time tracking — live timer with server-side state | 3-4 days | Persistent across sessions, multiple devices. |
| Time tracking — calendar view | 2-3 days | |
| Expenses (incl. mileage and recurring) | 4-6 days | |
| Estimates (incl. accept/decline by email link, convert flows) | 5-7 days | Accept-by-link flow needs unauthenticated public route + token security. Convert-to-invoice and convert-to-project are stateful. |
| Invoices (incl. all line types, all creation paths) | 8-12 days | The heart of the system. Time-entry and expense line generation is non-trivial. Status lifecycle automation. Stripe Pay Now integration. |
| Recurring invoices (template + cron generation) | 3-5 days | pg_cron or Supabase Edge Function on schedule. |
| Retainer invoices | 2-3 days | Builds on invoice infrastructure. |
| Credit notes | 2-3 days | |
| Payments (online + offline, allocations, refunds) | 4-6 days | Stripe sync is the load-bearing piece. |
| Customer credit tracking | 1-2 days | |
| Payment reminders (automated + manual) | 3-5 days | Schedule engine + templating + send loop. |
| Late fees (Q9: actively used today) | 1-2 days | Configurable per-customer or globally, percentage or flat, grace period, capped/uncapped. |
| Salesperson tracking + commission report (Q10) | 2-3 days | Salesperson field on documents; assignment UI; commission report (sales by salesperson with configurable commission percentage per salesperson). |
| Settings UI (email templates, tax rates, reminders, numbering, currencies, custom fields, salespeople) | 4-6 days | |
| Reports (16 reports, list + customization + export) | 7-11 days | Many reports are SQL views; UI is the time cost. Adds commission report to original 15. |

**Module build subtotal: ~64-99 days (~13-20 weeks).**

### 7.3 QA, polish, and migration

| Item | Estimate | Notes |
|---|---|---|
| End-to-end test suite for core flows | 5-7 days | |
| Manual QA + bug fix passes | 5-10 days | |
| Migration tooling: import from Zoho Invoice + parallel-period reconciliation (Q6) | 5-7 days | Zoho has a CSV export per entity. Map and ingest customers, items, projects, time entries, expenses, estimates, invoices, payments. Parallel-period (1-2 months) means reconciling data created in both systems during overlap. |
| Production deployment + monitoring | 2-3 days | |
| Documentation (internal runbooks) | 2-3 days | |

**QA + migration subtotal: ~19-30 days (4-6 weeks).**

### 7.4 v1 total

**Optimistic: 111 days ≈ 22 weeks ≈ 5.5 months.**
**Pessimistic: 170 days ≈ 34 weeks ≈ 8 months.**
**Midpoint: 6.5 months.**

This is one full-time developer working sustainably. With Cole as the only developer also running BrainWise, real calendar time stretches further. The 3-month target you stated upfront cannot be met for v1 of Doc 1 alone.

**Phasing options (Option A locked from Q1, so Stripe-Invoicing-first is no longer on the table):**

- **Option A1 (lean):** Build v0.5 with customers, items, projects, time tracking, estimates, invoices, payments, 5 essential reports, single template, Stripe Tax. Skip recurring invoices, retainers, credit notes, late fees, automation, custom fields, salesperson tracking. ~12-16 weeks. Get off Zoho with reduced functionality, layer the rest back over months.
- **Option A2 (full v1):** Build everything in section 5 as-spec'd. ~5.5-8 months.

Option A2 is the default unless the timeline forces Option A1.

### 7.5 v2 (customer portal + deferred features)

If v1 ships as Option B, v2 adds the customer portal and the deferred items. Estimate:

| Item | Estimate |
|---|---|
| Customer portal (auth, dashboard, estimates, invoices, payments, statements, projects view) | 15-20 days |
| Email-to-expense inbox | 2-3 days |
| Timesheet approval workflow | 3-4 days |
| Progress invoicing | 3-5 days |
| Batch invoicing | 2-3 days |
| Auto FX rate pulling | 1-2 days |
| Granular role-based permissions | 3-4 days |
| Scheduled report email delivery | 2-3 days |

**v2 subtotal: ~31-44 days (6-9 weeks).**

### 7.6 v3+ (parking lot)

- Receipt OCR / auto-scan (~5-8 days with vendor wrap).
- Mobile native app (~60-90 days).
- Chrome extension for context-aware timer (~5-7 days).
- Bulk CSV import improvements (~3-5 days).
- Custom report builder (~10-15 days).
- Tax-engine vendor integration (Avalara/TaxJar) (~5-8 days).
- Capacity / scheduling (Harvest-style) (~10-15 days).
- Top-up retainer relationships (FreshBooks-style) (~3-5 days).
- Workflow automation (~10-15 days).

---

## 8. Out of scope for Doc 1

Explicitly not included in this document (covered elsewhere or out entirely):

- **Double-entry accounting, chart of accounts, journal entries, bank feeds, reconciliation, P&L, balance sheet** → Doc 3 (Zoho Books layer).
- **Deal pipeline, lead management, email sync, calendar sync** → Doc 2 (Zoho CRM layer).
- **Contract templates, e-signature, signing audit trail** → Doc 4 (Zoho Sign layer). Note: estimate-level acceptance via accept-by-link is in Doc 1 v1; full e-signature is Doc 4.
- **Multi-tenancy decision** (single internal tool vs. productized for other coaches) → Doc 5.
- **Architectural decision** (module inside BrainWise vs. separate product/repo/Supabase project) → Doc 5.
- **Migration sequencing** (which functions move off Zoho first) → Doc 5.
- **Stripe replacement** (locked: Stripe stays).
- **Payroll** (out entirely — use Gusto, ADP, or similar; do not build).
- **Inventory management** (out entirely — service business, no inventory).
- **Project management features beyond billing containers** (Kanban, Gantt, dependencies — use Linear, Jira, or similar if needed; don't build).
- **Calendar / scheduling** (out — Google Calendar, Calendly).
- **Email itself** (out — Gmail, Resend).

---

## 9. Risks and dependencies

### 9.1 Risks

- **PDF rendering fidelity (elevated risk).** Q1 locks own invoice engine (Option A); Q5 requires 2-3 templates at v1. The PDF engine is now the largest single risk in v1. Zoho's PDF templates are mature and Stripe's are clean by default; building three polished templates that match what corporate clients expect is a real engineering investment. Mitigation: nail the Standard template first, ship it, iterate Corporate and Detailed Services after. Escape valve: drop to Stripe-Invoicing PDF for v1 if the engine costs more than budgeted and revisit own-PDF in v2.
- **PDF rendering quirks across email clients and print.** Outlook and Apple Mail render embedded PDFs differently from web preview. Test matrix needed.
- **Multi-template selection logic.** Per-customer template assignment with fallback to default needs to work for migrated customers (who won't have a template assignment until backfilled).
- **Stripe Tax integration is mostly de-risked.** Stripe Tax handles jurisdiction lookup and rate accuracy. Residual risk: customer addresses must be validated and complete for Stripe Tax to calculate correctly; bad addresses (missing zip, wrong state code) cause silent miscalculation. Address validation at customer create/edit is required.
- **Recurring invoice engine reliability.** Cron failures, duplicate generation, customer card decline edge cases. Use pg_cron with idempotency keys and a "last generated" check on every template.
- **Stripe webhook ordering.** Stripe doesn't guarantee event ordering. Handle out-of-order events (a payment-succeeded arriving before invoice-created) with idempotent processing.
- **Loss of Zoho's mobile apps.** v1 is web-only. Cole loses on-the-go time tracking from the Zoho mobile apps. Mitigation: make the web app aggressively mobile-responsive; revisit native after v1.
- **Loss of Zoho's mature integrations.** Zoho integrates with hundreds of products natively. v1 has zero of those. Mitigation: prioritize building API + webhooks so future integrations are possible.
- **Parallel-period reconciliation (Q6).** Running BrainWise and Zoho for 1-2 months means two systems with two sets of data. Customer creates an invoice in Zoho while you're transitioning, or pays in BrainWise while still on Zoho's books. Mitigation: clear cutover date per entity type (e.g., "all new invoices in BrainWise starting June 1; Zoho closed to new invoices but stays read-only through August").

### 9.2 Hard dependencies

- Supabase Edge Functions or pg_cron for recurring invoice generation and payment reminders.
- Stripe API for payment processing (already in use).
- **Stripe Tax for tax calculation (Q4 lock).** Pricing is 0.5% per taxed transaction, capped. Requires customer address validation.
- Resend (or Postmark / SES) for transactional email (already in use).
- Object storage for attachments (Supabase Storage).
- A PDF generation library (React PDF, Puppeteer, or a vendor like DocRaptor / PDFShift).

### 9.3 Soft dependencies

- A receipt OCR vendor if v3 wants auto-scan (Veryfi, Mindee, AWS Textract).
- An e-signature vendor if estimates need true signatures before Doc 4 ships (Dropbox Sign, BoldSign).
- An FX rate provider for v3 multi-currency (Open Exchange Rates, currencylayer, ECB feed).

---

## 10. Resolved decisions (Q1-Q10)

All ten questions raised in v1.0 of this document have been resolved. The resolutions and their impact on v1 scope:

1. **Q1: Invoice engine — own vs. Stripe Invoicing.** Resolved: **own engine (Option A)**. Full control over PDF, numbering, email, status, line-item structure. Cost: 25-35 days of build effort embedded in v1, vs. 8-12 for Stripe wrapper. Escape valve documented in 9.1: drop to Stripe-Invoicing PDF for v1 if engine costs exceed budget.

2. **Q2: Customer portal — v1 vs. v2.** Resolved: **v2**. v1 customer-facing access is email + Stripe-hosted pay page (or own pay page given Q1 lock — see section 5.7 invoice operations). Portal build is ~15-20 days in v2.

3. **Q3: Multi-currency — v1 vs. v3.** Resolved: **v3**. v1 is single-currency USD. Foundation simplified by ~1 day. FX rate provider integration deferred to v3.

4. **Q4: Sales tax — manual vs. vendor.** Resolved: **Stripe Tax wrap in v1**. Multi-state nexus is real today. Stripe Tax handles jurisdiction lookup, rates, exemption certificates, filing reports. Build cost: 3-5 days for integration vs. 10-15 days for hand-rolled engine that would still have gaps. Hard dependency added (section 9.2).

5. **Q5: PDF templates in v1.** Resolved: **2-3 templates** (Standard, Corporate, Detailed Services). Per-customer template assignment with default fallback. Adds 3-5 days to PDF engine build. Template selection logic flagged as a risk (section 9.1).

6. **Q6: Zoho cutover.** Resolved: **1-2 month parallel run, then hard cutover**. Migration tooling estimate increased from 3-5 to 5-7 days for parallel-period reconciliation. Cutover protocol documented in 9.1.

7. **Q7: Time entry rounding default.** Resolved: **no rounding** (log actual time). Round-up rule is configurable per-organization but default is off. Simplest v1 implementation; one-line setting.

8. **Q8: Timesheet approval flow in v1.** Resolved: **no approval flow at v1**. All time entries are implicitly approved on creation. Schema preserves `is_approved`, `approved_by`, `approved_at` columns as nullable for v2 addition without migration. Saves ~3-4 days in v1.

9. **Q9: Late fees.** Resolved: **in v1** (actively used today). Configurable per-customer or globally, percentage or flat amount, grace period, capped/uncapped. Build cost: 1-2 days already in v1 estimate.

10. **Q10: Salesperson / commission tracking.** Resolved: **in v1**. Salesperson field on estimates and invoices, assignment UI, commission report (sales by salesperson × configurable commission percentage). Build cost: 2-3 days added to module build.

### Decisions deferred to Doc 5

- O5: Module-inside-BrainWise vs. separate product/repo/Supabase project. (Architectural.)
- O6: Multi-tenancy posture — single internal tool vs. designed for productization. (Architectural.)
- O7: Sequencing — Doc 1 vs. Doc 2 vs. Doc 3 build order. (Roadmap.)
- O8: Migration order — which Zoho functions move off first. (Roadmap.)

---

## 11. Connection to subsequent docs

This document defines the operational layer. The remaining docs build out around it:

- **Doc 2 (CRM)** adds the pre-customer pipeline: leads, deals, activities. CRM's "Account" object maps to Doc 1's `customers` table; CRM's "Contact" maps to `contact_persons`. The boundary is when a deal converts to a customer.
- **Doc 3 (Books)** sits underneath Doc 1. Every invoice in Doc 1 generates a journal entry in Doc 3 (revenue + AR). Every payment generates a journal entry (cash + AR clearing). Every expense generates a journal entry. Doc 3's chart of accounts is the substrate.
- **Doc 4 (Sign)** wraps documents in Docs 1 and 2 with e-signature. Estimates, proposals, contracts can be sent for signature. The relationship is: Doc 4 references Doc 1 and 2 documents.
- **Doc 5 (Cross-cutting)** decides the architecture, sequencing, multi-tenancy, and migration approach.

The data model in section 6 is intentionally compatible with the CRM extensions in Doc 2 and the Books journal-entry layer in Doc 3. Specifically: `customers` will be extended with CRM lifecycle fields in Doc 2; `invoices`, `payments`, and `expenses` will gain `journal_entry_id` foreign keys in Doc 3.

---

## 12. Decision log

Decisions locked in this document:

- **D1:** Stripe stays as payment processor. (Locked before doc started.)
- **D2:** 4-billing-method project model from Zoho is the baseline. (Section 5.3.)
- **D3:** Customer portal is v2, not v1. (Q2.)
- **D4:** Time tracking is web-only at v1, designed multi-user from day one. (Section 5.4.)
- **D5:** PDF generation is in-house (React PDF or Puppeteer), not vendor-wrapped, at v1. (Q1 + Q5.)
- **D6:** Stripe Tax wraps tax calculation for v1; multi-state nexus is real today. (Q4.)
- **D7:** Receipt OCR is v3, not v1. (Section 5.5.)
- **D8:** E-signature on estimates uses accept-by-link at v1; true e-signature is Doc 4. (Section 5.6.)
- **D9:** Architecture (module vs. separate product) is deferred to Doc 5. (Open.)
- **D10:** Multi-tenancy posture is deferred to Doc 5. Data model written multi-tenant-capable to preserve options. (Section 6.)
- **D11:** Invoice engine is own-build (Option A), not Stripe Invoicing wrapper. Trade-off: +15-25 days, full PDF and lifecycle control. (Q1.)
- **D12:** Single base currency (USD) at v1; multi-currency deferred to v3. (Q3.)
- **D13:** 2-3 invoice PDF templates at v1 (Standard, Corporate, Detailed Services). (Q5.)
- **D14:** Parallel 1-2 months with Zoho, then hard cutover. (Q6.)
- **D15:** No time rounding default; configurable per-organization. (Q7.)
- **D16:** No timesheet approval flow at v1; schema preserves v2 option. (Q8.)
- **D17:** Late fees are in v1. (Q9.)
- **D18:** Salesperson tracking + commission report in v1. (Q10.)

Decisions deferred to Doc 5:

- **O1:** Module-inside-BrainWise vs. separate product/repo/Supabase project.
- **O2:** Multi-tenancy posture.
- **O3:** Build sequencing across Docs 1-4.
- **O4:** Zoho function migration order.

---

*End of Doc 1.*
