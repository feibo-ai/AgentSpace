import { createHash, randomBytes } from "node:crypto";
import { getDatabase, randomLikeId, withTransaction } from "./database.ts";
import { readWorkspaceMembershipSync, upsertWorkspaceMembershipSync } from "./workspace-memberships.ts";
import { readUserSync } from "./user-auth.ts";
import type { StoredWorkspaceInvitationRecord, WorkspaceInvitationStatus, WorkspaceRole } from "./types.ts";

const DEFAULT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreatedWorkspaceInvitationRecord extends StoredWorkspaceInvitationRecord {
  token: string;
}

export function createWorkspaceInvitationSync(input: {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  expiresAt?: string;
}): CreatedWorkspaceInvitationRecord {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = `invite-${randomLikeId()}`;
  const token = `wsi_${randomBytes(24).toString("hex")}`;
  const tokenHash = hashWorkspaceInvitationToken(token);
  const email = normalizeInvitationEmail(input.email);
  if (!email) {
    throw new Error("workspace.invitation.missing_email");
  }

  const expiresAt = input.expiresAt ?? new Date(Date.now() + DEFAULT_INVITATION_TTL_MS).toISOString();
  withTransaction(db, () => {
    db.prepare(
      `UPDATE workspace_invitation
       SET status = 'revoked'
       WHERE workspace_id = ? AND email = ? AND status = 'active'`,
    ).run(input.workspaceId, email);

    db.prepare(
      `INSERT INTO workspace_invitation (
        id,
        workspace_id,
        email,
        role,
        token_hash,
        status,
        invited_by,
        created_at,
        expires_at,
        accepted_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL)`,
    ).run(id, input.workspaceId, email, input.role, tokenHash, input.invitedBy, now, expiresAt);
  });

  return {
    id,
    workspaceId: input.workspaceId,
    email,
    role: input.role,
    tokenHash,
    status: "active",
    invitedBy: input.invitedBy,
    createdAt: now,
    expiresAt,
    token,
  };
}

export function readActiveWorkspaceInvitationByTokenSync(token: string): StoredWorkspaceInvitationRecord | null {
  const db = getDatabase();
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return null;
  }

  const record = readWorkspaceInvitationRowByTokenHashSync(hashWorkspaceInvitationToken(normalizedToken));
  if (!record || record.status !== "active") {
    return null;
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    expireWorkspaceInvitationSync(record.id);
    return null;
  }
  return record;
}

export function readWorkspaceInvitationByTokenSync(token: string): StoredWorkspaceInvitationRecord | null {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return null;
  }

  const record = readWorkspaceInvitationRowByTokenHashSync(hashWorkspaceInvitationToken(normalizedToken));
  if (!record) {
    return null;
  }
  if (record.status === "active" && new Date(record.expiresAt).getTime() <= Date.now()) {
    expireWorkspaceInvitationSync(record.id);
    return { ...record, status: "expired" };
  }
  return record;
}

export function listWorkspaceInvitationsSync(
  workspaceId: string,
  options?: { statuses?: WorkspaceInvitationStatus[] },
): StoredWorkspaceInvitationRecord[] {
  const db = getDatabase();
  const statuses = options?.statuses?.length ? options.statuses : ["active"];
  const placeholders = statuses.map(() => "?").join(", ");
  const rows = db.prepare(
    `SELECT
      id,
      workspace_id AS workspaceId,
      email,
      role,
      token_hash AS tokenHash,
      status,
      invited_by AS invitedBy,
      created_at AS createdAt,
      expires_at AS expiresAt,
      accepted_at AS acceptedAt
     FROM workspace_invitation
     WHERE workspace_id = ? AND status IN (${placeholders})
     ORDER BY created_at DESC, id DESC`,
  ).all(workspaceId, ...statuses) as Array<Record<string, unknown>>;

  return rows
    .map((row) => mapWorkspaceInvitationRecord(row))
    .filter((row): row is StoredWorkspaceInvitationRecord => row !== null)
    .map((record) => {
      if (record.status === "active" && new Date(record.expiresAt).getTime() <= Date.now()) {
        expireWorkspaceInvitationSync(record.id);
        return { ...record, status: "expired" } satisfies StoredWorkspaceInvitationRecord;
      }
      return record;
    });
}

