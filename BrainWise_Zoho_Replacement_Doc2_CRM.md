# BrainWise Internal Operations Platform

## Doc 2 of 5: CRM Layer Scope

**Version:** 1.1 (Decisions Q1-Q10 locked)
**Author:** Claude (drafted with Cole Bastian, BrainWise Enterprises)
**Date:** May 21, 2026
**Status:** Scope locked pending Doc 5 architectural decisions

**v1.1 changelog (Q1-Q10 resolution):**

- Q1: 6-stage pipeline default — Inquiry → Discovery → Demo → Proposal → Negotiation → Closed Won/Lost.
- Q2: Single pipeline + deal Type field (Renewal/Upsell/New). Multi-pipeline UI deferred to v2 (data model retains pipeline_id for forward compatibility).
- Q3: 10-source lead source picklist (Web Form, Referral, Cold Outbound, Conference/Event, Partner, Existing Customer Referral, LinkedIn, Podcast/Content Marketing, Webinar, Other).
- Q4: Won/Lost reasons — Doc 2 defaults plus "Lost to Build-In-House" and "Lost to No Decision Maker."
- Q5: Strict Lead/Contact distinction, AND direct Contact creation allowed (for warm intros that bypass the lead step).
- Q6: Activity-based selling enforcement is warn-only (visual flag).
- Q7: 5 webhook integration recipes shipped at v1: Lovable forms, Tally, Microsoft Bookings, Stripe (new customer), Zapier passthrough. Form-building uses Tally (Typeform alternative) rather than building one internally.
- Q8: Silent email tracking (industry standard).
- Q9: Two-tier opt-out — marketing_opt_out (blocks bulk/templated) + transactional_opt_out (blocks everything including one-off).
- Q10: Customer auto-creation on Deal Won via workflow rule with 5-minute delay (gives time to undo accidental Won status).

**Net v1 estimate after Q1-Q10: 6.5-9 months for one full-time developer (midpoint ~7.5 months).** Substantially unchanged from v1.0.

**Scope locks from session:**

- Q-CRM1: Full lifecycle CRM (leads + deals + post-sale relationship management).
- Q-CRM2: Email integration = Sync-A (BCC log + CRM-composed via Resend SMTP). No two-way Gmail/Outlook sync.
- Q-CRM3: Calendar integration = "Add to Calendar" generator (Google Calendar URL, Outlook URL, .ics). No two-way sync. CRM is the source of truth for meetings; in-CRM reminders compensate (1hr-before email, day-of digest).
- Q-CRM4a: Lite enrichment via Apollo free tier + Hunter.io email verification.
- Q-CRM4b: Generic webhook ingest for lead capture (handles Lovable forms, Calendly, Typeform).
- Q-CRM5: Light multi-user at v1 (Cole + 1-2 future hires).

**Carry-forward from Doc 1:**

- `customers` table from Doc 1 is the post-close identity. CRM contains pre-close entities (leads, deals) that convert to customers at close.
- `contact_persons` from Doc 1 already exists; CRM's contacts reference the same table.
- Salesperson tracking lives on CRM users (with commission percentage); Doc 1's salesperson field on documents pulls from CRM users.
- Customer portal v2 means `contact_persons` identity must remain compatible with portal authentication.

---

## 1. Purpose

This document specifies the CRM layer of the BrainWise Internal Operations Platform — the pre-customer pipeline (leads, deals, accounts), the post-customer relationship layer (activities, notes, follow-ups, segmentation), and the supporting infrastructure (email logging, calendar event generation, lead capture, light enrichment).

Doc 1 (Invoice Replacement) covered the moment a deal closes and becomes billable. Doc 2 covers everything before that, plus everything that keeps the relationship warm after a customer is signed.

The boundary between Doc 1 and Doc 2 is the **lead → customer conversion event**: when a deal moves to "Closed Won," the CRM converts the lead/deal record into a `customers` row (already defined in Doc 1) and the relationship transitions from "sales tracking" mode to "billing and operations" mode.

---

## 2. Context

Cole currently does not have a CRM. Lead tracking happens in a mix of email, notes, calendar invites, and memory. Deals are tracked by feel. There is no system for tracking activities (calls, demos, follow-ups), no view of pipeline state, no record of what was said in which meeting with which contact.

This is the classic pre-CRM state for a founder-led business. It works at 5 deals in flight and breaks down between 10-20.

Driving forces for adding CRM now:

- Corporate sales motion requires longer sales cycles (multi-month deals with multiple stakeholders) where a CRM is the difference between closing and dropping.
- BrainWise's stated direction (productization eventually, possibly to other coaches) makes proven CRM discipline part of the product DNA.
- Doc 1's effort doesn't make sense without Doc 2 — billing a customer who was never tracked as a deal means losing the closed-loop analytics (what % of deals close, which sources convert, where time goes between contact and close).

---

## 3. Zoho CRM feature inventory (the surface being replaced)

Zoho CRM is the broadest competitor in the CRM market and is the explicit target for replacement. The features below are organized into the canonical CRM module structure.

### 3.1 Module structure (Zoho's canonical entities)

Zoho CRM uses five core entities:

- **Leads** — unqualified prospects. Pre-qualification, may not be a real opportunity yet.
- **Accounts** — companies (post-qualification). The organization being sold to.
- **Contacts** — individual people inside accounts. Same person can appear at multiple accounts over time.
- **Deals** — opportunities (qualified leads with revenue potential). Move through pipeline stages.
- **Activities** — calls, meetings, tasks, emails associated with any of the above.

Plus standard auxiliary modules:

