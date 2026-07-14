# Architecture Reference — APPEND Session 174

*Append to `architecture-reference.md`. Parallel track to Session 173 (concurrent). Version marker **v81** (Session 174 CLOSE). Covers the off-wave punch-list session: prepaid bulk seat links, the org-wide coach access layer, the team/paired report debrief-hold, report commitments, AI-chat document upload, coach-about-client AI chat, and the public certification-verify RPC. All changes additive; no base-table read revokes. Numbering bumped +1 to avoid collision with the concurrent Session 173 closeout.*

## New tables

- **`coach_bulk_links`** — prepaid seat links. `(id, coach_user_id, instrument_id, token unique, seats_total 1..500, seats_claimed, coach_note, status pending_payment|active|exhausted|expired|cancelled, total_amount, stripe_payment_intent_id, paid_at, expires_at)`. RLS: coach reads own (or super-admin). `coach_clients` gained `bulk_link_id` + a unique claimer guard, and `invitation_source` check widened to include `bulk_link`.
- **`organization_coaches`** — coach↔org assignment. `(id, organization_id, coach_user_id, status active|ended, assigned_by/at, ended_by/at, note)`, one active row per (org, coach). RLS: super-admin all; coach reads own; org/company admin reads own org. Writes via SECURITY DEFINER RPCs only.
- **`report_commitments`** — shared "team commitments" tied to a team/paired report. `(id, report_id, report_kind team|paired, action_text, dimension_tags[], created_by, created_at, archived_at)`. RLS SELECT: readable by anyone who can read the underlying report (`bw_can_read_team_profile` / `_paired_profile`); writes via RPCs.
- **`chat_session_documents`** — documents uploaded into the AI chat. `(id, user_id, chat_session_id, file_name, mime_type, file_size_bytes, extracted_text, extracted_text_token_count, was_truncated, created_at)`. Keeps only the extracted text (no binary/bucket). RLS: owner reads + deletes; inserts via the upload edge function (service role).

## New columns

