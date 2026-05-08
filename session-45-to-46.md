# BrainWise Session 45 to 46 Handoff

*Closeout: Session 45. Open: Session 46.*

## Where Session 45 left off

A productive multi-track session. Three full deliverables shipped end-to-end (AIRSA dashboard PDF export, AIRSA AI workforce narrative voice rewrite, risk-flag color fix) plus the NAI PDF generator extraction (Option A foundation work) plus two rendering bug fixes. Comprehensive scope doc produced for the Org Overview Dashboard + AIRSA cross-instrument extensions, parked at `/mnt/user-data/outputs/org-overview-and-airsa-cross-instrument-scope.md` for execution in a future session.

Cole's call at session close: pivot Session 46 to "another section of work that is more important" than the Overview / cross-instrument scope. The scope doc is shelf-ready — upload at session open, the receiving session executes Phase 1 → Phase 4. Session 46 can target whatever Cole prioritizes next.

## Session 45 accomplishments

### Sub-task 1 SHIPPED — Risk-flag color fix

Cole chose Option B (over Option A): HIGH = solid `ORANGE` chrome with white badge text + ORANGE borderLeft preserved; WARN = `#fef0e7` peach fill + `ORANGE` 4px borderLeft + ORANGE badge text on tint. Three single-character edits in `AirsaDashboard.tsx` lines 750-776. Visual verification confirmed in screenshots.

### Sub-task 3 SHIPPED — AIRSA org dashboard PDF export

New file `src/lib/generateAIRSADashboardPdf.ts` (~1276 lines after Lovable). Single coordinated build via Prompt 2.

PTP-pattern mirror with AIRSA-specific helpers ported from existing `src/lib/generateAirsaPdf.ts` (the individual combined-report generator):
- `cleanMarkdown()` strips `**bold**` / `*italic*` markers
- ASCII glyph substitutions per arch-ref §5.6 rule 1: `TOP_GROWTH_GLYPH = "^"` for ▲, `TOP_STRENGTH_GLYPH = "+"` for ◆
- `sectionHeading(title, minContentNeeded)` anti-orphan pattern per §5.6 rule 3
- Page geometry: PAGE_W=210, MARGIN_L/R=15, MARGIN_T=20, MARGIN_B=25, CONTENT_W=180

Sections delivered:
- Cover: NAVY hero band, 4-card metric strip (TCI / Alignment / Blind spot / Underestimate)
- Overview: AI Workforce Calibration Summary card + always-expanded narrative + 2 ranking panels (Greatest Growth / Strengths) + Calibration Map + risk flags
- Domains: 8 cards stacked-bar with confirmed_strength / other / blind_spot / underestimate segments
- Skill Inventory: 24-row table, columns sum to 180mm
- Manager Calibration: top 5 / bottom 5 cards
- Trends: TCI history table only (no cross-instrument placeholder in PDF — only on-screen)

Calibration Map implementation: 60mm skill column + dept columns at `(180-60)/N` mm, max 8 columns with overflow note, 5mm cell height, dashed border on blind_spot cells via `setLineDashPattern([1.5,1.5])` then reset.

Filename: `BrainWise-AIRSA-CompanyDashboard-YYYY-MM-DD.pdf`. Modal mirrors PTP exactly with section export checkboxes.

### NAI PDF generator extracted (Option A foundation)

New file `src/lib/generateNAIDashboardPdf.ts` mirrors `generatePTPDashboardPdf.ts` structure. Replaced ~890-line inline jsPDF block in `CompanyDashboard.tsx` lines 753-1644 with imported function call.

Decisions locked in this build:
- camelCase keys for `NAIDashboardPdfSections` (overview, dimensions, interpretation, leaderPerspective, trends, interventions, crossInstrument)
- Full PTP modal mirror dropping "No data yet" indicators
- 360px width modal, single h2 title
- Surfaced previously-dead `interventions` section that was gated on a key never set under old kebab-case state

This is foundation work for future symmetric refactor of NAI to fully match the PTP pattern. The PDF extraction was Prompt 1 of the session.

### AIRSA AI narrative voice rewrite — `generate-airsa-org-narrative` v2 deployed

Verification before writing the new prompt: queried `airsa_skills` table — 24 skills, 13-37 chars (avg 21). Confirmed dropping skill numbers from prose makes text lighter, not heavier. Frontend hover/Calibration Map/Skill Inventory still use skill numbers from data — they're for visual lookup, not prose.

