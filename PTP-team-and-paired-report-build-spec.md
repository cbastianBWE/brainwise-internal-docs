# BrainWise PTP Team and Paired Report — Build Spec

A complete specification for generating two reports from Personal Threat Profile results: a **Team report** and a **Paired report**. A future session should be able to take this spec, the classification workbook, a branding fill-in, and a set of member scores, and produce the reports without further interpretation decisions.

All brand elements are left as fill-in tokens written like `{{TOKEN}}`. The generating session must not choose colors, fonts, or logos; it fills the tokens from the branding supplied that session. Nothing else in this spec is optional unless marked optional.

No em dashes anywhere in any generated output. Use commas, colons, or parentheses.

---

## 0. Fill-in tokens (branding)

Type and logo: `{{FONT_HEADING}}`, `{{FONT_BODY}}`, `{{LOGO}}`.

Base palette: `{{COLOR_PRIMARY}}` (deep brand color for headers and hero), `{{COLOR_ACCENT}}` (highlight), `{{COLOR_BACKGROUND}}`, `{{COLOR_TEXT}}`, `{{COLOR_MUTED}}`, `{{COLOR_LINE}}`.

Five domain colors: `{{COLOR_PROTECTION}}`, `{{COLOR_PARTICIPATION}}`, `{{COLOR_PREDICTION}}`, `{{COLOR_PURPOSE}}`, `{{COLOR_PLEASURE}}`.

Six signal colors: `{{COLOR_COLLISION}}`, `{{COLOR_FRICTION}}`, `{{COLOR_COMPLEMENTARITY}}`, `{{COLOR_BLINDSPOT}}`, `{{COLOR_SATURATING}}`, `{{COLOR_ALIGNMENT}}`.

Two person colors (paired only): `{{COLOR_PERSON_A}}`, `{{COLOR_PERSON_B}}`. These must be distinct from the five domain colors so the overlaid shapes read clearly.

---

## 1. Shared foundations (both reports)

### 1.1 Source of truth
The classification workbook (`PTP-facet-classification.xlsx`) is authoritative for every per-facet decision. It has four sheets:
- **Facet classification**: 89 facets, each with item number, question text, context (Prof or Personal), Used in scope, dimension, resource logic, group lean, floor risk, behavioral salience, primary and secondary signal lens, review flag, rationale.
- **Routing rules**: how the three computed inputs combine with the tags to produce a signal.
- **Facet interactions**: curated pairs labeled Complements, Amplifies, Detracts, or Masks, tagged within-person or cross-person.
- **Parameters**: the numeric thresholds.

The generating session reads tags from this file. It does not re-derive them.

### 1.2 The model
The PTP measures threat and reward across the 5P dimensions. Threat: **Protection**, **Participation**, **Prediction**. Reward: **Purpose**, **Pleasure**. Core principle, applied throughout: reward only opens once threat is met. A person or a pair does not reach shared Purpose and Pleasure while safety needs are unmet. Read threat first, always.

### 1.3 Inputs
Per facet, the score (0 to 100) for each person in scope. Team report needs every member's scores on the 47 work-context facets. Paired report needs both people's scores on all 89.

### 1.4 Computed values
- **Team mean** per facet.
- **Spread** per facet, measured as range (highest minus lowest).
- **Shape** per facet, via the gap rule: sort the scores, find the largest gap between adjacent scores; if that gap is at least 25 and each side holds at least 30 percent of members, it is two camps (report both cluster centers and sizes); otherwise it is a single cluster, tight if range is small, a gradient if range is large.
- For the paired report: each person's value per facet, and the distance between them.

### 1.5 Thresholds (from Parameters; tune to instrument banding)
High mean is 67 or above. Low mean is 33 or below. Mid is 34 to 66. Tight cluster is range 25 or below. Dispersed is range 40 or above. Two-camp gap is 25 or more with each side at least 30 percent. Pair distance: far apart is 40 or more, moderate 20 to 39, close 19 or below. Both-high and both-low for a pair reuse the 67 and 33 cut points.

