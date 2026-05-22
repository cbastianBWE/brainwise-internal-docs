# BrainWise Competitor Recon — Learning-Admin, Content-Authoring, Learner-Side Surfaces

*Session 87 recon, ahead of Round 4 design decisions.*

## Why this doc exists

Cole flagged the current Completion Control tab as "clunky and not comprehensive enough." Round 4 was scoped as polish-only (audit + fix per-finding); pausing that to do design-level recon first so polish work targets the right design, not a wrong one. Same pause applies to learning-admin tooling broadly, content authoring's pending Rise-builder extraction, and any open learner-side UI questions.

This is observation, not prescription. Decisions land after Cole reviews.

## Competitor inventory

| Tier | Competitor | Why they matter |
|------|------------|-----------------|
| Enterprise | **Cornerstone OnDemand** (Galaxy) | Compliance-heavy industries, talent-suite integration; market reference for "robust admin tooling" |
| Enterprise | **Docebo** | AI-first; April 2026 just shipped a "fully redesigned admin navigation"; market sets the pace |
| Enterprise | **SAP SuccessFactors Learning** | Tightly integrated with SAP HCM; "Add Learning History" is the canonical admin override model |
| Enterprise | **Absorb LMS** | Reports-first admin model with refreshed Admin Experience (AE); explicit drill-down pattern |
| Mid-market | **LearnUpon** | Coaching-focused; manager dashboard pattern; Slack-like sidebar collapse |
| Mid-market | **TalentLMS** | SMB-friendly; free tier; simple admin model |
| Mid-market | **360Learning** | Collaborative-learning angle; custom-dashboard-as-entry-point; "click a learner's name" drill-down |
| Mid-market | **LearnUpon / Workleap / Bridge / Litmos / iSpring Learn** | Various flavors of mid-market |
| Modern admin | **Linear** | Three-role model (Admin/Member/Guest); single Members page; role dropdown per row |
| Modern admin | **Notion** | Permission groups; workspace owner / member / guest / bot; role change inline |
| Modern admin | **shadcn/ui + Next.js patterns** | Sidebar + data-table + drawer; the BrainWise stack lives in this idiom |
| Coach-cert direct | **iPEC** | Closest direct analog; LMS gated, no public screenshots |
| Content authoring | **Articulate Rise 360** | Block-based, "create once publish anywhere," AI Assistant; current industry benchmark |
| Content authoring | **Articulate Storyline 360** | Slide-based, custom interactions; Rise's heavyweight sibling |
| Content authoring | **Cornerstone Create / Docebo Author / iSpring Suite / Elucidat** | LMS-native authors |

---

## Surface 1: Learning-admin tooling

### Completion override / manual completion

What competitors do:

- **Docebo** — Per-training-material status icon dropdown inside the course-management view. Click status icon → dropdown → "Completed" → save. No reason field captured by default. Forward cascade course → learning-plan happens automatically. Reverse is not standard (irreversible by default on learning-plan tier). One-at-a-time per material.
- **Adobe Learning Manager** — Course-up navigation: `Course → Learners → Select instance → Search user → Actions → Mark Completion`. Supports user-group bulk variant. Per the docs: "Once marked completed, the completion cannot be reversed." Reverse is not exposed.
- **SAP SuccessFactors** — Admin model is "Add Learning History" — adding a completion record to the learner's transcript per-course. Bulk variant via CSV import. Course-tier only; not item-level override.
- **Cornerstone** — Transcript-based override via the user's transcript view. Mark complete from the transcript record itself. Reason field required for many actions. Audit log mandatory.
- **Absorb LMS** — Reports-first: open `Users Report` → select user → `Views Enrollments` action (right side panel) → `Edit Enrollment` → update Completion Status. Or open `Course Activity Report` → select user row → Actions menu → similar. The admin enters through a *report*, not a dedicated tool.
- **LearnUpon** — Similar to Absorb. Enrollment-as-record; admin modifies enrollment state.
- **360Learning** — "Click a learner's name to view their enrollment details and see how they're progressing." Path session statistics page is the entry; status changes happen contextually inside the detail view.

Patterns that emerge:

