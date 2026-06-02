# BrainWise Internal Operations Platform

## Doc 4 of 5: E-Signature Layer Scope

**Version:** 1.0
**Author:** Claude (drafted with Cole Bastian, BrainWise Enterprises)
**Date:** May 21, 2026
**Status:** Scope draft — two build paths specified, recommendation included

**Scope locks from session:**

- Q-SIGN1: Scope BOTH Sign-Wrap (vendor wrap) and Sign-Build (build own engine). Recommendation: Sign-Wrap.
- Q-SIGN2: Document types in scope — Estimates, SOWs, NDAs, MSAs, Onboarding paperwork.
- Q-SIGN3: Full multi-party flow design — Cole as sender, optional internal countersigner, external multi-recipient signing in sequential or parallel order.
- Q-SIGN4: Document creation = Word/PDF upload + in-platform field placement and merge tags (Interpretation 2).
- Q-SIGN4b: Platform ships with 4 default templates (NDA, MSA, SOW, Onboarding). Cole assumes attorney-review liability. Platform enforces version locking and disclaimer surfacing.
- Q-SIGN5: Email + SMS OTP for ALL contracts (stronger compliance posture).
- Q-SIGN6: 10-year signed document retention.
- Q-SIGN7: Both — auto-email signed copy + Certificate of Completion + in-platform storage.

**External dependencies beyond the build:**

- **Attorney engagement** (~$12k once + $3-5k/year) for the 4 default template contents. Doc 4 specifies structure; attorney provides content.
- **SMS provider** (Twilio Verify, ~$0.05/verification) for OTP at every signature.
- **If Sign-Wrap is chosen:** vendor subscription (~$30-120/month).

---

## 1. Purpose

This document scopes the e-signature layer of the BrainWise Internal Operations Platform — the system for sending documents for signature, capturing signatures with legal defensibility, generating certificates of completion, and storing signed artifacts. The layer integrates with Doc 1 (estimates → signature) and Doc 2 (deals → contracts → signature) to close the gap between "we agreed verbally" and "we have a binding signed document."

Per Q-SIGN1, this document specifies **two build paths**:

- **Sign-Wrap:** integrate a vendor (BoldSign, Dropbox Sign, or SignWell) as the signature engine. Build the BrainWise-side integration layer.
- **Sign-Build:** build the full e-signature engine in-house. Includes signature capture, cryptographic document sealing, tamper-evident audit log, certificate generation, and compliance posture.

A recommendation between the two is in §10, with detailed risk and cost comparison.

---

## 2. Context

Cole currently does not have a structured contract-signing workflow. Estimates from Zoho Invoice can be accepted via email link (no real signature). Larger contracts (SOWs, MSAs) likely go through DocuSign or are sent as Word/PDF attachments and signed by some ad-hoc combination of typed names, scanned signatures, or unsigned acceptance.

This breaks down as soon as:

- Corporate sales motion requires contracts with signed deliverables (multi-page MSAs, NDA-protected pilots).
- Legal disputes arise (need to produce a defensible audit trail of when, who, and where a contract was signed).
- Productization (selling BrainWise to other coaches) requires the platform to handle the full sales-to-contract flow in-house.

Driving force: every Doc 2 deal that reaches Proposal or Negotiation stage produces a document that needs a signature. Without an integrated signature layer, deals stall in a "sent the contract over email, waiting" state with no tracking and no defensible artifact.

---

## 3. Zoho Sign feature inventory (the surface being replaced)

Zoho Sign is the explicit replacement target. It's a full e-signature platform with API and UI, organized into the standard feature modules.

### 3.1 Document and template management

- **Document upload** — PDF, Word, Excel, image formats. System converts to PDF for signing.
- **Template creation** — reusable documents with placed signature fields. Templates have version history; in-flight documents retain the version they were sent with.
- **Drag-and-drop field placement** — signature, initial, date, text input, checkbox, dropdown, attachment-request fields placed on specific pages and coordinates.
- **Merge fields** — `{{customer_name}}`, `{{deal_amount}}`, etc., populated from CRM/Invoice data on send.
- **Text-tag detection** — placeholder text like `{{sig1}}` in the source document is auto-detected and converted to a signature field on upload.
- **Form-based signing** — templates with input fields where the signer fills in information (e.g., onboarding form: "What's your preferred meeting cadence?").
- **In-person signing** — sender hands their device to a person to sign in front of them.
- **Bulk send** — same template to multiple recipients in one action, each with their own merge data.

### 3.2 Signing workflow

- **Sequential routing** — Recipient A signs first, then Recipient B, then Recipient C. Each gets the document only after the prior signed.
- **Parallel routing** — all recipients receive the document at once; complete when all have signed.
- **Mixed routing** — sequential within groups, parallel between groups.
- **Recipient roles** — Signer, Approver (must approve before signers see), CC/Observer (notified at completion), In-Person Signer.
- **Signing order edit** — sender can change order after sending if no one has signed yet.
- **Reassignment** — recipient can pass their signing turn to a colleague.
- **Decline option** — recipient can decline with reason; document closes without signature.
- **Expiration date** — document expires if not completed by date.
- **Reminders** — automatic chase emails (configurable cadence) and manual reminders.

### 3.3 Authentication and security

- **Email-link signing** — default, lowest friction. Tokenized link with expiration.
- **Access code (PIN)** — sender sets a code, communicated out-of-band; recipient must enter to open.
- **SMS OTP** — phone-number verification at signing time.
- **Knowledge-based authentication (KBA)** — recipient answers identity-verification questions sourced from credit bureau data.
- **Digital signature with PKI certificate** — strongest form, requires recipient to have a certificate.
- **Blockchain timestamping** — document hash registered to a blockchain for tamper-proof time-of-completion proof.
- **AES-256 encryption at rest, TLS in transit.**

### 3.4 Audit trail and Certificate of Completion

