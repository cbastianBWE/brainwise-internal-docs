# Session 155 to 156 Handoff

## What Session 155 did

Completed BQ-AI-MODEL-REGISTRY-SWEEP: extended the Session-154 `ai_model_registry` centralization across the AI edge functions so model selection is a one-row UPDATE for 13 functions. One paste remains undeployed; newsletter was left as-is by Cole's decision.

## Registry ground truth (verified at close via execute_sql)

Five roles in `public.ai_model_registry`:

- `chat` to `claude-haiku-4-5-20251001`
- `general` to `claude-sonnet-4-6`
- `report_generation` to `claude-sonnet-4-6`
- `lms_authoring` to `claude-opus-4-8`
- `newsletter` to `claude-opus-4-8`

Access model: RLS on, policy `ai_model_registry_read` is SELECT for role `authenticated` with qual true. A user-scoped client (anon key + caller Bearer JWT, which is the authenticated role) can read the registry directly. A function without a service-role client resolves through its existing caller client; the per-function hardcoded fallback covers the unauthenticated/error path.

## Conversion recipe (durable, applied to every swept function)

1. Add a top-level role-matched `const MODEL_FALLBACK = "<role model>";` and an async `resolveModelId(client, role)` that does `client.from("ai_model_registry").select("model_id").eq("role", role).maybeSingle()` in try/catch, returning MODEL_FALLBACK on null/error. Client param typed `ReturnType<typeof createClient>`.
2. Resolve ONCE after a usable client is built (service-role admin if present, else the user/caller client): `const ANTHROPIC_MODEL = await resolveModelId(<client>, "<role>");`.
3. Repoint every `model:` call site, every stored `ai_model:`/`p_model:`, every audit-log `model:`, and the returned `model:` to the resolved const.
4. Strip temperature/top_p on Opus-4.8 targets if present (none of the swept functions carried them).
5. esbuild syntax check: `esbuild <file> --bundle=false --log-level=warning --outfile=/dev/null`.
6. Deploy preserving the function's existing verify_jwt.
7. Boot-probe: OPTIONS 2xx (200 or 204), no-auth POST 401 `missing_bearer_token`.

## Deploy ceiling (durable, refines the v147/v148 note)

MCP `deploy_edge_function` is bounded by Claude's own inline-streaming capacity, not the tool. Proven clean to 41,526 bytes (generate-dashboard-narrative). Above roughly 50KB, dashboard-paste by Cole. Paste-only this sweep: expand-lesson-from-outline (92,881 bytes) and draft-lesson-block (63,702 bytes). scaffold-lesson-outline (39,444 bytes) was paste-eligible but MCP-capable.

Three impersonation_gate.ts variants exist in the tree: FULL (with logImpersonationAction), SLIM (without), COMPACT-with-log (one-line format). Reuse the matching variant per function.

## Swept and live (13 functions, verified via list_edge_functions)

From S154 (live before this session):
- generate-facet-interpretations v61
- ai-chat v56

report_generation to Sonnet 4.6 (Claude via MCP):
- generate-ptp-delta-narrative v25
- generate-dashboard-narrative v40 (41,526 bytes, proves the MCP ceiling)
- generate-report v58 (its model was already `aiVersion.model_id` = sonnet-4-6, so zero behavior change; aiVersion.model_id is now vestigial)

lms_authoring to Opus 4.8:
- lesson-open-response-feedback v6 (learner-facing coach; NO service-role client, resolves via the user client; verify_jwt TRUE)
- lesson-hotspot-autoplace v6 (vision; verify_jwt TRUE)
- draft-text v22
- ai-authoring-chat v19
- scaffold-lesson v21
- scaffold-lesson-outline v40 (Cole-deployed paste)
- expand-lesson-from-outline v43 (Cole-deployed paste; live v43 source re-verified at close: MODEL_FALLBACK claude-opus-4-8, resolveModelId via serviceClient role lms_authoring, zero claude-opus-4-7, verify_jwt false)

chat to Haiku:
- content-item-ai-assist v16. RECLASSIFIED from the inventory's lms_authoring to the chat role because it is a trainee-facing assist deliberately pinned to Haiku as a hard cost cap (one use per (user, content_item), max_tokens 220). Mapping it to chat keeps Haiku and avoids a Haiku-to-Opus cost regression. Zero behavior change.

All except the two Cole-deployed pastes were deployed by Claude via MCP and boot-probed (verify_jwt false unless noted TRUE above).

## Outstanding (the one open item)

`draft-lesson-block` is STILL v41 on the retired `claude-opus-4-7`. The paste was fully prepared (opus-4-8 fallback, resolve via serviceClient role lms_authoring, 4 refs repointed, no temp/top_p, esbuild-clean) and delivered at `/mnt/user-data/outputs/draft-lesson-block-index.ts`, but it was NOT deployed.

To finish the sweep: dashboard, draft-lesson-block, replace index.ts, keep verify_jwt FALSE, deploy. The three _shared deps (impersonation_gate, markdown_to_tiptap, length_guidance) are byte-identical and untouched.

## Deferred by Cole's decision

`newsletter_ai_generate` v16 left entirely unchanged. It is structurally distinct: two model constants (`MODEL_OPUS = "claude-opus-4-7"`, `MODEL_SONNET = "claude-sonnet-4-6"`) with a user-selected `body.model` toggle ("opus"|"sonnet"); verify_jwt TRUE (Class A gateway).

A wiring fork was presented and declined:
- Option A (recommended, fully centralized): opus to the `newsletter` role + sonnet to the `general` role.
- Option B: opus to `newsletter` only, leave sonnet hardcoded.

If revisited, the frontend `NewsletterAiPane.tsx` `SONNET_FULL_ID` constant should track whatever sonnet model the function resolves.

## Deferred (never in scope this sweep)

generate-nai-delta-narrative, generate-cross-instrument-recommendations, the 7 generate-airsa-* functions (instruments not live). EPN/HSS have no AI generators.

## Next session (156)

1. Deploy `draft-lesson-block` (the paste at `/mnt/user-data/outputs/draft-lesson-block-index.ts`) to finish the sweep.
2. New-coach feedback on the individual PTP report: capture as concrete change items and triage copy/interpretation vs structural/scoring before any code.
3. Build the PTP TEAM (aggregate) report. Read `ptp-report-and-entitlement-scope.md` and `ptp-entitlement-model-design-spec.md` first (mirrored locally). Backend-first for the read RPC: SECURITY DEFINER, REVOKE EXECUTE FROM PUBLIC/anon + GRANT authenticated/service_role, impersonation gate, NOTIFY pgrst, verify with a separate execute_sql, then frontend.

PTP facts: 89 items (47 professional, 42 personal). Dimension colors locked: Protection=Navy, Participation=Teal, Prediction=Gray, Purpose=Purple, Pleasure=Green.

Also logged: BQ-PTP-INSIGHTS-AUDIENCE (evaluate moving per-facet negative "impact on others" statements to a coach-only view; not started).

## Standing reminder

`newsletter-sitemap` (v14) STATIC_ROUTES is hardcoded. When a new public marketing page is added, STATIC_ROUTES needs a manual add. Not triggered this session.