export function countActiveWorkspaceInvitationsSync(workspaceId: string): number {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT COUNT(*) AS count
     FROM workspace_invitation
     WHERE workspace_id = ? AND status = 'active' AND expires_at > ?`,
  ).get(workspaceId, new Date().toISOString()) as { count?: number } | undefined;

  return typeof row?.count === "number" ? row.count : 0;
}

export function revokeWorkspaceInvitationSync(invitationId: string, workspaceId?: string): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = workspaceId
    ? db.prepare(
      `UPDATE workspace_invitation
       SET status = CASE WHEN status = 'active' THEN 'revoked' ELSE status END,
           expires_at = CASE WHEN status = 'active' THEN ? ELSE expires_at END
       WHERE id = ? AND workspace_id = ?`,
    ).run(now, invitationId, workspaceId)
    : db.prepare(
      `UPDATE workspace_invitation
       SET status = CASE WHEN status = 'active' THEN 'revoked' ELSE status END,
           expires_at = CASE WHEN status = 'active' THEN ? ELSE expires_at END
       WHERE id = ?`,
    ).run(now, invitationId);

  return Number(result.changes) > 0;
}

export function acceptWorkspaceInvitationSync(
  token: string,
  userId: string,
): StoredWorkspaceInvitationRecord {
  const db = getDatabase();
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error("workspace.invitation.invalid");
  }

  return withTransaction(db, () => {
    const record = readWorkspaceInvitationRowByTokenHashSync(hashWorkspaceInvitationToken(normalizedToken));
    if (!record) {
      throw new Error("workspace.invitation.invalid");
    }
    if (record.status !== "active") {
      throw new Error("workspace.invitation.inactive");
    }
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      expireWorkspaceInvitationSync(record.id);
      throw new Error("workspace.invitation.expired");
    }

    const user = readUserSync(userId);
    const userEmail = normalizeInvitationEmail(user?.primaryEmail);
    if (!userEmail || userEmail !== normalizeInvitationEmail(record.email)) {
      throw new Error("workspace.invitation.email_mismatch");
    }

    const existingMembership = readWorkspaceMembershipSync(record.workspaceId, userId);
    const acceptedRole = resolveAcceptedInvitationRole(existingMembership?.role, record.role);
    upsertWorkspaceMembershipSync({
      workspaceId: record.workspaceId,
      userId,
      role: acceptedRole,
      invitedBy: record.invitedBy,
    });

    const acceptedAt = new Date().toISOString();
    db.prepare(
      `UPDATE workspace_invitation
       SET status = 'accepted', accepted_at = ?
       WHERE id = ?`,
    ).run(acceptedAt, record.id);

    return {
      ...record,
      status: "accepted",
      acceptedAt,
    };
  });
}

function readWorkspaceInvitationRowByTokenHashSync(tokenHash: string): StoredWorkspaceInvitationRecord | null {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT
      id,
      workspace_id AS workspaceId,
      email,
      role,
      token_hash AS tokenHash,
      status,
      invited_by AS invitedBy,
      created_at AS createdAt,
      expires_at AS expiresAt,
      accepted_at AS acceptedAt
     FROM workspace_invitation
     WHERE token_hash = ?`,
  ).get(tokenHash) as Record<string, unknown> | undefined;

  return row ? mapWorkspaceInvitationRecord(row) : null;
}

function expireWorkspaceInvitationSync(invitationId: string): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE workspace_invitation
     SET status = CASE WHEN status = 'active' THEN 'expired' ELSE status END
     WHERE id = ?`,
  ).run(invitationId);
}

function mapWorkspaceInvitationRecord(value: Record<string, unknown>): StoredWorkspaceInvitationRecord | null {
  if (
    typeof value.id !== "string" ||
    typeof value.workspaceId !== "string" ||
    typeof value.email !== "string" ||
    (value.role !== "owner" && value.role !== "admin" && value.role !== "member") ||
    typeof value.tokenHash !== "string" ||
    (value.status !== "active" && value.status !== "accepted" && value.status !== "revoked" && value.status !== "expired") ||
    typeof value.invitedBy !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.expiresAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    workspaceId: value.workspaceId,
    email: value.email,
    role: value.role,
    tokenHash: value.tokenHash,
    status: value.status,
    invitedBy: value.invitedBy,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    acceptedAt: typeof value.acceptedAt === "string" ? value.acceptedAt : undefined,
  };
}

function normalizeInvitationEmail(email: string | undefined): string | undefined {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function hashWorkspaceInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function resolveAcceptedInvitationRole(
  currentRole: WorkspaceRole | undefined,
  invitationRole: WorkspaceRole,
): WorkspaceRole {
  if (!currentRole) {
    return invitationRole;
  }

  const rank: Record<WorkspaceRole, number> = {
    member: 0,
    admin: 1,
    owner: 2,
  };

  return rank[currentRole] >= rank[invitationRole] ? currentRole : invitationRole;
}