### 1.6 Signal routing (from Routing rules)
Read each facet's resource logic and floor risk against the computed values:
- **Rivalrous + high mean + tight** routes to **Collision**.
- **Saturating + high mean** routes to a saturating outcome (**Groupthink, Rigidity, Silence, or Gridlock**, choose the one that fits the facet).
- **Convergent + two camps or dispersed** routes to **Friction** (escalate to fault line if two camps).
- **Convergent + tight at a healthy level** routes to **Alignment** (a strength).
- **Complementary + dispersed or two camps** routes to **Complementarity** (clean role split if two camps).
- **Protective floor + low mean** routes to **Blind spot**.
- **Neutral on both** is not routed.
- Guard: any two-camp facet is pulled out of Alignment regardless of how moderate its mean looks.
- **Dual-tag**: a few facets carry a secondary lens alongside the primary one and can fire two signals at once; surface both.
- **Group lean** (Dissension, Alignment, Role-dependent, Neutral) is the plain-language summary of a facet's resource logic, useful as a quick read in the overview.
- **Interactions**: beyond the within-person Detracts and Masks used in the paired report, the Complements, Amplifies, and cross-person pairs on the interactions sheet can feed the signal cards and the next steps in both reports.

### 1.7 Voice and format
BrainWise voice: precise, plain, confident, human. Write so an average reader understands at a glance with no analytical effort. Lead visuals with a plain meaning, then a "Do this" action. No em dashes. Illustrative data must be clearly labeled as an example until real data is wired in.

---

## 2. Team report

### 2.1 Scope
The 47 work-context facets (Used in = Team + Paired). These span only the three threat domains, so the team profile is a three-point shape.

### 2.2 Visuals

**Triangle (team profile).** A three-axis radial chart. Center is zero, outer ring is 100. One axis each for Protection (`{{COLOR_PROTECTION}}`), Participation (`{{COLOR_PARTICIPATION}}`), Prediction (`{{COLOR_PREDICTION}}`). Each axis sits in a faint wedge of its domain color. Plot the team average on each axis and connect the three points into the team shape. Show the value at each vertex. Hover a vertex shows the domain name and average.

**Dimension agreement bars.** One horizontal bar per threat domain. A faint band from the lowest to the highest member, an average marker, the value, and a plain agreement tag (members vary a lot, some variation, or fairly aligned, keyed to range at the 40 and 25 cut points). Purpose: the triangle shows the average, the bars show how much members agree, which the triangle cannot. Optional: plot each member as a hoverable dot on the bar showing name and score (this is the right home for per-person detail, not the triangle).

**Six intuitive signal cards.** One card per signal that fired, drawn from the routed facets. Each card is a simple picture plus a plain "what it is" line plus a "Do this" action line. The picture uses member dots on a Lower-to-Higher track with a motif:
- **Collision** (`{{COLOR_COLLISION}}`): dots crowded high, reaching toward one star. Meaning: everyone needs the same scarce thing. Do: share it on a schedule.
- **Friction** (`{{COLOR_FRICTION}}`): two clusters with arrows pushing against each other. Meaning: split into two camps. Do: name it and agree one standard.
- **Complementarity** (`{{COLOR_COMPLEMENTARITY}}`): two clusters joined by a plus under an arc reading "one complete team." Meaning: difference is a strength. Do: give each group the work it is built for.
- **Blind spot** (`{{COLOR_BLINDSPOT}}`): dots low, a dashed empty box high reading "no one here." Meaning: nobody is watching this. Do: assign it to one person.
- **Saturating** (`{{COLOR_SATURATING}}`): dots crowded high with the caption "everyone high, no one speaks." Meaning: uniform high is the dysfunction (here, silence or groupthink). Do: make it safe to be wrong, invite dissent.
- **Alignment** (`{{COLOR_ALIGNMENT}}`): dots clustered together at a healthy level on shared ground. Meaning: a genuine shared strength. Do: name it and lean on it.

Pick the headline facet for each card from the routed facets (the strongest example of that signal). Generate the "what it is" and "Do this" lines from that facet.

