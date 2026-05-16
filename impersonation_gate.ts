import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type ImpersonationDenylistCategory =
  | "identity_change" | "assessment_submission" | "privacy_consent"
  | "financial_transaction" | "outbound_user_communication"
  | "permission_change" | "corporate_admin_action" | "coach_action"
  | "lifecycle_action" | "read_only" | "other";

export class ImpersonationDeniedError extends Error {
  public readonly impSessionId: string | null;
  constructor(message: string, impSessionId: string | null) {
    super(message);
    this.name = "ImpersonationDeniedError";
    this.impSessionId = impSessionId;
  }
}

export type ImpersonationGateResult =
  | { gated: false }
  | { gated: true; imp_session_id: string; imp_actor_user_id: string; imp_target_user_id: string; imp_mode: "act" };

export async function enforceImpersonationGate(
  callerClient: SupabaseClient,
  category: ImpersonationDenylistCategory,
): Promise<ImpersonationGateResult> {
  const { data, error } = await callerClient.rpc("assert_impersonation_allows", { p_action_category: category });

  if (error) {
    if ((error as { code?: string }).code === "42501") {
      const detail = (error as { details?: string }).details || "";
      const match = detail.match(/imp_session_id=([0-9a-f-]+)/i);
      throw new ImpersonationDeniedError(error.message, match ? match[1] : null);
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.status === "no_impersonation") return { gated: false };

  if (row.status === "act_allowed") {
    return {
      gated: true,
      imp_session_id: row.imp_session_id,
      imp_actor_user_id: row.imp_actor_user_id,
      imp_target_user_id: row.imp_target_user_id,
      imp_mode: "act",
    };
  }

  throw new Error(`Unknown impersonation gate status: ${row.status}`);
}

export async function logImpersonationAction(
  callerClient: SupabaseClient,
  args: { target_user_id: string | null; target_org_id: string | null; edge_function_name: string; before: unknown; after: unknown },
): Promise<void> {
  const after = { ...((args.after && typeof args.after === "object") ? args.after as Record<string, unknown> : {}), edge_function: args.edge_function_name };
  const { error } = await callerClient.rpc("log_super_admin_action", {
    p_target_user_id: args.target_user_id,
    p_target_org_id: args.target_org_id,
    p_action_type: "impersonation_action",
    p_before: args.before ?? null,
    p_after: after,
    p_reason: null,
    p_mode: null,
  });
  if (error) {
    console.error(`[impersonation_gate] audit row failed from ${args.edge_function_name}:`, error);
  }
}
