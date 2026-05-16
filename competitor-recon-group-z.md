# Competitor Recon: Trainee UI Design Insights for Group Z

**Compiled:** Session 75 close (pre-Session-76)
**Purpose:** Inform design lock for Group Z (detail pages for cert path / curriculum / module / content item viewers + completion modals + stubs)
**Scope:** Trainee-side UI patterns only. Authoring UI excluded.

This is recon to inform design decisions, not a design lock. Session 76 walks Cole through these patterns and locks specific choices.

---

## Platforms covered

**Consumer-facing LMS:** Coursera, LinkedIn Learning, Udemy, edX, Skillshare, MasterClass, Domestika, Pluralsight, Brilliant

**Authoring-focused (trainee side):** Articulate Rise, Articulate Storyline, Thinkific, Teachable, Kajabi

**Enterprise LMS:** Docebo, Cornerstone OnDemand, Schoox, Oracle Learning, SAP SuccessFactors, 360Learning, Absorb LMS, TalentLMS, Litmos, iSpring Learn, Workday Learning

**Habit/engagement reference:** Duolingo, Khan Academy, Salesforce Trailhead

---

## Major insights by theme

### Theme 1: Course/cert-path overview pages

**The pattern winners use:**

- **Hero with structured metadata strip.** Course name, provider/brand, completion estimate, difficulty level, language, certification credential. Coursera does this best — clean typography, generous whitespace, credential prominence drives enrollment intent.
- **Week-by-week or module-by-module breakdown as the primary content.** Coursera's "Course Outline" view exposes every video/reading/assignment count per week before enrollment. This is a transparency play that builds trust.
- **Next-step affordance.** Coursera ships a "Next step" feature that highlights the recommended next item with a "Start" button on both dashboard and course home. They reported a measurable lift: learners with access to these features are over 10 percent more likely to complete a course successfully overall. The catch: occasionally, however, you'll be directed back to re-attempt an assignment that you didn't pass on the first try, or forward to start practicing new skills on the next assignment to come — Next Step is not always linear "what's next", it's contextual.
- **Dual progress bars.** A second progress bar appears on your course home pages, along with a detailed week-by-week summary of the content and assignments that you need to complete each week. One for overall course progress, one for current week.

**The patterns most enterprise LMSes get wrong:**

- Docebo and Cornerstone bury course detail pages behind cluttered "learner home" dashboards with widgets, news feeds, recommendations, and gamification panels all competing for attention. Course detail becomes an afterthought.
- Schoox, Workday Learning, Oracle Learning all use a dated "expandable accordion list" pattern for module navigation — works but feels like 2014 SharePoint.
- 360Learning differentiates with a flat, modern card layout that prioritizes content over chrome — closer to consumer LMS feel.

**Applies to our cert path detail page:**

- Hero with brand + cert path name + dimensions covered (PTP / NAI / etc) + estimated hours + Required credential badge
- Below hero: at-a-glance metadata strip (curricula count, modules count, content_items count, certification type, who certifies it)
- Below that: the curricula carousel with progress indicators
- Recommend a "Next step" CTA that points to the user's current in-progress item or recommended next, with clear "Resume" language
- Dual progress: overall cert path completion % AND current curriculum % shown side-by-side

### Theme 2: Module/lesson navigation chrome

**Articulate Rise's pattern (and its known flaws):**

- Sidebar-left navigation with lesson titles. Lesson numbers default-shown. Search built into sidebar. Search is active by default in new and existing courses. To disable search, toggle the Search option to Off.
- Lesson content scrolls vertically. Rise 360 lessons are very similar to traditional websites — learners will scroll down to view text, images, media, and interactivity.
- Continue blocks as section dividers within a lesson. There are three completion types: None means learners simply need to click the button to continue. Complete Block Directly Above means learners must complete the interaction immediately before the Continue button. Complete All Blocks Above means learners must complete all interactions above the Continue button to proceed.
- Block completion is generous: a block of text, images, charts, quotes, lists and so on are counted as complete as soon as the block is 'viewed'. Usually within seconds of appearing on screen.

**Where Rise fails:**