**Optional full signal map.** Inside a collapsed expander, a scatter of every facet by team mean (across) and spread (up), colored by signal. This is the analyst view and stays hidden by default so it does not burden the average reader.

### 2.3 Narrative sections (in order)
1. **Team profile overview.** Read the three domains (which lead, which is softest and most uneven), then the cross-cutting patterns (the collisions of shared high needs, the blind spots of shared lows, the clean splits). Apply the threat-first principle.
2. **What it means for the team.** Three plain bullets. One on the biggest risk, one on the hidden shared-agreement risk, one on the difference that can become a strength.
3. **What we found, and what to do.** The six signal cards.
4. **Three suggested next steps.** Each with four sub-bullets. Tie each step to the signal it addresses.
5. **How this team communicates.** Two panels, in general and under pressure, plus a short "how to avoid communication conflict" block of one or two bullets. Derive from the loud and quiet facets, the collisions, and the splits.
6. **How this team handles conflict.** Two panels, mitigate and promote healthy conflict. The promote-healthy panel must cover the saturating risk (if everyone avoids looking foolish or conforms, the team goes silent, which looks like harmony but is avoidance).

---

## 3. Paired report

### 3.1 Scope
All 89 facets, both contexts, so the paired profile is a five-point shape.

### 3.2 Relationship context (the mode selector)
At generation time the report is built in one of three contexts: **Work** (default), **Personal**, or **Romantic**.
- **Work and Personal share one structure.** Same sections, same visuals, same logic. Only the interpretation language and the action-step examples change. Work speaks in meetings, decisions, and deliverables. Personal speaks in plans, shared space, and support between two people who are not romantic partners (friends, siblings, roommates, close colleagues outside a reporting line).
- **Romantic is the same base structure plus two added sections** (3.5), plus romantic framing throughout, plus the guardrails and competence gate in Section 4.

The intimacy section and the spousal next-steps section appear only in Romantic. In Work and Personal the closeness facets are still read inside the normal interpretation, but they do not get their own sections.

### 3.3 Visuals
**Pentagon (paired profile).** A five-axis radial chart, one axis per 5P domain, each in its faint domain-color wedge. Two overlaid outlines, Person A in `{{COLOR_PERSON_A}}` and Person B in `{{COLOR_PERSON_B}}`. Where the shapes pull apart is where they differ, where they overlap is where they meet. Hover a vertex shows the person, the domain, and the value.

**Four intuitive signal cards** (same idiom as the team, two-dot version): **Collision** (both high on a rivalrous trait), **Complementarity** (far apart on a complementary trait), **Blind spot** (both low on a protective trait), **Alignment** (both high on a convergent trait, the shared strength). Same picture-plus-meaning-plus-do format.

**Optional distance chart.** Inside a collapsed expander, each facet drawn as the distance between the two people, ordered by distance, longest at the top. Long lines are where they differ most, tight pairs at the bottom are where they match.

### 3.4 Narrative sections, all modes (in order)
1. **Paired profile overview.** Where each leads, where they mirror, the single most important shared pattern (a shared high or shared low), and the framing that their distance is mostly an asset not yet divided into roles. Apply the threat-first principle.
2. **What it means for the pair.** Three plain bullets.
3. **What we found, and what to do.** The four signal cards.
4. **What is going on inside each of you.** Use the within-person Detracts and Masks pairs from the interactions sheet. Surface where a loud trait hides a quieter one (one person reads confident but is fragile underneath; another reads bold but has thin caution). One short block per person.
5. **What each of you needs from the other.** The signature output. Two plain statements: what A needs from B, what B needs from A. This is the most useful read in the report; make it prominent.
6. **Three suggested next steps.** Four sub-bullets each.
7. **How the pair communicates.** In general, under pressure, and how to avoid communication conflict.
8. **How the pair handles conflict.** Mitigate, and promote healthy conflict.

### 3.5 Romantic-only added sections
Insert these in Romantic mode, after the signal cards and before the standard next steps.

