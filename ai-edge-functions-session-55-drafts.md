# AI Authoring Edge Function source drafts (Session 55 → 56 handoff)

These are the three AI authoring Edge Functions designed and drafted at Session 55 close. They have NOT been deployed. They are pending one prerequisite: the canonical `supabase/functions/_shared/impersonation_gate.ts` helper module source, which is imported by all three files but is not present in the brainwise-blueprint GitHub repo. Cole must paste that source at the top of Session 56 before any of these can deploy.

## Status at Session 55 close

| File | Lines | Status |
|---|---|---|
| `draft-lesson-block/index.ts` | 342 | Source drafted; not deployed |
| `scaffold-lesson/index.ts` | 358 | Source drafted; not deployed |
| `draft-text/index.ts` | 312 | Source drafted; not deployed |

All three share the same architecture:
- Class A JWT auth via `auth.getClaims`
- `account_type = 'brainwise_super_admin'` gate
- `enforceImpersonationGate(callerClient, "permission_change")` from `_shared/impersonation_gate.ts`
- Context block fetch from `ai_authoring_context` table (5 v1 blocks)
- Voice resolution: preset_key → fetch from `ai_authoring_voice_presets`, or custom from request body
- Anthropic API call with `claude-opus-4-7` and `anthropic-version: 2023-06-01`
- Per-function output validation (JSON shape, schema match)
- Audit log via `log_super_admin_action` with `ai_authoring_draft_generated` action_type
- Standardized error envelope with sanitized error codes (no PII leakage)

## Session 56 deploy sequence

1. **Paste canonical `_shared/impersonation_gate.ts` source** — required before any deploy attempt.
2. **Deploy `draft-lesson-block` first** — has the most internal complexity (17 block-type schema dispatch); a successful deploy validates the bundling pattern for `_shared`.
3. **Deploy `scaffold-lesson`** — once draft-lesson-block's bundling works, this one follows the same pattern.
4. **Deploy `draft-text`** — simplest, deploys last.
5. **Curl-verify each function** against these scenarios:
   - Anonymous → 401 missing_bearer_token
   - Non-super-admin authenticated → 403 super_admin_required
   - Super-admin authenticated, valid payload → 200 with parsed output
   - Super-admin authenticated during impersonation → 403 IMPERSONATION_DENIED

## Deploy parameters per function

All three are deployed with:
- `verify_jwt: false` — JWT verified manually via `auth.getClaims` (per arch-ref convention since Class A pattern)
- `entrypoint_path: "index.ts"`
- `files`: array containing both `index.ts` and `_shared/impersonation_gate.ts` (relative path inside the bundle)

---

## File 1: `draft-lesson-block/index.ts`

Generates a single AI-drafted block for a lesson_blocks content item. Takes a `block_type` (one of 17 v1 types) and author prompt; returns a structured JSON object matching that block_type's config schema.