- I just hoped the app design would be more user friendly and display that it displayed something that lets the user know there is more content below — community complaints about Next Lesson buttons being below excessive padding with no scroll indicators.
- This is not intuitive enough for people who have been conditioned to see a larger, colorful "Continue" button in previous lessons. Bad design that needs to be rectified, Articulate — quizzes don't get a Continue button, breaking learned navigation expectations.
- the continue button isn't set up to monitor cross-lesson block completion, it only tracks block completion in the lesson in which it's contained — Rise's gating is per-lesson, not cross-lesson. Authors hit this constantly.

**Applies to our module/lesson detail pages:**

- Our lesson_blocks renderer already has a working Continue button pattern (Session 65 ship). The architecture from Rise is sound; we just need to fix the chrome.
- Add a "more content below" affordance (down chevron, fade gradient at viewport bottom) when content extends beyond initial viewport. This is one of Rise's biggest pain points and trivially fixable.
- Quizzes/skills practice items DO get a Continue button on completion — break Rise's bad pattern, keep user expectations consistent.
- Sidebar nav: TOC of all lesson_blocks within the current content_item. Click jumps to that block. Visual indicator (checkmark) on completed blocks. Required vs Optional pill on each.

### Theme 3: Progress indicators and the dopamine question

**Duolingo's playbook (extreme but instructive):**

- XP bars, crown levels, league tables, streak counters, and achievement badges create a layered progress system where something is always advancing, even on bad days.
- Reaching a one week, one month, 100 day, or one year streak and beyond on Duolingo is no small feat and should be celebrated. Streak milestones get elaborate animations.
- Wrong answers trigger gentle animations and encouraging feedback, not red error screens; users need to feel safe making mistakes to learn.

**Khan Academy's playbook (more growth-mindset, less anxiety):**

- Streaks are designed to promote and celebrate consistency, motivating learners to get at least one skill to Proficient or higher each week. Levels, on the other hand, are designed to break apart the daunting task of completing an entire course into smaller, more manageable milestones.
- Weekly streaks instead of daily reduce the anxiety hit. Daily streaks work for language-learning where 5 minutes/day is realistic; weekly is more appropriate for cert paths where one lesson takes 30-60 min.
- At the end of each level, users can celebrate with a "level up" that recognizes their progress towards their goals. Khan calls them "level ups," not "achievements" — the word "level up" carries video-game momentum, "achievement" feels stuffy.

**The Black Hat / White Hat distinction (Octalysis Framework):**

- Khan Academy's mission-driven approach is pure White Hat. You feel good because you're learning something meaningful... These motivations are sustainable because people don't burn out from feeling accomplished.
- Duolingo's streak system is Black Hat. You keep your streak not because you feel amazing, but because losing 200 days of progress feels devastating. It's effective, but notice: people often complain about feeling "held hostage" by their streak.

**Applies to BrainWise:**

- BrainWise is a professional workforce-readiness platform, not a language app. Black Hat loss-aversion mechanics (streaks, "you'll lose your progress!" guilt) are wrong for the audience. Coaches and trainees would resent it.
- White Hat mechanics fit: milestone celebration ("You're certified!"), progress visibility (3 of 5 modules complete), competency framing (skills gained, not points scored).
- DO: Module completion modal with celebration animation (one-time, not anxiety-inducing). Cert path completion gets a bigger moment.
- DON'T: streak counters, daily-practice nudges, gamified leagues/leaderboards (these create awkward dynamics in professional learning where trainees know each other).
- DO: per-dimension competency visualization (Protection / Participation / Prediction / Purpose / Pleasure for PTP-related learning). This connects learning to the assessment results trainees already care about.

### Theme 4: Completion modals and milestone celebrations

**What works:**

- Duolingo's milestone animations are loved because they're proportional to the achievement. 7-day streak = small moment. 100-day = big moment. Now that we had a more widely-understood image, our design needed to lean into that excitement, and give learners something to look forward to as they practiced for more days.
- Coursera's certificate completion screen is restrained — clean confetti, big credential card, "Add to LinkedIn" CTA, "Share on social" CTA. Tasteful, not garish.
- Khan Academy's "level up" celebration uses sounds + visual + brief copy. Time-bounded (auto-dismisses or single click).