**Building intimacy.** Driven entirely by the threat-to-reward principle, which is BrainWise's own model, so it borrows from no one. Structure it as: (a) each partner's on-ramp, meaning the unmet threat needs that must be met first, because closeness cannot grow while either feels unsafe, unseen, or off-balance; (b) where their closeness needs align or diverge, read from emotional safety, love and attachment, harmony, and authenticity (name mismatches plainly, for example one craving reassurance while the other needs space, so neither misreads the other); (c) the shared sources of joy and meaning to build on once the ground is safe, read from the Pleasure and Purpose facets (play, shared enjoyment, shared values and meaning). Keep the language relational, warm, and non-explicit.

**Spousal suggested next steps.** A separate next-steps section generated natively from the pair's own signals, translated into repair and connection moves. A collision on being heard becomes a step about not talking over each other and repairing after a blow-up. A within-person tension becomes a step about criticizing the issue and not the person. A blind spot becomes a step about checking in before resentment builds. These land in the same territory established couples work covers, but they are derived from the instrument and written in original BrainWise language. See Section 4.

---

## 4. Guardrails (apply to all generation)

**No branded third-party IP.** Do not name or reproduce any third-party framework, model, trademark, or its structure, including named couples-therapy systems and their signature terms. The overlapping ideas may be expressed only in original BrainWise wording, and recommendations should be derived from the PTP signals themselves, never lifted from an external system.

**Risk, not diagnosis.** The PTP measures needs, not behaviors or conditions. Never assert that a person or pair exhibits a behavior the instrument did not measure. Frame everything as patterns that raise the likelihood of something, with the move that helps, for example "both needing the last word, plus one of you going quiet under pressure, is the setup where shutdown tends to grow, so here is the antidote," not "you shut down."

**Romantic mode gating.** The romantic mode carries a stronger disclaimer than the work and personal modes and should be gated on coach competence, because relationship coaching is a different qualification from work coaching. Keep all romantic content relational, never clinical or explicit.

**Illustrative data.** Until real scores are wired in, all numbers and named facets in a generated example are clearly labeled as illustrative.

---

## 5. Generation checklist
1. Load the workbook. Read tags, routing, parameters, interactions.
2. Take member scores. Compute mean, spread, and shape per facet (team), or per-person values and distances (paired).
3. Route every in-scope facet to a signal.
4. For each report, pick the headline facet per signal and generate the cards.
5. Generate the narrative sections in order, in the chosen mode and language.
6. For Romantic, add the intimacy and spousal next-steps sections under the guardrails.
7. Fill every `{{TOKEN}}` from the branding supplied this session. Choose nothing.
8. Confirm: no em dashes, no branded IP, risk-not-diagnosis throughout.

---

## Appendix A: Visual implementation (exact build)

This is the authoritative build detail for the visuals named in Sections 2.2 and 3.3. Reproduce the geometry, opacities, stroke widths, font sizes, motifs, captions, and behavior exactly. Only colors and fonts are tokens. All example numbers reproduce the approved reports; real data replaces them.

### A.0 Conventions and token mapping

All visuals are inline SVG drawn at runtime, set to width 100 percent and made responsive by the viewBox (no fixed pixel width). Coordinates below are in viewBox units.

Color tokens (the working files carry placeholder hex values; replace each with the token):
- Domain colors: Protection `{{COLOR_PROTECTION}}`, Participation `{{COLOR_PARTICIPATION}}`, Prediction `{{COLOR_PREDICTION}}`, Purpose `{{COLOR_PURPOSE}}`, Pleasure `{{COLOR_PLEASURE}}`.
- Signal colors: Collision `{{COLOR_COLLISION}}`, Friction `{{COLOR_FRICTION}}`, Complementarity `{{COLOR_COMPLEMENTARITY}}`, Blind spot `{{COLOR_BLINDSPOT}}`, Saturating `{{COLOR_SATURATING}}`, Alignment `{{COLOR_ALIGNMENT}}`.
- Person colors: A `{{COLOR_PERSON_A}}`, B `{{COLOR_PERSON_B}}`.
- The team profile shape fill and the bar average markers use `{{COLOR_PRIMARY}}`.
- Structural neutrals: hairlines, gridlines, and spokes use `{{COLOR_LINE}}`; faint scale numbers and small captions use `{{COLOR_MUTED}}`; data labels use `{{COLOR_TEXT}}`; dot halos use the card background (white). Where a caption is a darker shade of a signal color, use that signal token.

