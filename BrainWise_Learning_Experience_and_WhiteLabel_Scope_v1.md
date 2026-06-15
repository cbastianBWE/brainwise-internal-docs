# BrainWise Learning Experience & White-Label Scope

*v1 — Session 136. Authoring tool, learner viewer, AI media, per-lesson branding.*
*Status: scope locked for sequencing and design choices; per-track backend recon happens at the start of each track before any Lovable prompt.*

---

## 0. Purpose, goals, thesis

**Goal.** Make the BrainWise lesson experience, both authoring and learner-facing, more dynamic and engaging than the best tools on the market (Mindsmith, Articulate, Colossyan, Captivate, LearningStudioAI, Easygenerator), and make lessons sellable off the shelf to other companies with fast per-lesson re-branding.

**Strategic thesis (the moat).** Every competitor personalizes against behavior (correctness, time on task). BrainWise is the only one sitting on neuroscience psychometric instruments (PTP, NAI, AIRSA, HSS). The durable differentiator is profile-aware learning plus a learner-facing AI tutor grounded in both the lesson content and the learner's psychometric profile. No listed competitor can copy this without the instruments.

**What we are NOT doing (explicit non-goals).**
- Not building a Storyline-style freeform timeline/trigger/simulation authoring paradigm. The block model plus interactivity plus psychometric adaptation is the better-differentiated path.
- Not adding AI image generation now. Pexels covers stock; Synthesia covers presenter video. (If ever revisited, prefer a commercially-safe licensed-data model.)
- Not white-labeling the BrainWise app chrome. The white-label surface is the lesson content only (blocks plus the new title card). The platform UI stays BrainWise.

**Design principle for all visual work: dynamic with restraint.** Momentum, smooth motion, sense of place, and a living AI presence, all inside the brand system. If an enhancement would look at home in a credibility-driven clinical or executive context, it is right. If it would look at home in a mobile game, it is wrong.

---

## 1. Build sequence

1. **Pexels image picking** (start here; small, reuses live newsletter infra).
2. **Per-lesson branding and white-label, including the title card** (unblocks off-the-shelf selling; the title card also delivers the "sense of place" visual win).
3. **Visual shell enhancements** (progress, section transitions, reward cadence, expressive framing; learner-facing engagement, independent of media).
4. **Voiceover, ElevenLabs** (multimodal; the read/listen/both control lands in the shell from step 3).
5. **AI video, Synthesia** (largest media build; reuses the asset patterns proven in VO).
6. **Learner AI tutor** (strategic centerpiece; built last so it sits on a stable content model and profile integration).

One judgment call flagged for Cole: the tutor is the differentiator but also the largest and highest-risk build, which is why it is sequenced last on a stable base. It can be pulled forward to right after branding if you want it as a flagship sooner, at the cost of building it before the content model fully settles.

---

## 2. Cross-cutting architecture and constraints

These govern every track.

**Asset delivery seam (durable).** Lesson assets are delivered only through `get_lesson_block_assets_for_trainee` to `get-lesson-block-asset-urls` to service-role signed URLs. Viewers never call storage directly. Any new asset kind (VO audio, Synthesia video, brand logo) must be modeled as `content_assets` and routed through this seam, with the walker `_walk_block_config_for_asset_refs` extended to enumerate new nested refs.

**Branding model: hex with lesson-level inheritance and per-block override (resolved).**
- Pickers keep the existing brand swatches (full and tinted) as one-click presets, and add a "More colors" affordance that opens a full hex picker, on both the regular and tinted controls.
- A lesson carries a brand object: logo, a small palette, and font choices. Blocks inherit the lesson brand by default. Any block may override a specific color with its own hex.
- This is per-lesson, travels with the lesson, and is NOT a system-level profile. The BrainWise app chrome is unaffected.
- Re-skinning a finished lesson for a new buyer is one edit (swap logo, two or three brand colors, font) and every inheriting block re-themes. Per-block overrides are preserved unless explicitly changed.

**Block parity discipline (standing rule).** Any new block type or any block field touching color/brand/asset must update all parity touchpoints: the AI Edge Functions' allowed-type and schema tables, `transformConfigForCanvas`, `BlockRenderer`, `blockTypeMeta`, the block form, and `lesson-blocks.css`.