```typescript
// draft-lesson-block v1
// Generates an AI draft for a single lesson_blocks block, shaped to the block_type's config schema.
// SOC 2: CC6.1 (Class A JWT auth + assert_super_admin + impersonation gate), CC6.3 (least privilege),
//        CC7.2 (sanitized errors, no PII leakage).
// Auth model: Class A JWT — caller is a super admin authoring content. JWT verified via auth.getClaims.
// Standing Rule 2: impersonation gate from inception. No author actions allowed during impersonation.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { enforceImpersonationGate, ImpersonationDeniedError } from "../_shared/impersonation_gate.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_MODEL = "claude-opus-4-7";
const MAX_OUTPUT_TOKENS = 3000;

// Per-block-type config schema specs. Each entry tells the model exactly what JSON shape to return.
// Keep these synced with lesson_block_types catalog rows seeded in Migration 3.
const BLOCK_SCHEMAS: Record<string, { schema: string; rules: string }> = {
  text: {
    schema: `{ "markdown": "<paragraph text in Markdown>" }`,
    rules: "Single Markdown paragraph. 60-180 words unless author requests otherwise. No headings inside the markdown (use the heading block for that). Supports **bold**, *italic*, and [links](url).",
  },
  heading: {
    schema: `{ "text": "<heading text>", "level": 2 | 3 | 4 }`,
    rules: "Single line. No trailing punctuation. Level 2 for section headings, level 3 for subsections, level 4 for minor headings.",
  },
  image: {
    schema: `{ "url": "<image URL>", "alt": "<alt text for accessibility>", "caption": "<optional caption>" | null }`,
    rules: "URL must be a valid http(s) URL the author has indicated they will upload. If no URL is known, return URL as a placeholder like 'https://placeholder.example/<descriptive-slug>.png' and flag with [author-verify: upload actual image]. Alt text required, 5-15 words. Caption optional.",
  },
  video_embed: {
    schema: `{ "source_type": "mux" | "vimeo" | "youtube_unlisted", "source_id": "<provider ID>" }`,
    rules: "If author has not provided a source_id, use the literal string 'TBD' and add [author-verify: insert video ID] inline.",
  },
  divider: {
    schema: `{}`,
    rules: "Empty object. Dividers carry no config. Author requests for dividers are rare but valid.",
  },
  quote: {
    schema: `{ "text": "<quote body>", "attribution": "<author or source>" | null }`,
    rules: "Quote body 1-3 sentences. Attribution optional but encouraged. Use real cited sources from the scientific foundations context; do NOT invent quotations or attributions.",
  },
  list: {
    schema: `{ "items": ["<item 1>", "<item 2>", ...], "ordered": true | false }`,
    rules: "3-7 items typically. Each item 5-25 words. Use 'ordered: true' for sequential steps, 'ordered: false' otherwise.",
  },
  callout: {
    schema: `{ "variant": "info" | "warning" | "success" | "important", "body_markdown": "<callout body>" }`,
    rules: "Choose variant by intent: 'info' for context, 'warning' for risks, 'success' for affirmations, 'important' for must-read takeaways. Body 1-3 sentences.",
  },
  stat_callout: {
    schema: `{ "value": "<headline number or short phrase>", "caption": "<descriptor>", "source": "<citation>" | null }`,
    rules: "Value must be specific and accurate. If a specific number is implied but unverified, use [author-verify] inline. Source: cite by author-year for research, omit for internal stats.",
  },
  statement_a_b: {
    schema: `{ "left": { "label": "<short label>", "body_markdown": "<body>" }, "right": { "label": "<short label>", "body_markdown": "<body>" }, "left_variant": "positive" | "negative" | "neutral", "right_variant": "positive" | "negative" | "neutral" }`,
    rules: "Each side 1-3 sentences. Labels short (1-4 words). Use variants to convey emotional/normative valence (e.g., do/don't, before/after).",
  },
  embed_audio: {
    schema: `{ "source_url": "<audio URL>", "transcript_markdown": "<transcript>" | null }`,
    rules: "URL must be valid http(s) audio source. If unknown, use placeholder + [author-verify]. Transcript optional but strongly preferred for accessibility.",
  },
  tabs: {
    schema: `{ "tabs": [{ "label": "<short label>", "body_markdown": "<panel body>" }, ...] }`,
    rules: "2-5 tabs. Labels short (1-3 words). Panel bodies 2-5 sentences. Use when comparing peer concepts that benefit from side-by-side reveal.",
  },
  flashcards: {
    schema: `{ "cards": [{ "front": "<front text>", "back": "<back text>" }, ...] }`,
    rules: "3-10 cards. Front is the prompt (term, question, or scenario); back is the answer or explanation. Each side 5-30 words. Best for: term-definition pairs, before-after concepts, question-answer recall.",
  },
  accordion: {
    schema: `{ "panels": [{ "heading": "<panel heading>", "body_markdown": "<panel body>" }, ...] }`,
    rules: "2-6 panels. Headings short, action-oriented or descriptive. Bodies 1-4 sentences each. Use for FAQ patterns or stepped progressive disclosure.",
  },
  button_stack: {
    schema: `{ "buttons": [{ "label": "<button label>", "body_markdown": "<reveal content>" }, ...] }`,
    rules: "2-5 buttons. Labels 1-3 words (e.g., a role, scenario, or option name). Body revealed on click is 1-3 sentences. Use for: comparing roles, scenarios, or branching options.",
  },
  scenario: {
    schema: `{ "setup": "<scene-setting markdown>", "options": [{ "choice": "<option label>", "outcome": "<outcome markdown>", "is_recommended": true | false }, ...] }`,
    rules: "Setup 2-4 sentences painting a scene. 2-4 options. Each option has a 'choice' (action the trainee would take) and 'outcome' (what happens). Mark exactly one as is_recommended=true. Outcomes 2-4 sentences.",
  },
  knowledge_check: {
    schema: `{ "question_type": "multiple_choice" | "true_false", "question": "<question text>", "options": [{ "text": "<option text>", "is_correct": true | false }, ...] }`,
    rules: "Question 1-2 sentences. For multiple_choice: 3-4 options, exactly one correct. For true_false: exactly 2 options, exactly one correct. Distractors must be plausible but clearly wrong on careful reading.",
  },
};

interface DraftRequest {
  block_type: string;
  author_prompt: string;
  voice_preset_key?: string;        // optional; one of the seeded preset_keys
  custom_voice_guidance?: string;   // optional; used when voice_preset_key is 'custom'
  custom_voice_example?: string;    // optional; example paragraph to match style
  lesson_context?: string;          // optional; surrounding lesson content for cohesion
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonError(405, "method_not_allowed");
  }

  try {
    // === Auth ===
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonError(401, "missing_bearer_token");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Caller client (anon key + caller JWT) — used for auth + gate checks
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims();
    if (claimsErr || !claimsData?.claims?.sub) {
      return jsonError(401, "invalid_jwt");
    }
    const callerId = claimsData.claims.sub;

    // Super admin gate
    const { data: callerRow, error: callerErr } = await callerClient
      .from("users")
      .select("account_type")
      .eq("id", callerId)
      .maybeSingle();
    if (callerErr || !callerRow || callerRow.account_type !== "brainwise_super_admin") {
      return jsonError(403, "super_admin_required");
    }

    // Impersonation gate — Standing Rule 2
    try {
      await enforceImpersonationGate(callerClient, "permission_change");
    } catch (e) {
      if (e instanceof ImpersonationDeniedError) {
        return jsonResponse(403, {
          error: "IMPERSONATION_DENIED",
          message: "AI authoring is not permitted during impersonation, even in act mode.",
        });
      }
      throw e;
    }

    // === Input ===
    let body: DraftRequest;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "invalid_json_body");
    }

    if (!body.block_type || !BLOCK_SCHEMAS[body.block_type]) {
      return jsonError(400, `unknown_block_type: ${body.block_type}`);
    }
    if (!body.author_prompt || body.author_prompt.trim().length === 0) {
      return jsonError(400, "author_prompt_required");
    }
    if (body.author_prompt.length > 4000) {
      return jsonError(400, "author_prompt_too_long");
    }

    // === Pull context blocks (service role for full read access) ===
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: contextRows, error: ctxErr } = await serviceClient
      .from("ai_authoring_context")
      .select("context_name, body_markdown")
      .eq("is_active", true);
    if (ctxErr) {
      return jsonError(500, "context_fetch_failed");
    }
    const contextBlocks = (contextRows ?? [])
      .sort((a, b) => orderForContext(a.context_name) - orderForContext(b.context_name))
      .map((r) => r.body_markdown)
      .join("\n\n---\n\n");

    // === Resolve voice ===
    let voiceGuidance = "";
    let voiceExample = "";
    if (body.voice_preset_key === "custom") {
      voiceGuidance = body.custom_voice_guidance ?? "";
      voiceExample = body.custom_voice_example ?? "";
    } else if (body.voice_preset_key) {
      const { data: presetRow, error: presetErr } = await serviceClient
        .from("ai_authoring_voice_presets")
        .select("voice_guidance_markdown, example_paragraph")
        .eq("preset_key", body.voice_preset_key)
        .eq("is_active", true)
        .maybeSingle();
      if (presetErr || !presetRow) {
        return jsonError(400, `unknown_voice_preset: ${body.voice_preset_key}`);
      }
      voiceGuidance = presetRow.voice_guidance_markdown;
      voiceExample = presetRow.example_paragraph;
    }
    // If neither voice_preset_key nor custom provided: leave voiceGuidance blank; AI uses default tone

    // === Build the system + user prompts ===
    const blockSpec = BLOCK_SCHEMAS[body.block_type];

    const systemPrompt = [
      "You are an authoring assistant for the BrainWise platform. You draft content for licensed coach training material that must meet a high bar for accuracy and tone.",
      "",
      "## Platform context (authoritative)",
      contextBlocks,
      "",
      "## Voice guidance",
      voiceGuidance || "(No specific voice preset selected. Default to professional, warm, and clear.)",
      voiceExample ? `\n## Voice example to match\n\n${voiceExample}` : "",
      "",
      "## Output format",
      `The user is authoring a "${body.block_type}" block. Return ONLY a JSON object matching this exact schema:`,
      "",
      "```json",
      blockSpec.schema,
      "```",
      "",
      `Schema rules: ${blockSpec.rules}`,
      "",
      "Critical rules:",
      "- Return ONLY the JSON object. No preamble, no markdown code fence, no explanatory text before or after.",
      "- Match the schema keys exactly.",
      "- Follow all guardrails from the platform context above.",
    ].join("\n");

    const userPromptParts: string[] = [`Author request: ${body.author_prompt}`];
    if (body.lesson_context) {
      userPromptParts.push(`\nSurrounding lesson context (for cohesion, do not repeat verbatim):\n${body.lesson_context}`);
    }
    const userPrompt = userPromptParts.join("\n");

    // === Call Anthropic API ===
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return jsonError(500, "anthropic_api_key_missing");
    }

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      console.error("anthropic_api_error", { status: anthropicResp.status, body_excerpt: errText.slice(0, 500) });
      return jsonError(502, "anthropic_api_failure");
    }

    const anthropicData = await anthropicResp.json();
    const rawText = anthropicData?.content?.[0]?.text;
    if (typeof rawText !== "string") {
      return jsonError(502, "anthropic_unexpected_shape");
    }

    // Strip code fences if AI wrapped output anyway
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return jsonResponse(502, {
        error: "ai_output_unparseable",
        message: "AI returned non-JSON output. Try again or rephrase the prompt.",
        raw_output_excerpt: cleaned.slice(0, 500),
      });
    }

    // === Audit: log the draft generation (NOT the accept; that comes later when author saves) ===
    await serviceClient.rpc("log_super_admin_action", {
      p_target_user_id: null,
      p_target_org_id: null,
      p_action_type: "ai_authoring_draft_generated",
      p_before: null,
      p_after: {
        edge_function: "draft-lesson-block",
        block_type: body.block_type,
        voice_preset_key: body.voice_preset_key ?? null,
        author_prompt_excerpt: body.author_prompt.slice(0, 200),
        model: ANTHROPIC_MODEL,
      },
      p_reason: "AI draft generated for authoring",
      p_mode: null,
    });

    return jsonResponse(200, {
      block_type: body.block_type,
      config: parsed,
      model: ANTHROPIC_MODEL,
    });
  } catch (e) {
    console.error("draft_lesson_block_unhandled", e);
    return jsonError(500, "internal_error");
  }
});

