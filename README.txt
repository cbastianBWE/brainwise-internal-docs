EDGE FUNCTIONS OWED TO GitHub (cbastianBWE/brainwise-blueprint, branch main)
Carryover from Session 77 — confirmed Session 78 still uncommitted.

Upload each index.ts to its path under supabase/functions/ in the repo:

  supabase/functions/draft-text/index.ts                          (live v7)
  supabase/functions/draft-text/_shared/impersonation_gate.ts      (shared dep — also not in repo)
  supabase/functions/get-content-item-video-url/index.ts           (live v1)
  supabase/functions/content-item-ai-assist/index.ts               (live v1)
  supabase/functions/skills-practice-attachment-upload/index.ts    (live v1)
  supabase/functions/content-item-file-upload/index.ts             (live v1)

content-item-file-upload needs NO v2 — the cascade pass-through works via the
existing {...rpcData} spread in the finalize action. Just commit the v1 source.

NOTE on _shared/impersonation_gate.ts: this module lives in the deployed runtime
but the repo's supabase/functions/_shared/ has historically held only errors.ts +
secrets.ts. draft-text imports it via ../_shared/impersonation_gate.ts. Decide at
upload time whether the canonical path is supabase/functions/_shared/ (shared across
functions) or supabase/functions/draft-text/_shared/ (function-local). It is staged
here under draft-text/_shared/ matching draft-text's import path; if other functions
also import it, move it up one level and fix imports.

SEPARATE PRE-EXISTING DRIFT (not these five, flagged for awareness):
  create-checkout is live at v59 — repo last committed v56 (Session 73)
  customer-portal is live at v44 — repo last committed v41 (Session 73)
Reconcile these separately.