**What fails:**

- Cornerstone and Oracle have completion screens that look like permission dialogs — gray, formal, no celebration. A 6-month workforce certification ends with "Course completed. Click OK." Feels like a tax filing receipt.
- Some Udemy course-completion screens are too aggressive on social-share CTAs. They block the content with "Share your achievement!" before the user has processed completing it.

**Applies to BrainWise:**

- **Three tiers of celebration sized to achievement weight:**
  - Block / content_item completion → subtle micro-feedback (checkmark animation, gentle progress bar advance, no modal)
  - Module completion → modal with success animation + "Next module: X" CTA + "Back to cert path" link. Auto-collapsible.
  - Curriculum completion → modal with stronger celebration + summary of what was learned + "Next curriculum" CTA
  - Cert path completion → full-screen moment with certification credential preview + "Download certificate" + "Share with my coach" + "Share on LinkedIn". This is the marquee moment.
- Use the Session 72 locked "collapse to highest tier on cascaded transitions" rule: if a single action triggers content_item + module + curriculum + cert_path completion (the rare case), show only the cert_path celebration. The lower-tier modals get audit-logged but not shown.

### Theme 5: Per-item-type content viewers

**Video viewers — what works:**

- MasterClass's video chrome is the gold standard. Full-screen capable, clean controls, captions toggle prominent, playback speed (0.75x, 1x, 1.25x, 1.5x, 2x), chapter markers, "Watch next" rail at end. Notes panel slides in from right without leaving the video.
- Coursera's video player is similar with one improvement: transcript visible as scrollable panel alongside video, with click-to-jump-to-timestamp. Powerful for non-native speakers and accessibility.
- Pluralsight pioneered the "watch progress = completion" pattern. Watch 90% of a video = completed. Backing up doesn't un-complete it.

**Video viewers — what fails:**

- LinkedIn Learning auto-plays the next video by default. Many users hate this; it removes agency. Their setting to disable is buried.
- Udemy's video player is functional but visually dated — looks like a 2018 product.

**Quiz viewers — what works:**

- Brilliant's quiz UX is the best in class: one question at a time, large question text, plenty of whitespace, choices as big tappable cards, immediate feedback with explanation revealed (not before answering). No "scoring" anxiety — gentle correction.
- Khan Academy's "hint" mechanic: stuck on a question, click "hint", lose some points but get partial guidance. Removes the binary right/wrong stress.

**Quiz viewers — what fails:**

- Coursera, edX, and most enterprise LMSes ship form-style quizzes: all questions on one page, radio buttons, Submit button at bottom, results page reveals score. Feels like a standardized test. Bad for learning, fine for assessment.

**External link, file upload, live event — what works:**

- Most platforms handle these poorly. The honest pattern: open external link in new tab with a "Mark complete when done" affordance on return. We already do this.
- Live events: Zoom integration with calendar block + RSVP + auto-completion on attendance. SuccessFactors does this well; most others don't.

**Lesson blocks (Rise-style):**

- Already covered in Theme 2. Our existing implementation is competitive. Polish needs: scroll affordances, better progress indicator within a lesson, smoother Continue button hover/active states.

**Applies to BrainWise:**

- Build a single canonical video viewer component (BrainWise styling) with: chapter markers if authored, captions toggle, playback speed, completion at the authored `video_completion_threshold_pct` (defaults to 90%), no auto-play next.
- Quiz viewer: one question at a time, large cards, immediate feedback per question. NOT one-page-form style.
- External link / file upload / live event: keep current implementation. Add subtle "Last completed [date]" badge to make completion state visible on the content_item card.

### Theme 6: Information density and visual chrome

**The split:**

- **Enterprise LMSes (Docebo, Cornerstone, SuccessFactors)** trend toward high information density: stat dashboards, recommendations widgets, news feeds, admin metadata, gamification panels all on the same screen. Designed for "engagement metrics" not deep work.
- **Consumer LMSes (Coursera, MasterClass, Domestika)** trend toward editorial whitespace: hero imagery, single primary CTA, content gets room to breathe. Designed for "focused learning."

**The right answer for BrainWise:**