function orderForContext(name: string): number {
  // Stable ordering for system-prompt injection
  const order: Record<string, number> = {
    platform_overview: 1,
    framework_terminology: 2,
    scientific_foundations: 3,
    output_format_rules: 4,
    guardrails: 5,
  };
  return order[name] ?? 99;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string): Response {
  return jsonResponse(status, { error: code });
}
```

### draft-lesson-block test payloads

**Valid call (super admin, no impersonation)**:
```json
{
  "block_type": "flashcards",
  "author_prompt": "Generate 5 flashcards covering the 5 C.A.F.E.S. dimensions, front = dimension name, back = brief definition",
  "voice_preset_key": "conversational_coach"
}
```

Expected 200 response:
```json
{
  "block_type": "flashcards",
  "config": {
    "cards": [
      { "front": "Certainty", "back": "..." },
      { "front": "Agency", "back": "..." }
    ]
  },
  "model": "claude-opus-4-7"
}
```

**Knowledge check call**:
```json
{
  "block_type": "knowledge_check",
  "author_prompt": "One multiple-choice question testing whether the trainee can distinguish threat-state from reward-state brain responses",
  "voice_preset_key": "academic_grounded"
}
```

---

## File 2: `scaffold-lesson/index.ts`

Generates a full lesson_blocks array (mixed block types) from a lesson goal. The author refines block-by-block afterward.

```typescript
// scaffold-lesson v1
// Generates a full lesson_blocks array (mixed block types) for a new lesson.
// Author provides a lesson goal + optional constraints; AI returns a structured
// array of blocks the author can refine block-by-block.
// SOC 2: CC6.1 (Class A JWT + super_admin gate + impersonation gate), CC6.3 (least privilege),
//        CC7.2 (sanitized errors, audit log entry per draft).
// Standing Rule 2: impersonation gate from inception.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { enforceImpersonationGate, ImpersonationDeniedError } from "../_shared/impersonation_gate.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_MODEL = "claude-opus-4-7";
const MAX_OUTPUT_TOKENS = 8000; // larger envelope for multi-block output