- `team_profiles.released_to_subjects`, `paired_profiles.released_to_subjects` — `boolean not null`. Added with default TRUE (existing reports backfilled visible), then the column default flipped to FALSE so NEW reports are held-for-debrief until released.
- `development_plan_items.source_report_id uuid` (report-sourced individual commitments; `source_result_id` couldn't be reused because it FK-references `assessment_results`). `development_plan_items.source` CHECK widened: `ptp|custom|team_report|paired_report`.
- `coach_clients.bulk_link_id uuid` + unique index on the (bulk_link, claimer) pair.

## New / changed helper + gate functions

- **`is_org_coach_of_member(p_member, p_coach default auth.uid())`**, **`is_org_coach_of_org(p_org, p_coach default auth.uid())`** — SECURITY DEFINER STABLE; true when p_coach has an active `organization_coaches` row for the member's / the given org.
- **`ptp_show_coach_content(p_owner_user_id)`** — added an org-coach branch (`is_org_coach_of_member`). Now true for: coach-of-client (`coach_clients`), org coach, org/company admin same org, super-admin. Used both by the coach-content frontend gate AND as the authorization proxy for coach-about-client AI chat.
- **`bw_can_read_ptp_result`** — added `OR is_org_coach_of_member(ar.user_id)`.
- **`bw_can_read_team_profile` / `bw_can_read_paired_profile`** — two changes: (1) subject branch now also requires `released_to_subjects` (debrief hold); (2) added an org-coach-of-org branch. Generator / super-admin / org-admin / report-access-grant branches unchanged.
- **`dp_coach_can_view(p_coach, p_client)`** — added `OR is_org_coach_of_member(p_client, p_coach)`; covers `development_plan_items` / `_entries` / `_comments` read policies and `dp_get_client_plan`.
- **`bw_list_my_reports()`** — return signature extended with `released_to_subjects boolean` (dropped + recreated).

## New RPCs

- Bulk links: `coach_bulk_link_create(uuid, integer, text)`, `coach_bulk_link_claim(text)` (row-locks via FOR UPDATE, idempotent per claimer, decrements/exhausts), `coach_bulk_link_public_info(text)`.
- Org coach: `org_assign_coach(uuid, uuid, text)` / `org_unassign_coach(uuid, uuid)` (super-admin only; validate target is a practitioner coach; idempotent reactivate), `coach_list_org_members()`, `org_list_coaches(uuid)`. `anon` EXECUTE revoked on the mutating + list RPCs.
- Report release: `bw_set_report_release(profile uuid, kind text, released boolean)` (generator / org coach / org-or-company admin / super-admin; `not_authorized_to_release` otherwise).
- Report commitments: `report_add_commitments(report_id, kind, scope, items jsonb)`, `report_list_commitments(report_id, kind)`, `report_archive_commitment(id)`, `dp_list_my_report_commitments(kind)`.
- Certification: `get_public_certification(cert_id)` — public verification; no `auth.uid()` dependency; returns display_name / recipient_name / certification_type / certified_at only for `status='certified'`, else `{valid:false}`.

## Additive RLS policies (read-only, OR-combined)

- `assessment_results`, `assessments`: new "org coach reads members" SELECT policy (`is_org_coach_of_member(user_id)`).
- `coaching_activity_sessions`, `coaching_assessment_uploads`, `coaching_user_summary`: same org-coach read policy — so an org coach sees a member's coaching activity like their own client's.

## Edge functions

- **`create-checkout` v76** — additive `coach_bulk_link` mode: resolves seats + ownership from `coach_bulk_links` (never trusts client quantity), requires the per-assessment price, bypasses the generic MAX_QUANTITY cap (DB-validated ≤500), success/cancel URLs (`?checkout=bulk_success`), and metadata `checkout_type=coach_bulk_link` + `bulk_link_id`. Deployed against the LIVE source (repo copy was stale). All other checkout modes byte-unchanged.
- **`stripe-webhook` v46** — additive `coach_bulk_link` branch at the head of the `checkout.session.completed` chain: flips the link `pending_payment → active`, stamps `paid_at` + `stripe_payment_intent_id`, guarded by `.eq(status,'pending_payment')` (idempotent). Not in the repo; deployed against live v45.
- **`ai-chat` v58 → v59** — v58 added `document_ids[]` (injects `chat_session_documents` extracted text as context, ≤5 docs / ~60K-token budget). v59 added `subject_user_id` (coach-about-client): authorizes via `ptp_show_coach_content`, loads the subject's assessment context, coach-facing `COACH_DISCLAIMER`. Both additive — omitting the new fields preserves prior behavior. (Note: the deployed `ai-chat` reads only `message`/`conversation_history`/`assessment_result_ids`/`document_ids`/`subject_user_id`; the frontend's extra `peer_*`/`subscription_tier` fields were already ignored.)
- **`upload-chat-doc` v1 (new)** — multipart doc upload for the user chat. Mirrors `upload-ai-authoring-doc` extractors (`pdf-parse`, `mammoth`, `JSZip`, decode) but gated to any authenticated user (not super-admin), no impersonation gate, no storage bucket (stores extracted text only). Per-file 50K-token truncation, 25MB byte cap. `verify_jwt=false` (does its own `getClaims`).

## Patterns / decisions

- **Org-wide coach via additive RLS, NOT `coach_clients` fan-out.** Chosen because `coach_clients` rows are entitlements (would grant free assessments) and would flood the coach's client list. The org-coach layer is purely read-access, entitlements untouched — verified: assignment creates zero `coach_clients` rows.
- **Debrief hold default = held for new reports** (column default FALSE after backfilling existing rows TRUE). Subjects lose access to a report until a generator/coach/admin releases it; those roles always see held reports.
- **Team commitment = shared** (`report_commitments`, one row, visible to all who can read the report). Individual commitment = a normal `development_plan_items` row (`source = <kind>_report`, `source_report_id = report id`) so it flows into the DP page + coach visibility.
- **Coach-about-client chat reuses `ptp_show_coach_content` as the authorization gate** — the one function that already encodes coach / org-coach / org-admin / super-admin visibility of a user.

## Verification method (unchanged from house style)

All backend verified via `set_config('request.jwt.claims', …)` impersonation inside `BEGIN … ROLLBACK` transactions (owner/subject/coach/stranger matrices), plus role-switched RLS SELECTs where the actual policy needed exercising. Nothing test-data persisted.

## Not changed / caveats

- No base-table read revokes; no new standing numbered rules.
- `check-ai-usage` v67 unchanged — still has NO `coach` branch (coach chat, incl. coach-about-client, runs on one-time credits). Dedicated coach allowance deferred to coach-sub-plan finalization. Same root as the Session-172 `coaching_activity_access` coach-branch gap.
- LinkedIn share preview: the SPA is client-rendered, so LinkedIn's crawler sees only the app's default Open Graph card; the `/verify/cert/:certId` page renders fully when opened. A rich share preview would need server-rendered meta (future).
- `apply_post_certification_benefits` remains the Session-73 v1 no-op (Q13) — untouched this session.