1. **Reports / data tables as the primary entry, not a dedicated "Completion Control" tab.** Every modern LMS treats completion override as a *capability* surfaced from multiple entry points (course-centric reports, user-centric reports, department reports, transcripts), not as its own destination. BrainWise's "Completion Control" tab is a structural outlier.
2. **Actions menu via row selection.** Select row(s) → right-side panel slides out → Actions list including Edit Enrollment / Mark Complete / Send Message / etc. Multi-select unlocks bulk actions.
3. **Course-up navigation is more common than user-up.** Most flows assume the admin is investigating "who's done this course" rather than "what has this user done." User-up exists but is secondary.
4. **Reason capture is uneven.** Cornerstone requires it (audit-heavy); Docebo skips it; SuccessFactors mostly skips it (records as part of the transcript event). BrainWise's mandatory 10-char reason is on the strict end.
5. **Reverse-cascade is rare.** Most LMS treat completion as forward-only; reverse is "edit the enrollment record" and the cascade-up implications are usually ignored. BrainWise's explicit reverse-with-cert-block protection (`manual_incomplete_blocked_certified_cert_path`) is sophisticated relative to industry norm.
6. **Drill-down via row click into detail drawer or sub-page is universal.** Everyone supports it; the design varies between drawer (modern shadcn-style), modal, or full-page navigation. Drawer is dominant in 2025/2026 designs (per Pencil & Paper enterprise table UX article: "the most scalable option for this situation is the sidebar… can be triggered by clicking the whole row, a 'View More' link or a 3-dot menu icon").

### Role assignment (mentor / instructor / etc.)

What competitors do:

- **Linear / Notion** — Single `Members` page; click member row → role dropdown changes role inline. No "Assign X Role" tab per role type.
- **Cornerstone** — Roles managed in `Admin → Tools → Core Functions → Users`; roles are bundled with domains; one user-management surface, role assignment is one column.
- **Docebo** — Role assignment via user edit (`Admin Menu → Users → click user → Roles tab`). Role list is a multi-select.
- **SAP SuccessFactors** — Roles managed via Role tile in user profile; bulk assignment via assignment profiles (rule-based).
- **LearnUpon** — User Types & Permissions: edit a user → user type → role dropdown.
- **360Learning** — User edit panel; roles as tabs of permission sets.

Patterns:

1. **Roles live on the user record, not in a separate tab per role.** The dominant pattern is `Users page → row click → user detail → roles section → toggle`. BrainWise has "Assign Mentor Role" as its own peer tab to "Trainees" and "Assign / Unassign," which fragments the mental model. The mentor flag is a property of the user, not a destination.
2. **Bulk role assignment exists but is secondary.** Most LMS expose it via the same user table (select multiple rows → Actions → "Set role…"), not as a separate flow.
3. **Audit / justification on role change is uncommon.** Most don't require justification text; some require an audit flag but auto-fill it. BrainWise's 10-char reason on mentor-role grant matches Cornerstone-tier compliance feel.

### Per-learner progress inspection

What competitors do:

- **Absorb** — Learner-centric Activity Report renders the full enrollment list with filterable columns. Click a row → drawer with progress detail. Multi-tier drilling (course → lesson → activity) happens via expanding rows or sub-drawers.
- **360Learning** — Path session statistics page lists name/progress/status/time spent/score/validation date. Each attempt expandable. Click View → goes to path session itself.
- **Docebo** — Course-centric "Enrollments" view + user-centric "My Activities" view. Modern design uses cards for course-level; expandable rows for activity-level.
- **iSpring** — "Click on any user to drill down into their personal learning results, such as enrolled courses, awarded points, badges, and certificates."
- **Cornerstone** — Transcript view is the canonical per-learner inspection. Transcript shows all training, with status pills, drill-down per item.

Patterns:

1. **Transcript-style timeline is the default.** Most LMS show the per-learner inspection as a chronological transcript with status pills, not as a hierarchical tree. BrainWise's tree-based `AdminLearningTree` (cert path → curriculum → module → content item) is structurally different — it surfaces the hierarchy, which is correct for BrainWise's curriculum-driven model but unusual.
2. **Submission viewing is bundled into the row, not a separate panel.** Click the row → drawer opens to the right → submission contents, attempt history, mentor feedback. BrainWise's `ContentItemArtifactPanel` *expands inline below the row*; modern pattern is drawer-on-side.
3. **Status pills with semantic colors are universal.** Green = complete, amber = in progress, gray = not started, red = failed/revoked. BrainWise's `AdminLearningTree.statusBadgeClass` uses raw Tailwind colors that don't follow brand semantic tokens — already logged.

---

## Surface 2: Content authoring

### Rise 360 — the industry benchmark

Rise's model, confirmed:

- **Block-based, web-page-style scroll-through lessons.** No slides. No timeline.
- **20+ content block types.** Text, image, interactive (sorting, matching, scenarios, knowledge checks), media (video, audio), labeled graphics, flashcards, accordions, tabs, lists, etc.
- **Block templates and reusable patterns.** Pre-built lesson templates for common scenarios; block-level reuse via custom blocks.
- **AI Assistant integrated at the block level.** Sparkle icon inside any lesson. Generate course outline → lesson titles → block content; rewrite at different reading level/tone; quiz generation; image generation; "Magic Import" of source documents.
- **"Create once, publish anywhere"** — single source produces SCORM, xAPI, web link, mobile app.
- **Real-time co-authoring on Teams plan.** Multiple authors edit different lessons simultaneously.
- **Storyline Block escape hatch.** Embed a published Storyline output as a block when you need branching scenarios or interactions Rise can't natively do.

What's new April 2026:
- Source Content Image Extraction (upload PDF → images auto-pulled into library)
- Magic Import Enhancements (storyboards → formatted lessons + blocks + quizzes)
- Course Draft generation
- Undo/Redo in the block editor
- Custom Block Localization

### Storyline 360 — the slide-based sibling

- Timeline-based, slide-by-slide.
- Highly customizable interactions, animations, branching scenarios.
- Used when Rise's block library isn't enough.
- AI Assistant features: Sync Timelines With Audio (animate to narration), Likert Scale Accessibility, custom imagery, voices.

### Other authors

- **Cornerstone Create** — "Easy microcontent authoring tool" — light-touch authoring for quick updates inside the LMS.
- **Docebo Author** — Microlearning emphasis.
- **iSpring Suite** — PowerPoint-based authoring; converts slides to SCORM.
- **Elucidat** — Block-based, Rise-style; "Page Progress Indicator" feature surfaces section navigation in long pages.

### Patterns

1. **Block-based authoring dominates.** Slides are legacy for new course-creation, mainly retained for specialized interactions. BrainWise's `lesson_blocks` architecture aligns with the dominant pattern.
2. **AI Assistant is now table-stakes.** All major authors ship AI features for content generation, rewriting, image generation, quiz generation. BrainWise already has the `ai-pane` infrastructure on lesson_blocks.
3. **Magic Import / source-content extraction is the differentiator in 2026.** Upload a PDF/Word/storyboard → auto-formatted lesson. BrainWise does not currently have this; build queue candidate.
4. **Course-outline-first, block-content-second.** Rise's flow: generate outline → fill in blocks. BrainWise's existing pattern (cert path → curriculum → module → content item → blocks) supports this but the AI assistance currently operates at the block level, not the outline level.
5. **Co-authoring is enterprise-tier (Teams plan).** Real-time collaborative editing of different lessons concurrently. BrainWise is single-author by design; no plan for co-authoring v1.

### Pulling the lesson_blocks builder out of where it lives

Per the build queue, Cole wants to pull the "Rise builder" (i.e., the `lesson_blocks` authoring surface) out of its current location. Speculation only — without seeing the current placement and Cole's specific friction, the recon angle is:

- **Rise is its own destination** (`rise.articulate.com`), not buried inside a more general "course editor." A clear, separate top-level "Lesson Builder" or "Author" destination is the industry pattern.
- **The authoring surface deserves its own URL structure** — Rise uses `/courses/{id}/lessons/{lessonId}`, fullscreen on the authoring view, sidebar collapses when authoring.
- **Asset library / block library / preview as side panels**, not modals — the modern pattern is dockable panels on the right side that can be expanded/collapsed.
- **Outline + block view in a two-column layout.** Left: outline (collapsible). Right: block stack. Top: course-level metadata + preview/publish buttons.

What this would mean for BrainWise specifically depends on where the lesson_blocks builder currently lives in our IA — Cole to clarify.

---

## Surface 3: Learner-side LMS surfaces

### Modern learner dashboard

What competitors do:

- **Docebo** (April 2026 release) — "Meet learners in the moment without pulling them out of it" + "Harmony Search built into the header" + redesigned admin nav. Home dashboard prioritizes "what to do next" over course catalog browse.
- **360Learning** — Skills dashboard with Upskilling and Assessment tabs; manager dashboard with team-rollup metrics; in-app notifications center.
- **Cornerstone** — Learning Experience Platform (LXP) framing; AI-driven recommendations on home; "My Transcript" feature for completed work.
- **LearnUpon** — Home dashboard with rotating banners + widgets configured by admin; learner can see "My Tasks" with current learning + statuses.

Patterns:

1. **"What to do next" over course catalog.** Modern learner home leads with assigned active learning + due dates + next-action CTAs. Catalog browse is secondary. BrainWise's `MyLearningTab` already does this (in-progress + not-started + Browse & Enroll); aligns with industry pattern.
2. **In-app notifications center as a panel.** Bell icon + dropdown + dedicated `/notifications` page. BrainWise just shipped this Session 84-86; aligns.
3. **Streaks, badges, gamification.** Duolingo / Sana / TalentLMS lean heavily here. Cornerstone and Docebo add lightly. BrainWise has none. Open product question for v2.
4. **Mobile-first responsive design is mandatory.** "65 percent of learners cite mobile-friendly design as important" (iSpring 2025 study). BrainWise should already be responsive; verify on the learning surfaces specifically.

