# Scope: Frontend Hardening — CoachingActivityRunner

*Purpose: shrink and speed up the coaching runner without changing behavior. Written for staged execution in Lovable, one stage at a time, verifying between. This touches the LIVE runner every coaching activity depends on, so it is treated with publish-and-verify discipline.*

## The situation (grounded in the live code)

`src/pages/coaching/CoachingActivityRunner.tsx` is ~3,690 lines. It holds ~17 interactive widget wrappers plus the orchestration component. Measured facts: **45 `useState`, 4 `useMemo`, 8 `useCallback`, 0 `React.memo`, 0 `React.lazy`.** The presentational views are already split out into `CoachingViews.tsx` (SynthesisView, AiAnalysisPanel, CoachingRecordingPlayer, IkigaiRegionsView, InnerTeamCircleView, etc.), so this work is only about the runner file.

The runner already renders **only the current step's widget** (`const step = steps[currentStep]`), so it is NOT rendering every widget at once.

## Two distinct problems (do not conflate)

1. **Runtime "slow to react"** — a re-render problem. Every keystroke updates one big `responses` object and re-renders the runner; nothing is memoized. Fix = render hygiene (memo / useCallback / narrow props / lazy). Splitting files does not fix this by itself.
2. **"Full of code" / slow + costly to edit in Lovable** — a maintainability problem. A 3,690-line file makes Lovable slow, expensive, and error-prone (it re-reads the whole file per edit). Fix = split widgets into files. This is unambiguously worth doing and is low-risk.

## Reassurance worth stating plainly

Activities are **data, not code.** The four activities shipped in Session 171 (0475, 0503, 0505, 0545) added ZERO lines to this file (only 0505 needed a backend analyzer change). The runner grows only when a genuinely new widget *type* is introduced, which is now rare. So the page does not bloat as the activity catalog is finished. Do NOT build a separate page per activity — the config-driven runner is exactly what lets activities ship as DB rows. Keep it.

## Guardrails

- One stage at a time. After each: open the Lovable preview, click through **Your PTP (0420), Your team (0450), Recent past (0503), Major influencers (0505)**, type in text fields, run one AI analysis, and check the browser console for errors. Only then proceed.
- Behavior-preserving unless a stage explicitly says otherwise. No prompt/label/logic changes except the one label fix noted at the end.
- Commit after each green stage so any regression is easy to bisect.

---

## Stage 0 — Diagnose the lag FIRST (before any perf change)

In the live app, open React DevTools → Profiler. Record while (a) typing into a `qa_multimodal` field and (b) filling the influencers detail cards. Read off: which components re-render per keystroke, and their render durations. This tells us whether the fix is memoization, prop-narrowing, state isolation, or a heavy always-mounted component. **Do not write a perf prompt until this is known** — otherwise we are guessing.

Capture the worst offender(s) and bring them back; the Track B prompts below are then chosen to match.

---

## Track A — File split (safe, mechanical, do regardless of Stage 0)

Shrinks the file immediately → faster/cheaper Lovable edits. Behavior-preserving.

### Stage A1 — Create the shared module (do this first)

**Lovable prompt:**
> In `src/pages/coaching/`, create a new file `runner/shared.tsx`. MOVE the following from `CoachingActivityRunner.tsx` into it VERBATIM (no logic changes) and `export` each: the interface/type declarations `Step`, `Activity`, `Negative`, `ChatMsg`, `Responses`, `Session`, `SelectedSaying`, `SelectedImage`, `LibraryImage`, `SayingRow`, `QaAnswer`, `AssessmentFileType`, `AssessmentUploadRow`; the helper functions `buildUserPatch`, `useDebouncedSave`, `imgUrl`, `humanizeBand`, `inferFileType`, `extForFile`; and any small internal component used by more than one widget (e.g. the multimodal input field and any local recording control) — search the file for shared usage before moving. Re-export nothing that already lives in `CoachingViews.tsx`. Then update `CoachingActivityRunner.tsx` to import these from `./runner/shared`. Do not change any behavior. Build must pass and all coaching activities must render exactly as before.

Verify (guardrail checklist), commit.

### Stage A2–A4 — Move widgets into files, in batches

Each widget → `src/pages/coaching/runner/widgets/<Name>.tsx`, importing shared items from `../shared` and views from `@/components/coaching/CoachingViews`. Re-import into the runner. VERBATIM, no logic change. Do one batch per prompt, verify between.

- **A2 (heavy/self-contained):** `PtpDisplayWidget`, `AssessmentUploadWidget`, `IkigaiWidget` (+ `IkigaiItemCard`), `InnerTeamWidget` (+ `InnerTeamCharacterCard`).
- **A3 (selection/media):** `ImageSelectWidget`, `TextSelectWidget`, `ImageDescribeWidget`, `RecapWidget`.
- **A4 (core/text):** `TextareaWidget`, `ListBuilderWidget`, `RiskBlocksWidget`, `ChatWidget`, `PrioritizePanel`, `SuggestionPanel`, `ContentWidget`, `QaMultimodalWidget`.