- **Campaigns** — marketing campaigns and source attribution.
- **Forecasts** — quota and pipeline projections.
- **Cases** — support tickets (out of scope for v1; this is post-sale support, not relevant until BrainWise has a support function).
- **Solutions** — knowledge base for support (out of scope).
- **Products** — items/services being sold (overlaps with Doc 1's items table).
- **Price Books** — per-customer or per-segment pricing (deferred).
- **Quotes** — pre-invoice pricing documents (overlaps with Doc 1's estimates).
- **Invoices, Vendors, Purchase Order, Sales Orders** — billing-side modules (covered by Doc 1).
- **Tasks, Calls, Meetings** — activity sub-types.
- **Reports, Dashboards, Documents** — cross-cutting.

The conventional lead lifecycle is:

```
Lead created (from web form / manual / import / enrichment)
  ↓
Lead qualified (manual or automated based on score)
  ↓
Lead converted → creates Account + Contact + Deal in one step
  ↓
Deal moves through pipeline stages
  ↓
Deal closes (Won or Lost)
  ↓
[if Won] Account becomes a Customer (Doc 1 customer record created)
```

### 3.2 Leads module

A Lead in Zoho is an individual person who has expressed some interest. Standard fields:

- Lead Owner (CRM user assigned).
- Lead Source (web form, referral, trade show, cold outbound, partner, other — configurable picklist).
- Lead Status (New, Contacted, Qualified, Unqualified, Junk — configurable picklist).
- Salutation, First Name, Last Name (required), Title.
- Company Name (required — a Lead implicitly has a company, but it's not yet an Account).
- Email, Phone, Mobile, Fax, Website.
- Industry, # Employees, Annual Revenue, Rating.
- Lead Score (calculated from custom rules: page visits, email opens, form fills, manual adjustments).
- Address fields.
- Tags.
- Description, custom fields.
- Created Time, Modified Time, Last Activity Time.

Key Lead operations:

- **Convert Lead** — single action that creates Account + Contact + Deal. Field mapping is configurable: which Lead fields map to which Account/Contact/Deal fields.
- **Bulk convert** — convert multiple leads at once (e.g., trade show attendees who all become accounts).
- **Lead assignment rules** — round-robin, region-based, source-based.
- **Lead scoring rules** — automatic point adjustments based on activity (e.g., +10 for visiting pricing page, +20 for downloading whitepaper, -5 for unsubscribe).
- **Auto-response email** on lead creation.
- **Duplicate detection** — Zoho can flag potential duplicates on creation or in bulk.
- **Web-to-Lead forms** — generate HTML to embed on a website that POSTs to the CRM.
- **Lead import** from CSV, with field mapping and dedup options.

### 3.3 Accounts module

An Account is a company. Fields:

- Account Owner.
- Account Name (required).
- Account Number (auto or manual).
- Parent Account (hierarchy — Acme Corp parent of Acme Subsidiary).
- Type (Customer, Prospect, Partner, Vendor, Reseller, other).
- Industry, # Employees, Annual Revenue, Ownership, Ticker Symbol, Rating.
- Phone, Fax, Website.
- Billing Address, Shipping Address.
- Description, Tags, custom fields.

Account-level operations:

- **Contacts under account** — list of contact persons at this account.
- **Deals under account** — list of all opportunities (open and closed) with this account.
- **Activities timeline** — chronological list of all interactions with anyone at this account.
- **Notes** — free-form notes attached to the account.
- **Documents** — file attachments.
- **Mail merge** — generate documents from templates using account/contact data.

Account hierarchy: parent-child relationships for enterprise selling (sell to subsidiaries of a parent company).

### 3.4 Contacts module

A Contact is an individual person, associated with one Account (or unassociated). Fields:

- Contact Owner.
- Salutation, First Name, Last Name, Title.
- Account Name (lookup to Accounts).
- Reports To (lookup to another Contact — for org chart mapping).
- Email, Phone, Mobile, Other Phone, Fax, Skype/IM ID.
- Date of Birth, Lead Source, Department.
- Email Opt-Out flag (suppression for marketing).
- Mailing Address, Other Address.
- Description, Tags, custom fields.

Contact operations:

- **Deals associated with contact** — what opportunities involve this person.
- **Activities timeline** — emails, calls, meetings, tasks with this contact.
- **Notes** and documents.
- **Email this contact** — opens compose, populates To field.
- **Schedule activity** — quick-add task/call/meeting.

### 3.5 Deals (Opportunities)

A Deal is the heart of the sales pipeline. Fields:

- Deal Owner.
- Deal Name (required).
- Account Name (required), Contact Name (primary contact).
- Amount (deal value).
- Closing Date (expected close date).
- Stage (configurable picklist — default Zoho stages: Qualification, Needs Analysis, Value Proposition, Identify Decision Makers, Proposal/Price Quote, Negotiation/Review, Closed Won, Closed Lost).
- Probability % (auto-set per stage or manual override; used for forecasting).
- Expected Revenue (Amount × Probability, computed).
- Type (New Business, Existing Business, Renewal, Upsell, other).
- Lead Source.
- Next Step (free text).
- Description, Tags, custom fields.

Multi-pipeline support: in Zoho's higher tiers, you can have multiple pipelines (e.g., New Business pipeline with 6 stages, Renewals pipeline with 3 stages). Each deal belongs to one pipeline.

Deal-level features:

- **Pipeline Kanban view** — drag deals between stages.
- **Stage history** — timestamp of when deal entered each stage. Used for stage-velocity analysis.
- **Deal team / collaborators** — multiple users associated with a deal (account exec, SDR, solutions engineer).
- **Stakeholders** — multiple contacts associated with a single deal (the buying committee).
- **Products/items on a deal** — line items with quantity, price, discount (overlaps with Doc 1 estimates).
- **Quote generation** — generate a Quote document from the deal's line items (overlaps with Doc 1 estimates).
- **Forecasting** — closed-won + (open × probability) by close-date month/quarter.
- **Won/lost reason** — required on close (configurable picklist: too expensive, no budget, lost to competitor X, no decision, other).
- **Renewal tracking** — auto-create a renewal deal N days before subscription renewal date.
- **Activity timeline** specific to the deal.

### 3.6 Activities module

Activities is a meta-module covering all interaction types:

**Tasks** — to-dos with optional due date, priority, status (Not Started, In Progress, Completed, Deferred, Waiting), assigned-to user. Related to Lead/Account/Contact/Deal.

**Calls** — logged phone calls. Fields: subject, contact, call type (Outbound, Inbound), call result (Completed, Left voicemail, No answer, Wrong number, busy), duration, call purpose, description. Can be scheduled for the future or logged retroactively.

**Meetings** — scheduled or logged meetings. Fields: title, location, attendees (contacts + users), start/end time, all-day flag, recurrence, description, related deal/account. Generates calendar entry (in Zoho's case via two-way sync; in BrainWise's case via "Add to Calendar" deep link per Q-CRM3).

**Emails** (in Zoho, sent via integrated email or logged via BCC) — subject, body, recipients, sent-at timestamp, status (sent, opened, clicked), related contact/deal.

Activity timeline aggregates all of the above per Lead/Account/Contact/Deal in chronological order.

### 3.7 Pipeline view (Deals)

Pipeline is the central operational view for sales. Standard features:

- **Kanban board** — columns are stages, cards are deals. Drag to move stages.
- **Card content** — deal name, amount, contact, close date, last activity, age in stage.
- **Stage totals** — column header shows count + sum of deal amounts.
- **Color-coding** — based on deal age in stage, last activity recency, or custom rules.
- **Filters** — by owner, source, date range, amount range, tag, custom field.
- **Multiple pipelines** — switch between New Business / Renewals / Upsells.
- **Stage-rotting alerts** — deals stale in a stage past a threshold trigger notification.
- **Won-rate per stage** — historical conversion percentage between stages.
- **Forecast view** — by-quarter totals with weighted (probability × amount) and unweighted views.

### 3.8 Activities feed and tasks dashboard

- **My activities today** — calls/meetings/tasks due today across all entities.
- **Overdue activities** — past due.
- **Upcoming activities (next 7/30 days).**
- **Activity by type** — calls log, meeting log, task list.
- **Activity search** — find activities by content, contact, date range.

### 3.9 Email integration

Zoho's full implementation includes:

- **Two-way Gmail/Outlook sync** (via SalesIQ + Mail integration) — emails sent/received auto-log against contacts. Read state syncs. Drafts in Zoho sync to Gmail drafts.
- **In-CRM compose** — write emails inside the CRM, sent via your Gmail/Outlook with proper threading.
- **Email tracking** — pixel tracking for opens, link tracking for clicks.
- **Email templates** with merge tags.
- **Email scheduling** — send later.
- **Reply tracking** — replies thread back to the original message.

**BrainWise scope (Sync-A locked):**

- **BCC inbox** — each CRM user gets a unique BCC address (e.g., `bcc-cole+abc123@inbox.brainwiseenterprises.com`). Emails BCC'd to this address are ingested, parsed, matched to contacts by email address, and logged as activities.
- **Forward-to inbox** for inbound emails — Cole can forward important emails to a CRM inbox to log them. Auto-match by sender address.
- **In-CRM compose via Resend** — write emails inside the CRM. Sent via Resend from a CRM-controlled subdomain (e.g., `crm@mail.brainwiseenterprises.com`). Tracked for opens via pixel and clicks via link rewriting.
- **Email templates** with merge tags (`{{contact.first_name}}`, `{{deal.amount}}`, `{{account.name}}`).
- **No read-state sync.** Reading an email in Gmail does not mark it read in CRM.
- **No reply threading from Gmail.** Replies that come back via Gmail aren't auto-threaded to the original CRM-sent email unless they're BCC'd or forwarded.

### 3.10 Calendar integration

Zoho's full implementation: two-way Google Calendar + Outlook sync.

**BrainWise scope (Q-CRM3 locked):**

- **"Add to Calendar" button** on every Meeting activity. Generates:
  - Google Calendar event-create URL (opens new tab; user clicks Save to add).
  - Outlook web event-create URL.
  - Microsoft Outlook event-create URL (desktop).
  - .ics file download (for Apple Calendar, other clients).
- **CRM is source of truth** for meetings. Calendar entries are derivative artifacts that may or may not match the CRM record after creation.
- **In-CRM reminders** to compensate for no calendar sync:
  - Email reminder 1 hour before any scheduled meeting (sent to the assigned user and optionally meeting attendees).
  - Day-of digest email each morning with all meetings/calls/tasks for the day.
  - In-app notification 15 minutes before meeting start.
- **Meeting reschedule** updates the CRM record and regenerates the "Add to Calendar" link. User is responsible for updating their calendar.

### 3.11 Lead capture (web forms and webhooks)

Zoho's Web-to-Lead provides:
- HTML form generator embedded on any website that POSTs to the CRM endpoint.
- Field mapping (form field → CRM Lead field).
- Spam protection (reCAPTCHA, honeypot).
- Auto-response email to the lead.
- Auto-assignment rules.

**BrainWise scope (Q-CRM4b locked):**

- **Generic webhook ingest endpoint** — `POST /api/webhooks/lead-capture/{webhook_id}`. Accepts arbitrary JSON.
- **Webhook configuration** — for each webhook, define field mappings, default values, auto-assignment rules, auto-response template.
- **Multiple webhooks per organization** for different sources (`webhook_id=lovable-contact-form`, `webhook_id=calendly-demo-booking`, `webhook_id=typeform-survey`).
- **Spam mitigation** — IP rate limiting, optional honeypot field check, optional shared-secret HMAC header verification.
- **Auto-enrichment trigger** on lead creation (Q-CRM4a) — calls Apollo + Hunter, attaches firmographic + email verification data.
- **Auto-assignment rules** — round-robin among CRM users with the salesperson flag, or fixed assignment per webhook source.
- **Auto-response email** — sends a thank-you / next-steps email from the CRM-controlled address.
- **Activity log** — every webhook receipt is logged with raw payload for debugging.

### 3.12 Enrichment

Zoho's enrichment (Zia AI + integrations) is broad: company info, contact verification, intent signals, conversation enrichment.

**BrainWise scope (Q-CRM4a locked — lite):**

- **Apollo free tier integration** — on lead/contact creation (or manual "Enrich" button), call Apollo's `enrich/people` and `enrich/organizations` endpoints. Attach: full name, title, LinkedIn URL, company name, company size, industry, location, technographics, employee LinkedIn URLs.
- **Hunter.io email verification** — verify deliverability of provided email; suggest alternative formats if missing. Returns: confidence score, source, position pattern (e.g., `firstname.lastname@company.com`).
- **Manual enrich button** on any Contact or Account page; user clicks to refresh.
- **Rate-limit aware** — Apollo free tier has limits; queue and throttle.
- **No waterfall enrichment** — Apollo + Hunter only. Adding Clay or People Data Labs is v2.

### 3.13 Lead scoring

Zoho provides rule-based and AI-based lead scoring.

**BrainWise scope (v1):**

- **Rule-based scoring** — configurable rules per source/criteria:
  - Demographic rules: industry, company size, role.
  - Behavioral rules: opened email (+5), clicked link (+10), filled form (+25), visited pricing page (+15), unsubscribed (-50).
- **Score thresholds** drive lead status auto-promotion (e.g., score ≥ 50 → status auto-changes from "New" to "Qualified").
- **Score history** — log of score changes.
- **AI-based scoring (predictive)** — deferred to v3.

### 3.14 Campaigns and source attribution

Zoho's Campaigns module + Zoho Campaigns marketing automation.

**BrainWise scope (v1):**

- **Campaign record** — name, type (email, webinar, content, partner, event, paid ads, other), start/end date, budget, status.
- **Lead source tracking** — every Lead has a `source` field; configurable picklist.
- **UTM parameter capture** — Lovable form submissions include UTMs; CRM webhook ingest captures and tags the lead with campaign attribution.
- **Campaign ROI report** — leads sourced, deals created, deals won, revenue closed, vs. campaign cost.

### 3.15 Reports and dashboards

Zoho ships 300+ pre-built reports plus a custom report builder.

**BrainWise scope (v1):**

- **Pipeline reports:**
  - Pipeline by stage (count + amount).
  - Pipeline by source.
  - Pipeline by owner.
  - Forecast by month / quarter (closed + weighted open).
  - Win rate by stage (conversion %).
  - Average deal cycle (days from lead to close).
  - Lost reason breakdown.
- **Activity reports:**
  - Calls made by user, by day/week/month.
  - Meetings held.
  - Tasks completed vs. created.
  - Activity-to-deal correlation (how many activities precede a closed-won deal).
- **Lead reports:**
  - Leads by source.
  - Lead conversion rate by source (lead → deal → closed-won).
  - Lead score distribution.
  - Time-to-qualify (lead creation → status = Qualified).
- **Account reports:**
  - Top accounts by revenue.
  - Account engagement (activity recency).
  - Account hierarchy view.
- **Custom report builder** — choose entity, fields, filters, grouping, chart type. Save and share.
- **Dashboard** — combine multiple reports as widgets on a single page. Customizable per user.

### 3.16 Workflow automation

Zoho's Workflow Rules + Blueprint + CommandCenter.

**BrainWise scope (v1):**

- **Workflow rules** — trigger (record created/updated/converted, field changed, time-based) → conditions → actions (update field, send email, create task, notify user, call webhook).
- **Examples:**
  - When Lead status = Qualified → create task "Schedule discovery call" for assigned salesperson.
  - When Deal stage = Closed Won → create customer record in Doc 1 + assign onboarding task.
  - When Deal hasn't moved stage in 14 days → notify owner.
- **Blueprint-style stage progression** (deferred to v2) — required fields per stage, mandatory activities, approval gates.

### 3.17 Roles, permissions, and territories

Zoho's role hierarchy + profile-based permissions + territory management.

**BrainWise scope (v1) — light multi-user, Q-CRM5 locked:**

- **User roles:** Admin (full access), Sales User (read all, write own), Sales Manager (read all, write own + team), Read-Only.
- **Salesperson flag** on users (carries into Doc 1's commission tracking).
- **Commission percentage** per salesperson (used in Doc 1 commission report).
- **Owner-based filtering** — by default, list views show records owned by the current user; admins see all.
- **No territory management** at v1 — defer to when multi-region selling exists.

### 3.18 Mobile and integrations

Zoho's mobile apps + 800+ integrations.

**BrainWise scope (v1):**

- **Mobile responsive web** — no native app. Same posture as Doc 1.
- **REST API** for all CRM entities (already part of the Doc 1 platform).
- **Webhooks** for all status changes (lead created, deal stage changed, deal won/lost, activity completed).
- **Integration to Doc 1** — deal closed-won → customer auto-created.
- **Integration to BrainWise platform** — read-only sync of corporate organization records into CRM as Accounts (Cole's BrainWise platform corporate clients become CRM Accounts automatically).
- **Native integrations deferred:** Slack notifications (v2), Zapier/Make webhooks (v2), Calendly auto-import (v2).

---

## 4. Competitor cross-walk (what to steal from whom)

### 4.1 HubSpot CRM (the ease-of-use leader)

HubSpot's free CRM is the market reference for "easy to set up, hard to outgrow." Sales Hub adds the paid features.

**Take from HubSpot:**

- **Universal inbox / unified timeline.** Every interaction with a contact appears in a single chronological feed on the contact record: emails, calls, meetings, notes, deal stage changes, form fills, page visits, document opens. Zoho has this but it's cluttered; HubSpot's version is the cleanest in the market. Worth designing for.
- **"Sales sequences" lite** — multi-step outbound cadences (day 1 email, day 3 LinkedIn task, day 5 follow-up email, day 8 final email) with branching on engagement. The full version is sequences in Sales Hub Pro; even a minimal version (1-2 fixed templates with task automation) is high-value for outbound.
- **Email tracking with notifications** — get a desktop notification when a contact opens an email. Real-time. The "they just opened your email" trigger drives a lot of timely outreach.
- **Meeting scheduling links** — Calendly-style booking link tied to the user's calendar. Prospect picks a time, meeting goes on calendar AND CRM. (Note: this conflicts with Q-CRM3's no-sync decision; the Calendly-equivalent in BrainWise would be a separate v2 feature that requires opening the calendar sync question.)
- **Document tracking** — send a sales deck or proposal as a tracked link. See when prospect opens it, how long they spent on each page.
- **Deal record sidebar with everything** — when on a deal page, all associated contacts, line items, quotes, activities, related deals, attached files visible in collapsible sidebar without navigation.

**What HubSpot does *worse* than Zoho:**

- Free tier feature limits are aggressive once you hit 1-2 paid users.
- Customization (custom objects, multiple pipelines) gates behind expensive Professional/Enterprise tiers.
- Reporting depth on free/Starter plans is shallow.

### 4.2 Pipedrive (the pipeline UX leader)

Pipedrive is purpose-built for "deals moving through stages." Its Kanban pipeline view is the category reference.

**Take from Pipedrive:**

- **Pipeline Kanban as the home screen.** Default view is the pipeline, not a dashboard. The visual is the work surface. Drag-to-stage is instant, no modal.
- **"Activity-based selling" model** — every deal must have a next-step activity scheduled. If a deal has no upcoming activity, the deal card glows red. The forcing function prevents deals from going dark.
- **Deal age and rot indicators** — visual cues (color, icon) when a deal has been in a stage too long. Configurable thresholds per stage.
- **Smart Contact Data** — for any email address in the CRM, surface LinkedIn, Twitter, GitHub, gravatar, professional info pulled from the open web. Similar to enrichment but without needing a paid API.
- **Side panel for deal editing** — click a deal on the Kanban, side panel slides in with full editing without leaving the pipeline view.
- **Won/lost dashboard** — clean visual breakdown of pipeline outcomes with reasons.

**What Pipedrive does *worse* than Zoho:**

- Limited to sales (no marketing automation, no support).
- Custom objects don't exist below the Enterprise tier.
- Email integration requires the user's email provider OAuth (similar limitation to email sync discussion).
- Forecasting is shallow.

### 4.3 Attio (the modern flexibility leader)

Attio is the newest entrant aimed at startups/agencies that want a customizable relational database, not a "sales pipeline" tool.

**Take from Attio:**

- **Relational data model exposed to users.** Every object (Person, Company, Deal, custom object) can have typed relationships to others. Many-to-many is native. A Person can be associated with multiple Companies; a Deal can span multiple People and Companies.
- **List views as queries.** Lists are saved filters over the data — "deals closing this quarter over $50k," "contacts in healthcare industry I haven't talked to in 30 days." Lists are first-class navigation, not just filters.
- **Custom objects as first-class citizens.** Build a "Partners" object or "Resellers" object with the same UX as built-in Contacts/Companies. Without the Enterprise pricing tier other CRMs gate this behind.
- **Inline editing everywhere.** Click any field in any view, edit in place. No modal.
- **Keyboard-first navigation.** Real keyboard shortcuts (`/` to search, `c` to create, arrow keys to navigate, `e` to edit).
- **Linear-inspired UI density.** Information-dense, fast, no wasted whitespace.

**What Attio does *worse* than Zoho:**

- No marketing automation.
- No native quoting/invoicing (which is fine since Doc 1 covers that).
- Pricing scales with rows (database scale) which can be expensive at scale.
- Younger product, fewer integrations.
- Reporting is less mature than Zoho.

### 4.4 Salesforce (the enterprise depth reference)

Salesforce is the elephant. Mentioning for completeness because the architectural patterns matter even if the product doesn't.

**Take from Salesforce:**

- **Object hierarchy and metadata-driven UI.** Every object (Lead, Account, Contact, Opportunity, custom objects) is described in metadata. UI auto-generates from the metadata. Field changes propagate without code. The architectural choice that gives Salesforce its flexibility — and the one BrainWise should mirror in its data model.
- **Process Builder / Flow** — visual workflow automation that's actually graphical (not just rules in a list).
- **Stage history table** — every stage transition is its own record with timestamp, user, duration in prior stage. Drives stage-velocity analytics.
- **Opportunity Splits** — credit a deal to multiple users (deal owner gets X%, SDR gets Y%, AE gets Z%). Useful for team selling.
- **Forecast Categories** distinct from Stage — separately track "this will close" vs. "best case" vs. "commit." Stage is the deal state; Forecast Category is the rep's prediction.

**What Salesforce does *worse* than the alternatives:**

- Expensive ($175/seat/month at Enterprise).
- Complex to administer.
- UI is dated.
- Implementation typically requires a Salesforce admin or consultant.

### 4.5 Folk / Affinity (the relationship-network reference)

Folk (and Affinity for VCs) take the position that the CRM should map relationships, not just track deals.

**Take from Folk:**

- **Relationship strength score** — for each contact, computed from interaction frequency, recency, and warmth signals (email back-and-forth count, meetings held). Surface "who haven't I talked to in a while" automatically.
- **Connection mapping** — Person A introduced you to Person B who introduced you to Person C. Visualize the introduction graph.
- **Email-based contact import** — connect Gmail and Folk auto-populates contacts from your sent/received history without needing to add each one manually.
- **Companies derived from email domains.** Receive an email from `jane@acme.com` → Acme auto-created if it didn't exist.

**What Folk does *worse* than Zoho:**

- No pipeline management to speak of.
- No deal stages, forecasting, lead scoring.
- Marketing automation absent.
- Reporting minimal.

### 4.6 Synthesis target

Pull:

- **Feature breadth and customization depth** from Zoho.
- **Universal timeline UX, email tracking, document tracking** from HubSpot.
- **Pipeline Kanban as the home screen, activity-based selling, deal rot indicators** from Pipedrive.
- **Relational data model, list-views-as-queries, keyboard-first nav** from Attio.
- **Stage history table, metadata-driven UI, opportunity splits** from Salesforce.
- **Relationship score, email-derived contacts, domain-based company creation** from Folk.

Design north star: Pipedrive's pipeline-as-home, Attio's customizable data model, HubSpot's timeline polish, Salesforce's stage-history rigor, Folk's relationship intelligence.

---

## 5. v1 scope (the actual build)

### 5.1 Leads module

**In scope:**

- Lead record with: owner, source (picklist), status (picklist), salutation, first name, last name (required), title, company name (required — text, not yet linked to Account), email, phone, mobile, website, industry, employee count band, revenue band, rating, address, tags, description, custom fields, score (computed), created/updated timestamps, last activity timestamp.
- Lead list view with filters (status, source, owner, score range, created date, last activity).
- Lead detail page with: full fields, activity timeline, notes, attachments, tags, score history.
- **Convert Lead** action — single button that creates Account + Contact + Deal. Field mapping configurable in settings. After conversion, lead is archived (not deleted) for audit.
- **Bulk convert** for multiple leads.
- **Direct Contact creation path (Q5 lock).** Contacts can also be created directly without going through the lead step (for warm intros, referrals, or known prospects). Direct-created contacts can optionally have a deal created from the contact detail page. The `leads` table and the lead-conversion flow remain in place for cold prospects; the contact-direct path is an alternative entry, not a replacement.
- **Lead assignment** — round-robin among users with salesperson flag, or rule-based per source.
- **Lead scoring** — rule-based; configurable per organization. Demographic rules (industry, size) and behavioral rules (email opened, link clicked, form filled).
- **Auto-status promotion** — score threshold crossing triggers status change (e.g., score ≥ 50 → Qualified).
- **CSV import** with field mapping and duplicate handling.
- **Duplicate detection** — on creation, surface possible duplicates by email match or company-name match (don't block, just flag).
- **Activity feed** per lead.

**Deferred:**

- AI-based predictive scoring (v3).
- Multi-step lead-nurture automation sequences (v2).
- Auto-routing based on territory (v3+).

### 5.2 Accounts module

**In scope:**

- Account record with: owner, name (required), type (Customer/Prospect/Partner/Vendor/Reseller), parent account (self-lookup), industry, employee count, revenue band, phone, website, billing address, shipping address, description, tags, custom fields.
- Account list view with filters.
- Account detail page with tabs: Contacts (under this account), Deals (open + closed), Activities (timeline), Notes, Attachments, Custom Fields.
- **Account hierarchy view** — visual tree of parent/child relationships.
- **Domain-based auto-creation** (from Folk) — when an email arrives or is logged with domain `@acme.com`, if no Account with that domain exists, suggest creating Account "Acme" with that domain.
- **Doc 1 integration:** when Account type = Customer, link to the `customers` row in Doc 1 schema. Same UUID. Account becomes the editable display surface; `customers` becomes the billing-relationship surface.

**Deferred:**

- Org chart visualization (contacts within an account by reports-to) — v2.
- Account scoring (similar to lead scoring but at account level) — v3.

### 5.3 Contacts module

**In scope:**

- Contact record with: owner, salutation, first name, last name, title, account (lookup), reports-to (self-lookup), email, phone, mobile, alternate phone, LinkedIn URL, Twitter handle, date of birth, lead source, department, email opt-out flag, mailing address, description, tags, custom fields.
- **Maps to `contact_persons` from Doc 1.** Same UUID; the row exists in `contact_persons` whether it's a CRM contact or a billing contact. CRM-specific fields (LinkedIn, Twitter, opt-out, etc.) added as additional columns.
- Contact list view with filters.
- Contact detail page with: activity timeline, deals associated, notes, attachments.
- **Contact-derived from email logging** — when an email comes through BCC inbox and the sender/recipient isn't yet a Contact, optionally auto-create.
- **Email opt-out enforcement** — flagged contacts excluded from any bulk/template sends.

**Deferred:**

- Contact merge (combine duplicate contact records) — v2 (but design data model to support it).
- Contact-to-contact relationships beyond reports-to (referred-by, knew-from-event) — v3.

### 5.4 Deals module

**In scope:**

- Deal record with: owner, name (required), account (required lookup), primary contact (lookup), amount, currency (USD only at v1 per Doc 1 Q3), close date, stage (picklist), probability (auto from stage or manual), expected revenue (computed), type (New Business / Existing Business / Renewal / Upsell — Q2 lock: Type field carries the lifecycle distinction since v1 uses single pipeline), source, next step (text), description, tags, custom fields.
- **Single pipeline at v1 (Q2 lock).** Data model retains `pipeline_id` foreign key on deals; v1 has one default pipeline (BrainWise Corporate Sales) with 6 stages. Multi-pipeline UI deferred to v2.
- **Default 6 stages (Q1 lock):** Inquiry → Discovery → Demo → Proposal → Negotiation → Closed Won → Closed Lost.
- **Stage history table** — every stage transition logged with from/to/timestamp/user/time-in-prior-stage.
- **Deal team** — multiple users on a deal with roles (Owner, AE, SDR, SE, CSM).
- **Stakeholders** — multiple contacts on a deal with roles (Decision Maker, Influencer, Champion, Detractor, Other).
- **Line items / products** on a deal — references Doc 1's items table. Used to generate Doc 1 estimates and invoices.
- **Won/lost** transition requires reason (picklist + optional notes).
- **Auto-create renewal deal** — on Closed Won for type ≠ Renewal, optionally auto-create a renewal deal N days before next renewal (configurable per deal).
- **Doc 1 integration:** on Deal stage = Closed Won, auto-create or update the customer record in Doc 1's `customers` table. Trigger configurable per-deal (some won deals don't become billing customers immediately).

**Deferred:**

- **Multi-pipeline UI** — v2 (data model already supports it per Q2 lock; only the management UI and pipeline-switcher are deferred).
- Opportunity splits (deal credit shared across multiple reps) — v2 when team selling exists.
- Forecast categories distinct from stage — v2.
- Approval workflows on deal close — v3.

### 5.5 Activities (Tasks, Calls, Meetings, Emails)

**In scope:**

- **Tasks** — subject, due date, priority (Low/Med/High/Urgent), status (Open/In Progress/Done/Waiting/Deferred), assigned-to user, related-to (Lead/Account/Contact/Deal), description.
- **Calls** — subject, contact (lookup), call type (Outbound/Inbound), result (Completed/Voicemail/No Answer/Wrong Number/Busy/Bad Number), duration, purpose, description, scheduled-for or logged-at timestamp, related-to.
- **Meetings** — title, location (text or video link), attendees (CRM users + contacts), start/end timestamp, all-day flag, recurrence (simple weekly/monthly), description, related-to.
- **Emails** — subject, body (rich text), to/cc/bcc (contacts + free-text addresses), sent-at timestamp, sent-by user, opened-at (from tracking pixel), clicked-at (from link rewriting), related-to. Sent via Resend per Sync-A.
- **Activity dashboard** — Today, Overdue, This Week, Next Week views; filter by type, owner, status.
- **Activity timeline** on every Lead/Account/Contact/Deal page.
- **Add to Calendar** button on Meeting activities (Q-CRM3) — generates Google/Outlook/.ics links.
- **Meeting reminders** (Q-CRM3) — 1hr-before email, day-of digest.
- **Activity-based selling enforcement** (from Pipedrive) — Deal detail page surfaces "no next activity scheduled" warning when a deal has no upcoming Task/Call/Meeting.

**Deferred:**

- Recurring tasks beyond simple recurrence (skip dates, custom cadences) — v2.
- Activity templates (one-click "Schedule discovery call" creates a standard task with default fields) — v2.
- Conversation intelligence on logged calls (transcript, sentiment) — v3+.

### 5.6 Email integration (Sync-A)

**In scope:**

- **BCC inbox** — each user has a unique BCC address `bcc-{user_token}@inbox.brainwiseenterprises.com`. Emails BCC'd here are ingested via Resend inbound (or AWS SES inbound) → matched to contacts by recipient email → logged as Email activity with full body, attachments preserved.
- **Forward inbox** — user can forward any email to `forward-{user_token}@inbox.brainwiseenterprises.com`. Same parsing logic; matched by original sender.
- **CRM compose UI** — rich-text email composer in the CRM. Sent via Resend from a CRM domain. Tracked with pixel + link rewriting. Stored in `email_activities` table.
- **Email templates** — saved templates with merge tags (`{{contact.first_name}}`, `{{deal.amount}}`, `{{account.name}}`, `{{user.signature}}`).
- **Email tracking** — open pixel (1x1 transparent gif) + link rewriting (all links replaced with tracker URLs that redirect after recording the click).
- **Email send queue** — Resend send is async; failed sends retry with backoff.
- **Unsubscribe / two-tier opt-out (Q9 lock).** Every CRM-sent email includes an unsubscribe link. Two opt-out scopes:
  - **Marketing opt-out** — blocks bulk and templated sends (sequences, drip campaigns, newsletters). Default unsubscribe action.
  - **Transactional opt-out (all communication)** — blocks every CRM-initiated send including one-off composed emails. Requires explicit choice from the unsubscribe link or admin action on the contact record.
  - Each scope has separate `*_opt_out_at` timestamp and `*_opt_out_reason` columns for audit.
  - When composing a one-off email to a contact with marketing_opt_out set, a non-blocking warning banner appears; transactional_opt_out blocks send with an error.

**Deferred:**

- Two-way Gmail/Outlook sync (v3 or never — escape valve to Nylas if priority changes).
- Automated multi-step sequences (HubSpot-style cadences) — v2.
- Inbox view inside the CRM (read inbound emails from inside) — v3.

### 5.7 Calendar integration ("Add to Calendar")

**In scope:**

- **"Add to Calendar" button** on Meeting activities. Generates four output options on click:
  - Google Calendar event-create URL (opens in new tab).
  - Outlook.com event-create URL.
  - Outlook desktop event-create URL.
  - .ics file download.
- **Event payload** includes: title, location (text), start/end (with timezone), description (with link back to CRM Meeting record), attendees (email addresses only; doesn't auto-invite).
- **Meeting reminders:**
  - Email 1 hour before to assigned user(s).
  - Day-of digest each morning at 8 AM local time (configurable) — meetings + calls + tasks due today.
  - In-app notification 15 minutes before scheduled start.
- **Reschedule handling** — editing a Meeting's start/end time prompts "regenerate Add to Calendar link." User must manually update their calendar.

**Deferred:**

- True two-way sync (would require Nylas or direct integration; locked out of v1 per Q-CRM3).
- Scheduling links (Calendly-style "pick a time" for prospects) — v2 (revisits calendar sync question).
- Automatic meeting transcription / recording — v3+.

### 5.8 Lead capture (webhook ingest + Lovable forms)

**In scope:**

- **Generic webhook endpoint** — `POST /api/webhooks/lead-capture/{webhook_id}`. Accepts JSON payload.
- **Webhook config UI** — per webhook: field mapping (incoming JSON path → CRM Lead field), default values, lead source attribution, auto-assignment, auto-response, optional HMAC shared-secret header verification, IP rate limit.
- **Spam mitigation** — IP rate limiting (default 60/min), optional honeypot field, optional HMAC.
- **Auto-enrichment trigger** on lead creation — runs Apollo + Hunter enrichment in background.
- **Auto-assignment rules** — round-robin among salesperson-flagged users, or fixed-assignment-per-webhook.
- **Auto-response email** — configurable template; sent from CRM domain via Resend.
- **Webhook activity log** — every receipt logged with raw payload (visible to Admin users for debugging).
- **Pre-built integration recipes (Q7 lock).** Five recipes shipped at v1:
  - **Lovable forms** — POST to webhook with HMAC verification; snippet for the Lovable submit handler.
  - **Tally** — webhook endpoint config inside Tally's form settings; field mapping for Tally's standard payload shape. (Tally is the recommended form-builder substitute for Typeform; free tier supports unlimited forms with conditional logic and webhook delivery.)
  - **Microsoft Bookings** — webhook config for new booking events; field mapping for booking payload (attendee email, service, time).
  - **Stripe (new customer)** — webhook on `customer.created` or `checkout.session.completed`; maps Stripe customer data to a CRM Contact + Account.
  - **Zapier passthrough** — generic escape valve. Documents the JSON shape the webhook expects; any of Zapier's ~6,000 integrations can pipe data in via a custom Webhooks Zap.

**Deferred:**

- Hosted form builder (BrainWise generates the form HTML) — v2.
- Lead nurture sequences post-capture (drip emails) — v2.
- Multi-step / multi-page forms — v2.

### 5.9 Enrichment (Apollo + Hunter)

**In scope:**

- **Apollo integration** — on-demand and auto-on-create. Pulls: full name, title, LinkedIn URL, location, work email, personal email (when available), phone, company name, company domain, company size, industry, technographics (tech stack), employee LinkedIn URLs.
- **Hunter.io integration** — verifies email deliverability, returns confidence score, suggests alternative formats when missing.
- **Enrich button** on any Lead, Contact, or Account record.
- **Auto-enrich on creation** for leads coming through webhooks; configurable on/off per webhook.
- **Enrichment history** — every enrichment call logged with timestamp, source, data returned. Allows tracking of how data has changed over time.
- **Rate limit handling** — Apollo free tier has limits (~50 enrichments/month); queue and throttle, surface remaining quota in admin.

**Deferred:**

- Waterfall enrichment (Apollo → People Data Labs → Hunter chained) — v2 (Clay-style orchestration).
- Intent data (Bombora, G2 intent signals) — v3.
- Account-level intent / company news ingestion — v3.

### 5.10 Lead scoring

**In scope:**

- **Rule-based scoring engine** — admin-configurable rules.
  - **Demographic rules:** field value → score adjustment. (Industry = "Healthcare" → +10. Company size > 500 → +15.)
  - **Behavioral rules:** event → score adjustment. (Email opened → +5. Link clicked → +10. Form filled → +25. Email unsubscribed → -50. Visited pricing page → +15.)
  - **Recency decay:** scores decay over time without recent activity (configurable: 5% per week of no activity).
- **Threshold-based status promotion** — score crossing threshold triggers Lead status change (e.g., ≥ 50 → Qualified).
- **Score history log** — every score change recorded with reason.
- **Score badge** visible on lead cards in list views and pipeline.

**Deferred:**

- AI/predictive scoring (model trained on historical conversions) — v3.
- Account-level scoring — v3.

### 5.11 Campaigns and source attribution

**In scope:**

- **Campaign record** — name, type (email/webinar/content/partner/event/paid/other), start/end, budget (USD), status (Planned/Active/Completed), description.
- **UTM capture** — webhook ingest captures utm_source/medium/campaign/term/content if present in the lead payload. Tag the resulting lead with the matching Campaign.
- **Lead source picklist** — configurable per organization, attribution captured at lead creation.
- **First-touch and last-touch attribution** — both tracked on leads (multi-touch surfaces in v2).
- **Campaign ROI report:** leads, conversions to deals, deals won, revenue closed, cost, ROI ratio.

**Deferred:**

- Multi-touch attribution (each touch credited fractionally) — v2.
- Marketing automation (drip email campaigns) — v2.
- Landing page builder — v3.

### 5.12 Reports and dashboards

**In scope (v1 ships with these reports as named, parameterized SQL views):**

Pipeline reports:
- Pipeline by Stage (count + amount).
- Pipeline by Source.
- Pipeline by Owner.
- Forecast by Month / Quarter.
- Win Rate by Stage.
- Average Deal Cycle.
- Lost Reason Breakdown.

Activity reports:
- Calls Made by User (day/week/month).
- Meetings Held.
- Tasks Completed vs. Created.
- Activity-to-Deal Correlation.

Lead reports:
- Leads by Source.
- Lead Conversion Rate by Source.
- Lead Score Distribution.
- Time-to-Qualify.

Account reports:
- Top Accounts by Revenue (joins to Doc 1).
- Account Engagement (activity recency).

Campaign reports:
- Campaign ROI.
- Source Attribution.

User reports:
- Salesperson Performance (deals owned, closed, commission earned — joins to Doc 1).

- **Dashboard** with configurable widget layout per user.
- **Saved filters** as first-class objects (Attio-inspired list-views-as-queries).
- **Export to CSV / PDF** for any report.

**Deferred:**

- Custom report builder UI (point-and-click) — v2.
- Scheduled email delivery of reports — v2.
- Cross-Doc reports (CRM × Books) — Doc 3.

### 5.13 Workflow automation (rules engine)

**In scope (v1):**

- **Workflow rules** — configurable per organization.
  - **Triggers:** record created, record updated, field changed (specific value), record converted, time-based (X days after creation, X days before close date, X days in same stage).
  - **Conditions:** field comparisons, logical AND/OR.
  - **Actions:** update field, send email (template), create task, notify user (in-app + email), call webhook (outbound).
- **Workflow log** — every rule execution recorded.
- **Pre-built workflows shipped with v1:**
  - "Deal Won → wait 5 minutes (Q10 undo window) → create Customer in Doc 1 + assign onboarding task." If the deal stage is moved away from Won within the 5-minute window, the queued action is cancelled. Audit log entry records both the trigger and the cancellation if it occurred.
  - "Deal stale 14 days → notify owner."
  - "Lead score crosses threshold → status to Qualified + assign to salesperson."
  - "New deal in Discovery stage → schedule discovery call task."

**Deferred:**

- Visual workflow builder (Process Builder / Flow style) — v3.
- Blueprint stage-progression (required fields per stage, mandatory activities) — v2.
- Multi-step branching workflows — v2.

### 5.14 Roles, permissions, and team

**In scope (light multi-user v1 per Q-CRM5):**

- **Roles:** Admin, Sales User, Sales Manager, Read-Only.
- **Permission model:** record-level ownership + role-based read/write.
  - Sales User: read all, write own.
  - Sales Manager: read all, write own + their team's.
  - Admin: full access.
  - Read-Only: read-only across all.
- **Salesperson flag** on user with commission percentage (carried to Doc 1).
- **User invitation flow** — admin invites by email, user accepts via email link, sets password.
- **Audit log** — every record change logged with user, timestamp, before/after.

**Deferred:**

- Field-level permissions — v2.
- Territory management — v3.
- Custom roles — v3.

### 5.15 Settings

**In scope (v1):**

- Lead status picklist editor.
- Lead source picklist editor.
- Deal stage editor (per pipeline) with probability defaults.
- Pipeline manager (create/edit/archive pipelines).
- Industry picklist.
- Account type picklist.
- Won/Lost reason picklist.
- Custom field definitions (per entity: Lead, Account, Contact, Deal).
- Email template library.
- Workflow rule editor.
- Lead scoring rule editor.
- Webhook configuration (per source).
- Apollo / Hunter API key configuration.
- User management.

---

## 6. Data model (v1)

PostgreSQL-flavored. Same conventions as Doc 1: `id uuid pk`, `org_id`, `created_at`, `updated_at`, `created_by`, `updated_by` unless noted. RLS policies applied per `org_id`.

### 6.1 Core CRM entities

```
leads
  id, org_id, owner_user_id, status_id, source_id,
  salutation, first_name, last_name, title,
  company_name_text,  -- unlinked text until conversion
  email, phone, mobile, website,
  industry_id, employee_count_band, revenue_band, rating,
  address (jsonb), tags (text[]), description,
  score, last_score_calculated_at,
  converted_at, converted_account_id, converted_contact_id, converted_deal_id,
  archived_at, custom_fields (jsonb),
  enrichment_data (jsonb), last_enriched_at,
  utm_source, utm_medium, utm_campaign, utm_term, utm_content,
  source_webhook_id, last_activity_at

accounts
  id, org_id, owner_user_id, name, account_number,
  type (customer|prospect|partner|vendor|reseller),
  parent_account_id (self-fk),
  industry_id, employee_count_band, revenue_band, ownership, ticker, rating,
  phone, website, domain,  -- domain used for email-derived auto-creation
  billing_address (jsonb), shipping_address (jsonb),
  description, tags (text[]), custom_fields (jsonb),
  customer_id (fk to Doc 1 customers — null until conversion),
  last_activity_at

contacts
  -- maps to Doc 1's contact_persons with extended fields
  id, org_id, owner_user_id, account_id (fk),
  salutation, first_name, last_name, full_name (computed),
  title, reports_to_contact_id (self-fk),
  email, phone, mobile, alternate_phone,
  linkedin_url, twitter_handle, skype_id,
  date_of_birth, lead_source_id, department,
  marketing_opt_out, marketing_opt_out_at, marketing_opt_out_reason,
  transactional_opt_out, transactional_opt_out_at, transactional_opt_out_reason,
  mailing_address (jsonb), other_address (jsonb),
  description, tags (text[]), custom_fields (jsonb),
  is_billing_contact,  -- true if this is a Doc 1 billing contact
  enrichment_data (jsonb), last_enriched_at,
  last_activity_at, relationship_score,  -- Folk-inspired
  created_from (lead_conversion|direct|email_derived|webhook|api),
  source_lead_id  -- nullable; null for direct/email_derived/webhook

deals
  id, org_id, owner_user_id, name,
  pipeline_id (fk), stage_id (fk),
  account_id (fk required), primary_contact_id (fk),
  amount, currency_code, probability,
  expected_revenue (computed),
  close_date, actual_close_date,
  type (new_business|existing_business|renewal|upsell),
  source_id, next_step_text,
  won_reason, lost_reason, lost_to_competitor,
  description, tags (text[]), custom_fields (jsonb),
  parent_deal_id,  -- for renewal chains
  is_renewal_auto_created, auto_create_renewal_days_before,
  last_activity_at, no_activity_since_at  -- for rot detection

deal_team_members
  id, org_id, deal_id, user_id, role (owner|ae|sdr|se|csm|other), allocation_percent
  -- allocation_percent for opportunity splits (v2; default 100 for owner at v1)

deal_stakeholders
  id, org_id, deal_id, contact_id, role (decision_maker|influencer|champion|detractor|other), notes

deal_line_items
  id, org_id, deal_id, item_id (fk to Doc 1 items),
  description, quantity, unit_price, line_discount, line_total, sort_order

deal_stage_history
  id, org_id, deal_id, from_stage_id, to_stage_id,
  transitioned_at, transitioned_by_user_id, time_in_prior_stage_seconds
```

### 6.2 Activities

```
activities
  -- single table with discriminator column
  id, org_id, owner_user_id, type (task|call|meeting|email|note),
  subject, description (rich text),
  status, priority,
  scheduled_start_at, scheduled_end_at, all_day,
  completed_at, completed_by_user_id,
  related_to_type (lead|account|contact|deal), related_to_id,
  -- type-specific fields
  call_type, call_result, call_duration_seconds,  -- calls
  meeting_location, meeting_recurrence (jsonb),  -- meetings
  email_subject, email_body_html, email_body_text,  -- emails (also see email_activities)
  email_sent_at, email_opened_at, email_clicked_at, email_message_id,
  attachment_count, tags (text[]), custom_fields (jsonb)

activity_attendees
  -- many-to-many for meeting attendees (contacts + users)
  id, org_id, activity_id, attendee_type (contact|user|external),
  contact_id (fk), user_id (fk), external_email, response_status

activity_attachments
  id, org_id, activity_id, filename, storage_path, mime_type, size_bytes, uploaded_by
```

### 6.3 Email-specific tables (Sync-A)

```
email_activities
  -- extended record for outbound emails sent via CRM compose
  id, org_id, activity_id (fk to activities),
  sent_by_user_id, from_address, to_addresses (text[]),
  cc_addresses (text[]), bcc_addresses (text[]),
  subject, body_html, body_text,
  resend_message_id, sent_at,
  opened_count, first_opened_at, last_opened_at,
  clicked_count, first_clicked_at, last_clicked_at,
  unsubscribed_at,
  template_id (fk), merge_data (jsonb)

email_inbound_ingestion
  -- log of emails received via BCC or forward
  id, org_id, ingested_at,
  ingest_source (bcc|forward),
  raw_message (jsonb), from_address, to_addresses (text[]), cc_addresses (text[]),
  subject, body_html, body_text,
  matched_contact_ids (uuid[]),  -- contacts matched by address
  matched_deal_ids (uuid[]),
  matched_lead_ids (uuid[]),
  activity_id (fk to activities — created on successful match),
  processing_status (pending|matched|unmatched|error),
  processing_error_text

email_templates
  id, org_id, name, subject, body_html, body_text,
  merge_tags_used (text[]), category, is_active, created_by_user_id

email_tracking_events
  -- raw pixel/link click events for outbound emails
  id, org_id, email_activity_id, event_type (open|click|unsubscribe|bounce),
  event_at, ip_address, user_agent, link_url (for clicks)
```

### 6.4 Calendar (Add to Calendar)

```
meeting_calendar_links
  -- audit log of generated Add-to-Calendar invocations
  id, org_id, activity_id (must be meeting type),
  generated_at, generated_by_user_id,
  output_format (google|outlook_web|outlook_desktop|ics)

meeting_reminders
  -- queued reminders for meetings/calls/tasks
  id, org_id, activity_id, reminder_type (1hr_before|day_of_digest|15min_app_notify),
  scheduled_for_at, sent_at, sent_to_user_id,
  delivery_method (email|in_app|both), delivery_status
```

### 6.5 Lead scoring

```
lead_scoring_rules
  id, org_id, name, rule_type (demographic|behavioral|decay),
  trigger_condition (jsonb),  -- e.g., {"field": "industry", "operator": "in", "value": ["Healthcare"]}
  score_adjustment (int),
  applies_to (lead|contact|both),
  is_active, sort_order

lead_score_events
  id, org_id, lead_id (fk), rule_id (fk),
  score_delta, score_before, score_after,
  reason_text, event_at
```

### 6.6 Webhooks and lead capture

```
lead_capture_webhooks
  id, org_id, webhook_id_slug (unique, used in URL),
  name, description, source_id (default source for leads from this webhook),
  field_mappings (jsonb),  -- {"json.email": "leads.email", "json.full_name": "leads.first_name + leads.last_name"}
  default_values (jsonb),
  auto_assign_strategy (round_robin|fixed_user|none),
  auto_assign_user_id, auto_enrich_on_create,
  auto_response_template_id,
  hmac_secret (encrypted), require_hmac,
  rate_limit_per_minute, is_active

webhook_ingestion_log
  id, org_id, webhook_id_slug, received_at,
  source_ip, request_headers (jsonb), request_body (jsonb),
  hmac_verified, rate_limit_exceeded,
  processing_status (success|spam_blocked|rate_limited|validation_error|error),
  processing_error, resulting_lead_id (fk)
```

### 6.7 Enrichment

```
enrichment_log
  id, org_id, target_type (lead|contact|account),
  target_id, enrichment_provider (apollo|hunter|manual),
  triggered_by (auto_on_create|manual_button|workflow_rule),
  triggered_by_user_id, requested_at, completed_at,
  raw_response (jsonb), fields_updated (text[]),
  api_credits_consumed, error_text
```

### 6.8 Pipelines, stages, and config

```
pipelines
  id, org_id, name, description, is_default, is_active, sort_order

deal_stages
  id, org_id, pipeline_id, name,
  default_probability_percent, color,
  is_won, is_lost, requires_reason,
  rot_threshold_days,  -- deal in this stage past this many days flags as stale
  sort_order, is_active

lead_statuses
  id, org_id, name, color, is_terminal,
  promote_to_status_at_score, sort_order, is_active

picklist_values
  -- generic picklist: industry, lead source, account type, won reason, lost reason, etc.
  id, org_id, picklist_type, value, label, color, sort_order, is_active

custom_field_definitions
  -- shared with Doc 1's custom field engine
  -- entity_type extended to include lead|account|contact|deal
```

### 6.9 Workflow rules

```
workflow_rules
  id, org_id, name, description,
  trigger_type (record_created|record_updated|field_changed|time_based|record_converted),
  trigger_config (jsonb),
  applies_to_entity (lead|account|contact|deal|activity),
  conditions (jsonb),  -- nested AND/OR tree
  actions (jsonb),  -- array of action specs
  is_active, sort_order, last_executed_at, execution_count

workflow_execution_log
  id, org_id, rule_id, triggered_at,
  target_entity_type, target_entity_id,
  conditions_evaluated_to (bool),
  actions_executed (jsonb), actions_failed (jsonb),
  execution_duration_ms
```

### 6.10 Campaigns

```
campaigns
  id, org_id, name, type, status,
  start_date, end_date, budget_amount, currency_code,
  description, custom_fields (jsonb)

campaign_attribution
  -- many-to-many: leads/deals can be attributed to multiple campaigns
  id, org_id, campaign_id,
  target_type (lead|deal), target_id,
  attribution_type (first_touch|last_touch|multi_touch),
  attribution_weight (numeric, defaults 1.0)
```

### 6.11 Saved lists and views

```
saved_lists
  id, org_id, owner_user_id, name,
  entity_type (lead|account|contact|deal|activity),
  filter_config (jsonb),  -- the query
  visible_columns (text[]),
  sort_config (jsonb),
  is_shared, is_default_for_entity
```

That's roughly **30 additional tables** for the CRM layer on top of Doc 1's 25. Total platform data model at v1: ~55 tables.

---

## 7. Effort estimates (v1)

Same methodology as Doc 1: one full-time developer, calendar days, ranges not commitments.

### 7.1 Foundation work specific to CRM

| Item | Estimate | Notes |
|---|---|---|
| CRM data model migration (30 tables + RLS + triggers) | 5-7 days | Heavy SQL. |
| User roles + permission model (4 roles, owner-based filtering) | 3-4 days | Extends Doc 1's auth. |
| Picklist management (lead source, deal stage, account type, etc.) | 2-3 days | Generic picklist engine. |
| Custom field definitions extending Doc 1's engine | 1 day | Mostly reuse. |
| Activity timeline rendering component | 3-4 days | Performant cross-entity timeline. |
| Saved lists / list-views-as-queries (Attio-inspired) | 4-5 days | Filter builder UI + persistent query storage. |

**Subtotal: ~18-24 days (4-5 weeks).**

### 7.2 Module-by-module build

| Module | Estimate | Notes |
|---|---|---|
| Leads (CRUD, list, detail, convert, bulk convert, import) | 5-7 days | Conversion logic is the trickiest piece. |
| Accounts (CRUD, hierarchy, domain-derived creation, Doc 1 customer link) | 4-5 days | |
| Contacts (CRUD, extending contact_persons, opt-out, derived from email) | 3-4 days | |
| Deals (CRUD, multi-pipeline, stage history, deal team, stakeholders, line items) | 8-11 days | Heart of CRM. Multi-pipeline + stage history are non-trivial. |
| Activities core (Tasks, Calls, Meetings, Notes) | 5-7 days | |
| Pipeline Kanban view (drag-to-stage, side panel editing, rot indicators) | 6-8 days | UI work is heavy here. Pipedrive-quality is the bar. |
| Activity-based selling enforcement (no-next-step warnings on deals) | 1-2 days | |
| Lead conversion workflow (field mapping, bulk convert) | 3-4 days | |
| Lead scoring engine (rule editor + score calculator + decay) | 4-6 days | Rules engine is reusable infrastructure. |
| Auto-assignment (round-robin, rule-based) | 2-3 days | |
| Multi-pipeline management UI | 2-3 days | |
| Workflow rules engine (trigger + conditions + actions) | 6-8 days | Cross-cutting; significant value. |
| Workflow rule editor UI | 4-5 days | |
| Campaigns + UTM capture + attribution | 3-4 days | |

**Subtotal: ~56-77 days (~11-15 weeks).**

### 7.3 Email integration (Sync-A)

| Item | Estimate | Notes |
|---|---|---|
| Resend inbound webhook → email_inbound_ingestion table | 2-3 days | |
| Email parser + contact matcher (by recipient/sender) | 2-3 days | RFC 5322 parsing edge cases. |
| BCC inbox routing (unique user tokens) | 1 day | |
| Forward inbox handling | 1 day | |
| In-CRM email composer UI (rich text, merge tag picker) | 4-5 days | |
| Email send via Resend with tracking (pixel + link rewriting) | 3-4 days | |
| Open/click tracking endpoint + event ingestion | 2-3 days | |
| Email template library + editor | 3-4 days | |
| Unsubscribe link + opt-out enforcement | 1-2 days | |

**Subtotal: ~19-26 days (4-5 weeks).**

### 7.4 Calendar integration ("Add to Calendar")

| Item | Estimate | Notes |
|---|---|---|
| Google Calendar / Outlook / .ics link generation | 1-2 days | Pure string templating. |
| Meeting reminder scheduler (cron + queue) | 2-3 days | 1hr-before email, in-app notification. |
| Day-of digest email generation + send | 2-3 days | Daily cron, per-user, with timezone handling. |
| Reschedule flow with regenerate link | 1 day | |

**Subtotal: ~6-9 days (~1-2 weeks).**

### 7.5 Lead capture (webhook ingest)

| Item | Estimate | Notes |
|---|---|---|
| Generic webhook endpoint + ingestion log | 2-3 days | |
| Webhook config UI (field mapping, defaults, auto-assign, rate limit) | 3-4 days | |
| HMAC verification + rate limiting + honeypot | 2 days | |
| Integration recipes documentation (Lovable forms, Calendly, Typeform) | 1-2 days | |

**Subtotal: ~8-11 days (~2 weeks).**

### 7.6 Enrichment (Apollo + Hunter)

| Item | Estimate | Notes |
|---|---|---|
| Apollo API integration | 2-3 days | |
| Hunter.io API integration | 1-2 days | |
| Enrichment service + queue (rate limit aware) | 2-3 days | |
| "Enrich" button + manual trigger UI | 1 day | |
| Auto-enrich on lead creation (workflow integration) | 1 day | |
| Enrichment history viewer | 1 day | |

**Subtotal: ~8-11 days (~2 weeks).**

### 7.7 Reports and dashboards

| Item | Estimate | Notes |
|---|---|---|
| 18 named reports (SQL views + UI cards) | 8-12 days | |
| Dashboard with configurable widgets | 4-5 days | |
| Saved list views (entity-typed queries) — reuses 7.1 work | 0 days | Built in foundation. |
| CSV/PDF export | 2-3 days | |

**Subtotal: ~14-20 days (~3-4 weeks).**

### 7.8 QA, polish, migration

| Item | Estimate | Notes |
|---|---|---|
| End-to-end test suite for core flows | 4-6 days | |
| Manual QA + bug fix passes | 5-8 days | |
| Migration tooling: import from Zoho CRM (CSV exports per entity) | 4-6 days | Zoho CRM exports CSVs per module. Map and ingest leads, accounts, contacts, deals, activities. Note: deal pipeline stage mapping requires hand-curation. |
| Documentation (internal runbooks, integration recipes) | 2-3 days | |

**Subtotal: ~15-23 days (~3-5 weeks).**

### 7.9 Doc 2 v1 total

**Optimistic: 144 days ≈ 29 weeks ≈ 6.5 months.**
**Pessimistic: 201 days ≈ 40 weeks ≈ 9 months.**
**Midpoint: ~7.5 months.**

For comparison: Doc 1 v1 midpoint was 6.5 months. Combined Doc 1 + Doc 2 build, done sequentially: **~14 months. Done with reuse where overlapping (auth, custom fields, picklists, attachments, activity log): ~12-13 months.**

### 7.10 v2 (deferred features summary)

- Two-way email sync via Nylas (~10-12 days).
- Sequences / cadences (multi-step outbound) (~8-12 days).
- Visual workflow builder (~10-14 days).
- Hosted form builder (~6-8 days).
- Waterfall enrichment + Clay orchestration (~6-8 days).
- Multi-touch attribution (~4-5 days).
- Custom report builder UI (~8-12 days).
- Blueprint stage-progression (~5-7 days).
- Opportunity splits (~3-4 days).
- Forecast categories (~2-3 days).
- Scheduling links (Calendly-style) — requires calendar sync (~10-15 days).
- Custom roles + field-level permissions (~5-7 days).

**v2 subtotal: ~77-107 days (~15-21 weeks).**

### 7.11 v3+ (parking lot)

- Predictive lead scoring (ML model).
- True two-way Gmail/Outlook sync (direct or Nylas).
- Two-way calendar sync.
- Marketing automation (drip campaigns).
- Landing page builder.
- Conversation intelligence (call transcription, sentiment).
- Account-level intent data / news monitoring.
- Multi-region territory management.
- Mobile native app.

---

## 8. Out of scope for Doc 2

- **Two-way email sync** (locked out by Q-CRM2, v3+).
- **Two-way calendar sync** (locked out by Q-CRM3, v3+).
- **Quote and invoice generation** — covered by Doc 1 (deals link to estimates/invoices via line items).
- **Bookkeeping integration** — Doc 3 (CRM revenue closed flows into Books P&L).
- **Contract / e-signature** — Doc 4.
- **Architecture and multi-tenancy** — Doc 5.
- **Support ticketing / Cases module** — out entirely. Doc 4 doesn't cover this either. Use Zendesk, Help Scout, or similar if needed; do not build.
- **Marketing automation (drip email campaigns)** — out of v1 explicitly; v2.
- **Product catalog / Price Books** — overlaps with Doc 1 items; deferred.

---

## 9. Risks and dependencies

### 9.1 Risks

- **Email parsing edge cases.** RFC 5322 has corners. Some clients strip headers, mailing lists munge subject lines, replies don't always include the original Message-ID. The BCC/forward ingestion approach is simpler than full sync but still has parsing risk. Mitigation: log raw payload always; allow manual re-matching when auto-match fails.
- **Email deliverability via CRM domain.** Sending from `crm@mail.brainwiseenterprises.com` rather than Cole's Gmail address means recipients may flag it as more "automated." Compensate with proper SPF/DKIM/DMARC setup and Resend's reputation management.
- **Apollo free tier limits.** ~50 enrichments/month at the free tier is restrictive. Realistic case: a real outbound campaign will exhaust this in days. Mitigation: queue + throttle; alert when approaching limit; design for graceful upgrade to paid tier.
- **Lead → customer dual-write coordination.** When a deal closes Won, customer is created in Doc 1's table. If this happens via workflow rule asynchronously and there's a partial failure (deal moved to Won but customer creation failed), we have inconsistency. Mitigation: transactional creation in the same SQL transaction; backfill job for any orphans; alert on inconsistency.
- **Pipeline Kanban performance at scale.** Drag-and-drop Kanbans become slow above ~500 deals visible. Mitigation: pagination per stage + lazy loading; degrade gracefully for power users with large pipelines.
- **Calendar "Add to Calendar" UX gap.** Users will sometimes reschedule meetings in their calendar without updating the CRM. The CRM's source-of-truth claim breaks in those cases. Mitigation: prominent "I updated my calendar manually" button on Meeting records; periodic UI prompts to verify upcoming meetings.
- **Workflow rules infinite loops.** "When deal updated → update field X" can recurse if X is in the trigger. Mitigation: rule execution depth limit (max 10); rule self-trigger detection.
- **Webhook ingestion abuse.** Public POST endpoint is a vector for spam, payload bombing, malicious payloads. Mitigation: rate limiting per IP, HMAC option, payload size caps, content-type validation, optional honeypot field, IP allowlist option.

### 9.2 Hard dependencies

- Doc 1 already shipped (or being built in parallel) — CRM relies on `customers`, `contact_persons`, `items` tables.
- Resend for outbound email + inbound parsing (already in stack).
- Apollo API (free tier).
- Hunter.io API (free tier).
- Supabase Edge Functions or cron for workflow execution + reminder scheduler.

### 9.3 Soft dependencies

- Nylas (if v3 or escape valve flips email/calendar to true two-way).
- Clay (if v2 adds waterfall enrichment).
- People Data Labs / ZoomInfo / Cognism (if enrichment scales beyond Apollo free).

---

## 10. Resolved decisions (Q1-Q10)

All ten questions raised in v1.0 of this document have been resolved.

1. **Q1: Default pipeline stages.** Resolved: **6 stages — Inquiry → Discovery → Demo → Proposal → Negotiation → Closed Won/Lost.** Stage probabilities seeded as: Inquiry 10%, Discovery 25%, Demo 40%, Proposal 60%, Negotiation 80%, Won 100%, Lost 0%. Editable per organization.

2. **Q2: Multi-pipeline at v1.** Resolved: **single pipeline + deal Type field (Renewal / Upsell / New Business).** Data model retains `pipeline_id` foreign key for forward compatibility; multi-pipeline management UI is v2 work. Saves ~2-3 days from module estimate.

3. **Q3: Lead source picklist.** Resolved: **10 sources** — Web Form, Referral, Cold Outbound, Conference/Event, Partner, Existing Customer Referral, LinkedIn, Podcast/Content Marketing, Webinar, Other.

4. **Q4: Won/Lost reason picklists.** Resolved: **defaults plus two additions.**
   - **Won:** Best-Fit Solution, Existing Relationship, Competitive Pricing, Other.
   - **Lost:** Price, Lost to Competitor, No Budget, Bad Timing, Lost to Status Quo, Project Cancelled, **Lost to Build-In-House**, **Lost to No Decision Maker**, Other.

5. **Q5: Lead vs. Contact philosophy.** Resolved: **strict Lead/Contact distinction + direct Contact creation allowed.** Cold prospects go through the lead-conversion flow; warm intros and referrals can be created directly as Contacts (with optional inline Deal creation). The `contacts.created_from` column tracks origin (lead_conversion | direct | email_derived | webhook | api).

6. **Q6: Activity-based selling enforcement.** Resolved: **warn only** (visual flag on deal cards with no upcoming activity). No blocking of stage advancement. Configurable to stricter mode in admin settings for future use.

7. **Q7: Webhook integration recipes at v1.** Resolved: **5 recipes** — Lovable forms, Tally, Microsoft Bookings, Stripe (new customer), Zapier passthrough. Tally is the recommended form-builder substitute for Typeform (free tier supports unlimited forms with conditional logic and webhook delivery; no internal form-builder built at v1, deferred to v3+).

8. **Q8: Email tracking transparency.** Resolved: **silent tracking** (industry standard). Open pixel + link rewriting active on all CRM-sent emails. No visible "tracked" indicator on outgoing emails.

9. **Q9: Email opt-out scope.** Resolved: **two-tier opt-out.**
   - **Marketing opt-out** — blocks bulk and templated sends (sequences, newsletters, drip campaigns). Default behavior of unsubscribe link.
   - **Transactional opt-out (all communication)** — blocks every CRM-initiated send including one-off composed emails. Requires explicit choice or admin action.
   - Schema: `contacts.marketing_opt_out` + `transactional_opt_out` with separate timestamp and reason columns each.

10. **Q10: Customer auto-creation on Deal Won.** Resolved: **auto-create with 5-minute undo delay.** Workflow rule fires on Deal stage = Closed Won, queues a "create Customer in Doc 1" action with a 5-minute delay. If the deal is reverted from Won during that window, the queued action is cancelled and audit log records both. After 5 minutes, the customer is created and an onboarding task is assigned.

### Net impact on v1 estimate

- Q2 (single pipeline): -2 to -3 days
- Q7 (Tally + 5 recipes): +1 to +2 days
- Q9 (two-tier opt-out): +1 day
- Q10 (delay queue): +0.5 day
- Others: 0

**Net: roughly unchanged.** v1 midpoint stays at ~7.5 months.

### Decisions deferred to Doc 5

- Same as Doc 1 — architecture (module vs. separate product), multi-tenancy, sequencing across docs, migration order.

---

## 11. Connection to subsequent docs

- **Doc 1 (Invoice):** already specified the bridge. Deals → customers + estimates → invoices. The CRM is the upstream funnel; Doc 1 is the downstream billing.
- **Doc 3 (Books):** every closed-won deal contributes to revenue forecasting and recognized revenue. CRM's pipeline data feeds Books' forecasting reports. Books doesn't depend on CRM but is enriched by it.
- **Doc 4 (Sign):** deals send proposals/contracts via Doc 4. Signed contracts close deals. The integration: Deal record has a "Send for Signature" action that invokes Doc 4; status updates back when signed.
- **Doc 5 (Cross-cutting):** the CRM's data model is intentionally compatible with Doc 1's customer schema (shared `contact_persons`, customer-to-account link) and with Doc 3's revenue recognition needs.

---

## 12. Decision log

Locked in this doc:

- **D2-1:** Strict Lead/Contact/Account/Deal entity model + direct Contact creation allowed for warm intros (Q5).
- **D2-2:** Email integration via Sync-A only (BCC + forward + compose-via-Resend). No Gmail/Outlook OAuth at v1.
- **D2-3:** Calendar via "Add to Calendar" generator + in-CRM reminders. No two-way sync at v1.
- **D2-4:** Lite enrichment via Apollo free + Hunter.io.
- **D2-5:** Generic webhook ingest endpoint. 5 pre-built integration recipes at v1: Lovable, Tally, Microsoft Bookings, Stripe, Zapier (Q7).
- **D2-6:** Light multi-user (4 roles: Admin, Sales User, Sales Manager, Read-Only).
- **D2-7:** Single base currency USD (inherited from Doc 1 Q3).
- **D2-8:** Salesperson + commission percentage lives on users table (carried to Doc 1).
- **D2-9:** Workflow rules engine in v1 with 4 pre-built rules shipped.
- **D2-10:** Pipeline Kanban as the default home screen for sales users.
- **D2-11:** Activity-based-selling enforcement via warning only (Q6).
- **D2-12:** Customer auto-creation on Deal closed-won via workflow rule with 5-minute undo delay (Q10).
- **D2-13:** 6-stage default pipeline: Inquiry → Discovery → Demo → Proposal → Negotiation → Closed Won/Lost (Q1).
- **D2-14:** Single pipeline at v1; multi-pipeline UI deferred to v2; data model retains forward compatibility (Q2).
- **D2-15:** 10-source default lead source picklist (Q3).
- **D2-16:** Won/Lost reason picklists with "Lost to Build-In-House" and "Lost to No Decision Maker" additions (Q4).
- **D2-17:** Silent email tracking; no visible "tracked" indicator (Q8).
- **D2-18:** Two-tier email opt-out: marketing_opt_out + transactional_opt_out (Q9).
- **D2-19:** Tally as the recommended form-builder; no internal form-builder built at v1 (Q7).

Open / deferred to Doc 5:

- **O2-1:** Same as Doc 1 — architecture (module vs. separate product), multi-tenancy, sequencing across docs, migration order.

---

*End of Doc 2.*
