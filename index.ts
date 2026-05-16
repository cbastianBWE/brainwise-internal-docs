import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

// skills-practice-attachment-upload v1 (Session 77 Step 3)
// Trainee/mentor file-upload subsystem for skills_practice content items.
// FileUploadField (the authoring upload component) is super-admin-gated and
// produces content_assets ids; it cannot be used by a trainee. This function is
// the trainee/mentor-facing equivalent, writing a plain storage path into
// content_item_completions.skills_attachment_url (trainee) or
// skills_mentor_attachment_url (mentor) via the set_skills_practice_attachment RPC.
//
// Class A (custom auth via getClaims; verify_jwt:false). Role-parameterized:
//   role 'trainee' -> caller uploads their own evidence
//   role 'mentor'  -> caller (mentor of trainee, or super admin) uploads for a trainee
// The mentor role path has no UI in Step 3; the Phase 6 mentor portal will use it.
//
// Three actions:
//   request  -> access-check (via get_content_item_for_viewer) + signed upload URL
//   finalize -> set_skills_practice_attachment RPC records the storage path
//   read     -> signed download URL for an existing attachment
//
// Bucket: skills-practice-attachments (private, 200MB, image/video/pdf/office).

const BUCKET = 'skills-practice-attachments';
const UPLOAD_URL_TTL = 300;      // 5 min to start the upload
const DOWNLOAD_URL_TTL = 3600;   // 1 hr for viewing an existing attachment
const MAX_BYTES = 209715200;     // 200 MB, mirrors the bucket limit

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

