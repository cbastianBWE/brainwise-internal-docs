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