### Content viewer (learner consuming a lesson)

What competitors do:

- **Rise (learner mode)** — Single-page scroll-through with section breaks. Sticky progress bar at top. Continue button at section boundaries. Bookmark/resume support. Mobile-responsive by design.
- **Storyline (learner mode)** — Player chrome with progress bar, menu, resources, glossary tabs.
- **Cornerstone** — Player varies by content type; consistent header chrome with progress + exit.
- **360Learning** — Path session player with linear next-back; collaborative comments per content piece.
- **Elucidat** — Page Progress Indicator: visual menu showing each part of a longer scrolling page; jump-to-section navigation.

Patterns:

1. **Sticky progress indicator at top of content.** Universal. Often combined with sticky section title + breadcrumb to parent course.
2. **Section TOC on the side or top.** Long-form lessons need a way to jump between sections. BrainWise's lesson_blocks viewer already does this (per Session 79 paged-section Model B with sidebar TOC).
3. **Continue/Previous CTAs at section boundaries**, not just at the lesson end. BrainWise already does this.
4. **Resume to last position** is universal. BrainWise does this via `lesson_last_block_id` + `lesson_furthest_continue_client_id`.
5. **Collaborative comments / questions per content piece** is 360Learning's distinctive feature. Not in BrainWise; not planned for v1.

### Course catalog / browse experience

- **Docebo / LearnUpon / Absorb** — Catalog with category-based browse, tile/card layout, filter sidebar, search, AI-powered recommendations.
- **Cornerstone** — Content marketplace with curated subscriptions (Content Anytime).
- **Sana** — AI-only automated training delivery; no traditional catalog.

BrainWise's Resources subsystem is the analog. Aligned with mainstream catalog patterns: search, filter, tile grid. The "upgrade modal" for locked resources is BrainWise-specific (cert-program-gated content).

---

## Cross-cutting observations

### Patterns to adopt (where we're behind)

1. **Reports-first admin model.** The dominant 2025/2026 admin pattern is "open a report → filter rows → row click → Actions panel." BrainWise's Learning Admin has four peer tabs, which fragments the mental model. A unified "Learners" entry with filter/sort/multi-select → row drill-down would be more consistent with industry expectations and more comprehensive.
2. **Side-drawer for row detail.** Click row → drawer slides in from right with full detail + actions. This is the dominant modern data-table pattern (Pencil & Paper, Linear, Notion, Absorb refresh, Docebo redesign). BrainWise currently does multi-page navigation (`setSelected` re-renders to full-page tree view) — replacing this with a drawer keeps the user's context.
3. **Role-as-property, not role-as-tab.** Linear/Notion/Cornerstone/Docebo all put role assignment in user-detail panels, not in separate "Assign X Role" tabs. The Mentor Role tab is structural mismatch.
4. **Magic Import for content authoring.** Upload PDF/Word/storyboard → auto-generated formatted lesson. Rise just shipped this (Q1 2026); we don't have it.
5. **Outline-level AI assist for course authoring.** Generate cert path → curricula → modules → content items → blocks. Currently BrainWise AI operates at the block level only.
6. **Per-content-item drawer (not inline expansion).** When the admin clicks a content item to inspect a learner's submission, modern pattern opens a side drawer; current pattern expands the row inline (more visually disruptive).

### Patterns BrainWise already gets right

1. **Block-based lesson_blocks authoring with AI pane.** Aligned with Rise.
2. **Tile-based My Learning / Resources surfaces.** Aligned with modern catalog patterns.
3. **Notifications subsystem.** Bell + dropdown + dedicated pages. Aligned.
4. **In-app sticky progress + section TOC + resume-from-position on lessons.** Aligned.
5. **Reverse-cascade with cert-block protection.** Sophisticated compared to industry norm — most LMS treat completion as forward-only.
6. **Audit logging with mandatory justification on permission changes.** Cornerstone-tier compliance discipline.
7. **Curriculum hierarchy (cert path → curriculum → module → content item → blocks).** Stronger structure than the flat course-and-lesson model of most LMS, suited to the coaching-cert model.

### Patterns BrainWise does *differently* — neither better nor worse, just different