New prompt structure:
- AUDIENCE block: write for CPO/VP HR, plain English, action-oriented
- VOCABULARY RULES table mapping internal terms (cps_growth, blind_spot, underestimate, confirmed_strength, confirmed_gap, aligned-Proficient) to plain-English substitutes
- BANNED words/phrases expanded (concentrate, underpin, compound, destabilising, "the symmetry of", "the data tells us")
- Section structures enforced: business_meaning/benefits/risks = lead paragraph + 2-3 hyphen bullets + closing paragraph; next_steps = numbered sequence (no opener/closer); risk_flags detail = "What this means:" paragraph + "What to do:" hyphen bullet block
- Skill numbers banned from prose; skill names only
- TCI introduced as "Talent Calibration Index (TCI)" first, then TCI thereafter

Edge function source saved at `/home/claude/edge-functions/generate-airsa-org-narrative/index.ts` (with `_shared/secrets.ts` and `_shared/errors.ts` siblings). Cole regenerated test org narrative — voice "is great" per direct feedback. AI narrative tone now confirmed as canonical voice template for the broader Action-Oriented Voice Redesign work in the queue.

### Two rendering bugs fixed (Prompts 3 + 4) — both shipped first try

**Prompt 3** — `bodyText` helper in `generateAIRSADashboardPdf.ts`. Two fixes combined:

1. **Font-state leak.** `renderContinuationHeader` set 10pt italic for the "(cont.)" label and reset weight to normal but did NOT reset font size. Control returned to `bodyText`'s loop which called `doc.text(line, ...)` directly without re-applying font state. Lines were split for 8.5pt width via `splitTextToSize` but rendered at 10pt, overflowing the right margin. Visible on page 3 of the first AIRSA dashboard PDF export with clipped words ("Ethical and Re", "Information and Resource Management fo"). Fix: re-apply `setFontSize(8.5)`, `setFont("helvetica", "normal")`, `setText(BLACK)` inside the for-loop AFTER `checkPageBreak()` and BEFORE `doc.text()`.

2. **Bullet rendering.** Split text on `\n` first; detect lines matching `/^[-*]\s+(.+)$/` (bullets) or `/^(\d+\.)\s+(.+)$/` (numbered); render with 4mm hanging indent + 1mm extra spacing before each list item; wrapped continuation lines indent past the prefix.

**Prompt 4** — `renderNarrativeText(text, fontSize, color)` helper inside `AirsaDashboard.tsx`. Splits on `\n`, classifies each line, buffers prose into `<p>`, renders bullets as flex rows with `paddingLeft: 16, marginBottom: 4`, numbered items with hanging-indent flex layout. Replaced 7 render points (summary card + 5 expanded narrative subsections + risk flag detail).

Send order was Prompt 4 first (frontend, instant verification), Prompt 3 second (PDF re-export). Cole confirmed "both landed perfectly".

### Sub-task 2 PIVOTED — comprehensive scope doc produced for future session

Original Sub-task 2 was "Phase 7 cross-instrument wiring + test fixture seeding". Full recon completed:

- **Test fixture overlap verified excellent** (no seeding needed): 44 PTP+AIRSA users, 34 NAI+AIRSA users, 32 all-three. All well above n≥5 suppression threshold. **Sub-task 2b dropped entirely from queue.**
- **`org_cross_instrument_recommendations` schema already instrument-agnostic** (per arch-ref §10.6). No migration needed.
- **`trigger_logic` table inventory**: 11 rules total. INST-003 source has only 1 generic rule (TRG-011 — AIRSA self-vs-manager divergence ≥ 2 levels → DIM-NAI-04). Existing v7 Edge Function does NOT read from trigger_logic — uses hardcoded `CO_ELEVATION_MAPPINGS` array (7 NAI↔PTP pairings from Oxford Brain Institute C.A.F.E.S.→PTP framework).
- **v7 Edge Function source review**: hardcoded reject `if (!["INST-001", "INST-002"].includes(primary_instrument_id)) throw`. Two prompt builders both NAI↔PTP focused. Reads dimension_scores assuming NAI/PTP shape; AIRSA's shape (TCI, alignment_rate, status_distribution, manager_calibration) fundamentally different.

Mid-session Cole shifted scope to a bigger and more strategic question: build BOTH the per-dashboard AIRSA cross-instrument AND a new Org Overview dashboard. Three-way analysis (NAI×PTP×AIRSA) lives ONLY on Overview. Per-dashboard tabs stay 1×1 pairings. **B2 path locked**: use trigger_logic as actual source of truth (vs B1 which would hardcode mappings in code mirroring v7).

Comprehensive scope document produced at `/mnt/user-data/outputs/org-overview-and-airsa-cross-instrument-scope.md` (~720 lines, 4 phases):