**Backend-first.** Every track: Supabase work (migrations, RPCs, RLS, Edge Functions) verified by separate `execute_sql` and a rolled-back functional test before any Lovable prompt. Frontend verified by GitHub SHA after each ship.

**AI authoring surfaces.** New authoring AI gets its own Edge Function rather than retrofitting the lesson co-pilot, per the surface-area rule. Shared concerns (auth, impersonation gate, Markdown to TipTap) stay in shared modules.

---

## 3. Track 1 — Pexels image picking (start here)

**Intent.** Give the lesson AI authoring tool and the author a Pexels image search and insert, reusing the newsletter integration rather than rebuilding it.

**What already exists (reuse, do not rebuild).**
- `newsletter-image-search` Edge Function: super-admin gated, calls Pexels `/v1/search`, returns candidates with photographer name, photographer URL, photo page URL, alt text, and image URLs.
- `PEXELS_API_KEY` already set in Edge Function secrets.
- The `content_assets` pipeline plus the signing seam for lesson assets.
- An image attribution pattern from the newsletter work (attribution as a separate field, auto-populated as "Photo by [name] on Pexels" with links).

**Design choices.**
- Add Pexels search to the lesson `image` block flow and to the AI authoring pane, so both a human author and the AI co-pilot can pick a Pexels image.
- On selection, the chosen Pexels image is ingested into `content_assets` (rehosted, not hot-linked) with `asset_kind='image'`, so it flows through the existing signing seam and survives like any other lesson asset.
- Attribution auto-populates on the image block from the Pexels metadata. Pexels API terms require attribution; the newsletter pattern already handles this shape.
- The AI co-pilot can call the image search and propose images as part of generation; final insert stays in the author's review path (no surprise inserts), consistent with the existing AI authoring flow.

**Backend recon to run before the Lovable prompt.**
- Read `newsletter-image-search` to confirm exact request/response shape and whether it is reusable as-is or needs a thin lesson-context variant.
- Confirm the lesson image ingest path (how a picked external image becomes a `content_assets` row with a ref) mirrors the newsletter rehost path, and whether an Edge Function or RPC already does the rehost-and-insert for lessons.
- Read the AI pane integration point (`ai-pane/`) to see where an image-proposal step would attach.

**Open decisions.**
- Whether to reuse `newsletter-image-search` verbatim or fork a `lesson-image-search` (decide after reading it; reuse preferred).
- Whether the AI proposes images inline during generation or via an explicit "find an image" action (lean explicit action in v1).

---

## 4. Track 2 — Per-lesson branding and white-label (with title card)

**Intent.** Sell lessons off the shelf and re-brand them per buyer quickly.

**Design choices.**
- **Lesson brand object** (new, lesson-level): logo asset, palette (brand color slots), and font selection. Stored with the lesson (the title card needs it anyway). Blocks inherit by default; per-block hex override available.
- **Pickers:** brand swatches (full and tinted) stay as presets; "More colors" opens a hex picker on both. This replaces the locked-palette-only `BrandColorSwatch` behavior with presets-plus-hex.
- **Tint generation:** when a custom hex is chosen on the tinted picker, the tint is generated by mixing the chosen color toward the surface color at a fixed ratio, preserving the soft-card look that the hand-picked tints gave.
- **Fonts:** a few curated additional families on top of the current default, selectable per lesson, injected via the existing `--font-display` / `--font-body` CSS variables. Curated set, not open upload, for loading and quality.
- **Title card (new component):** a lesson cover shown before the lesson starts, containing brand logo, lesson title, short overview, and the table of contents. Doubles as the "sense of place" cover from the visual review. It is the natural home for the lesson brand.
- **Logo:** a new per-lesson asset.
- **Boundary:** branding applies to lesson content only (blocks plus title card). App chrome stays BrainWise.

**AI behavior.**
- Brand details given at the start of the chat: the co-pilot sets the lesson brand object (logo reference, colors, font) and authors blocks that inherit it.
- Re-brand later on request: the co-pilot updates the lesson brand object; inheriting blocks re-theme automatically; per-block overrides stay unless changed.
- Manual fast path already exists: Manage-mode bulk Apply Style.