- **Audit log per document** — every event timestamped with IP address:
  - Document created, edited, sent, viewed, opened (per recipient).
  - Each field filled.
  - Each signature applied.
  - Document completed, declined, expired, voided.
- **Tamper-evident** — log is append-only and hash-chained.
- **Certificate of Completion PDF** — generated on completion, includes:
  - Document identifier and hash.
  - All recipients with signing timestamps.
  - IP addresses and geolocation (city-level) per signing event.
  - Authentication method used per recipient.
  - The certificate is either appended to the signed document or attached separately.

### 3.5 Compliance posture

- **ESIGN Act (US)** compliance.
- **UETA (US state law)** compliance.
- **eIDAS (EU)** compliance — qualified electronic signatures.
- **Title 21 CFR Part 11** (pharmaceutical/medical industry).
- **HIPAA** for healthcare use.
- **Court-admissible audit trail** validated by case history.

### 3.6 Integrations

- Zoho Suite (CRM, Invoice, Writer).
- Google Drive, Dropbox, OneDrive, Box.
- Microsoft Teams, Slack notifications.
- REST API with webhook events for every status change.
- White-label / custom domain options at higher tiers.

### 3.7 Reporting

- Documents sent, signed, declined, expired by date range.
- Average time to signature.
- Top senders, top template usage.
- Per-recipient signing speed.

### 3.8 Pricing (reference)

Zoho Sign offers a free plan (5 envelopes/month, single user), paid plans starting at $10/user/month, and API-only pricing at $0.50 per document signature request. Credits start at $50 for 500 credits, with each document consuming 5 credits at the API tier. SMS authentication, blockchain timestamping, and trust services consume extra credits.

---

## 4. Competitor cross-walk

Five vendors matter in this space. Comparison focuses on what each does better than Zoho Sign and what trade-offs apply if Sign-Wrap is the chosen path.

### 4.1 BoldSign (by Syncfusion)

**The developer-friendliest vendor.** API-first design, generous free tier, transparent pricing.