Fonts: axis labels, value labels, and headings use `{{FONT_HEADING}}`; scale numbers, captions, and body text use `{{FONT_BODY}}`.

Tooltip behavior (all charts): a div positioned absolutely inside a position-relative wrapper. On a marker's mouseenter, set its HTML and place it at (cursorX minus wrapper-left plus 12, cursorY minus wrapper-top minus 10), then show it; on mouseleave, hide it. All hoverable markers use a pointer cursor and a white halo stroke.

Radial helpers (used by triangle and pentagon): for N axes, the angle of axis i is (-90 + i times 360 divided by N) degrees, so axis 0 points straight up and the rest go clockwise. A point at axis i and radius r is (cx plus r cosine(angle), cy plus r sine(angle)).

### A.1 Team triangle (3-axis radial)
viewBox 0 0 440 430. Center cx 220, cy 205, max radius R 140, N 3. Axis order: 0 Protection (top), 1 Participation (lower right), 2 Prediction (lower left).
- Domain wedges: for each axis, a pie slice centered on the axis spanning plus and minus 180/N degrees out to R, filled the domain color at 0.10 opacity. Path form: move to center, line to the R point at (angle minus pi/N), arc (R R 0 0 1) to the R point at (angle plus pi/N), close.
- Gridlines: concentric circles at radius R times g/100 for g in 25, 50, 75, 100, stroke `{{COLOR_LINE}}` width 1, no fill. Print g at (cx plus 3, cy minus R times g/100 plus 3), size 9, `{{COLOR_MUTED}}`.
- Spokes: line from center to the R point of each axis, stroke `{{COLOR_LINE}}` width 1.
- Profile shape: polygon through each axis point at radius R times value/100, fill `{{COLOR_PRIMARY}}` at 0.14, stroke `{{COLOR_PRIMARY}}` width 2.5, round joins.
- Vertex markers: circle radius 6 at each profile point, fill the domain color, white stroke width 2. Hover shows "<b>{domain}</b><br>team average {value}".
- Axis labels: at radius R plus 24, size 13, weight 600, `{{FONT_HEADING}}`, domain color, anchored center, y plus 4.
- Value labels: at radius (R times value/100) offset outward 16 (for the top axis, offset up 16 instead), size 13, weight 700, domain color, center.
- Example values: Protection 58, Participation 44, Prediction 61.

### A.2 Dimension agreement bars
viewBox 0 0 720 210. Plot from x 140 to x 690, so x of value v is 140 plus v/100 times 550. First row top 24, row height 58.
- Vertical gridlines at v in 0, 25, 50, 75, 100, from y 16 to y past the last row, stroke `{{COLOR_LINE}}` width 1; scale number above at y 12, size 11, `{{COLOR_MUTED}}`, center.
- Per domain, with row center cy at top plus index times 58 plus 16:
  - Domain name at x 12, y cy plus 2, size 14, weight 500, `{{COLOR_TEXT}}`.
  - Agreement tag at x 12, y cy plus 18, size 11, `{{COLOR_MUTED}}`: if range (hi minus lo) is 40 or more "members vary a lot", else 25 or more "some variation", else "fairly aligned".
  - Range band: rounded rect from x of lo to x of hi, y cy minus 9, height 18, corner radius 9, fill the domain color at 0.16. Hover shows "{domain} range<br><b>{lo} to {hi}</b>".
  - Average marker: circle radius 8 at x of avg, fill `{{COLOR_PRIMARY}}`, white stroke 2. Hover shows "{domain} average<br><b>{avg}</b>".
  - Average value label above the marker at y cy minus 14, size 12, weight 700, `{{COLOR_PRIMARY}}`, center.
