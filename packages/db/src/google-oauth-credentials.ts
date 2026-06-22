import { DEFAULT_WORKSPACE_ID, getDatabase, randomLikeId } from "./database.ts";
import type { StoredGoogleOAuthCredentialRecord } from "./types.ts";

export function upsertGoogleOAuthCredentialSync(input: {
  workspaceId?: string;
  userId: string;
  googleSubject?: string;
  googleEmail?: string;
  scopes: string;
  accessTokenEncrypted?: string;
  refreshTokenEncrypted?: string;
  expiresAt?: string;
}): StoredGoogleOAuthCredentialRecord {
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const userId = input.userId.trim();
  const scopes = normalizeScopes(input.scopes);
  if (!userId) {
    throw new Error("Google OAuth credential user id is required.");
  }
  if (!scopes) {
    throw new Error("Google OAuth credential scopes are required.");
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const id = `google-oauth-${randomLikeId()}`;

  db.prepare(
    `INSERT INTO google_oauth_credential (
       id,
       workspace_id,
       user_id,
       google_subject,
       google_email,
       scopes,
       access_token_encrypted,
       refresh_token_encrypted,
       expires_at,
       status,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
     ON CONFLICT(workspace_id, user_id)
     DO UPDATE SET
       google_subject = EXCLUDED.google_subject,
       google_email = EXCLUDED.google_email,
       scopes = EXCLUDED.scopes,
       access_token_encrypted = COALESCE(EXCLUDED.access_token_encrypted, google_oauth_credential.access_token_encrypted),
       refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, google_oauth_credential.refresh_token_encrypted),
       expires_at = EXCLUDED.expires_at,
       status = 'active',
       updated_at = EXCLUDED.updated_at,
       revoked_at = NULL`,
  ).run(
    id,
    workspaceId,
    userId,
    normalizeOptionalString(input.googleSubject),
    normalizeOptionalEmail(input.googleEmail),
    scopes,
    normalizeOptionalString(input.accessTokenEncrypted),
    normalizeOptionalString(input.refreshTokenEncrypted),
    normalizeOptionalString(input.expiresAt),
    now,
    now,
  );

  const credential = readGoogleOAuthCredentialSync({ workspaceId, userId });
  if (!credential) {
    throw new Error("Google OAuth credential could not be read back.");
  }
  return credential;
}

export function readGoogleOAuthCredentialSync(input: {
  workspaceId?: string;
  userId: string;
}): StoredGoogleOAuthCredentialRecord | null {
  const db = getDatabase();
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const row = db.prepare(
    `SELECT
       id,
       workspace_id AS workspaceId,
       user_id AS userId,
       google_subject AS googleSubject,
       google_email AS googleEmail,
       scopes,
       access_token_encrypted AS accessTokenEncrypted,
       refresh_token_encrypted AS refreshTokenEncrypted,
       expires_at AS expiresAt,
       status,
       created_at AS createdAt,
       updated_at AS updatedAt,
       revoked_at AS revokedAt
     FROM google_oauth_credential
     WHERE workspace_id = ? AND user_id = ?`,
  ).get(workspaceId, input.userId.trim()) as Record<string, unknown> | undefined;

  return row ? mapGoogleOAuthCredentialRecord(row) : null;
}

export function readActiveGoogleOAuthCredentialSync(input: {
  workspaceId?: string;
  userId: string;
}): StoredGoogleOAuthCredentialRecord | null {
  const credential = readGoogleOAuthCredentialSync(input);
  return credential?.status === "active" ? credential : null;
}

export function listGoogleOAuthCredentialsSync(
  workspaceId = DEFAULT_WORKSPACE_ID,
): StoredGoogleOAuthCredentialRecord[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT
       id,
       workspace_id AS workspaceId,
       user_id AS userId,
       google_subject AS googleSubject,
       google_email AS googleEmail,
       scopes,
       access_token_encrypted AS accessTokenEncrypted,
       refresh_token_encrypted AS refreshTokenEncrypted,
       expires_at AS expiresAt,
       status,
       created_at AS createdAt,
       updated_at AS updatedAt,
       revoked_at AS revokedAt
     FROM google_oauth_credential
     WHERE workspace_id = ?
     ORDER BY updated_at DESC`,
  ).all(workspaceId) as Array<Record<string, unknown>>;

  return rows
    .map((row) => mapGoogleOAuthCredentialRecord(row))
    .filter((row): row is StoredGoogleOAuthCredentialRecord => row !== null);
}

export function revokeGoogleOAuthCredentialSync(input: {
  workspaceId?: string;
  userId: string;
}): StoredGoogleOAuthCredentialRecord {
  const db = getDatabase();
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const now = new Date().toISOString();
  const result = db.prepare(
    `UPDATE google_oauth_credential
     SET status = 'revoked',
         access_token_encrypted = NULL,
         refresh_token_encrypted = NULL,
         updated_at = ?,
         revoked_at = ?
     WHERE workspace_id = ? AND user_id = ?`,
  ).run(now, now, workspaceId, input.userId.trim());

  if (result.changes === 0) {
    throw new Error("Google OAuth credential does not exist.");
  }

  const credential = readGoogleOAuthCredentialSync({ workspaceId, userId: input.userId });
  if (!credential) {
    throw new Error("Google OAuth credential could not be read back.");
  }
  return credential;
}

function mapGoogleOAuthCredentialRecord(value: Record<string, unknown>): StoredGoogleOAuthCredentialRecord | null {
  if (
    typeof value.id !== "string" ||
    typeof value.workspaceId !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.scopes !== "string" ||
    (value.status !== "active" && value.status !== "revoked") ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    workspaceId: value.workspaceId,
    userId: value.userId,
    googleSubject: typeof value.googleSubject === "string" ? value.googleSubject : undefined,
    googleEmail: typeof value.googleEmail === "string" ? value.googleEmail : undefined,
    scopes: value.scopes,
    accessTokenEncrypted: typeof value.accessTokenEncrypted === "string" ? value.accessTokenEncrypted : undefined,
    refreshTokenEncrypted: typeof value.refreshTokenEncrypted === "string" ? value.refreshTokenEncrypted : undefined,
    expiresAt: typeof value.expiresAt === "string" ? value.expiresAt : undefined,
    status: value.status,
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

function normalizeOptionalString(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalEmail(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}