// Allowed block_types — keep synced with lesson_block_types catalog (Migration 3, 17 v1 types).
const ALLOWED_BLOCK_TYPES = [
  "text", "heading", "image", "video_embed", "divider", "quote", "list",
  "callout", "stat_callout", "statement_a_b", "embed_audio",
  "tabs", "flashcards", "accordion", "button_stack", "scenario",
  "knowledge_check",
];

// Per-block-type schema description for the scaffolding prompt.
// Lighter-weight than draft-lesson-block's full schema rules — the AI here is
// generating a coherent SEQUENCE of blocks, so each block's spec is a one-liner.
const BLOCK_SCHEMA_HINTS: Record<string, string> = {
  text: `{ "markdown": "<paragraph>" } — Markdown paragraph, 60-180 words.`,
  heading: `{ "text": "<heading>", "level": 2|3|4 } — Section heading.`,
  image: `{ "url": "<url>", "alt": "<alt>", "caption": "<caption>"|null } — Image. Use placeholder URL + [author-verify].`,
  video_embed: `{ "source_type": "mux"|"vimeo"|"youtube_unlisted", "source_id": "<id>" } — Use "TBD" + [author-verify] if no source.`,
  divider: `{} — Horizontal rule.`,
  quote: `{ "text": "<quote>", "attribution": "<source>"|null } — Cite real sources only.`,
  list: `{ "items": ["<item>", ...], "ordered": true|false } — 3-7 items.`,
  callout: `{ "variant": "info"|"warning"|"success"|"important", "body_markdown": "<body>" } — 1-3 sentences.`,
  stat_callout: `{ "value": "<number>", "caption": "<descriptor>", "source": "<citation>"|null } — Cite source or [author-verify].`,
  statement_a_b: `{ "left": {"label","body_markdown"}, "right": {"label","body_markdown"}, "left_variant": "positive"|"negative"|"neutral", "right_variant": "..." } — Side-by-side compare.`,
  embed_audio: `{ "source_url": "<url>", "transcript_markdown": "<transcript>"|null } — Placeholder URL + [author-verify] if needed.`,
  tabs: `{ "tabs": [{"label","body_markdown"}, ...] } — 2-5 peer concepts side-by-side.`,
  flashcards: `{ "cards": [{"front","back"}, ...] } — 3-10 term/definition or Q/A pairs.`,
  accordion: `{ "panels": [{"heading","body_markdown"}, ...] } — 2-6 collapsible panels.`,
  button_stack: `{ "buttons": [{"label","body_markdown"}, ...] } — 2-5 reveal-on-click options.`,
  scenario: `{ "setup": "<scene markdown>", "options": [{"choice","outcome","is_recommended":bool}, ...] } — Branching decision moment with exactly one is_recommended=true.`,
  knowledge_check: `{ "question_type": "multiple_choice"|"true_false", "question": "<q>", "options": [{"text","is_correct":bool}, ...] } — multiple_choice has 3-4 options; true_false has 2.`,
};

