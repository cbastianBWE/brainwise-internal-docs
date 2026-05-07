# BrainWise Session NN to MM Handoff

*Closeout: Session NN. Open: Session MM.*

## Where Session NN left off

[Brief 2-3 sentence summary of what shipped, what was decided, and what's queued.]

## Session MM opening priorities, in order

### 1. [First priority]

[Description, files affected, verification steps.]

### 2. [Second priority]

...

## Decisions locked in Session NN (recap)

- [Decision 1]
- [Decision 2]
- ...

## Open questions / things to lock in Session MM

[List, or "None blocking"]

## Bugs surfaced in Session NN added to Build Queue

- BUG-X [PRIORITY]: [one-line summary]
- ...

## What's NOT in scope for Session MM

- [Out-of-scope item 1]
- ...

## Architecture additions in Session NN

[Describe any new RPCs, tables, columns, Edge Functions, or patterns that were added. These should also be recorded in architecture-reference.md.]

## Test fixture state at end of Session NN

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

[Describe any AIRSA / instrument fixtures, their state, and any pending cleanup needed.]

## Documents this session leaves behind

- BrainWise_Build_Queue_v<N>.docx (uploaded to project knowledge)
- BrainWise_System_Architecture_Reference_v<M>.docx (uploaded to project knowledge)
- BrainWise_Session_NN_to_MM_Handoff.docx (this document, uploaded to project knowledge)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs.