- We are professional but not enterprise-stuffy. The trainee experience should feel closer to Coursera/MasterClass than to Docebo. Whitespace, large typography, content-first.
- BUT: include the metadata strip with cert path / curriculum / module counts and required-vs-optional pills. Professional users want to know "what am I committing to" before clicking.
- Reserve the dashboard density for super_admin and coach views — those users want metrics. Trainees want clarity.

### Theme 7: Mobile responsiveness

- Every modern LMS (Coursera, LinkedIn Learning, Udemy, Docebo, MasterClass) ships first-class mobile experience now. Even authoring-focused tools (Rise lessons) render well on mobile because of responsive design.
- Mobile responsiveness is another critical element. As more users engage with learning on the go, a responsive learning platform ensures training content performs seamlessly across devices.
- 76% of employees now accessing learning content on mobile devices.

**Applies to BrainWise:**

- All Group Z surfaces (detail pages, content item viewers, modals) must be tested at common mobile breakpoints (375px, 414px, 768px). Not "mobile-friendly later" — Day 1.
- Lesson_blocks renderer already responsive (Session 60-69 work). Detail pages need the same discipline.

### Theme 8: Navigation patterns

- **Sidebar TOC** (Rise, Articulate, most enterprise LMSes): persistent left sidebar with course structure. Good for "where am I in the bigger picture." Bad on mobile, slow to scan with long curricula.
- **Breadcrumb + back button** (Coursera, Domestika): minimal chrome, scroll-driven. Good for "focused reading mode." Bad for users who want to jump non-linearly.
- **Hybrid** (Pluralsight, MasterClass): collapsible sidebar that's open on desktop, hidden on mobile, accessible via hamburger. Best of both.

**Applies to BrainWise:**

- Hybrid model. Sidebar TOC of cert-path → curriculum → module → content_item available on desktop. Collapsed by default on tablet/mobile, available via hamburger.
- Each detail page has a breadcrumb at top (Cert path > Curriculum > Module > Content item) — Session 72 locked this. Single back button per level — Session 72 also locked this.

---

## Patterns to AVOID (industry-wide failure modes)

1. **Cluttered dashboard chrome on detail pages.** Most enterprise LMSes do this. Trainees just want to see what they're learning.
2. **Auto-play next video.** LinkedIn Learning's default. Users hate losing agency.
3. **Streak / daily-practice gamification for professional learning.** Wrong audience. Save for habit apps.
4. **Form-style "submit all answers at end" quizzes.** Feels like school testing, not learning.
5. **Tiny next-lesson links buried below excessive padding.** Rise's known flaw. Make next-step affordance obvious.
6. **Cold, formal completion screens.** Cornerstone-style "Course completed. OK." kills the dopamine moment.
7. **Aggressive social-share prompts before user has processed completion.** Udemy fail. Let them celebrate, then offer sharing.
8. **Quiz screens with no explanation per question.** Just "Correct/Wrong" + score loses the learning moment.
9. **No "more content below" affordance.** Users miss content because the scroll cue isn't visible.
10. **Mixing admin metadata into trainee views.** Don't show trainees "enrollment_id 47823, created 2024-03-15, audit log entries 7" — that's super_admin info.

---

## Patterns to MATCH OR EXCEED (industry-wide wins)

1. **Coursera's "Next step" with measured completion lift.** Highlight the recommended next item with a Start/Resume button on every overview screen. Use `get_user_learning_state` to compute it.
2. **Coursera's dual progress bars.** Overall + current sub-unit progress side by side.
3. **MasterClass video chrome polish.** Large play button, clean controls, transcript panel, chapter markers.
4. **Brilliant's quiz UX.** One question per screen, big tappable cards, immediate feedback with explanation.
5. **Coursera's restrained completion celebrations.** Confetti + credential preview + tasteful share CTAs.
6. **Khan Academy's "level up" framing.** Sized-to-achievement celebrations, video-game momentum.
7. **Duolingo's failure-safe feedback.** Gentle, encouraging, never red-alert.
8. **MasterClass's editorial whitespace.** Content-first, chrome-second. The opposite of enterprise LMS density.
9. **Rise's Continue button mechanics for lesson_blocks.** Sectioning within a long lesson. Sound architecture, we already have this.
10. **Pluralsight's watch-progress = completion pattern.** 90% watched = done. No re-completion penalty for re-watching.