interface ScaffoldRequest {
  lesson_goal: string;                  // required; what the lesson should accomplish
  voice_preset_key?: string;            // optional; one of seeded preset_keys or "custom"
  custom_voice_guidance?: string;       // optional; used when voice_preset_key === "custom"
  custom_voice_example?: string;        // optional; example paragraph to match style
  target_audience?: string;             // optional; "PTP coach trainees", "company_admin", etc.
  estimated_minutes?: number;           // optional; informs lesson length
  required_block_types?: string[];      // optional; e.g. ["knowledge_check"] to force certain blocks
  excluded_block_types?: string[];      // optional; e.g. ["scenario"] to prevent certain blocks
  max_blocks?: number;                  // optional; cap on total blocks; default 20
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonError(405, "method_not_allowed");
  }

  try {
    // === Auth ===
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonError(401, "missing_bearer_token");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims();
    if (claimsErr || !claimsData?.claims?.sub) {
      return jsonError(401, "invalid_jwt");
    }
    const callerId = claimsData.claims.sub;

    // Super admin gate
    const { data: callerRow, error: callerErr } = await callerClient
      .from("users")
      .select("account_type")
      .eq("id", callerId)
      .maybeSingle();
    if (callerErr || !callerRow || callerRow.account_type !== "brainwise_super_admin") {
      return jsonError(403, "super_admin_required");
    }

    // Impersonation gate
    try {
      await enforceImpersonationGate(callerClient, "permission_change");
    } catch (e) {
      if (e instanceof ImpersonationDeniedError) {
        return jsonResponse(403, {
          error: "IMPERSONATION_DENIED",
          message: "AI authoring is not permitted during impersonation, even in act mode.",
        });
      }
      throw e;
    }

    // === Input ===
    let body: ScaffoldRequest;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "invalid_json_body");
    }

    if (!body.lesson_goal || body.lesson_goal.trim().length === 0) {
      return jsonError(400, "lesson_goal_required");
    }
    if (body.lesson_goal.length > 4000) {
      return jsonError(400, "lesson_goal_too_long");
    }
    if (body.estimated_minutes !== undefined && (body.estimated_minutes < 1 || body.estimated_minutes > 240)) {
      return jsonError(400, "estimated_minutes_out_of_range");
    }
    const maxBlocks = body.max_blocks ?? 20;
    if (maxBlocks < 1 || maxBlocks > 50) {
      return jsonError(400, "max_blocks_out_of_range");
    }
    // Validate required + excluded against ALLOWED_BLOCK_TYPES
    for (const bt of (body.required_block_types ?? [])) {
      if (!ALLOWED_BLOCK_TYPES.includes(bt)) {
        return jsonError(400, `required_block_type_invalid: ${bt}`);
      }
    }
    for (const bt of (body.excluded_block_types ?? [])) {
      if (!ALLOWED_BLOCK_TYPES.includes(bt)) {
        return jsonError(400, `excluded_block_type_invalid: ${bt}`);
      }
    }

    // === Pull context blocks ===
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: contextRows, error: ctxErr } = await serviceClient
      .from("ai_authoring_context")
      .select("context_name, body_markdown")
      .eq("is_active", true);
    if (ctxErr) {
      return jsonError(500, "context_fetch_failed");
    }
    const contextBlocks = (contextRows ?? [])
      .sort((a, b) => orderForContext(a.context_name) - orderForContext(b.context_name))
      .map((r) => r.body_markdown)
      .join("\n\n---\n\n");

    // === Resolve voice ===
    let voiceGuidance = "";
    let voiceExample = "";
    if (body.voice_preset_key === "custom") {
      voiceGuidance = body.custom_voice_guidance ?? "";
      voiceExample = body.custom_voice_example ?? "";
    } else if (body.voice_preset_key) {
      const { data: presetRow, error: presetErr } = await serviceClient
        .from("ai_authoring_voice_presets")
        .select("voice_guidance_markdown, example_paragraph")
        .eq("preset_key", body.voice_preset_key)
        .eq("is_active", true)
        .maybeSingle();
      if (presetErr || !presetRow) {
        return jsonError(400, `unknown_voice_preset: ${body.voice_preset_key}`);
      }
      voiceGuidance = presetRow.voice_guidance_markdown;
      voiceExample = presetRow.example_paragraph;
    }

    // === Build block-catalog instruction (filtered for required + excluded) ===
    const excluded = new Set(body.excluded_block_types ?? []);
    const allowedBlocks = ALLOWED_BLOCK_TYPES.filter((bt) => !excluded.has(bt));
    const blockCatalog = allowedBlocks.map((bt) => `- **${bt}**: ${BLOCK_SCHEMA_HINTS[bt]}`).join("\n");

    // === Build the system + user prompts ===
    const systemPromptParts = [
      "You are an authoring assistant for the BrainWise platform. You are scaffolding a complete lesson by producing an ordered array of structured blocks the author will then refine.",
      "",
      "## Platform context (authoritative)",
      contextBlocks,
      "",
      "## Voice guidance",
      voiceGuidance || "(No specific voice preset selected. Default to professional, warm, and clear.)",
      voiceExample ? `\n## Voice example to match\n\n${voiceExample}` : "",
      "",
      "## Available block types and their schemas",
      blockCatalog,
      "",
      "## Lesson scaffolding rules",
      `- Output a JSON ARRAY of block objects, each shaped { "block_type": "<one of the available types>", "config": <object matching that block_type's schema> }.`,
      `- Order matters: it represents the trainee's reading flow.`,
      `- Start with a "text" or "heading" block that orients the trainee.`,
      `- Use a mix of block types: do not produce 10 consecutive "text" blocks.`,
      `- End with a "knowledge_check" if the lesson teaches a concept that can be tested. Otherwise, end with a "callout" of variant "important" summarizing the takeaway.`,
      `- Total blocks: 5 to ${maxBlocks}. Err toward fewer, higher-quality blocks rather than padding.`,
      body.required_block_types && body.required_block_types.length > 0
        ? `- REQUIRED: include at least one of each of these block types: ${body.required_block_types.join(", ")}`
        : "",
      body.excluded_block_types && body.excluded_block_types.length > 0
        ? `- EXCLUDED: do NOT use any of these block types: ${body.excluded_block_types.join(", ")}`
        : "",
      "",
      "## Critical output rules",
      "- Return ONLY the JSON array. No preamble, no markdown code fence around the JSON, no commentary.",
      "- Every block must include both 'block_type' and 'config' keys.",
      "- 'config' must match the schema shown above for that block_type exactly.",
      "- Follow all guardrails from the platform context. No invented neuroscience, no clinical language, no hyperbole.",
    ].filter(Boolean);

    const systemPrompt = systemPromptParts.join("\n");

    const userPromptParts: string[] = [`Lesson goal: ${body.lesson_goal}`];
    if (body.target_audience) {
      userPromptParts.push(`Target audience: ${body.target_audience}`);
    }
    if (body.estimated_minutes) {
      userPromptParts.push(`Estimated lesson length: ${body.estimated_minutes} minutes.`);
    }
    const userPrompt = userPromptParts.join("\n");

    // === Call Anthropic API ===
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return jsonError(500, "anthropic_api_key_missing");
    }

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      console.error("anthropic_api_error", { status: anthropicResp.status, body_excerpt: errText.slice(0, 500) });
      return jsonError(502, "anthropic_api_failure");
    }

    const anthropicData = await anthropicResp.json();
    const rawText = anthropicData?.content?.[0]?.text;
    if (typeof rawText !== "string") {
      return jsonError(502, "anthropic_unexpected_shape");
    }

    // Strip code fences if AI wrapped output
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return jsonResponse(502, {
        error: "ai_output_unparseable",
        message: "AI returned non-JSON output. Try again or rephrase the goal.",
        raw_output_excerpt: cleaned.slice(0, 500),
      });
    }

    if (!Array.isArray(parsed)) {
      return jsonError(502, "ai_output_not_array");
    }
    if (parsed.length === 0) {
      return jsonError(502, "ai_output_empty_array");
    }

    // Validate each block has block_type + config and block_type is in catalog
    const validatedBlocks: { block_type: string; config: unknown }[] = [];
    const allowedSet = new Set(allowedBlocks);
    for (let i = 0; i < parsed.length; i++) {
      const b: any = parsed[i];
      if (!b || typeof b !== "object" || Array.isArray(b)) {
        return jsonError(502, `block_at_index_${i}_not_object`);
      }
      if (typeof b.block_type !== "string" || !allowedSet.has(b.block_type)) {
        return jsonError(502, `block_at_index_${i}_invalid_block_type: ${b.block_type}`);
      }
      if (!b.config || typeof b.config !== "object") {
        return jsonError(502, `block_at_index_${i}_invalid_config`);
      }
      validatedBlocks.push({ block_type: b.block_type, config: b.config });
    }

    // === Audit ===
    await serviceClient.rpc("log_super_admin_action", {
      p_target_user_id: null,
      p_target_org_id: null,
      p_action_type: "ai_authoring_draft_generated",
      p_before: null,
      p_after: {
        edge_function: "scaffold-lesson",
        block_count: validatedBlocks.length,
        block_types: validatedBlocks.map((b) => b.block_type),
        voice_preset_key: body.voice_preset_key ?? null,
        lesson_goal_excerpt: body.lesson_goal.slice(0, 200),
        model: ANTHROPIC_MODEL,
      },
      p_reason: "AI lesson scaffold generated for authoring",
      p_mode: null,
    });

    return jsonResponse(200, {
      blocks: validatedBlocks,
      block_count: validatedBlocks.length,
      model: ANTHROPIC_MODEL,
    });
  } catch (e) {
    console.error("scaffold_lesson_unhandled", e);
    return jsonError(500, "internal_error");
  }
});