**Batch prompt template:**
> Move these components VERBATIM out of `CoachingActivityRunner.tsx`, each into its own file under `src/pages/coaching/runner/widgets/`: [list]. Export each as a named export. They should import shared types/helpers from `../shared` and any presentational views from `@/components/coaching/CoachingViews`. Import them back into `CoachingActivityRunner.tsx`. Change NO logic, JSX, props, or strings. The build must pass and every coaching activity must behave identically.

After A4 the runner is a thin orchestration shell (~600–900 lines).

---

## Track B — Reactivity fixes (choose per Stage 0 profile)

Apply only what the profiler implicated. Likely, in order of value/safety:

- **B1 — Stabilize handlers.** Wrap the `onChange`/callback props the runner passes to the current widget in `useCallback`, and pass narrow slices of `responses` (e.g. `responses.negatives`) rather than the whole object where practical.
- **B2 — Memoize widgets.** Wrap each widget export in `React.memo`. Combined with B1, a widget then re-renders only when its own inputs change.
- **B3 — Memoize always-mounted chrome.** If the profiler shows the step header / progress / briefing re-rendering per keystroke, extract and `React.memo` it.
- **B4 — Local input state (only if lag persists).** Give text widgets local state for the in-progress value, propagating to `responses` on blur or debounced. Highest risk (save/stale-data bugs) — do last, verify hard.

Each B stage: one prompt, then the full guardrail click-through + a real AI analysis to confirm saves still work.

---

## Track C — Lazy-load heavy widgets (after Track A)

**Lovable prompt:**
> In `CoachingActivityRunner.tsx`, convert the imports of the heavy widgets — `PtpDisplayWidget`, `AssessmentUploadWidget`, `IkigaiWidget`, `InnerTeamWidget`, `ImageSelectWidget`, `TextSelectWidget` — to `React.lazy(() => import(...))` and wrap the widget-dispatch area in a single `<Suspense fallback={<Loader2 className="h-4 w-4 animate-spin" />}>`. Leave the light widgets (content, qa_multimodal, ai_panel, textarea, list_builder, risk_blocks, chat) as normal imports. No behavior change beyond a brief spinner when a heavy step first mounts.

---

## Label fix (fold into A4, or run standalone)

> In `CoachingActivityRunner.tsx`, inside `RiskBlocksWidget`, the collect-mode label is hardcoded `Add a risk`. Change `<p className="text-xs font-medium text-muted-foreground">Add a risk</p>` to `<p className="text-xs font-medium text-muted-foreground">{step.addLabel || "Add a risk"}</p>`, and add optional `addLabel?: string;` to the `Step` type. No other change.

**STATUS: applied on the frontend in a prior turn.** The DB side is also done (0505's collect step has `addLabel: "Add a person"`). Action item: after the A4 widget move, verify this `{step.addLabel || "Add a risk"}` line is still present in the relocated `RiskBlocksWidget` and that `addLabel?` remains on the `Step` type.

---

---

## Feature Stage F1 — single-select subfield in `risk_blocks` (unblocks forced-choice pickers)

Adds a reusable capability: a `risk_blocks` detail subfield can render as a single-select (radio / segmented control) instead of the free-text multimodal field. Needed by Resolve/0820 "Decisions Already Made" (the four Dixon stages), and reusable for any future per-item categorical field. **Do this after Track A (on the already-split `RiskBlocksWidget.tsx`).** No backend change — analyzer v14 serializes the picked string as-is.

**Lovable prompt:**
> In `RiskBlocksWidget` (subfield-editing mode), each subfield currently renders a `MultimodalField`. Add branching: if `step.subfieldTypes?.[sf] === "select"` and `step.subfieldOptions?.[sf]` is a non-empty string array, render a single-select control instead — a row of selectable options (radio buttons or a segmented control) whose selected value is the option string, written to `next[i][sf]` on change, styled consistently with the app. Otherwise render the `MultimodalField` exactly as today. Add optional `subfieldTypes?: Record<string,string>` and `subfieldOptions?: Record<string,string[]>` to the `Step` type. `canAdvance` already treats a non-empty subfield value as filled, so no change there. Behavior-preserving for every existing `risk_blocks` step (none set `subfieldTypes`).

**Graceful degrade:** 0820 ships with `subfieldTypes.stage = "select"` already in its definition. Before F1 ships, the frontend ignores it and renders guided free-text (the four stages are listed in the subfield helper). After F1 ships, the same field becomes the picker automatically — no change to 0820 needed.

**Verify F1:** open Resolve/0820, confirm the "where you are in the process" field shows the four options as a picker; confirm existing risk_blocks activities (`clarity-engine`, `pitch-engine` drafts, and any live one) still render their subfields as free text.

---

## Recommended order

**Stage 0 (profile) → A1 → A2 → A3 → A4 (+ label fix) → F1 (picker) → B1/B2 (per profile) → C → B3/B4 only if still laggy.**

Track A alone (the split) delivers the biggest immediate win for Lovable velocity and cost, and is safe. Do it even if the runtime lag turns out minor. Treat Track B strictly on the evidence from Stage 0.
