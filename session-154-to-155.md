# BrainWise Session 154 to 155 Handoff

*Closeout: Session 154. Open: Session 155.*

## Where Session 154 left off

Session 154 opened as a planned PTP arc (new-coach feedback + build the PTP team report) but pivoted immediately to a live production incident. A coach viewing a client's PTP report saw blank sections (profile overview, "what this means to me", dimension highlights, suggested next steps, coach questions). The root cause was external: Anthropic retired the dated models `claude-sonnet-4-20250514` and `claude-opus-4-20250514` from the Claude API on June 15 2026 (migration targets Claude Sonnet 4.6 and Opus 4.8). The `generate-facet-interpretations` edge function hardcoded the retired Sonnet string in 14 places and returned `404 not_found_error` on every fresh generation; cached content survived, which is why only some users saw blanks.

Two defects compounded it. The backend coach_questions branch returned 500 deterministically, and the frontend `PTPNarrativeSections.tsx` coach view treated `coach_questions_${ctx}` as a required section, so a single failed sub-call discarded the entire assembly and blanked sections that existed in the database. No data was lost; the UI refused to render. The hotfix (`generate-facet-interpretations` v59) made the coach_questions branch non-fatal.

The durable outcome is a new `ai_model_registry` config table that centralizes AI model selection so the next retirement is a one-row update, not a redeploy. `generate-facet-interpretations` was wired to it and validated end to end (a cplummer PTP reset regenerated cleanly on Sonnet 4.6), the broken `ai_versions` row was fixed, and `ai-chat` was moved onto the registry. The rest of the AI edge functions were checked and are all on working models, so the remaining work is centralization, not outage repair.

## Session 155 opening priorities, in order

### 1. Finish the AI edge-function registry sweep (BQ-AI-MODEL-REGISTRY-SWEEP)

Wire every remaining AI edge function to `ai_model_registry` using the established pattern (see "The conversion recipe" below). None of these is broken, so there is no time pressure; do each one carefully, esbuild-verify, deploy, and boot-probe. The full list is in the next section.

### 2. PTP team report + new-coach feedback (carried from the Session-153 handoff)

This was the planned Session-154 build, displaced by the incident. Pick it back up after the sweep: capture the new coach's feedback on the individual PTP report as concrete change items first (triage copy/interpretation vs structural/scoring before touching code), then build the team (aggregate) report. Read `ptp-report-and-entitlement-scope.md` and `ptp-entitlement-model-design-spec.md` first. Standing PTP facts: 89 items (47 professional, 42 personal); split-pair combined rows live on the professional result row; `facet_insights_all` rows are permanent per `assessment_result_id` and regenerate only on a new attempt; dimension colors locked (Protection=Navy, Participation=Teal, Prediction=Gray, Purpose=Purple, Pleasure=Green). Backend-first: present the aggregation unit (org / department / supervisor group), the roll-up per dimension, and the entitlement gate, get go-ahead, then build the read RPC (SECURITY DEFINER, REVOKE EXECUTE FROM PUBLIC/anon + GRANT to authenticated/service_role, impersonation gate, NOTIFY pgrst), verify with a separate execute_sql, then the frontend.

## Full list of AI edge functions yet to be wired to ai_model_registry

All are currently on a working model, so this is centralization, not firefighting. Target role and hardcoded fallback in parentheses.

**report_generation role (fallback `claude-sonnet-4-6`):**

- `generate-report` - sources its model from the `ai_versions` table (the active row was fixed to `claude-sonnet-4-6` this session, so it already works). Decide whether to wire it to the registry for a single source of truth or leave it reading `ai_versions`.
- `generate-ptp-delta-narrative` - currently `claude-opus-4-6` via raw fetch. Has a `_shared/impersonation_gate.ts` dependency. Two string sites to repoint: the `model:` call and a stored `ai_model:` field. Source already fetched and analyzed this session.
- `generate-dashboard-narrative` - not yet fetched; pull via `get_edge_function`, verify the current model and call sites.

**lms_authoring role (fallback `claude-opus-4-8`):**

- `draft-lesson-block` - LARGE (~57KB); MCP-deployable but near the ceiling, treat as dashboard-paste if it grows.
- `scaffold-lesson` - verify (smaller).
- `scaffold-lesson-outline` - LARGE; dashboard-paste.
- `expand-lesson-from-outline` - LARGE (~84KB); dashboard-paste (above the inline ceiling).
- `draft-text` - verify.
- `ai-authoring-chat` - verify (the lesson-authoring chat; distinct from `ai-chat`).
- `content-item-ai-assist` - verify.
- `lesson-open-response-feedback` - verify (single Opus formative-feedback call).
- `lesson-hotspot-autoplace` - verify it calls Anthropic at all (vision Opus for marker placement); if so, wire it.

**newsletter role (fallback `claude-opus-4-8`):**

- `newsletter_ai_generate` - verify the current model and call sites. Also: the frontend `src/components/super-admin/newsletter/ai-copilot/NewsletterAiPane.tsx` carries a `SONNET_FULL_ID = "claude-sonnet-4-6"` constant; make the function authoritative via the registry rather than trusting a frontend-supplied model string.

**chat role (fallback `claude-haiku-4-5-20251001`):**

- `ai-chat` - DONE this session.

**Deferred until those instruments go live (add to the registry then):**