function orderForContext(name: string): number {
  const order: Record<string, number> = {
    platform_overview: 1,
    framework_terminology: 2,
    scientific_foundations: 3,
    output_format_rules: 4,
    guardrails: 5,
  };
  return order[name] ?? 99;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string): Response {
  return jsonResponse(status, { error: code });
}
```

### scaffold-lesson test payloads

**Valid call**:
```json
{
  "lesson_goal": "Teach coach trainees how to recognize threat-state activation in a client and what to do in the first 90 seconds of a session when they see it",
  "voice_preset_key": "conversational_coach",
  "target_audience": "PTP coach trainees",
  "estimated_minutes": 15,
  "required_block_types": ["knowledge_check"],
  "max_blocks": 12
}
```

Expected 200 response:
```json
{
  "blocks": [
    { "block_type": "heading", "config": { "text": "Recognizing Threat-State in the First 90 Seconds", "level": 2 } },
    { "block_type": "text", "config": { "markdown": "..." } },
    { "block_type": "scenario", "config": { ... } },
    { "block_type": "flashcards", "config": { ... } },
    { "block_type": "knowledge_check", "config": { ... } },
    { "block_type": "callout", "config": { "variant": "important", "body_markdown": "..." } }
  ],
  "block_count": 6,
  "model": "claude-opus-4-7"
}
```

---

## File 3: `draft-text/index.ts`

Plain-text drafts for short fields (descriptions, titles). Supports refinement mode (taking existing text + improvement request) in addition to fresh drafts.

```typescript
// draft-text v1
// Generates plain-text drafts for description / title / short-prose fields across
// the Content Authoring surfaces (cert path / curriculum / module / content_item).
// Simpler than draft-lesson-block — no schema dispatch, returns plain text.
// SOC 2: CC6.1 (Class A JWT + super_admin gate + impersonation gate), CC6.3 (least privilege),
//        CC7.2 (sanitized errors, audit log entry per draft).
// Standing Rule 2: impersonation gate from inception.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { enforceImpersonationGate, ImpersonationDeniedError } from "../_shared/impersonation_gate.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_MODEL = "claude-opus-4-7";
const MAX_OUTPUT_TOKENS = 1500;