---

## Specific design recommendations for Group Z surfaces

### Cert path detail page (e.g., `/learning/cert-paths/<id>`)

- **Hero:** brand badge + cert path name + summary + estimated hours + Required/Optional pill (the cert path itself; rarely Optional but possible) + dimensions covered
- **Action strip:** "Resume" primary CTA pointing to in-progress curriculum/module via get_user_learning_state, OR "Enroll" if not enrolled, OR "Review" if certified
- **Progress band:** overall cert path % + "Certified" badge if status='certified'
- **Curricula carousel:** each tile shows name + summary + Required/Optional + per-curriculum progress %. Hover reveals "Open" CTA. Click navigates to curriculum detail.
- **At a glance metadata strip:** total curricula, total modules, total content_items, who certifies, time estimate
- **Cross-instrument analysis section (Session 72 locked):** PTP / NAI / AIRSA / HSS dimension competencies built by this cert path
- **What this means / takeaways:** authored content from cert_path.summary or expanded description
- **Hidden:** super_admin enrollment metadata, audit log, system IDs

### Curriculum detail page (`/learning/curricula/<id>`)

- Hero similar but smaller scale. Curriculum name + summary + estimated hours + Required/Optional pill (relative to parent cert path).
- Action: Resume / Start / Review per status.
- Progress: curriculum %.
- Modules carousel: per-module tiles with progress + Required/Optional + delivery mode (self_paced / cohort) + prerequisite indicator if blocked.
- Parent cert path breadcrumb at top.

### Module detail page (`/learning/modules/<id>`)

- Hero smaller again. Module name + summary + estimated minutes + Required/Optional.
- Content items as a vertical list (not carousel — modules usually have 5-15 items, list scans better).
- Each row: icon for item_type + name + estimated time + completion checkmark or progress + Required/Optional.
- "Up next" affordance for the next unstarted required item.
- Parent breadcrumb: Cert path > Curriculum > Module.

### Content item viewer pages

- Per-item-type renderers as scoped in Session 70 phase-5-lesson-progress-carry-forward.md.
- Common chrome: top bar with breadcrumb, completion status pill, Mark complete button (where applicable), Next item button (after completion).
- Lesson_blocks rendering: already shipped (Session 60-69), needs Group Z polish — better scroll affordances, smoother Continue button transitions, mobile-tested.

### Completion modals

- Three tiers per Theme 4. Block-level = micro feedback. Module = modal with Next module CTA. Curriculum = bigger modal with summary. Cert path = full-screen moment with certificate preview + share CTAs.
- Use Session 72 locked "collapse to highest tier on cascaded transitions" rule.
- Notification audit log preserves all tiers regardless of which modal renders.

### Stubs (Restart / Review / Request Access)

- "Coming soon" modal per Session 72 lock. Don't ship half-baked.
- Restart on curricula and modules only (cert path Restart NOT supported, Session 72 locked).

---

## What this means for Session 76 design lock

These insights inform decisions but don't make them. Session 76 walks Cole through these patterns surface-by-surface and locks specific choices for each. Expected open questions for Cole:

1. **Celebration intensity tier sizing.** Confirm block/module/curriculum/cert-path get the three-tier scale described above.
2. **"Next step" affordance.** Does our `get_user_learning_state` need a new field for recommended-next-item, or can frontend derive from existing data?
3. **Dimension-based competency visualization on cert path detail.** Show / hide / phase-2? Requires backend support if shown.
4. **Quiz UX pattern.** One-question-at-a-time (Brilliant style) or form-style (Coursera style)? Affects the QuizViewer component scope significantly.
5. **Video player chrome.** Build BrainWise-styled player or use a battle-tested library (Vidstack, Plyr, video.js)?
6. **Mobile-first or desktop-first design pass.** Different starting points produce different final designs.
7. **Hero imagery vs no hero on detail pages.** Thumbnails as backdrop, or clean typography hero with no imagery?

These get answered at Session 76 open after Cole reviews this doc.

---

*End of recon doc. Session 76 design lock proceeds from these insights.*