**Backend.**
- New lesson-brand storage (a column or small table keyed to the lesson `content_item`), holding palette slots, font keys, and the logo `asset_id`.
- `BlockRenderer` and the title card resolve brand at render: per-block override if set, else lesson brand, else BrainWise default.
- Walker extension if the logo and any brand asset must cascade like other lesson assets.

**Open decisions.**
- Logo delivery: public versus signed. Logos are meant to be shown, so public delivery is simpler; signed keeps everything uniform through the seam. Lean public for logos specifically, decide at recon.
- Exact palette slot set (primary, CTA, surface, accent, plus how many free slots). The BrainWise dimension colors and the green-plus-teal pairing rule are BrainWise-specific and simply absent for other brands.
- Storage shape: column on `content_items` versus a `lesson_brands` table (lean small table for clarity and future fields).

---

## 5. Track 3 — Voiceover (ElevenLabs)

**Intent.** Optional human-quality narration the learner can read, listen, or both.

**Design choices (locked with Cole).**
- ElevenLabs, not Descript, for automated per-block VO (direct text-to-speech API, per-character billing, voice by ID). Descript stays available for human-in-the-loop edits if ever needed.
- VO generation is a final pass, never eager. It runs only when the lesson is marked final, so content is frozen before audio is rendered.
- Generation granularity: generate per block, play per section, to match the Model B paged sections.
- Generate-on-publish with a regenerate control, not eager generation everywhere, because billing is per use.
- VO audio is a new asset kind through the signing seam. Transcripts come for free from the source text and satisfy part of the accessibility sweep.
- Learner control: a read / listen / both toggle, which lives in the shell control built in Track 5.

**Backend.** New `vo_audio` asset kind in `content_assets`, walker extension, a generation Edge Function calling ElevenLabs gated on lesson-final, storage of per-block audio refs, and a viewer playback path through the seam.

**Open decisions.** Voice selection model (one brand voice per lesson versus author choice), and whether VO regeneration on a content edit auto-invalidates stale audio.

---

## 6. Track 4 — AI video (Synthesia)

**Intent.** AI presenter video that supports the lesson content, scripted and storyboarded in-platform, then rendered by Synthesia and imported.

**Design choices (locked with Cole).**
- Script and storyboard iterate in the platform first. Only the finalized payload is sent to Synthesia for render and import, keeping the expensive external render at the very end (same discipline as VO).
- Synthesia render is an async job: submit to the videos API, webhook on completion, fetch the time-limited download URL, ingest to Mux (reusing the existing video pipeline), render as a video block. Captions come from Synthesia and satisfy more of the accessibility sweep.
- Script chunking respects Synthesia's per-slide character limit.

**Flag to verify before committing (from the Colossyan recon).** Synthesia reserves SCORM and localization for Enterprise, can apply content moderation review, and restricts some industries. Before building, verify on the API path whether renders bypass human moderation and whether a neuroscience-adjacent use case is permitted. If it bites, Colossyan or HeyGen are training-purpose alternates. This is a verify-first item, not a reversal of the Synthesia choice.

**Backend.** A video-generation job table and status/webhook Edge Function, the Synthesia submit-and-poll/webhook flow, ingest-to-Mux, and the resulting video asset through the existing video path.

**Open decisions.** Avatar/template selection surface, and whether storyboard scenes map to lesson sections one-to-one.

---

## 7. Track 5 — Learner AI tutor (strategic centerpiece)

**Intent.** A learner-facing AI presence grounded in the lesson content and the learner's psychometric profile. This is the moat.

**Design choices.**
- Distinct from the authoring co-pilot: its own Edge Function and system framing, learner-gated, not super-admin.
- Grounded in two sources: retrieval over the current lesson's content (so it answers about the material), and the learner's psychometric profile (PTP/NAI/etc.) so framing, examples, and tone adapt to who the learner is. Competitors ground only in content; the profile layer is the differentiator.
- Uses the existing but currently unwired AI-chat grant system as the entitlement spine (regular users first, then coach-paid and super-admin-invited, per the phased plan already noted).
- Any cited lesson assets flow through the signing seam.
- Lives in the shell as a calm, persistent, premium affordance, not a chat bubble that undercuts credibility.

