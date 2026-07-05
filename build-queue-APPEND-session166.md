# Build Queue — APPEND Session 166

*Append to `build-queue.md`. Version lineage v65 to v66. Covers the My Coaching (coaching activities) system.*

## Epic: My Coaching (coaching activities)

Separate domain from the LMS. Flow-engine, definition-driven. ~150 interactive activities (Appendix A of Phil's Coaches' Guide) plus ~90 reference documents (Appendix B, to a library). Full detail in `BrainWise_Coaching_Activities_Scope_v1.md`.

### DONE (Session 165, verified)

- COACH-BE-1: Four domain tables with RLS (`coaching_activities`, `coaching_activity_sessions`, `coaching_activity_shares`, `coaching_user_summary`). Verified.
- COACH-BE-2: Credit and metering layer (`users.one_time_coaching_credits`, `coaching_credit_grants`, `coaching_usage_counters`, grant/consume RPCs, purchase-grant trigger). Verified with rolled-back tests.
- COACH-BE-3: `coaching_activity_access`, `coaching_activity_access_batch`, `coaching_usage_check_and_consume` (super admin unlimited/unmetered), `coaching_session_save` (input-only merge). Verified.
- COACH-BE-4: Model-registry roles `coaching_analysis` and `coaching_chat` on Sonnet.
- COACH-EF-1: `coaching-activity-analyze` v2 (gated, PTP + summary injection), `coaching-activity-chat` v1 (gated, one unit per turn), `coaching-activity-summary` v1 (updates rolling summary). Boot-probed. One full completion observed.
- COACH-FE-1: Catalog `/coaching` (batch access, grouped cards, tier badge, search, tags, thumbnails), runner `/coaching/:activityId` (seven Clarity Engine widgets, analysis, chat, synthesis, restart, sharing), history tab and read-only session view.
- COACH-CONTENT-1: Clarity Engine (module 0745) live as reference activity with analysis and chat prompts, tags, and a thumbnail column (URL pending from Cole).

### QUEUED (Session 166 and beyond)

- COACH-FE-2 [NEXT]: `content` widget (image/model/sayings + short reflection). Unblocks the group openers and model explainers.
- COACH-CONTENT-2 [NEXT]: build one common group end to end (05 Past or 02 Purpose) to prove data-only authoring.
- COACH-IMG-1: Supabase storage bucket for coaching media plus `image_capture` widget via 03 Future 0310. Also delivers thumbnail upload, hero images, inline step images.
- COACH-FE-3: `select_model`, `matrix_2x2`, `goal_form`, `timeline`, `ptp_display` widgets, added as the first activity needing each comes up.
- COACH-FE-4: PDF export of a completed session to the PTP-report standard.
- COACH-LIB-1: reference library for Appendix B (~90 docs), searchable, tagged, not gated by coaching credits.
- COACH-AUTHOR-1 [LAST]: super-admin authoring UI, once the widget palette is complete.
- COACH-CONTENT-3: the remaining ~149 activities, Foundational tiers first per group.

### BUGS

- BUG-COACH-1 [FIXED]: runner lost progress on refresh/re-entry due to persistent `?fresh=1` URL. Fix prompt issued (clear param, ref guard, flush on unmount).
- BUG-COACH-2 [FIXED]: client save clobbered server-owned analysis/chat. Resolved by `coaching_session_save` merge RPC.
- OPS-1 [OPEN]: documented test password no longer authenticates any PTP fixture. Reset fixture password or update the record.

### GATES

- Survey widget reuse vs build (recommend reuse of assessment engine). Decide.
- 06 Life's Tools Decoded activity-vs-reference split. Phil.
- Per-activity AI touchpoint content and wording. Phil.