- **Phase 1**: trigger_logic seed (~12 new rules covering AIRSA→NAI, AIRSA→PTP, NAI→AIRSA reverse, plus PTP→AIRSA Protection-domain). Pure SQL, no code deploy.
- **Phase 2**: New Edge Function `generate-airsa-cross-instrument-recommendations` reading from trigger_logic. Two prompt variants (AIRSA×NAI, AIRSA×PTP). Hybrid Class A/B auth mirroring `generate-airsa-org-narrative` v2 pattern.
- **Phase 3**: New Org Overview dashboard at `/company/overview` with 6 headline numbers (2 per instrument), synthesis narrative, 3-5 cross-cutting actions, deep-dive links. New table `org_overview_narratives` with RLS. New synthesis Edge Function `generate-overview-narrative`. PDF export. Default landing for `org_admin` and `company_admin` redirects to Overview.
- **Phase 4**: Wire AIRSA cross-instrument cards on AIRSA dashboard's Trends tab + add ×AIRSA sub-tabs to PTP and NAI dashboards via shared `CrossInstrumentCard` component.

Estimated 3-5 sessions to execute in full. Doc is upload-ready as a session-opener.

### Architecture additions in Session 45

Three new constraints in arch-ref §8 (full text in arch-ref):
1. jsPDF font-state must be re-applied on EVERY `doc.text()` call inside a multi-line wrapped-text loop, not just before `splitTextToSize`. The previous §5.6 rule 2 only addressed measurement, not the render-side leak through `renderContinuationHeader`.
2. Frontend bullet rendering for AI-emitted hyphen-prefixed lines requires explicit string-split + line-classification rendering. `whiteSpace: pre-wrap` preserves newlines but provides zero visual hierarchy. Pattern locked in `renderNarrativeText` helper, portable across dashboards.
3. When rewriting an AI generator's prompt to drop ID prefixes from prose, pre-verify name string lengths first. Skill names at 13-37 chars are short enough to drop "Skill N." prefix; longer names may require keeping the prefix.
4. `org_cross_instrument_recommendations` schema is verified instrument-agnostic — no migration needed for AIRSA cross-instrument or future Overview synthesis.

### Two known issues NOT in scope for Session 45 fix

**`generatePTPDashboardPdf.ts` likely has the same `bodyText` font-state leak as AIRSA had pre-Prompt 3.** The pattern was lifted from there originally, so the latent bug almost certainly exists in production PTP exports. Logged as future work — not affecting users obviously yet, but worth fixing when convenient. Easy verification: pull the PTP dashboard PDF generator file, search for the `bodyText` helper, check whether it re-applies font state inside the loop.

**The same Action-Oriented Voice rewrite needs to be applied to NAI and PTP** narrative generators (`generate-dashboard-narrative` v22, `generate-facet-interpretations` v23, `generate-nai-delta-narrative` v10, `generate-ptp-delta-narrative` v7). The AIRSA work was a one-instrument case study; the broader voice redesign is in the queue.

## Session 46 opening priorities

Cole flagged Session 46 will pivot to "another section of work that is more important" than the Overview / cross-instrument scope. Three candidate tracks listed in the build queue:

### Candidate 1: Action-Oriented Voice Redesign across NAI + PTP surfaces

Replace neuropsychology consulting prose with action-oriented language across NAI dashboard UI/PDF, PTP dashboard UI/PDF, NAI individual results UI/PDF, PTP individual results UI/PDF. The AIRSA voice work in Session 45 (`generate-airsa-org-narrative` v2 prompt) is the canonical voice template — apply same VOCABULARY RULES table, BANNED words/phrases, SECTION STRUCTURES discipline.

Sequencing dependency: Voice Redesign should ship BEFORE the Org Overview build, otherwise the Overview will surface NAI/PTP narratives in the old clinical voice while AIRSA shows the new voice — inconsistent.

Affected Edge Functions:
- generate-dashboard-narrative v22 (NAI + PTP org)
- generate-facet-interpretations v23 (NAI + PTP individual)
- generate-nai-delta-narrative v10
- generate-ptp-delta-narrative v7

Frontend dashboards may also need `renderNarrativeText` helper added if NAI/PTP use the same `whiteSpace: pre-wrap` pattern AIRSA had pre-Session 45 — recon at session open.

### Candidate 2: Org Overview Dashboard + AIRSA cross-instrument

Full scope at `/mnt/user-data/outputs/org-overview-and-airsa-cross-instrument-scope.md`. 4 phases, 3-5 sessions estimated. Recommended after Voice Redesign completes.

### Candidate 3: Other priority Cole identifies at session open

Cole hinted at "another section of work that is more important" — open question what that is. Could be marketing site work, validation pathway, customer-facing content, or something else entirely. Awaiting direction.

## Decisions locked in Session 45

