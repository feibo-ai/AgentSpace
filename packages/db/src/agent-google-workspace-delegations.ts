import { DEFAULT_WORKSPACE_ID, getDatabase, randomLikeId, withTransaction } from "./database.ts";
import type { StoredAgentGoogleWorkspaceDelegationRecord } from "./types.ts";

export function upsertAgentGoogleWorkspaceDelegationSync(input: {
  workspaceId?: string;
  employeeName: string;
  userId: string;
  googleOAuthCredentialId: string;
  scopes: string;
  googleEmail?: string;
  grantedByUserId: string;
}): StoredAgentGoogleWorkspaceDelegationRecord {
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const employeeName = input.employeeName.trim();
  const userId = input.userId.trim();
  const googleOAuthCredentialId = input.googleOAuthCredentialId.trim();
  const scopes = normalizeScopes(input.scopes);
  const grantedByUserId = input.grantedByUserId.trim();

  if (!employeeName) {
    throw new Error("Agent Google Workspace delegation employee name is required.");
  }
  if (!userId) {
    throw new Error("Agent Google Workspace delegation user id is required.");
  }
  if (!googleOAuthCredentialId) {
    throw new Error("Agent Google Workspace delegation credential id is required.");
  }
  if (!scopes) {
    throw new Error("Agent Google Workspace delegation scopes are required.");
  }
  if (!grantedByUserId) {
    throw new Error("Agent Google Workspace delegation grantor user id is required.");
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const id = `agent-google-delegation-${randomLikeId()}`;

  withTransaction(db, () => {
    db.prepare(
      `UPDATE agent_google_workspace_delegation
       SET status = 'revoked',
           updated_at = ?,
           revoked_at = ?
       WHERE workspace_id = ?
         AND employee_name = ?
         AND user_id <> ?
         AND status = 'active'`,
    ).run(now, now, workspaceId, employeeName, userId);

    db.prepare(
      `INSERT INTO agent_google_workspace_delegation (
         id,
         workspace_id,
         employee_name,
         user_id,
         google_oauth_credential_id,
         status,
         scopes,
         google_email,
         granted_by_user_id,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, employee_name, user_id)
       DO UPDATE SET
         google_oauth_credential_id = EXCLUDED.google_oauth_credential_id,
         status = 'active',
         scopes = EXCLUDED.scopes,
         google_email = EXCLUDED.google_email,
         granted_by_user_id = EXCLUDED.granted_by_user_id,
         updated_at = EXCLUDED.updated_at,
         revoked_at = NULL`,
    ).run(
      id,
      workspaceId,
      employeeName,
      userId,
      googleOAuthCredentialId,
      scopes,
      normalizeOptionalEmail(input.googleEmail),
      grantedByUserId,
      now,
      now,
    );
  });

  const delegation = readAgentGoogleWorkspaceDelegationSync({ workspaceId, employeeName, userId });
  if (!delegation) {
    throw new Error("Agent Google Workspace delegation could not be read back.");
  }
  return delegation;
}

export function readAgentGoogleWorkspaceDelegationSync(input: {
  workspaceId?: string;
  employeeName: string;
  userId: string;
}): StoredAgentGoogleWorkspaceDelegationRecord | null {
  const db = getDatabase();
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const row = db.prepare(
    `SELECT
       id,
       workspace_id AS workspaceId,
       employee_name AS employeeName,
       user_id AS userId,
       google_oauth_credential_id AS googleOAuthCredentialId,
       status,
       scopes,
       google_email AS googleEmail,
       granted_by_user_id AS grantedByUserId,
       created_at AS createdAt,
       updated_at AS updatedAt,
       revoked_at AS revokedAt
     FROM agent_google_workspace_delegation
     WHERE workspace_id = ? AND employee_name = ? AND user_id = ?`,
  ).get(workspaceId, input.employeeName.trim(), input.userId.trim()) as Record<string, unknown> | undefined;

  return row ? mapAgentGoogleWorkspaceDelegationRecord(row) : null;
}

export function readActiveAgentGoogleWorkspaceDelegationSync(input: {
  workspaceId?: string;
  employeeName: string;
}): StoredAgentGoogleWorkspaceDelegationRecord | null {
  const db = getDatabase();
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const row = db.prepare(
    `SELECT
       id,
       workspace_id AS workspaceId,
       employee_name AS employeeName,
       user_id AS userId,
       google_oauth_credential_id AS googleOAuthCredentialId,
       status,
       scopes,
       google_email AS googleEmail,
       granted_by_user_id AS grantedByUserId,
       created_at AS createdAt,
       updated_at AS updatedAt,
       revoked_at AS revokedAt
     FROM agent_google_workspace_delegation
     WHERE workspace_id = ? AND employee_name = ? AND status = 'active'
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
  ).get(workspaceId, input.employeeName.trim()) as Record<string, unknown> | undefined;

  return row ? mapAgentGoogleWorkspaceDelegationRecord(row) : null;
}

export function listAgentGoogleWorkspaceDelegationsSync(
  workspaceId = DEFAULT_WORKSPACE_ID,
): StoredAgentGoogleWorkspaceDelegationRecord[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT
       id,
       workspace_id AS workspaceId,
       employee_name AS employeeName,
       user_id AS userId,
       google_oauth_credential_id AS googleOAuthCredentialId,
       status,
       scopes,
       google_email AS googleEmail,
       granted_by_user_id AS grantedByUserId,
       created_at AS createdAt,
       updated_at AS updatedAt,
       revoked_at AS revokedAt
     FROM agent_google_workspace_delegation
     WHERE workspace_id = ?
     ORDER BY updated_at DESC, id DESC`,
  ).all(workspaceId) as Array<Record<string, unknown>>;

  return rows
    .map((row) => mapAgentGoogleWorkspaceDelegationRecord(row))
    .filter((row): row is StoredAgentGoogleWorkspaceDelegationRecord => row !== null);
}

export function revokeAgentGoogleWorkspaceDelegationSync(input: {
  workspaceId?: string;
  employeeName: string;
  userId: string;
}): StoredAgentGoogleWorkspaceDelegationRecord {
  const db = getDatabase();
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const employeeName = input.employeeName.trim();
  const userId = input.userId.trim();
  const now = new Date().toISOString();

  const result = db.prepare(
    `UPDATE agent_google_workspace_delegation
     SET status = 'revoked',
         updated_at = ?,
         revoked_at = ?
     WHERE workspace_id = ? AND employee_name = ? AND user_id = ? AND status = 'active'`,
  ).run(now, now, workspaceId, employeeName, userId);

  if (result.changes === 0) {
    throw new Error("Agent Google Workspace delegation does not exist.");
  }

  const delegation = readAgentGoogleWorkspaceDelegationSync({ workspaceId, employeeName, userId });
  if (!delegation) {
    throw new Error("Agent Google Workspace delegation could not be read back.");
  }
  return delegation;
}

function mapAgentGoogleWorkspaceDelegationRecord(value: Record<string, unknown>): StoredAgentGoogleWorkspaceDelegationRecord | null {
  if (
    typeof value.id !== "string" ||
    typeof value.workspaceId !== "string" ||
    typeof value.employeeName !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.googleOAuthCredentialId !== "string" ||
    (value.status !== "active" && value.status !== "revoked") ||
    typeof value.scopes !== "string" ||
    typeof value.grantedByUserId !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    workspaceId: value.workspaceId,
    employeeName: value.employeeName,
    userId: value.userId,
    googleOAuthCredentialId: value.googleOAuthCredentialId,
    status: value.status,
    scopes: value.scopes,
    googleEmail: typeof value.googleEmail === "string" ? value.googleEmail : undefined,
    grantedByUserId: value.grantedByUserId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    revokedAt: typeof value.revokedAt === "string" ? value.revokedAt : undefined,
  };
}

function normalizeScopes(value: string): string {
  return value
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)
    .join(" ");
}

function normalizeOptionalEmail(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}