- Example: Protection avg 58 range 41 to 72; Participation avg 44 range 22 to 68; Prediction avg 61 range 38 to 88.
- Optional per-member dots: one small dot per member at x of their score on the bar, hover showing name and score. This is the only place individual member scores are plotted.

### A.3 Team signal cards (six)
Each card is one SVG, viewBox 0 0 320 84. Shared frame: a baseline at y 50 from x 24 to x 296, stroke `{{COLOR_LINE}}` width 2, round caps; the word "Lower" at (24, 72) and "Higher" right-anchored at (296, 72), size 10, `{{COLOR_MUTED}}`.
Member dots are radius 6.5, fill the signal color at 0.9, white stroke 1.5. A cluster of n dots is laid out in rows of three: dot k sits at x equal to clusterX plus ((k mod 3) minus 1) times 9, and y equal to 43 minus floor(k/3) times 11 (that is, stacked upward from just above the baseline).
- Collision (`{{COLOR_COLLISION}}`): cluster of 10 at clusterX 250; a star glyph at (289, 40) size 17; three faint converging lines from near the cluster (x 266, y 40 offset by minus 8, 0, plus 8) to the star (x 282, y 37), width 1.5, opacity 0.5.
- Friction (`{{COLOR_FRICTION}}`): two clusters of 6 at clusterX 78 and 236; two arrowheads in the gap pointing at each other, a right-pointing head at x 150 and a left-pointing head at x 170, both at y 41, width 2.5, round. An arrowhead is a two-segment open path 7 units wide and 5 tall.
- Complementarity (`{{COLOR_COMPLEMENTARITY}}`): two clusters of 6 at 78 and 236; a bold plus sign at (160, 47) size 22 weight 700; an arc above, path "M74 20 Q160 4 240 20", width 1.5, opacity 0.5; caption "one complete team" at (160, 15) size 10, center.
- Blind spot (`{{COLOR_BLINDSPOT}}`): cluster of 10 at clusterX 70; a dashed empty rounded rect at x 178, y 20, width 116, height 42, radius 9, stroke width 1.2, dash "4 4", opacity 0.55; caption "no one here" at (236, 45) size 11, opacity 0.65, center.
- Saturating (`{{COLOR_SATURATING}}`): cluster of 10 at clusterX 248; caption "everyone high then no one speaks" at (160, 14) size 10, center.
- Alignment (`{{COLOR_ALIGNMENT}}`): cluster of 10 at clusterX 208 (a single mid-high cluster, not two); an arc "M170 24 Q208 10 246 24" width 1.5, opacity 0.6; caption "shared ground" at (208, 16) size 10, center.
Each card's body text (the plain "what it is" line and the "Do this" line) sits below the SVG in the card, per Section 2.2.

### A.4 Optional team signal map (scatter, inside the expander)
viewBox 0 0 760 440. Plot x 58 to 730, y top 40 to bottom 370, maximum spread shown 36. X of mean v is 58 plus v/100 times 672. Y of spread s is 370 minus s/36 times 330 (higher spread sits higher).
- Zone shading: a faint blind-spot rectangle in the low-left, a faint collision rectangle in the low-right, and a faint divergent rectangle across the top, each in the matching signal color at about 0.04 to 0.05 opacity.
- Bottom and left axis lines `{{COLOR_LINE}}`. X scale numbers 0 to 100 below the axis. X axis title "Team average then scarce or shared", Y axis title "Spread" rotated, both `{{COLOR_MUTED}}`. Zone labels "Blind spots", "Collision", and "Divergent (friction / complementarity)" in darker shades of the matching signal colors.
- Points: circle radius 9, fill the signal color at 0.85, white stroke 2. Hover shows "<b>{facet}</b><br>avg {mean} times spread {spread}<br>{signal}".
- Example points (mean, spread, signal): Voice and influence 86, 6, collision; Recognition need 81, 9, collision; Correctness need 74, 11, collision; Situational awareness 19, 9, blind; Short-term loss aversion 24, 12, blind; Well-being vigilance (others) 28, 10, blind; Consistency need 52, 30, friction; Commitment reliability 50, 26, friction; Ambiguity tolerance 47, 28, friction; Action orientation 49, 31, complementarity; Risk tolerance 62, 27, complementarity; Status quo and stability 56, 29, complementarity; Embarrassment avoidance 78, 8, saturating; Equality and reciprocity 80, 8, alignment; Need to trust others 78, 10, alignment.