**Pricing:** Free tier (5 documents/month single user). Paid plans from ~$10/user/month with unlimited documents. API-only pricing at $0.10 per envelope (50% cheaper than Zoho Sign's $0.50).

**Take from BoldSign:**

- **Embeddable signing experience.** The signing ceremony can be iframed into BrainWise's own UI so the recipient never leaves your domain. Other vendors require navigation to vendor URL.
- **Clean REST API.** Well-documented, predictable response shapes, comprehensive webhook events.
- **Affordable SMS OTP.** Per-message pricing rather than premium tier upgrade.
- **White-label included** at Business tier ($25/user/month) rather than Enterprise gating.
- **Templates with conditional logic** — fields can be required/optional based on other field values.

**Trade-offs:**

- Smaller market presence than Dropbox Sign or DocuSign. Recipients may be less familiar with the signing UI.
- Younger company (Syncfusion founded 2001, BoldSign launched 2021). Long-term viability less established than DocuSign/Dropbox Sign.
- Fewer pre-built integrations with other products.

### 4.2 Dropbox Sign (formerly HelloSign)

**The middle-ground choice.** Mature, owned by Dropbox, well-known to recipients.

**Pricing:** ~$25-40/user/month for paid plans. API-tier separate at ~$0.40/envelope after free quota.

**Take from Dropbox Sign:**

- **Brand recognition.** Recipients see "powered by Dropbox" and the friction is lower than an unknown vendor.
- **Strong audit trail** with court-tested defensibility.
- **Excellent mobile signing UX** — recipients sign on phones at very high completion rates.
- **Bulk send with merge data** at a polished tier.
- **Pre-built integrations** with Google Drive, Salesforce, HubSpot, Slack.

**Trade-offs:**

- More expensive than BoldSign.
- API less developer-friendly than BoldSign (verbose response shapes, less predictable webhooks).
- Co-branded signing ceremony on lower tiers (Dropbox logo visible).
- True white-label requires Premium tier ($50/user/month) or Enterprise.

### 4.3 DocuSign

**The enterprise standard.** Mentioned for completeness, not recommended for BrainWise.

**Pricing:** $45-75/user/month for standard plans. API tiers start at $480/year minimum.

**Take from DocuSign:**

- **Universal recognition.** Most professional recipients have signed at least one DocuSign in their career; ceremony is familiar.
- **Strongest legal defensibility track record.** Litigation history of DocuSign signatures upheld.
- **Identity verification options** beyond what competitors offer (government ID verification, notary integration).
- **Industry-specific compliance certifications** (life sciences, federal government).

**Trade-offs for BrainWise scale:**

- Significantly more expensive than alternatives.
- API is the least developer-friendly of the major vendors (complex authentication, verbose XML legacy paths).
- Sales process for API access is enterprise-style (talk to sales, contract terms).
- Overkill for solo founder + small team.

### 4.4 SignWell (formerly Docsketch)

**The startup-friendliest vendor.** API-first like BoldSign but with a more polished sender UI.

**Pricing:** Free tier (3 documents/month). Paid plans from $10-32/user/month. API at ~$0.30/envelope.

**Take from SignWell:**

- **Best sender UI of the affordable vendors.** Cleaner than BoldSign, more polished than Dropbox Sign's lower tiers.
- **Strong template editor.**
- **White-label at $32/user/month tier.**
- **Embedded signing similar to BoldSign.**

**Trade-offs:**

- Less feature-complete API than BoldSign (smaller webhook surface, fewer advanced fields).
- Smaller integration ecosystem.
- Less mature company than Dropbox Sign or DocuSign.

### 4.5 Adobe Acrobat Sign

**The Adobe-stack default.** Mentioned for completeness.

**Pricing:** Bundled with Adobe Acrobat Pro at $24-30/user/month. Standalone Sign plans start ~$15/user/month.

**Take from Adobe Sign:**

- **Integration with Adobe Acrobat** — natural fit if Cole is already in the Adobe ecosystem for PDF work.
- **Strong PDF features** — better PDF rendering and field detection than competitors.
- **Microsoft 365 native integration.**

**Trade-offs:**

- API less developer-friendly than BoldSign or SignWell.
- Pricing tied to Adobe Creative Cloud strategy; less predictable for non-Adobe customers.
- Sender UI complex compared to startup-friendly vendors.

### 4.6 Synthesis target for Sign-Wrap

Recommended vendors for BrainWise (in order of fit):

1. **BoldSign** — best API + cheapest + embeddable + white-label included at affordable tier.
2. **SignWell** — best sender UI of the affordable vendors; API less complete than BoldSign.
3. **Dropbox Sign** — most brand recognition; double the cost of BoldSign.

Skip DocuSign and Adobe Sign for BrainWise scale.

Doc 4 v1 specifies the integration layer generically; the actual vendor choice is locked in §10.

---

## 5. v1 scope — Sign-Wrap path

This is the recommended path. v1 wraps a vendor (BoldSign recommended, swappable to SignWell or Dropbox Sign).

### 5.1 Document types and template system

**In scope:**

- **4 default templates** shipped at v1 (Q-SIGN4b lock):
  - **NDA** — mutual or one-way, configurable per send.
  - **SOW (Statement of Work)** — project scope, deliverables, timeline, fees.
  - **MSA (Master Services Agreement)** — umbrella contract for ongoing engagements.
  - **Onboarding paperwork package** — multi-document set Cole sends to new customers.
- **Template content is attorney-supplied.** Doc 4 specifies template *structure* (field placements, merge tag positions, page layouts). **Attorney engagement is a v1 gating dependency** before any template can be sent.
- **Template version locking** — each template has a version number and `last_attorney_reviewed_at` timestamp. Editing a template increments version and clears the reviewed-at flag. Platform surfaces a warning banner: "This template has been modified since last attorney review on [date]. Attorney review required before sending."
- **Template upload workflow (Q-SIGN4 lock):**
  - Cole drafts contract in Word.
  - Saves as PDF.
  - Uploads to platform.
  - Platform renders PDF preview with drag-drop overlay for field placement (signature, initial, date, text input, checkbox).
  - Cole defines merge fields (`{{customer_name}}`, `{{deal_amount}}`, etc.) with source data binding (from Doc 1 invoice, Doc 2 deal, or static value).
  - Save template.
- **Default templates ship with field structure pre-placed** — Cole uploads attorney-drafted content; platform's pre-defined field layout overlays automatically.
- **Custom one-off documents** — Cole can upload any PDF and add fields ad-hoc without creating a template.

**Deferred:**

- Conditional fields (show field X only if field Y filled) — v2.
- Form-based input fields where recipient fills in data — v2.
- Multi-language template support — v3.
- In-person signing (hand device to signer) — v2.

### 5.2 Document creation and send

**In scope:**

- **"Send for Signature" entry points:**
  - From Doc 1 Estimate → Send Estimate for signature (sends estimate PDF with signature field).
  - From Doc 2 Deal → Send Contract (picks template, merge fields populate from deal + account + contacts).
  - From a standalone signing flow → upload custom document.
- **Send configuration page:**
  - Document selection (template or upload).
  - Recipients with roles (Signer / Approver / CC / In-Person — In-Person deferred to v2).
  - Signing order (Sequential / Parallel).
  - Authentication method (Email + SMS OTP locked from Q-SIGN5 — applied to all signers).
  - Subject and message (custom or default).
  - Expiration date (default 30 days, configurable).
  - Reminder cadence (default: 3 days, 7 days, 14 days after send if not signed).
- **Send action** triggers vendor API call to create envelope, send first recipient email.
- **Status updates** flow back via vendor webhook to local document record.

**Deferred:**

- Conditional approval gates ("requires Cole's approval before customer signs") — v2.
- Bulk send (same template to many recipients) — v2.
- Pre-send preview as recipient sees it — v2.

### 5.3 Multi-party signing flow (Q-SIGN3 lock)

**In scope — full multi-party design:**

- **Sender** is always Cole (or another internal CRM user with signing permission).
- **Internal countersigner** (optional) — for documents that require internal review before going to customer. Example: SOW gets countersigned by Cole, then sent to customer. Configurable per template.
- **External signers** — one or more customer-side recipients. Roles supported:
  - **Primary signer** (decision maker).
  - **Co-signer** (legal review, second decision maker).
  - **Observer / CC** (notified at completion, no signing required).
- **Signing order:**
  - **Sequential:** internal countersigner → primary external signer → co-signer.
  - **Parallel:** all signers receive at once; complete when all have signed.
  - **Mixed:** countersigner first, then all external signers in parallel.
- **Reassignment:** recipient can pass their turn to a colleague (vendor-supported).
- **Decline:** any recipient can decline with reason; document marked Declined; sender notified.
- **All signers receive Email + SMS OTP authentication** at signing time (Q-SIGN5 lock).

**Deferred:**

- Custom signing groups (e.g., "any 2 of these 3 signers complete it") — v3.
- Notary-witnessed signing — v3+ (vendor offerings exist but expensive).

### 5.4 Authentication (Q-SIGN5: Email + SMS OTP for all)

**In scope:**

- **Email-link authentication** — recipient receives a tokenized link unique to them. Link expires after 30 days or on document completion.
- **SMS OTP** at signing time — recipient enters phone number (or it's pre-populated from CRM), receives 6-digit OTP via SMS, enters to proceed.
  - SMS provider: Twilio Verify (~$0.05/verification).
  - Cost passthrough: ~$0.10-0.15 per signature including retries.
- **Authentication results logged** in audit trail with timestamp, IP, phone number (last 4 digits visible, full number stored encrypted).

**Deferred:**

- Knowledge-Based Authentication (KBA) — v3 if regulatory requirements demand it.
- Government ID verification — v3.
- Digital certificate (PKI) signing — v3.

### 5.5 Signing ceremony UX

**In scope (Sign-Wrap path):**

- **Embedded signing** — recipient lands on a BrainWise-domain page that iframes the vendor's signing UI. The vendor's branding is minimized (BoldSign and BoldSign's embedded option, SignWell's embedded, Dropbox Sign's Premium tier).
- **Mobile-responsive** — signing works on phones (vendor-provided).
- **Pre-signing review** — recipient sees the document, scrolls through, can download a copy before signing.
- **Field-by-field guidance** — vendor UI walks recipient through required fields.
- **"Decline" button** prominently available with required reason text.
- **Post-signature confirmation** — recipient sees "Document Signed" page with option to download signed copy immediately.

**Deferred:**

- Full white-label (zero vendor branding) — depends on chosen vendor tier. BoldSign Business tier ($25/user/month) provides this.
- Custom signing-page domain (e.g., `sign.brainwiseenterprises.com`) — vendor-supported at higher tiers.

### 5.6 Audit trail and Certificate of Completion

**In scope (vendor-provided):**

- **Audit trail per document** — vendor generates and stores. Surfaced in BrainWise UI via vendor API.
- **Events logged:**
  - Document created.
  - Sent to each recipient (with timestamp + IP).
  - Opened by each recipient (timestamp + IP).
  - Each field filled (timestamp + field).
  - Each signature applied (timestamp + IP + authentication method).
  - Document completed.
  - Declined / expired / voided events as applicable.
- **Tamper-evident** — vendor's hash-chained log.
- **Certificate of Completion PDF** — auto-generated on completion by vendor. Includes audit trail summary, recipient details, signing timestamps, IP/geolocation, authentication method.
- **Certificate is attached to the signed document** (default) or downloadable separately.

### 5.7 Storage and delivery (Q-SIGN6 + Q-SIGN7 locks)

**In scope:**

- **Storage location:**
  - Signed PDF + Certificate of Completion stored in Supabase Storage in dedicated bucket with strict access controls.
  - Vendor also retains a copy per their retention policy (Dropbox Sign: indefinite; BoldSign: indefinite for paid plans).
- **Retention: 10 years** from signature completion date (Q-SIGN6 lock).
  - Document records older than 10 years are archived (compressed, moved to cold storage) but not deleted.
  - Audit trail retention matches document retention.
- **Auto-email on completion (Q-SIGN7):**
  - All signers receive the signed PDF + Certificate of Completion via email.
  - Internal users (sender + any internal CC) receive same.
  - Email sent from Doc 1's `crm@mail.brainwiseenterprises.com` domain (consistent branding).
- **In-platform storage:**
  - Signed document linked to source record (Deal, Estimate, Customer).
  - "Signed Documents" tab on every Customer, Deal, Estimate page.
  - Documents searchable by template, date, recipient, status.
  - One-click re-download.
- **Access controls:**
  - Admins: all signed documents.
  - Sales Users: documents they sent or are CC'd on.
  - Read-Only: documents linked to records they have access to.

### 5.8 Status lifecycle and operations

**Document statuses:**

- **Draft** — being prepared, not yet sent.
- **Sent** — sent to first recipient.
- **In Progress** — at least one recipient has opened but not all signed.
- **Completed** — all required signatures collected.
- **Declined** — any recipient declined.
- **Expired** — past expiration date without completion.
- **Voided** — sender canceled.

**Operations:**

- **Send.**
- **Cancel/Void** — sender can void before all signatures collected.
- **Resend** to a recipient (re-trigger their email).
- **Manual reminder.**
- **Reassign** a recipient (e.g., wrong email; sender corrects).
- **Edit expiration date** before completion.
- **Clone** an in-flight document to start fresh (e.g., add a missing signer).
- **Download** signed copy or Certificate of Completion any time.

### 5.9 Reports

**In scope:**

- Documents Sent by Date.
- Documents Signed (completed) by Date.
- Average Time-to-Signature (per template type).
- Documents Declined / Expired with reasons.
- Top Templates Used.
- Documents per Customer.
- Documents per Deal.

### 5.10 Settings

**In scope:**

- Vendor API credentials configuration.
- Email-template customization (send invite, reminder, completion).
- Reminder cadence default.
- Default expiration days.
- Default authentication method (locked to Email + SMS OTP at v1; configurable for v2).
- Template version management (which version is active, attorney review status).
- White-label / branding configuration (logo, colors, domain).

---

## 6. v1 scope — Sign-Build path (alternative)

This is the alternative path: build the full e-signature engine in-house. Specified here for comparison; **not the recommended path** (see §10).

### 6.1 What Sign-Build encompasses that Sign-Wrap delegates to vendor

Everything in §5 still applies, plus all of the following must be built in-house:

- **Signature capture UI:**
  - HTML5 canvas signature with smoothing, undo, mobile touch support.
  - Typed signature with font selection.
  - "Apply previously created signature" for repeat signers.
- **PDF rendering:**
  - PDF.js or equivalent for displaying multi-page documents in the browser.
  - Field overlay on top of PDF coordinates (zoom-aware).
- **PDF signing layer:**
  - Embedding signature images into PDF at specified coordinates.
  - Cryptographic signature application using `node-signpdf` or equivalent.
  - Document sealing — modifications to the PDF after signing detectable.
- **Digital certificate management:**
  - Organizational certificate from a Certificate Authority (DigiCert, Entrust, ~$200-500/year).
  - Certificate renewal lifecycle.
  - Multi-certificate support if expanding to per-organization signing certs.
- **Tamper-evident audit log:**
  - Append-only database table with restricted write permissions.
  - Each entry includes hash of the previous entry (chain).
  - Any tampering breaks the chain — detectable on verification.
  - Audit log entries cover every event in §5.6.
- **Certificate of Completion generator:**
  - PDF generation summarizing the audit trail.
  - Standardized format that's clearly distinguishable as an audit artifact.
  - Embeds within signed document or attaches separately.
- **SMS OTP integration:**
  - Twilio Verify API.
  - Rate limiting to prevent abuse.
  - Audit trail entries for each OTP attempt.
- **Recipient routing engine:**
  - Sequential / parallel / mixed order.
  - State machine for "who can sign next."
  - Email triggering on each recipient turn.
- **Tokenized link generation:**
  - Per-recipient unique links.
  - Expiring tokens.
  - Revocation if document voided.
- **Reminder scheduling:**
  - Configurable cadence per document.
  - Cron job for fire-on-schedule.
- **Multi-document envelope support:**
  - Send multiple documents as one envelope (e.g., MSA + SOW + NDA together).
  - All-or-nothing signing logic.

### 6.2 Sign-Build legal compliance

This is the most consequential part of Sign-Build. The system must meet:

- **ESIGN Act requirements:**
  - Consent to use electronic signatures (recipient explicitly opts in before signing).
  - Intent to sign (clear "Sign Document" action with no ambiguity).
  - Association of signature with the document (cryptographic binding).
  - Record retention (10 years per Q-SIGN6).
- **UETA requirements:** essentially same as ESIGN at state level.
- **Reasonable authentication:** Email + SMS OTP meets the "reasonable assurance" bar but case law varies.

**Compliance posture documentation** is required: a written attestation by an attorney that the BrainWise implementation meets ESIGN/UETA. Estimated cost: **$5,000-15,000 for initial legal review.** This is a one-time cost but updates needed when laws change.

**Liability framework:** If a signed document is ever challenged in court, the defense is the audit trail. Any gap, weakness, or bug in the implementation can be exploited by opposing counsel to argue the signature is invalid. With Sign-Wrap, the vendor's legal team supports this defense; with Sign-Build, BrainWise's own attorney does, and the implementation's quality is the determining factor.

### 6.3 Sign-Build data model

```
sig_envelopes
  id, org_id, sender_user_id, status,
  source_type (estimate|deal|standalone), source_id,
  template_id (nullable), template_version (nullable),
  subject, message, expiration_date, sent_at, completed_at,
  signing_order_mode (sequential|parallel|mixed),
  document_count, total_pages,
  void_reason, declined_reason, declined_by_recipient_id

sig_envelope_documents
  id, envelope_id, document_order, original_filename,
  original_file_hash (sha-256), signed_file_hash (sha-256, after completion),
  pdf_storage_path, signed_pdf_storage_path,
  page_count

sig_envelope_recipients
  id, envelope_id, role (signer|approver|cc|in_person_signer),
  routing_order_index, routing_group,
  full_name, email, phone, contact_id (fk to crm contacts, nullable),
  status (pending|sent|opened|signed|declined),
  auth_method (email_only|email_sms_otp|email_kba),
  token (random, expiring), token_expires_at,
  sent_at, opened_at, signed_at, declined_at,
  ip_addresses (jsonb), declined_reason

sig_envelope_fields
  id, envelope_document_id, recipient_id, field_type (signature|initial|date|text|checkbox|dropdown),
  page_number, x_coord, y_coord, width, height,
  is_required, value_filled, value_filled_at, source_merge_tag

sig_audit_log
  -- append-only, hash-chained
  id, org_id, envelope_id, event_at, event_type, actor_type (system|sender|recipient),
  actor_user_id (nullable), actor_recipient_id (nullable),
  ip_address, user_agent, geo_city, geo_country,
  event_details (jsonb),
  previous_entry_hash, this_entry_hash (sha-256 of all above fields + previous_entry_hash)

sig_otp_attempts
  id, envelope_recipient_id, phone_number_hash, attempt_at,
  success, twilio_sid

sig_certificates_of_completion
  id, envelope_id, generated_at, pdf_storage_path,
  pdf_hash (sha-256), embedded_in_signed_doc

sig_templates
  id, org_id, name, document_type (nda|msa|sow|onboarding|custom),
  current_version, last_attorney_reviewed_at, last_attorney_reviewer_name,
  is_active

sig_template_versions
  id, template_id, version_number, pdf_storage_path,
  field_layout (jsonb), merge_field_mappings (jsonb),
  created_by_user_id, created_at, attorney_reviewed (bool),
  attorney_reviewed_at, attorney_reviewer_name,
  is_active_version

sig_digital_certificates
  id, org_id, certificate_authority, certificate_serial,
  valid_from, valid_until, public_key_pem, private_key_storage_ref,
  revoked_at, revoked_reason
```

About **9 additional tables** for Sign-Build (vs. ~3 tables for Sign-Wrap — see §7).

### 6.4 Sign-Build effort estimate

| Item | Estimate |
|---|---|
| Data model migration (9 tables, audit-log triggers, RLS) | 5-7 days |
| Document upload + PDF parsing (page count, dimensions) | 3-4 days |
| PDF rendering UI with overlay (PDF.js + custom drag-drop) | 8-12 days |
| Signature canvas component (HTML5 canvas, smoothing, mobile touch) | 4-6 days |
| Typed signature component (font picker, save-and-reuse) | 2-3 days |
| Recipient routing engine (sequential / parallel / mixed) | 5-7 days |
| Tokenized link generation + auth flow | 3-4 days |
| Email send orchestration (one per recipient turn) | 3-4 days |
| SMS OTP integration (Twilio Verify) | 2-3 days |
| Document hashing + tamper-evident audit log | 6-8 days |
| PDF signing library integration + digital seal | 8-12 days |
| Certificate of Completion PDF generator | 4-6 days |
| Template engine (upload, field placement, version locking) | 7-10 days |
| Default template structure scaffolding (4 templates × field layouts) | 3-4 days |
| Status lifecycle automation | 3-4 days |
| Reminder system | 2-3 days |
| Multi-document envelope support | 4-6 days |
| Reassignment + decline flows | 3-4 days |
| Reports (10 reports + SQL views) | 5-7 days |
| Settings UI (template management, vendor config, certificate config) | 4-6 days |
| Digital certificate management UI + renewal lifecycle | 3-5 days |
| QA + edge cases (legally consequential — extensive) | 15-20 days |
| Legal compliance review (attorney engagement) | 3-5 days dev + $5-15k attorney fees |

**Sign-Build subtotal: ~106-150 days = 21-30 weeks ≈ 5-7.5 months.** Plus attorney fees.

### 6.5 Sign-Build ongoing costs

- Digital certificate: $200-500/year (DigiCert, Entrust, or equivalent CA).
- Twilio Verify: ~$0.05/verification × volume.
- Annual attorney review: $3-5k/year.
- Compliance monitoring overhead: ~5-10 hours/year of legal counsel time as laws evolve.
- Infrastructure (Supabase storage at 10-year retention): minor; ~$0.02/GB/month.

**No vendor subscription. Trade-off: all maintenance and legal liability is internal.**

---

## 7. Sign-Wrap effort estimate

For comparison with §6.4. This is the recommended path.

### 7.1 Sign-Wrap data model

Minimal additions on top of Doc 1 + Doc 2 schemas:

```
sig_envelopes
  id, org_id, sender_user_id, vendor (boldsign|signwell|dropbox_sign),
  vendor_envelope_id, vendor_template_id (nullable),
  source_type (estimate|deal|standalone), source_id,
  status (mirrors vendor status), subject, message,
  expiration_date, sent_at, completed_at, voided_at,
  void_reason, signed_pdf_storage_path, cert_of_completion_storage_path

sig_envelope_recipients
  id, envelope_id, role, routing_order_index, routing_group,
  full_name, email, phone, contact_id (fk to crm contacts),
  vendor_recipient_id, status, sent_at, opened_at, signed_at, declined_at,
  declined_reason

sig_templates
  id, org_id, name, document_type (nda|msa|sow|onboarding|custom),
  vendor_template_id, current_version, last_attorney_reviewed_at,
  last_attorney_reviewer_name, is_active

sig_template_versions
  id, template_id, version_number, vendor_template_id,
  attorney_reviewed (bool), attorney_reviewed_at, attorney_reviewer_name,
  is_active_version, created_by_user_id, created_at

sig_vendor_webhook_log
  id, org_id, vendor, event_type, vendor_event_id (unique),
  payload (jsonb), received_at, processed_at, processing_error
```

About **5 tables** vs. 9 for Sign-Build. Audit log lives in vendor; we mirror status only.

### 7.2 Sign-Wrap effort estimate

| Item | Estimate |
|---|---|
| Data model migration (5 tables + RLS) | 2-3 days |
| Vendor API client (BoldSign primary, with abstraction layer for alternatives) | 3-5 days |
| Vendor webhook receiver + event dispatcher | 2-3 days |
| Document upload UI + vendor envelope creation | 3-4 days |
| Field placement UI (vendor-provided embedded editor or our own) | 4-6 days |
| Recipient configuration UI (roles, routing, auth method) | 3-4 days |
| Template management UI (upload, version lock, attorney-review flag) | 4-6 days |
| Default 4 templates — structural scaffolding (field placements pre-defined) | 2-3 days |
| Embedded signing iframe + post-signature handling | 3-4 days |
| Signed document storage + Certificate of Completion download | 2-3 days |
| Multi-party routing config (sequential / parallel / mixed) | 2-3 days |
| Status sync from vendor webhook → local records | 2-3 days |
| Auto-email signed PDF + Certificate to all signers (Q-SIGN7) | 2-3 days |
| 10-year retention archival policy | 1-2 days |
| Reports (10 reports) | 4-6 days |
| Settings UI | 3-4 days |
| Integration with Doc 1 Estimates ("Send for Signature") | 2-3 days |
| Integration with Doc 2 Deals ("Send Contract") | 2-3 days |
| Document type page (Customer / Deal / Estimate "Signed Documents" tab) | 2-3 days |
| QA + vendor integration testing | 6-10 days |
| Vendor account setup + sandbox/production cutover | 1-2 days |

**Sign-Wrap subtotal: ~55-83 days = 11-17 weeks ≈ 3-4 months.**

### 7.3 Sign-Wrap ongoing costs

- BoldSign Business tier: ~$25/user/month × 1-3 users = $25-75/month at v1.
- Twilio Verify: ~$0.05/verification × volume.
- Vendor API charges for envelope sends (most plans include unlimited; API-only pricing if applicable).

**Total ongoing: ~$30-100/month for the e-signature infrastructure.**

---

## 8. Comparison table

| Dimension | Sign-Wrap | Sign-Build |
|---|---|---|
| Build calendar time | 11-17 weeks (3-4 months) | 21-30 weeks (5-7.5 months) |
| Legal review cost (one-time) | $0 (vendor covers) | $5,000-15,000 |
| Annual legal review | $0 | $3,000-5,000 |
| Vendor subscription | $30-100/month | $0 |
| Digital certificate | $0 (vendor-managed) | $200-500/year |
| Twilio Verify SMS | ~$0.05/verification | Same |
| Legal defensibility | Vendor's litigation track record | Untested implementation |
| Court-admissibility risk | Low (vendor has case history) | High (relies on internal QA) |
| White-label capability | At vendor's higher tier | Full control natively |
| Vendor lock-in | Migration possible but non-trivial | None |
| Productization (selling BrainWise platform) | Each platform customer subscribes to vendor | Built-in feature, scales with you |
| Maintenance burden | Webhook reliability, vendor API updates | Full ownership of the engine |
| Number of additional tables | 5 | 9 |
| Time to first signed contract after attorney engagement | ~3-4 months | ~5-7.5 months |
| Risk if a signature is challenged in court | Vendor's audit trail + their legal support | Your audit trail + your attorney |

---

## 9. Risks and dependencies (both paths)

### 9.1 Risks specific to Sign-Wrap

- **Vendor dependency.** If BoldSign goes down, no contracts go out. SLA is the mitigation but downtime happens.
- **Vendor pricing changes.** BoldSign or chosen vendor could change pricing model. Annual budget exposure.
- **Vendor API changes.** APIs evolve; breaking changes occasionally. Mitigation: abstraction layer so swapping vendors is feasible.
- **Co-branded ceremony at lower tiers.** Recipient sees vendor name. Mitigation: upgrade to white-label tier.
- **Audit trail format determined by vendor.** Court admissibility depends on vendor's documentation; mitigations are vendor-specific.

### 9.2 Risks specific to Sign-Build

- **Legal defensibility risk.** A signature challenged in court tests the implementation. Any bug, gap, or weakness can invalidate signatures retroactively.
- **Compliance evolution.** ESIGN, UETA, eIDAS, state-specific rules change. Internal team must track and implement updates.
- **Certificate expiration.** Miss a renewal and new signatures are not properly sealed. Signed documents from before expiration remain valid; new ones don't.
- **Audit log integrity.** If a bug corrupts an audit log entry, every signed document from before the bug is potentially compromised. Recovery is non-trivial.
- **PDF library quirks.** Different PDF readers render differently; signature placement that looks right in Chrome may be misaligned in Adobe Reader. Test matrix is large.
- **PKI complexity.** Digital certificate management is a regulated subsystem; getting the key storage, rotation, and revocation right is non-trivial.

### 9.3 Risks common to both paths

- **Attorney engagement delays.** Default templates cannot ship until attorney delivers content. Build can complete but documents can't be sent. Mitigation: engage attorney early in build, parallel-track template work.
- **SMS OTP cost at scale.** $0.05 per verification × multiple verifications per envelope × volume. Budget exposure. Mitigation: monitoring + alerts.
- **Phone number requirement.** Every signer must have a verifiable phone number per Q-SIGN5. Customers without phones can't sign. Mitigation: phone is captured at lead/contact creation in Doc 2; required field at deal-close.
- **Template version drift.** Cole edits a template; forgets to re-engage attorney; ships defective contract. Mitigation: platform enforces version-lock warning and "DO NOT SEND" banner on untreated templates.
- **Document retention storage costs.** 10-year retention at scale. Mitigation: cold storage for documents older than 1 year.
- **Cross-border signing.** International recipients may have different e-signature requirements. Mitigation: out of scope for v1 (US-only); flag for future expansion.

### 9.4 Hard dependencies

**Sign-Wrap:**
- Vendor account (BoldSign, SignWell, or Dropbox Sign).
- Twilio Verify (SMS OTP).
- Resend (email send — already in stack).
- Attorney engagement for 4 default templates.

**Sign-Build:**
- All of the above plus:
- Digital certificate from a Certificate Authority.
- PDF signing library (`node-signpdf` or equivalent).
- PDF.js or alternative renderer.
- Compliance review attorney engagement (separate from template attorney; may be same attorney).

### 9.5 Soft dependencies

- KBA provider if v3 demands knowledge-based authentication (Experian, LexisNexis).
- Notary integration if v3 demands notarized signing.
- Government ID verification (Persona, Onfido) if v3 demands.

---

## 10. Recommendation and decision

### 10.1 Recommended path: Sign-Wrap with BoldSign

**Rationale:**

1. **Legal defensibility risk is asymmetric.** Sign-Build's upside (control, no vendor) is bounded; downside (a challenged signature is invalidated, with cascading effects on multiple signed contracts) is unbounded. Sign-Wrap moves this risk to a vendor whose business is precisely this.

2. **Build time difference is 1.5-3.5 months saved.** Time spent building commodity infrastructure isn't time spent on BrainWise's core differentiation.

3. **Cost difference is small relative to opportunity cost.** $30-100/month for BoldSign vs. $5-15k legal + $200-500/year cert + ongoing maintenance. Sign-Wrap is cheaper in the first 2-3 years and competitive after.

4. **Productization is not blocked.** When BrainWise sells to other coaches, each customer can subscribe to BoldSign (or BrainWise can resell via reseller program if BoldSign offers one). The platform doesn't need to build e-signature to be productizable.

5. **Reversibility.** If BoldSign ever becomes inadequate, swap to SignWell or Dropbox Sign with minimal disruption (data model is vendor-abstracted). Migrating from Sign-Build back to a vendor is much harder (lose audit-trail continuity, retention obligations transfer).

### 10.2 Recommended vendor: BoldSign

**Reasoning:**

- **Cheapest of the credible options** ($10-25/user/month vs. Dropbox Sign $25-40, DocuSign $45-75).
- **Best API of the affordable vendors.** Developer documentation is the cleanest.
- **White-label included at Business tier** ($25/user/month). No Enterprise gating.
- **Embeddable signing UI.** Recipient stays on BrainWise domain.
- **API-only pricing available** if BrainWise prefers per-envelope billing later.

**Alternatives if BoldSign is unavailable or inadequate:**

- **SignWell** as second choice — polished sender UI, API less complete than BoldSign.
- **Dropbox Sign** as third choice — most brand recognition but ~2x the cost.

### 10.3 Sign-Build as a contingency

If the recommended Sign-Wrap path is rejected for reasons specific to BrainWise's situation (e.g., productization requires zero-vendor architecture, or specific compliance requirements not met by any vendor), Sign-Build is fully specified in §6. The added cost is roughly $20-40k over 2 years (legal fees + build time at any internal-hourly-rate), with the legal-defensibility risk as the dominant additional concern.

### 10.4 v1 scope summary if Sign-Wrap chosen

- Months 1-2: BoldSign integration build, template scaffolding, send/sign/receive flow.
- Month 2 (parallel): attorney engagement for 4 default template contents.
- Month 3: QA, multi-party flows, edge cases.
- Month 4: deployment, monitoring setup, vendor production cutover.

**~3-4 months calendar time for one developer + parallel attorney work.**

### 10.5 v1 scope summary if Sign-Build chosen

- Months 1-2: data model + audit log + PDF signing infrastructure.
- Months 2-3: signing UI + recipient routing + SMS OTP.
- Months 3-4: template engine + default templates + reminders.
- Month 4-5: certificate generator + compliance documentation + attorney review.
- Months 5-7: QA + edge cases + multi-document envelopes + reports.
- Month 7: deployment.

**~5-7.5 months calendar time for one developer + parallel attorney work for both templates and compliance review.**

---

## 11. Out of scope for Doc 4

- **Notarized signing** (in-person, online notary integration) — v3+ if regulatory requirements demand it.
- **International e-signature compliance** (eIDAS, country-specific requirements) — out of v1; US-only.
- **Identity verification beyond Email + SMS OTP** (government ID, KBA) — v3+.
- **In-person signing on shared device** — v2.
- **Bulk send** (one template, many recipients) — v2.
- **Conditional fields and form-based input fields** — v2.
- **Notarization workflows** (online notary public) — v3+.
- **PKI-based signer certificates** (recipient presents their own digital cert) — v3+.
- **Custom signing-page domains** (`sign.brainwiseenterprises.com`) — vendor-dependent, achievable at higher tiers in v2.
- **HIPAA / pharma compliance** (Title 21 CFR Part 11) — out of v1; not relevant to BrainWise's customer base.
- **Architectural decisions** (module vs. separate product, multi-tenancy) — Doc 5.

---

## 12. Open questions

These should be locked before the Sign-Wrap path begins (or Sign-Build, depending on §10 decision).

1. **Final vendor choice for Sign-Wrap.** BoldSign recommended; needs explicit confirm. If you have a relationship with an existing vendor (e.g., your current corporate clients require a specific vendor), specify.
2. **Attorney engagement timing.** Attorney work must start ~2 months into build to have templates ready for v1 launch. Has Cole identified the attorney? If not, allow 4-6 weeks for selection.
3. **Phone number capture discipline.** Every signer needs a verifiable phone. Confirm Doc 2 contact-creation flow requires phone field (currently optional in Doc 2 v1 spec).
4. **Internal countersigner workflow.** Is there a real second-party at BrainWise who countersigns, or is this aspirational? If only Cole at v1, the internal-countersigner flow can be deferred and added when team grows.
5. **Custom domain branding.** Does BrainWise want `sign.brainwiseenterprises.com` for the signing ceremony URL (vendor-supported but costs are tier-dependent), or is the default vendor URL acceptable?
6. **Onboarding paperwork content.** What does the "onboarding paperwork" template actually consist of? Is it a single multi-page document, or multiple separate documents (intake form + assessment consent + payment authorization)?
7. **Estimate-as-signed-document semantics.** When Doc 1 Estimate is sent for signature, does the signed estimate replace the prior accept-by-link flow entirely, or coexist (signature required for some estimates, accept-by-link for others)?
8. **Template watermarking pre-attorney-review.** Should templates that haven't been attorney-reviewed yet be sendable at all (with a "DRAFT — DO NOT SEND TO CUSTOMER" watermark) or blocked entirely from send? Recommend: blocked entirely.

---

## 13. Connection to other docs

- **Doc 1 (Invoice):** Estimates send for signature via Doc 4. After signature, estimate-to-invoice conversion happens normally. Signed estimate stored in Doc 4 storage, linked from Doc 1 estimate record.
- **Doc 2 (CRM):** Deal records have "Send Contract" action that picks a Doc 4 template, populates merge fields, and sends. Deal status reflects contract status (Sent for Signature → Awaiting Signature → Signed). Signed contract triggers Doc 2 workflow rule "Deal stage to Closed Won" (with 5-min delay per Doc 2 Q10) which triggers Doc 1 customer creation.
- **Doc 3 (Bookkeeping):** Signed contracts are revenue-generating events. The Quarterly Bookkeeper Package includes signed-contract count for verification but the contracts themselves don't flow to QBO.
- **Doc 5 (Cross-cutting):** Doc 4's vendor abstraction layer (the BoldSign-or-equivalent client) is a Doc 5 architectural concern — should it live in BrainWise platform or a shared service?

---

## 14. Decision log

Locked in this doc:

- **D4-1:** Q-SIGN1 — both paths scoped; **recommendation is Sign-Wrap.**
- **D4-2:** Q-SIGN2 — document types: Estimates, SOWs, NDAs, MSAs, Onboarding paperwork.
- **D4-3:** Q-SIGN3 — full multi-party flow design (Cole + internal countersigner + multiple external signers, sequential / parallel / mixed routing).
- **D4-4:** Q-SIGN4 — Word/PDF upload + in-platform field placement and merge tags. No in-system content editor.
- **D4-5:** Q-SIGN4b — 4 default templates ship at v1 (NDA, MSA, SOW, Onboarding); attorney engagement required for content; version locking and attorney-review tracking enforced by platform.
- **D4-6:** Q-SIGN5 — Email + SMS OTP for ALL signatures (no per-document opt-out).
- **D4-7:** Q-SIGN6 — 10-year retention.
- **D4-8:** Q-SIGN7 — auto-email signed copy + Certificate of Completion to all parties + in-platform storage.
- **D4-9:** Recommended vendor (if Sign-Wrap): **BoldSign** (Business tier). Alternatives: SignWell, Dropbox Sign.
- **D4-10:** Twilio Verify for SMS OTP.
- **D4-11:** Resend for transactional emails (already in stack).
- **D4-12:** Attorney engagement is a v1 gating dependency for template content; build can complete in parallel but no templates send to customers until attorney sign-off.

Open / pending choice:

- **O4-1:** Sign-Wrap vs. Sign-Build final decision (recommendation: Sign-Wrap with BoldSign).
- **O4-2:** Final vendor confirmation if Sign-Wrap (BoldSign or alternative).
- **O4-3:** Attorney engagement timing and identification.
- **O4-4:** Q-12 series (custom domain, internal countersigner reality, onboarding content, estimate-as-signed semantics, template watermarking).
- **O4-5:** Same Doc 5 deferred items (architecture, multi-tenancy, sequencing).

---

*End of Doc 4.*