// Target field specifications — guides length, tone, and constraints per use case.
// Add new target_fields as new authoring surfaces surface them.
const FIELD_SPECS: Record<string, { lengthGuidance: string; toneGuidance: string }> = {
  certification_path_description: {
    lengthGuidance: "60-200 words.",
    toneGuidance: "Aspirational but grounded. Describe what the coach will be able to do after completing this path. Avoid marketing hyperbole.",
  },
  curriculum_description: {
    lengthGuidance: "50-150 words.",
    toneGuidance: "Describe what the curriculum covers and the skills it builds. Cite framework terminology where relevant.",
  },
  module_description: {
    lengthGuidance: "40-100 words.",
    toneGuidance: "Concise overview of what this module teaches and how it fits the curriculum.",
  },
  content_item_description: {
    lengthGuidance: "20-80 words.",
    toneGuidance: "Brief context for the learner — what to expect and why it matters.",
  },
  module_name: {
    lengthGuidance: "3-7 words. Title case.",
    toneGuidance: "Action-oriented or descriptive. No filler words like 'Introduction to' unless genuinely an introductory module.",
  },
  content_item_title: {
    lengthGuidance: "3-10 words. Title case.",
    toneGuidance: "Concrete and descriptive. Reflects the specific content, not generic.",
  },
  generic_short_prose: {
    lengthGuidance: "Match the length implied in the author's prompt.",
    toneGuidance: "Follow voice preset guidance.",
  },
};

interface DraftTextRequest {
  target_field: string;                 // required; one of FIELD_SPECS keys
  author_prompt: string;                // required; what should the text be about
  voice_preset_key?: string;            // optional; one of seeded preset_keys or "custom"
  custom_voice_guidance?: string;       // optional; used when voice_preset_key === "custom"
  custom_voice_example?: string;        // optional; example paragraph to match style
  surrounding_context?: string;         // optional; e.g. the parent curriculum's name + description for a module description
  current_value?: string;               // optional; if present, AI is REFINING existing text rather than writing fresh
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonError(405, "method_not_allowed");
  }

  try {
    // === Auth ===
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonError(401, "missing_bearer_token");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims();
    if (claimsErr || !claimsData?.claims?.sub) {
      return jsonError(401, "invalid_jwt");
    }
    const callerId = claimsData.claims.sub;

    // Super admin gate
    const { data: callerRow, error: callerErr } = await callerClient
      .from("users")
      .select("account_type")
      .eq("id", callerId)
      .maybeSingle();
    if (callerErr || !callerRow || callerRow.account_type !== "brainwise_super_admin") {
      return jsonError(403, "super_admin_required");
    }

    // Impersonation gate
    try {
      await enforceImpersonationGate(callerClient, "permission_change");
    } catch (e) {
      if (e instanceof ImpersonationDeniedError) {
        return jsonResponse(403, {
          error: "IMPERSONATION_DENIED",
          message: "AI authoring is not permitted during impersonation, even in act mode.",
        });
      }
      throw e;
    }

    // === Input ===
    let body: DraftTextRequest;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "invalid_json_body");
    }

    if (!body.target_field || !FIELD_SPECS[body.target_field]) {
      return jsonError(400, `unknown_target_field: ${body.target_field}`);
    }
    if (!body.author_prompt || body.author_prompt.trim().length === 0) {
      return jsonError(400, "author_prompt_required");
    }
    if (body.author_prompt.length > 2000) {
      return jsonError(400, "author_prompt_too_long");
    }
    if (body.current_value && body.current_value.length > 5000) {
      return jsonError(400, "current_value_too_long");
    }

    // === Pull context blocks ===
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: contextRows, error: ctxErr } = await serviceClient
      .from("ai_authoring_context")
      .select("context_name, body_markdown")
      .eq("is_active", true);
    if (ctxErr) {
      return jsonError(500, "context_fetch_failed");
    }
    const contextBlocks = (contextRows ?? [])
      .sort((a, b) => orderForContext(a.context_name) - orderForContext(b.context_name))
      .map((r) => r.body_markdown)
      .join("\n\n---\n\n");

    // === Resolve voice ===
    let voiceGuidance = "";
    let voiceExample = "";
    if (body.voice_preset_key === "custom") {
      voiceGuidance = body.custom_voice_guidance ?? "";
      voiceExample = body.custom_voice_example ?? "";
    } else if (body.voice_preset_key) {
      const { data: presetRow, error: presetErr } = await serviceClient
        .from("ai_authoring_voice_presets")
        .select("voice_guidance_markdown, example_paragraph")
        .eq("preset_key", body.voice_preset_key)
        .eq("is_active", true)
        .maybeSingle();
      if (presetErr || !presetRow) {
        return jsonError(400, `unknown_voice_preset: ${body.voice_preset_key}`);
      }
      voiceGuidance = presetRow.voice_guidance_markdown;
      voiceExample = presetRow.example_paragraph;
    }

    // === Build the system + user prompts ===
    const fieldSpec = FIELD_SPECS[body.target_field];
    const isRefinement = !!(body.current_value && body.current_value.trim().length > 0);

    const systemPrompt = [
      "You are an authoring assistant for the BrainWise platform. You draft short text fields for the content authoring surfaces.",
      "",
      "## Platform context (authoritative)",
      contextBlocks,
      "",
      "## Voice guidance",
      voiceGuidance || "(No specific voice preset selected. Default to professional, warm, and clear.)",
      voiceExample ? `\n## Voice example to match\n\n${voiceExample}` : "",
      "",
      `## Output specification for "${body.target_field}"`,
      `- Length: ${fieldSpec.lengthGuidance}`,
      `- Tone: ${fieldSpec.toneGuidance}`,
      "",
      "## Critical output rules",
      "- Return ONLY the requested text. No preamble (no 'Here is the description:'). No quotation marks wrapping the response. No markdown code fence. No commentary before or after.",
      "- Match length and tone specifications above.",
      "- Follow all guardrails from the platform context. No invented neuroscience, no clinical language, no hyperbole.",
      isRefinement
        ? "- This is a REFINEMENT: the author has existing text and is asking you to improve it. Preserve the author's intent; refine the prose. Do not invent new claims."
        : "",
    ].filter(Boolean).join("\n");

    const userPromptParts: string[] = [];
    if (isRefinement) {
      userPromptParts.push(`Existing text to refine:\n\n${body.current_value}\n\nRefinement request: ${body.author_prompt}`);
    } else {
      userPromptParts.push(`Author request: ${body.author_prompt}`);
    }
    if (body.surrounding_context) {
      userPromptParts.push(`\nSurrounding context (for cohesion, do not repeat verbatim):\n${body.surrounding_context}`);
    }
    const userPrompt = userPromptParts.join("\n");

    // === Call Anthropic API ===
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return jsonError(500, "anthropic_api_key_missing");
    }

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      console.error("anthropic_api_error", { status: anthropicResp.status, body_excerpt: errText.slice(0, 500) });
      return jsonError(502, "anthropic_api_failure");
    }

    const anthropicData = await anthropicResp.json();
    const rawText = anthropicData?.content?.[0]?.text;
    if (typeof rawText !== "string") {
      return jsonError(502, "anthropic_unexpected_shape");
    }

    // Clean: strip surrounding quotes if AI wrapped them, strip code fences, trim
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```(?:text|markdown)?\s*/i, "").replace(/```\s*$/, "").trim();
    // Strip wrapping straight or curly quotes if AI added them
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith('“') && cleaned.endsWith('”'))
    ) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    if (cleaned.length === 0) {
      return jsonError(502, "ai_output_empty");
    }

    // === Audit ===
    await serviceClient.rpc("log_super_admin_action", {
      p_target_user_id: null,
      p_target_org_id: null,
      p_action_type: "ai_authoring_draft_generated",
      p_before: null,
      p_after: {
        edge_function: "draft-text",
        target_field: body.target_field,
        is_refinement: isRefinement,
        voice_preset_key: body.voice_preset_key ?? null,
        author_prompt_excerpt: body.author_prompt.slice(0, 200),
        output_length: cleaned.length,
        model: ANTHROPIC_MODEL,
      },
      p_reason: isRefinement ? "AI text refinement for authoring" : "AI text draft for authoring",
      p_mode: null,
    });

    return jsonResponse(200, {
      target_field: body.target_field,
      text: cleaned,
      length: cleaned.length,
      model: ANTHROPIC_MODEL,
    });
  } catch (e) {
    console.error("draft_text_unhandled", e);
    return jsonError(500, "internal_error");
  }
});

