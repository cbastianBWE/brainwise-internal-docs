# BrainWise Internal Docs

Source-of-truth markdown for BrainWise closeout artifacts. This repo is the canonical version of the Build Queue, Architecture Reference, and Session Handoffs. Word documents (`.docx`) for project-knowledge upload are generated from these markdown files at session close.

## Layout

```
docs/
  build-queue.md              # current Build Queue (latest version)
  architecture-reference.md   # current Architecture Reference (latest version)
  session-handoffs/
    session-NN-to-MM.md       # handoff per session (immutable history)
tools/
  generate_docx.py            # converts the three markdown sources to binary .docx
  write_doc_helper.py         # canonical styling helper used by generate_docx.py
```

## Workflow for Claude

**At session start:**
1. Read `docs/build-queue.md`, `docs/architecture-reference.md`, and the latest handoff in `docs/session-handoffs/`
2. These are the canonical source-of-truth. Do not re-read older `.docx` versions from project knowledge unless explicitly needed.

**During session:**
1. Edit the three docs in place via `str_replace` as decisions get locked, items shift state, bugs surface
2. Do not rewrite from scratch - apply targeted deltas

**At session close:**
1. Create a new `docs/session-handoffs/session-NN-to-MM.md` for this session
2. Bump version markers in build-queue.md and architecture-reference.md
3. Push markdown changes to GitHub via `create_or_update_file`
4. Run `tools/generate_docx.py` locally to produce three `.docx` files
5. Present the `.docx` files for upload to project knowledge

## Sanitization rules

This repo is **public**. The following must NEVER appear in plaintext anywhere in this repo:

- Passwords of any kind (test, production, service)
- API keys, tokens, secrets
- Plaintext UUIDs of test users (use `<+orgmember-uuid>`, `<+supervisor-uuid>`, `<+employee-uuid>` placeholders)
- Production user emails or PII
- Stripe IDs, webhook secrets, internal function secrets
- Database connection strings

Architectural details (RPC names, table schemas, Edge Function versions, brand colors, build queue items, decision logs) are fine - they're discoverable from the public `brainwise-blueprint` repo anyway.

## Test fixture lookup

Test user details (UUIDs, password) live in Claude's `userMemories` block, not in this repo. When a session needs test fixture access, Claude should:

1. Look up the org UUID and user emails from `userMemories` (always available)
2. Query Supabase directly via MCP to get current user UUIDs
3. Ask the user for the test password if not present in memory

The test org is `BrainWise Test Corp`. Test user emails follow the `testclientbwe+<role>@gmail.com` pattern.

## Generating .docx files

Requires `python-docx` (already installed in Claude's environment):

```bash
cd tools/
python3 generate_docx.py
```

Output: three `.docx` files in `tools/output/`, ready for project-knowledge upload.