let checkpoint = 'start';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return jsonError(405, 'method_not_allowed');

  checkpoint = 'entry';
  try {
    checkpoint = 'auth_header';
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return jsonError(401, 'missing_bearer_token');
    const token = authHeader.replace('Bearer ', '');

    checkpoint = 'env_read';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    checkpoint = 'get_claims';
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return jsonError(401, 'invalid_jwt');
    const callerId = claimsData.claims.sub as string;

    checkpoint = 'json_parse';
    let body: {
      action?: string;
      content_item_id?: string;
      role?: string;
      trainee_user_id?: string;
      mime_type?: string;
      size_bytes?: number;
      original_filename?: string;
      storage_path?: string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'invalid_json_body');
    }

    const action = body.action;
    if (!action || !['request', 'finalize', 'read'].includes(action)) {
      return jsonError(400, `unknown_action: ${action}`);
    }
    const contentItemId = body.content_item_id;
    if (!contentItemId || typeof contentItemId !== 'string') {
      return jsonError(400, 'content_item_id_required');
    }
    const role = body.role;
    if (!role || !['trainee', 'mentor'].includes(role)) {
      return jsonError(400, `invalid_role: ${role}`);
    }
    // For mentor role, the trainee whose row is targeted must be named.
    const traineeUserId = role === 'mentor' ? body.trainee_user_id : callerId;
    if (role === 'mentor' && !traineeUserId) {
      return jsonError(400, 'trainee_user_id_required_for_mentor_role');
    }

    // caller-JWT client for access-checked RPC calls; service client for storage.
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Access pre-check: get_content_item_for_viewer raises if the caller cannot
    // reach the item for the target user. For the trainee role, target = caller.
    // For the mentor role, target = trainee_user_id and the caller must resolve
    // as a mentor (viewer_role 'mentor') or super_admin.
    checkpoint = 'access_check';
    const { data: viewerData, error: viewerErr } = await callerClient.rpc(
      'get_content_item_for_viewer',
      {
        p_content_item_id: contentItemId,
        p_user_id: role === 'mentor' ? traineeUserId : null,
      }
    );
    if (viewerErr) {
      return jsonResponse(403, { error: viewerErr.message || 'access_denied' });
    }
    const viewerRole = (viewerData as Record<string, unknown>)?.viewer_role;
    const itemType = ((viewerData as Record<string, unknown>)?.content_item as Record<string, unknown>)?.item_type;
    if (itemType !== 'skills_practice') {
      return jsonError(400, 'content_item_not_skills_practice');
    }
    if (role === 'mentor' && viewerRole !== 'mentor' && viewerRole !== 'super_admin') {
      return jsonResponse(403, { error: 'not_authorized_for_mentor_attachment' });
    }

    // ----- READ: signed download URL for an existing attachment -----
    if (action === 'read') {
      checkpoint = 'read_path_lookup';
      const column = role === 'trainee' ? 'skills_attachment_url' : 'skills_mentor_attachment_url';
      const { data: compRow, error: compErr } = await serviceClient
        .from('content_item_completions')
        .select(column)
        .eq('user_id', traineeUserId)
        .eq('content_item_id', contentItemId)
        .maybeSingle();
      if (compErr) return jsonResponse(500, { error: 'completion_lookup_failed' });
      const storedPath = compRow ? (compRow as Record<string, string | null>)[column] : null;
      if (!storedPath) {
        return jsonResponse(404, { error: 'no_attachment' });
      }
      checkpoint = 'read_sign';
      const { data: signed, error: signErr } = await serviceClient.storage
        .from(BUCKET)
        .createSignedUrl(storedPath, DOWNLOAD_URL_TTL);
      if (signErr || !signed?.signedUrl) {
        return jsonResponse(500, { error: 'sign_failed', detail: signErr?.message });
      }
      return jsonResponse(200, {
        signed_url: signed.signedUrl,
        storage_path: storedPath,
        expires_in_seconds: DOWNLOAD_URL_TTL,
      });
    }

    // ----- REQUEST: validate file, issue a signed upload URL -----
    if (action === 'request') {
      checkpoint = 'request_validate';
      const mime = body.mime_type;
      const size = body.size_bytes;
      const filename = body.original_filename;
      if (!mime || !ALLOWED_MIME.has(mime)) {
        return jsonError(400, `mime_type_not_allowed: ${mime ?? '(none)'}`);
      }
      if (!size || typeof size !== 'number' || size <= 0) {
        return jsonError(400, 'size_bytes_required_positive');
      }
      if (size > MAX_BYTES) {
        return jsonError(400, 'file_too_large');
      }
      if (!filename || typeof filename !== 'string') {
        return jsonError(400, 'original_filename_required');
      }
      // Construct a stable storage path: <content_item_id>/<role>/<target>/<uuid>.<ext>
      const ext = (filename.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const objectId = crypto.randomUUID();
      const storagePath = `${contentItemId}/${role}/${traineeUserId}/${objectId}.${ext}`;

      checkpoint = 'request_sign';
      const { data: signed, error: signErr } = await serviceClient.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath);
      if (signErr || !signed) {
        return jsonResponse(500, { error: 'signed_upload_url_failed', detail: signErr?.message });
      }
      return jsonResponse(200, {
        signed_upload_url: signed.signedUrl,
        upload_token: signed.token,
        bucket: BUCKET,
        storage_path: storagePath,
        expires_in_seconds: UPLOAD_URL_TTL,
      });
    }

    // ----- FINALIZE: record the storage path on the completion row -----
    if (action === 'finalize') {
      checkpoint = 'finalize_validate';
      const storagePath = body.storage_path;
      if (!storagePath || typeof storagePath !== 'string') {
        return jsonError(400, 'storage_path_required');
      }
      // Confirm the object actually exists in the bucket before recording it.
      checkpoint = 'finalize_verify_object';
      const slash = storagePath.lastIndexOf('/');
      const dir = slash >= 0 ? storagePath.slice(0, slash) : '';
      const fname = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;
      const { data: listed, error: listErr } = await serviceClient.storage
        .from(BUCKET)
        .list(dir, { search: fname, limit: 1 });
      if (listErr) return jsonResponse(500, { error: 'object_verify_failed' });
      if (!listed || listed.length === 0) {
        return jsonResponse(400, { error: 'uploaded_object_not_found' });
      }

      checkpoint = 'finalize_rpc';
      const { data: rpcData, error: rpcErr } = await callerClient.rpc(
        'set_skills_practice_attachment',
        {
          p_content_item_id: contentItemId,
          p_role: role,
          p_storage_path: storagePath,
          p_trainee_user_id: role === 'mentor' ? traineeUserId : null,
        }
      );
      if (rpcErr) {
        return jsonResponse(403, { error: rpcErr.message || 'set_attachment_failed' });
      }
      return jsonResponse(200, {
        ...(rpcData as Record<string, unknown>),
        ok: true,
      });
    }

    return jsonError(400, 'unhandled_action');
  } catch (e) {
    const err = e as Error;
    console.error('skills_practice_attachment_upload_unhandled', { checkpoint, name: err?.name, message: err?.message });
    return jsonResponse(500, { error: 'internal_error', checkpoint, message: err?.message ?? String(e) });
  }
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function jsonError(status: number, code: string): Response {
  return jsonResponse(status, { error: code });
}