function orderForContext(name: string): number {
  const order: Record<string, number> = {
    platform_overview: 1,
    framework_terminology: 2,
    scientific_foundations: 3,
    output_format_rules: 4,
    guardrails: 5,
  };
  return order[name] ?? 99;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string): Response {
  return jsonResponse(status, { error: code });
}
```

### draft-text test payloads

**Fresh draft (curriculum description)**:
```json
{
  "target_field": "curriculum_description",
  "author_prompt": "A curriculum teaching PTP coach trainees how to interpret a client's PTP profile and use it to ground coaching conversations",
  "voice_preset_key": "conversational_coach"
}
```

Expected 200 response:
```json
{
  "target_field": "curriculum_description",
  "text": "This curriculum walks you through the practical work of...",
  "length": 142,
  "model": "claude-opus-4-7"
}
```

**Refinement call (existing module description → tighter version)**:
```json
{
  "target_field": "module_description",
  "author_prompt": "Make it more action-oriented and cut the marketing language",
  "voice_preset_key": "tactical_direct",
  "current_value": "An exciting and transformative module that will revolutionize your understanding of brain-based coaching and unlock new dimensions of client connection."
}
```

---

## Notes for Session 56

1. **`_shared/impersonation_gate.ts` blocker is the only thing standing between these and deploy.** Cole has two options: paste the source from his local Supabase functions directory, or run `supabase functions download _shared` from CLI and paste the result.

2. **All three reference `ANTHROPIC_API_KEY`** as the Edge Function secret. This secret should already exist in production (per arch-ref §10.7 — used by 11 existing AI Edge Functions). Verify via Supabase Dashboard before deploy.

3. **The `claude-opus-4-7` model string** is the current top model per the system prompt environment. If Anthropic API rejects with "unknown model", fall back to `claude-opus-4-6` (existing platform default). Update the constant in all three files and redeploy.

4. **The `log_super_admin_action` RPC signature** these files use is `(p_target_user_id, p_target_org_id, p_action_type, p_before, p_after, p_reason, p_mode)`. Confirm this matches the deployed signature before deploy — Session 49 audit reform may have changed it.

5. **The `ai_authoring_draft_generated` action_type** was seeded in Migration 5 with `requires_justification=false`. The `p_reason` field is still passed (it's required by the RPC signature) but its value is internal — the user doesn't supply it. The strings used here ("AI draft generated for authoring", etc.) are fine.

6. **Bundle layout for deploy**: per arch-ref §22 standard pattern, the `_shared` module sits alongside the function in the bundle, so the import path `../_shared/impersonation_gate.ts` resolves at function runtime. Each `deploy_edge_function` call passes both files in the `files` array.

7. **First curl test after deploy** for draft-lesson-block:
   ```bash
   curl -X POST "https://svprhtzawnbzmumxnhsq.supabase.co/functions/v1/draft-lesson-block" \
     -H "Authorization: Bearer <super_admin_jwt>" \
     -H "Content-Type: application/json" \
     -d '{"block_type":"divider","author_prompt":"Add a divider"}'
   ```
   The `divider` block_type takes empty config — simplest path to confirm auth + Anthropic call + audit log work end-to-end without exercising the complex schema dispatch.