1. **Hierarchical tree for per-learner inspection.** Most LMS use transcript-style flat timeline. BrainWise tree better surfaces the cert-path → curriculum → module → item structure that's load-bearing for the coaching-cert use case. Trade-off: harder to scan at a glance for "what has this person completed lately."
2. **Mandatory reason field with min-10-char enforcement.** Most LMS don't enforce; the field is there for compliance teams but often empty.
3. **Mentor role as eligibility flag separate from relationship.** Most LMS treat instructor as a single role that includes the relationship; BrainWise separates `users.is_mentor` (eligibility) from `coach_mentor_assignments` (relationship). The split is design-intentional per Session 82.

---

## Specific takeaways for Round 4 / current open surfaces

### For "Completion Control feels clunky and not comprehensive"

The clunkiness is structural, not visual. Three root causes:

1. **Two-step navigation** (search → pick learner → expand tree) where modern pattern is one-step navigation (open table → click row → drawer).
2. **Inline expansion of content-item artifact** breaks visual flow; drawer pattern would keep tree intact while showing submission detail.
3. **"Completion Control" as a tab title** implies a destination; modern pattern is "Learners" as the destination with completion override as one Action among many on the row.

The not-comprehensive feel is real:
1. **No reports view** (course-centric, status-centric, recent-completions). User-up navigation only.
2. **No bulk action** on the completion side. Each completion is single-target.
3. **No filtering on the learner tree** (e.g., "show only items where status = revision_requested"). Tree dumps everything.
4. **No history view** of what completion overrides this admin has done. Cornerstone-style audit timeline missing.
5. **Submission viewer doesn't include any reviewer commentary thread for writing tasks** beyond the latest mentor comment. Mentor portal supports iterations; admin viewer should too.

### For "Mentor Role" tab structural mismatch

The whole tab is fighting industry pattern. Two refactor directions:

- **A. Fold mentor role into the Trainees tab as a row Action.** Click a user → user detail → toggle Mentor role. Matches Linear/Notion/Docebo. Drops "Mentor Role" tab entirely. Smallest behavior change, biggest IA correction.
- **B. Fold mentor role + completion override + curriculum assignment + import into a unified "Learners" surface.** Tabs collapse to one. Click a user → drawer with their roles + assigned learning + completion tree + actions. Biggest IA improvement, biggest refactor cost.

### For content authoring restructure (build queue)

Cole's "pull the Rise builder out of where it is" can mean different things. From the recon:

1. **Lesson builder as its own destination URL** — `/learning-admin/lessons/{id}` or `/author/lessons/{id}`, fullscreen with sidebar collapsed.
2. **Block library / asset library as right-side dockable panels** rather than modals.
3. **Outline view + block view in a two-column layout** with breadcrumb to parent module/curriculum/cert path.
4. **AI assistance at the outline level** (generate course outline, lesson titles), not just block level.

Need Cole's specific friction with current placement to scope this.

---

## Decision points for Cole

Pre-prompt scoping questions, in priority order:

1. **Completion Control IA**: Keep current Trainees / Assign-Unassign / Mentor Role / Completion Control structure with polish-only edits, OR consolidate to a unified "Learners" surface with row-detail drawer (bigger refactor, multiple sessions)? If consolidate, scope = Phase 11 not Round 4.
2. **Mentor Role tab disposition**: Fold into row Action (smaller, Round 4-doable), OR consolidate per #1?
3. **Per-content-item submission viewing**: Keep inline expansion under the row, OR refactor to right-side drawer (Round 4-doable as targeted change)?
4. **AdminLearningTree filtering / "show only X status"**: Add filter chips above tree (Round 4-doable), OR defer to whatever consolidation #1 brings?
5. **Bulk completion override**: Build it (post-Round 4), OR defer indefinitely (low real-world frequency)?
6. **Admin's own audit timeline**: Build a "Recent overrides" view showing what this admin has done historically (deferred build-queue), OR defer until compliance demand surfaces?
7. **Content authoring restructure**: Cole to describe specific current placement friction. Recon can't scope without that detail.
8. **Magic Import / outline-level AI assistance for authoring**: Worth scoping as v2 features, OR not now?

---

## What this recon doesn't cover

- Specific implementation prompts (out of scope; comes after design decisions land)
- Mobile-app-specific patterns (BrainWise is web-first; mobile is responsive but not native)
- Pricing comparisons / market positioning (separate analysis if needed)
- Detailed competitor screenshots (gated behind sales demos; not publicly indexed)
- iPEC specifically (LMS gated, no public visibility into their admin surfaces)
- SCORM / xAPI / cmi5 standards conformance details (not currently in Round 4 scope)
- Single-Sign-On / SCIM patterns (covered in Session 71 anon EXECUTE audit; not Round 4 scope)
