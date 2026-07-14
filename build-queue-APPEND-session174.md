# Build Queue — APPEND Session 174

*Append to `build-queue.md`. Parallel track to Session 173 (concurrent session). Version marker **v85** (Session 174 CLOSE). This was a non-typical, off-wave session: a single client-supplied punch list of ~13 platform bugs + features, worked top to bottom. Backend shipped and verified live for every item; each frontend piece delivered as a self-contained Lovable prompt (several already applied by Cole this session). Numbering bumped +1 to avoid collision with the concurrent Session 173 (My Coaching wave) closeout.*

## Headline

- **Whole punch list addressed (13 items).** 5 live bugs fixed + applied; 6 features built backend-first + verified with a frontend prompt each; 1 item (org members seeing their team/paired reports) verified already-working; 1 item (LinkedIn) shipped as badge+share with true auto-post deferred.
- **Every backend change was additive and impersonation-verified in rolled-back transactions before any prompt was written.** No base-table read revokes; no existing access narrowed.

## SHIPPED — live bug fixes (applied this session)

- **PDF export pass (team + paired reports).** Fixed bullet-per-wrapped-line in the two-column layout, card right-clip, footer overlap, an orphaned 5P bar, coach-section " : " and doubled "Lean on:", and team-legend copy. Also corrected shape/domain definitions (team = 3 domains; cover un-numbered) in `generatePairedProfilePdf.ts` / `generateTeamProfilePdf.ts` / `generatePdfPrimitivesShared.ts`. Applied, typecheck passed.
- **Coach-only content leaking to peers on shared reports.** New `ptp_show_coach_content(uuid)` RPC gates the coaching-questions block, NAI pattern alert, and CAFES-PTP mapping on the viewer's relationship to the owner (coach / org-or-company admin same org / super-admin), not on the overloaded `isCoachView`. Frontend: 9 edits to `src/pages/MyResults.tsx` (a `showCoachContent`/`coachContentActive` gate). Applied.
- **PTP profile-overview dimension mis-ranking (the "Prediction comes next" bug).** `generate-facet-interpretations` (`buildContextNarrativePrompt`) now computes an explicit descending `rankedDimensionLines` list server-side and instructs the model to use it verbatim for any ordinal claim, instead of letting it infer order from an unsorted score object. Deployed; cached overview cleared + regenerated + verified.
- **Notification email links (host + routes).** `notification_display(text,jsonb)` now builds links against the apex `https://brainwiseenterprises.com` with real routes (`/my-learning`, `/coach/certification`, `/coach/clients`, `/mentor`). Fixed the cert-email 404 reported for a coach. Applied + verified.
- **Org peer-directory sharing (directory empty for an org).** `ALTER VIEW public.org_users_public SET (security_invoker = false)` so the peer directory resolves for org members. Applied + verified.

## SHIPPED — Feature 2: Prepaid bulk PTP "seat link"

Coach pays for N assessment seats up front, shares one link; each signup consumes a seat.

- **Phase 1 (backend, applied+verified):** table `coach_bulk_links`; `coach_clients.bulk_link_id` + unique claimer guard; widened `coach_clients.invitation_source` check to include `bulk_link`; RPCs `coach_bulk_link_create` / `coach_bulk_link_claim` (row-locked, idempotent per person, decrements/exhausts) / `coach_bulk_link_public_info`.
- **Phase 2 (payment, deployed):** `create-checkout` **v76** — new `coach_bulk_link` mode (reads seats+ownership from the DB, forces the per-assessment price, charges seats × per-assessment, stamps `checkout_type`+`bulk_link_id`). `stripe-webhook` **v46** — activation branch flips the link `pending_payment → active`, stamps `paid_at` + payment ref, idempotent.
- **Phase 3 (frontend prompt delivered):** `bulkSeatClaim` helper (localStorage token survives email verification), `BulkSeatLinkModal`, CoachClients dropdown item + Active Seat Links list (QR/copy), `?checkout=bulk_success` toast, SignUp `?bulk=<token>` banner, and a claim consumer in Onboarding + AppLayout.

## SHIPPED — Feature 3: Organizations + org-wide coach (with Feature 12 folded in)

- **Item 12 (org members can't see the team/paired reports they're in) verified ALREADY WORKING.** `bw_can_read_team_profile` / `bw_can_read_paired_profile` already grant a subject read when `narrative_status='complete'`; `bw_list_my_reports` surfaces them; the sidebar conditionally shows the "shared with me" pages. All report subjects are user-linked. Cole confirmed the affected org's members can see theirs. No change needed (later constrained by Feature 5's release gate — see below).
- **Item 3 (org-wide coach, backend applied+verified):** organizations already exist; the gap was any coach↔org link. New `organization_coaches` join table + `is_org_coach_of_member` / `is_org_coach_of_org` helpers + RPCs `org_assign_coach` / `org_unassign_coach` (super-admin only, per Cole) / `coach_list_org_members` / `org_list_coaches`. Additive org-coach access on `assessment_results`, `assessments`, the three coaching tables, and the `bw_can_read_ptp_result` / team / paired gates, `ptp_show_coach_content`, and `dp_coach_can_view` — so an org coach sees members' results, reports, dev plans, and coaching exactly like a normal coach, with NO `coach_clients` rows (no entitlement side effects).
- **Frontend prompt:** super-admin CompanyDetail "Coaches" tab (assign/unassign) + a coach "Organization Members" page (list → member assessments → Results/Plan/Coaching), rendering `MyResults`/`CoachClientPlan`/`CoachClientCoaching` directly (NOT the `coach_clients`-coupled `/coach/client-results` viewer).