- `generate-nai-delta-narrative` (NAI)
- `generate-cross-instrument-recommendations`
- the seven `generate-airsa-*` functions (profile-overview, what-this-means, action-plan, conversation-guide, top-priorities, cross-instrument, org-narrative - confirm exact slugs via `list_edge_functions` next session)
- EPN and HSS have no AI generators (nothing to wire).

## The conversion recipe (established this session, durable)

Template functions: `generate-facet-interpretations` and `ai-chat`.

1. Add a top-level inline helper:
   ```ts
   const MODEL_FALLBACK = "<role-appropriate model>";
   const resolveModelId = async (admin, role) => {
     try {
       const { data, error } = await admin
         .from("ai_model_registry").select("model_id").eq("role", role).maybeSingle();
       if (error || !data?.model_id) return MODEL_FALLBACK;
       return data.model_id;
     } catch (_e) { return MODEL_FALLBACK; }
   };
   ```
2. Resolve ONCE per request, right after the service-role client is created: `const MODEL = await resolveModelId(admin, "<role>");`
3. Repoint every `model:` call site to `MODEL`.
4. On Opus-4.8 targets (lms_authoring, newsletter), strip any `temperature` / `top_p` (Opus 4.7+ removed sampling params and forces adaptive thinking; watch small-`max_tokens` calls).
5. `esbuild <file>.ts --bundle=false --log-level=warning --outfile=/dev/null`.
6. Deploy: MCP works up to ~57KB; dashboard-paste above that. Keep each function's existing `verify_jwt` setting. For dashboard-paste functions, reconstruct the full `index.ts` from `get_edge_function`, apply anchored str_replace edits, esbuild, then paste the complete file (a failed bundle leaves the prior version intact).
7. Boot-probe: OPTIONS to 204, unauthenticated POST to 401.

The hardcoded fallback is the point: if the registry read ever fails, the function still runs on a sane default instead of going down.

## Decisions locked in Session 154 (recap)

- AI model selection is owned by the `ai_model_registry` table, partitioned by purpose-role, not hardcoded per function.
- Five roles, Cole's mapping rule: super-admin authoring = Opus (`lms_authoring`, `newsletter` to `claude-opus-4-8`); everything else = Sonnet (`report_generation`, `general` to `claude-sonnet-4-6`); end-user chat = Haiku (`chat` to `claude-haiku-4-5-20251001`).
- Every registry-wired function keeps a hardcoded role-matched fallback so a DB-read failure degrades to a working default, never an AI outage.
- The registry is a NEW thin table, deliberately separate from the prompt-bearing `ai_versions` table.
- A failed AI sub-call inside a multi-section report must be non-fatal: assemble and return what succeeded rather than discarding the whole response (the coach_questions v59 fix; the frontend should match this on its side when next touched).

## What's NOT in scope for Session 155

- The deferred NAI / AIRSA / cross-instrument generators (wire when those instruments go live).
- SCORM 1.2 export, SCORM import, and the course/open API (still queued behind PTP).
- The held mux-create-upload 720p flip (`/home/claude/gen/mux-create-upload/index.ts`, proven, not deployed).

## Architecture additions in Session 154

New table `public.ai_model_registry`:

- Columns: `role text PRIMARY KEY`, `model_id text NOT NULL`, `notes text`, `updated_at timestamptz`, `updated_by uuid`.
- RLS ON; REVOKE ALL FROM PUBLIC and anon; GRANT SELECT to authenticated; ALL to service_role; a read policy for authenticated. NOTIFY pgrst run; verified by a separate execute_sql.
- Seeded rows: `report_generation` to `claude-sonnet-4-6`, `general` to `claude-sonnet-4-6`, `chat` to `claude-haiku-4-5-20251001`, `lms_authoring` to `claude-opus-4-8`, `newsletter` to `claude-opus-4-8`.

Functions changed: `generate-facet-interpretations` (registry-wired, role report_generation, plus the v59 non-fatal coach_questions wrap) and `ai-chat` (role chat). The `ai_versions` active row `AI-sonnet46-P3` was repointed from `claude-sonnet-4-20250514` to `claude-sonnet-4-6`. No new numbered standing rule (§1-§158 hold); §61 not triggered.

This is recorded as architecture-reference entry v155.

## Test fixture state at end of Session 154

- cplummer (`cplummer19912003@gmail.com`, user_id `febd1505-cbc2-48ed-8aa3-6e1aa68fd273`): his 4 PTP results were cleared for the registry validation (29 facet_interpretations rows deleted, narrative fields nulled) and then regenerated cleanly on Sonnet 4.6 on report open. He is in a freshly-regenerated state.
- Edgar Vazquez Encarnacion (the incident-trigger client, coach Cheryl): split-pair PTP, professional result `bfb71f2c-722d-4ef4-b8a5-cbb6d386c6c9` (holds the combined sections) + personal `c94555d5-590f-4074-958b-9f6adc59ac08`. His core report was restored by the v59 hotfix; coach questions regenerate on Sonnet 4.6 via the registry.
- Standard test org and users unchanged (BrainWise Test Corp; password in Claude's userMemories).

## Documents this session leaves behind

Markdown only (Session-74 decision; no `.docx` generated):

- build-queue.md (v156 - Session 154 delta + BQ-AI-MODEL-REGISTRY-SWEEP appended)
- architecture-reference.md (v155 entry at top of changelog)
- session-154-to-155.md (this handoff)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs (flat root). Upload these three to GitHub manually (GitHub MCP is read-only).