- **Risk flag color treatment** (Sub-task 1): HIGH = solid ORANGE chrome with white badge text; WARN = peach `#fef0e7` fill with ORANGE 4px borderLeft and ORANGE badge text. NO red anywhere on AIRSA dashboard. Visual differentiation is via fill saturation, not hue.
- **AIRSA dashboard PDF section structure**: Cover + Overview + Domains + Skill Inventory + Manager Calibration + Trends. NO cross-instrument section in PDF (only on-screen Trends tab carries the placeholder cards). Section export checkboxes mirror PTP's pattern.
- **AI voice canonical template**: `generate-airsa-org-narrative` v2 prompt structure is the locked template. Future voice work on NAI/PTP narratives applies same vocabulary translation table + section structures + numbered/bulleted formatting + writing discipline rules.
- **Cross-instrument architecture path**: B2 (use trigger_logic as actual source of truth) over B1 (hardcode mappings in new function code). Future-proofs the cross-instrument layer.
- **Three-way pairing scope**: NAI×PTP×AIRSA three-way analysis lives ONLY on the Org Overview dashboard. Per-dashboard cross-instrument tabs stay 1×1 (PTP×NAI exists; PTP×AIRSA, NAI×AIRSA to be added).
- **Org Overview headline numbers**: 2 per instrument, 6 total. NAI = AI Readiness Index + AI Adoption rate. PTP = TRI + RSI. AIRSA = TCI + Alignment Rate. Open question on AI Adoption metric source carried forward in scope doc.
- **Default landing**: org_admin and company_admin land on `/company/overview` (when built), not `/company/nai-dashboard`. super_admin keeps current behavior.
- **Test fixture seeding (Sub-task 2b) dropped**: 44 PTP+AIRSA, 34 NAI+AIRSA, 32 all-three users — sufficient overlap, no seeding needed. Item removed from queue.

## Open questions for Session 46

If Voice Redesign is chosen for Session 46:
- Should NAI/PTP individual report generators (`generate-facet-interpretations`) get same voice treatment as org-level generators, or stay in current voice for v1?
- Are there frontend rendering changes needed on PTP and NAI dashboards (similar to the Session 45 `renderNarrativeText` add on AIRSA)? Recon at session open.
- Should the consolidated voice work ship as one session (4 functions, batched prompts) or split into per-function sessions for safer regression management?

If Org Overview is chosen for Session 46:
- The five open questions documented at the bottom of the scope doc carry forward verbatim.

## What's NOT in scope for Session 46

- AIRSA dual-rater Phases 3c-8 (manager-rater flow, results pages, cross-instrument analysis at individual level) — still in queue but not Session 46 priority
- Corporate contract renewal schema change (POST-LAUNCH)
- Pricing-reads refactor (POST-LAUNCH)
- Clarity Engine (deferred until Resources pages built)
- Three-wave validation pathway work (Q3 2026 onward)
- NAI/PTP latent slice-control bug fixes (POST-LAUNCH per Session 44 decision)
- `generatePTPDashboardPdf.ts` likely-latent font-state leak (logged but not promoted to immediate fix)

## Test fixture state at end of Session 45

47 AIRSA pairs in BrainWise Test Corp, unchanged from Session 44 close. Org-wide TCI = 40.1.

Multi-instrument completion overlap (verified Session 45):
- 55 unique users with completed PTP (INST-001)
- 39 unique users with completed NAI (INST-002)
- 53 unique users with AIRSA (INST-003) self-rater data, 95 total assessments (47 self + ~48 manager pairs)
- **44 users with both PTP and AIRSA**
- **34 users with both NAI and AIRSA**
- **32 users with all three instruments**

All overlaps well above n≥5 threshold. Cross-instrument analysis can light up immediately on this fixture without seeding.

Department counts (carried from Session 44):
- Executive: 5 users, 0 with AIRSA
- Engineering: 19 users, 18 with AIRSA
- Finance: 14 users, 14 with AIRSA
- Marketing: 16 users, 15 with AIRSA

Edge Function versions current at Session 45 close:
- `generate-airsa-org-narrative` v2 (deployed Session 45)
- `generate-cross-instrument-recommendations` v7 (unchanged; will need refactor for B2 path when Cole executes the cross-instrument scope)
- All other functions unchanged from Session 44 close

When Session 46 begins, look up current state via Supabase rather than relying on values written here.

## Documents this session leaves behind

- build-queue.md v37 (uploaded to GitHub repo at session close)
- architecture-reference.md v39 (uploaded to GitHub repo at session close)
- session-45-to-46.md (this document, uploaded to GitHub repo at session close)
- org-overview-and-airsa-cross-instrument-scope.md (parked at `/mnt/user-data/outputs/`, upload to project knowledge or to GitHub if Cole prefers — this is a session-opener for whenever the cross-instrument work gets prioritized)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs.