**Backend.** Wire the AI-chat grant enforcement (currently scaffolded, unwired), a retrieval path over lesson content, profile injection, the learner-gated Edge Function, and audit. This is the largest backend track.

**Open decisions.** Retrieval approach (whole-lesson context versus chunked retrieval), how much profile detail to inject and with what guardrails, and the exact entitlement phasing.

---

## 8. Track 6 — Visual shell enhancements

**Intent.** Fix the flat-shell problem from the visual review. The blocks are good; the journey wrapper is utilitarian.

**Design choices (dynamic with restraint).**
- **Lesson-level progress visualization** in the shell: a segmented section stepper or slim progress rail showing where the learner is in the lesson. Highest-leverage engagement lever and currently absent from `ContentItemViewer`.
- **Section transitions:** a short, smooth transition between paged sections instead of instant swaps. Highest impact per unit effort.
- **Reward cadence:** small, tasteful acknowledgments at section completion and gated-block clearance, not only the end-of-item/module/curriculum modal. No arcade confetti.
- **Lesson cover / title card:** shared with Track 2; gives each lesson identity and a sense of arrival.
- **Expressive section framing within the brand:** tinted section bands, subtle depth and layering, accent use of the palette, all inside the locked system so it reads premium not loud.
- **Multimodal control:** the read / listen / both toggle (from VO) and any video presence surfaced as a clear shell control.

**Backend.** Mostly frontend. Progress stepper reads existing section/visited state. Reward cadence reads existing per-block and per-section completion.

**Forward-looking add (later sub-phase):** profile-adaptive pacing that ties back to Track 7, once objective tagging exists.

---

## 9. Cross-cutting upgrades worth folding in (from the competitive recon)

- **Lesson-grounded, dedup-aware quiz generation.** Ground `knowledge_check` and future quiz AI generation in the actual lesson content, avoiding duplicates, the way LearningStudioAI does. Cheap upgrade to existing AI authoring.
- **Learning-objective tagging.** Tag blocks and questions to learning objectives (Easygenerator's discipline). Powers analytics and later profile-adaptive pacing.
- **Accessibility automation.** AI alt text, captions, transcripts. VO yields transcripts; Synthesia yields captions; alt text generation is a small add. Reaches parity cheaply.
- **Dynamic / hosted export note for the future SCORM item.** A static SCORM export kills the tutor and profile adaptation on leaving the platform. When SCORM is built, prefer a hosted or dynamic export so those stay alive. Recorded here so the SCORM scope inherits it.

---

## 10. Explicitly deferred / out of scope

- **SCORM export and import (backlog Item 2).** Deferred until the content model settles (after these tracks), because new asset kinds change what the exporter must package. Target both SCORM 1.2 (max compatibility) and 2004 (modern), reuse `BlockRenderer`, convert-not-embed import, Articulate-grade bar. Fold in the dynamic/hosted export note above.
- **Lesson-block tracking API (backlog Item 3).** Moves with SCORM, since its main consumer is a hosted SCORM runtime. The org_id-stamped attempt write-path can land independently if attribution is needed sooner.
- **AI image generation.** Deferred; Pexels plus Synthesia cover visual needs.
- **Storyline-style freeform authoring.** Out of scope by strategic choice.

---

## 11. Open decisions to lock (consolidated)

- Track 1: reuse `newsletter-image-search` verbatim versus fork; AI inline-propose versus explicit action.
- Track 2: logo public versus signed; palette slot set; brand storage as column versus `lesson_brands` table.
- Track 3: per-lesson voice versus author choice; stale-audio auto-invalidate on edit.
- Track 4: Synthesia API moderation/industry verify; avatar/template surface; scene-to-section mapping.
- Track 5: retrieval approach; profile-injection depth and guardrails; entitlement phasing.
- Track 6: stepper style; transition style; reward treatments.

---

## 12. Immediate next action

Begin Track 1 (Pexels) with the backend recon: read `newsletter-image-search`, confirm the lesson image rehost-and-ingest path, and read the AI-pane integration point. Then write the single Lovable prompt for the lesson image picker and AI image proposal, backend verified first per protocol.