## SHIPPED — Feature 5: Results-now-vs-debrief hold for team/paired reports

- **Backend (applied+verified):** `team_profiles.released_to_subjects` / `paired_profiles.released_to_subjects` (added default TRUE so existing reports stay visible, then default flipped to FALSE so NEW reports are held for debrief). Subject branch of both read gates now also requires `released_to_subjects` — generator/org-coach/org-admin/super-admin still see held reports. `bw_set_report_release(profile, kind, released)` (generator + org coach + org/company admin + super-admin). `bw_list_my_reports` now returns `released_to_subjects`.
- **Decision:** hold-for-debrief is the DEFAULT for new reports (per Cole).
- **Frontend prompt:** hold/release choice in `GenerateReportDialog` (defaults to hold; calls the release RPC only when "release now" chosen) + a Held/Released toggle on the reports list.

## SHIPPED — Feature 6: Development-plan tabs for team/paired + add-to-plan commitments

- **Decision (Cole):** the Development Plan PAGE gets tabs — **My Development / Team / Paired** — as the home; reports carry only an "Add to development plan" button. Team commitments are **shared and visible to all participants** (new table). Add flow offers report-derived suggestions + free text.
- **Backend (applied+verified):** table `report_commitments` (owner/participant-readable via the report gates); RPCs `report_add_commitments(report_id, kind, scope, items)` (scope `individual` → caller's `development_plan_items`; scope `team` → shared `report_commitments`), `report_list_commitments`, `report_archive_commitment`, `dp_list_my_report_commitments`. Widened `development_plan_items.source` CHECK to add `team_report`/`paired_report`; added `development_plan_items.source_report_id` (report-sourced items can't reuse `source_result_id`, which FK-references `assessment_results`).
- **Frontend prompt:** DP page tabs + `ReportCommitmentsTab` + `AddReportCommitmentModal` (Individual/Team toggle) + an "Add to development plan" button on both report pages.

## SHIPPED — Feature 7: Document upload in the AI chat

- Reuses the proven authoring doc pipeline. New `upload-chat-doc` **v1** edge function extracts text server-side (`pdf-parse` / `mammoth` / `JSZip`; PDF/DOCX/PPTX/TXT/MD; 25MB + 50K-token/file caps with truncation). New table `chat_session_documents` (owner-only RLS; keeps extracted text only, not the binary). `ai-chat` **v58** accepts `document_ids[]` and injects each doc's text as context (≤5 docs, ~60K-token budget/turn); omitting it is a no-op for existing calls.
- **Frontend prompt:** paperclip + doc chips in `AiChat.tsx`, `document_ids` sent per message.

## SHIPPED — Feature 8: Coaches chat with AI about a client

- `ai-chat` **v59** accepts `subject_user_id`; when present it authorizes the caller via `ptp_show_coach_content(subject)` (the client's coach / assigned org coach / org-or-company admin / super-admin), loads the CLIENT's assessment context instead of the caller's, and switches to a coach-facing system prompt. 403 `not_authorized_for_subject` otherwise. Verified: client's coach yes, stranger no.
- **Metering (decision):** reuses the coach's existing pool / one-time credits (no `coach` branch in `check-ai-usage` — coaches run on onboarding-granted credits). Dedicated coach chat allowance deferred until coach sub plans are finalized (Cole).
- **Frontend prompt:** an "Ask AI" tab in the coach client view + org-members view.

## SHIPPED — Feature 10: Coach cert LinkedIn badge + share

- **Scope (Cole):** badge + one-click share now; true zero-click auto-post deferred to a LinkedIn-app phase 2.
- **Backend (applied+verified):** `get_public_certification(cert_id)` — public (no `auth.uid()` dependency) verification RPC returning only display name / recipient name / cert type / date for CERTIFIED certs.
- **Frontend prompt:** a public `/verify/cert/:certId` page; the existing Add-to-Profile badge now includes `certUrl`+`certId` (working "See credential" link); a new "Share as a post" button (share-offsite) + copyable suggested caption. (The Add-to-Profile button already existed; this completes it.)

## DEFERRED / FOLLOW-UPS created this session

- **Q-COACH-META: dedicated coach AI chat allowance.** `check-ai-usage` has no `coach` branch (coaches fall through to one-time credits). Add a coach allowance when coach subscription plans are finalized. (Same root as the Session-172 coaching-entitlement coach-branch gap.)
- **Q-LI-AUTOPOST: true LinkedIn auto-post (phase 2).** Needs a LinkedIn developer app (client id/secret), per-coach OAuth (`w_member_social`), token storage, and a post edge function hooked to cert grant. Blocked on Cole creating the LinkedIn app + LinkedIn scope approval.
- **Bulk-link v1 limits (by design):** prepay all seats up front, no automatic refund, one instrument per link.
- **Report debrief hold:** held team/paired reports have no "pending debrief" placeholder for subjects (they simply don't appear until released) — intentional for v1.

## APPLY / VERIFY STATE at 174 close

- Applied + confirmed by Cole this session: PDF pass, coach-questions leak, org-coach frontend, debrief-hold frontend, report-commitments frontend. Others delivered as prompts (bulk-link Phase 3, chat-doc upload, coach-client chat, LinkedIn) — apply + live-verify next.
- All backend is deployed and verified; nothing backend is pending.