### A.5 Paired pentagon (5-axis radial, two people)
viewBox 0 0 440 440. Center cx 220, cy 222, R 135, N 5. Axis order: 0 Protection (top), then clockwise 1 Participation, 2 Prediction, 3 Purpose, 4 Pleasure.
- Domain wedges: same pie-slice construction as the triangle, domain color at 0.10.
- Gridlines: at g in 25, 50, 75, 100, a closed pentagon polygon through each axis point at radius R times g/100, stroke `{{COLOR_LINE}}` width 1, no fill (pentagon rings, not circles).
- Spokes and axis labels: spoke to each R point, label at radius R plus 24, size 12.5, weight 600, domain color, center.
- Two series, drawn in the order B then A so A sits on top. Each series is a polygon through its axis points at radius R times value/100, fill the person color at 0.13, stroke the person color width 2.5, round joins. Vertex dots radius 5, person color, white stroke 1.5. Hover shows "<b>{person}</b><br>{domain}: {value}".
- Example: Person A `{{COLOR_PERSON_A}}` values Protection 59, Participation 41, Prediction 50, Purpose 52, Pleasure 55. Person B `{{COLOR_PERSON_B}}` values 40, 70, 75, 45, 38.

### A.6 Paired signal cards (four, two-dot version)
Same card frame as A.3 (viewBox 320 by 84, baseline, Lower and Higher labels). Here each dot is radius 8 at y 42, fill the signal color at 0.9, white stroke 2.
- Collision (`{{COLOR_COLLISION}}`): dots at x 244 and 262; star at (290, 38) size 17; two short converging lines from (270, 42 offset minus 6 and plus 6) to (283, 36), opacity 0.5; caption "both high" at (150, 38), `{{COLOR_MUTED}}`.
- Complementarity (`{{COLOR_COMPLEMENTARITY}}`): dots at x 70 and 250; bold plus at (160, 47) size 22; arc "M66 22 Q160 6 254 22" opacity 0.5; caption "two halves, one whole" at (160, 17).
- Blind spot (`{{COLOR_BLINDSPOT}}`): dots at x 64 and 82; dashed empty rounded rect x 170, y 20, width 124, height 42, radius 9, dash "4 4", opacity 0.55; caption "neither one here" at (232, 45), opacity 0.65.
- Alignment (`{{COLOR_ALIGNMENT}}`): dots at x 226 and 248; arc "M220 22 Q237 8 254 22" opacity 0.6; caption "both high, shared ground" at (150, 38).

### A.7 Optional paired distance chart (dumbbell, inside the expander)
viewBox 0 0 760 320. Plot x 190 to 620, so x of value v is 190 plus v/100 times 430. First row top 26, row height 44. Rows are ordered by descending distance between A and B.
- Vertical gridlines at 0, 25, 50, 75, 100 with scale numbers above, `{{COLOR_LINE}}` and `{{COLOR_MUTED}}`.
- Per row at row center cy equal to 26 plus index times 44: facet label at x 12, y cy plus 4, size 12.5, `{{COLOR_TEXT}}`; a connector line from x of A to x of B, stroke `{{COLOR_LINE}}` width 2; the text "{distance} apart" at the midpoint, y cy minus 8, size 10, `{{COLOR_MUTED}}`, center; a dot radius 7 at x of A in `{{COLOR_PERSON_A}}` and a dot radius 7 at x of B in `{{COLOR_PERSON_B}}`, white stroke 1.5. Hover shows "Person A · <b>{value}</b>" or "Person B · <b>{value}</b>".
- Example rows (A, B): Action orientation 9, 82; Recognition need 86, 30; Consistency need 92, 40; Risk tolerance 91, 45; Voice and influence 93, 88; Situational awareness 11, 15; Trust in each other 82, 79.

