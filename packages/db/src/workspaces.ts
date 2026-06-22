import { randomBytes } from "node:crypto";
import { DEFAULT_WORKSPACE_ID, getDatabase, randomLikeId, withTransaction } from "./database.ts";
import type { StoredWorkspaceRecord } from "./types.ts";

const JOIN_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const JOIN_CODE_LENGTH = 8;
const JOIN_CODE_MAX_ATTEMPTS = 20;

export type HardDeleteWorkspaceResult = {
  deletedWorkspace: boolean;
  removedWorkspaceRows: number;
  removedWorkspaceSnapshotRows: number;
  removedMembershipRows: number;
  removedInvitationRows: number;
  removedGoogleOAuthCredentialRows: number;
  removedAgentGoogleWorkspaceDelegationRows: number;
  removedChannelRows: number;
  removedEmployeeRows: number;
  removedTaskRows: number;
  removedDaemonRows: number;
  removedDaemonTokenRows: number;
  removedRuntimeRows: number;
  removedRuntimeDisplayNameRows: number;
  removedRuntimeGrantRows: number;
  removedDocumentAgentAccessRows: number;
  removedDocumentPermissionRequestRows: number;
  removedAgentAccessRequestRows: number;
  removedKnowledgeProposalRows: number;
  removedAgentForkInvitationRows: number;
  removedAgentForkSnapshotRows: number;
  removedNotificationRows: number;
  removedBindingRows: number;
  removedAgentRouterProviderSessionRows: number;
  removedAgentTaskAttemptRows: number;
  removedAgentRouterEventRows: number;
  removedAgentRouterContextSnapshotRows: number;
  removedAgentRouterSessionRows: number;
  removedQueuedTaskRows: number;
  removedTaskMessageRows: number;
  removedTokenUsageRows: number;
  removedSkillRows: number;
  removedAgentSkillRows: number;
  removedKnowledgeAssignmentPolicyRows: number;
  removedAgentKnowledgePageRows: number;
  removedSkillImportEventRows: number;
  removedBudgetRows: number;
};

/** Slug: lowercase alphanumeric + hyphens, max 48 chars */
function generateSlug(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = id.slice(0, 6);
  return `${base}-${suffix}`;
}

export function createWorkspaceSync(params: {
  name: string;
  createdBy: string;
  id?: string;
  slug?: string;
}): StoredWorkspaceRecord {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = params.id ?? randomLikeId();
  const slug = params.slug ?? generateSlug(params.name, id);
  const joinCode = generateUniqueWorkspaceJoinCodeSync();

  db.prepare(
    `INSERT INTO workspace (
       id, slug, name, created_by, created_at, updated_at,
       join_code, join_code_updated_at, join_code_updated_by
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, slug, params.name, params.createdBy, now, now, joinCode, now, params.createdBy);

  return {
    id,
    slug,
    name: params.name,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
    joinCode,
    joinCodeUpdatedAt: now,
    joinCodeUpdatedBy: params.createdBy,
  };
}

export function readWorkspaceSync(idOrSlug: string): StoredWorkspaceRecord | null {
  const db = getDatabase();
  // Try id first, then slug
  const row = (db.prepare(
    `SELECT id, slug, name, created_by, created_at, updated_at, archived_at,
            join_code, join_code_updated_at, join_code_updated_by
     FROM workspace
     WHERE id = ? OR slug = ?`,
  ).get(idOrSlug, idOrSlug) as {
    id: string; slug: string; name: string; created_by: string;
    created_at: string; updated_at: string; archived_at: string | null;
    join_code: string | null; join_code_updated_at: string | null; join_code_updated_by: string | null;
  } | undefined) ?? null;

  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
    joinCode: row.join_code ?? undefined,
    joinCodeUpdatedAt: row.join_code_updated_at ?? undefined,
    joinCodeUpdatedBy: row.join_code_updated_by ?? undefined,
  };
}

export function listWorkspacesSync(): StoredWorkspaceRecord[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT id, slug, name, created_by, created_at, updated_at, archived_at,
            join_code, join_code_updated_at, join_code_updated_by
     FROM workspace
     WHERE archived_at IS NULL
     ORDER BY created_at DESC`,
  ).all() as Array<{
    id: string; slug: string; name: string; created_by: string;
    created_at: string; updated_at: string; archived_at: string | null;
    join_code: string | null; join_code_updated_at: string | null; join_code_updated_by: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
    joinCode: row.join_code ?? undefined,
    joinCodeUpdatedAt: row.join_code_updated_at ?? undefined,
    joinCodeUpdatedBy: row.join_code_updated_by ?? undefined,
  }));
}

export function readWorkspaceByJoinCodeSync(joinCode: string): StoredWorkspaceRecord | null {
  const normalizedJoinCode = normalizeWorkspaceJoinCode(joinCode);
  if (!normalizedJoinCode) {
    return null;
  }

  const db = getDatabase();
  const row = (db.prepare(
    `SELECT id, slug, name, created_by, created_at, updated_at, archived_at,
            join_code, join_code_updated_at, join_code_updated_by
     FROM workspace
     WHERE join_code = ? AND archived_at IS NULL`,
  ).get(normalizedJoinCode) as {
    id: string; slug: string; name: string; created_by: string;
    created_at: string; updated_at: string; archived_at: string | null;
    join_code: string | null; join_code_updated_at: string | null; join_code_updated_by: string | null;
  } | undefined) ?? null;

  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
    joinCode: row.join_code ?? undefined,
    joinCodeUpdatedAt: row.join_code_updated_at ?? undefined,
    joinCodeUpdatedBy: row.join_code_updated_by ?? undefined,
  };
}

export function rotateWorkspaceJoinCodeSync(input: {
  workspaceId: string;
  updatedBy: string;
}): StoredWorkspaceRecord {
  const db = getDatabase();
  const now = new Date().toISOString();
  const joinCode = generateUniqueWorkspaceJoinCodeSync(input.workspaceId);
  const result = db.prepare(
    `UPDATE workspace
     SET join_code = ?, join_code_updated_at = ?, join_code_updated_by = ?, updated_at = ?
     WHERE id = ? AND archived_at IS NULL`,
  ).run(joinCode, now, input.updatedBy, now, input.workspaceId);

  if (result.changes === 0) {
    throw new Error("workspace.join_code.workspace_not_found");
  }

  const workspace = readWorkspaceSync(input.workspaceId);
  if (!workspace) {
    throw new Error("workspace.join_code.workspace_not_found");
  }
  return workspace;
}

export function ensureWorkspaceJoinCodesSync(): number {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT id FROM workspace
     WHERE archived_at IS NULL
       AND (join_code IS NULL OR join_code = '')`,
  ).all() as Array<{ id: string }>;

  let updated = 0;
  for (const row of rows) {
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE workspace
       SET join_code = ?, join_code_updated_at = ?, join_code_updated_by = ?, updated_at = ?
       WHERE id = ?`,
    ).run(generateUniqueWorkspaceJoinCodeSync(row.id), now, "system", now, row.id);
    updated += 1;
  }
  return updated;
}

export function updateWorkspaceSync(
  id: string,
  patch: Partial<Pick<StoredWorkspaceRecord, "name" | "slug">>,
): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const sets: string[] = ["updated_at = ?"];
  const values: string[] = [now];

  if (patch.name !== undefined) {
    sets.push("name = ?");
    values.push(patch.name);
  }
  if (patch.slug !== undefined) {
    sets.push("slug = ?");
    values.push(patch.slug);
  }

  values.push(id);
  db.prepare(`UPDATE workspace SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function archiveWorkspaceSync(id: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`UPDATE workspace SET archived_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id);
}

function generateUniqueWorkspaceJoinCodeSync(excludeWorkspaceId?: string): string {
  for (let attempt = 0; attempt < JOIN_CODE_MAX_ATTEMPTS; attempt += 1) {
    const joinCode = generateWorkspaceJoinCode();
    const existing = readWorkspaceByJoinCodeSync(joinCode);
    if (!existing || existing.id === excludeWorkspaceId) {
      return joinCode;
    }
  }
  throw new Error("workspace.join_code.collision");
}

function generateWorkspaceJoinCode(): string {
  const bytes = randomBytes(JOIN_CODE_LENGTH);
  let code = "";
  for (const byte of bytes) {
    code += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
  }
  return code;
}

function normalizeWorkspaceJoinCode(joinCode: string): string {
  return joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hardDeleteWorkspaceSync(id: string): HardDeleteWorkspaceResult {
  if (id === DEFAULT_WORKSPACE_ID) {
    throw new Error(`Cannot hard-delete the default workspace "${DEFAULT_WORKSPACE_ID}".`);
  }

  const db = getDatabase();

  return withTransaction(db, () => {
    const removedTaskMessageRows = Number(
      db.prepare(
        `DELETE FROM task_message
         WHERE task_id IN (
           SELECT id
           FROM agent_task_queue
           WHERE workspace_id = ?
         )`,
      ).run(id).changes,
    );

    const removedTokenUsageRows = Number(
      db.prepare("DELETE FROM token_usage WHERE workspace_id = ?").run(id).changes,
    );

    const removedAgentRouterEventRows = Number(
      db.prepare("DELETE FROM agent_router_event WHERE workspace_id = ?").run(id).changes,
    );

    const removedAgentRouterContextSnapshotRows = Number(
      db.prepare("DELETE FROM agent_router_context_snapshot WHERE workspace_id = ?").run(id).changes,
    );

    const removedAgentTaskAttemptRows = Number(
      db.prepare("DELETE FROM agent_task_attempt WHERE workspace_id = ?").run(id).changes,
    );

    const removedAgentRouterProviderSessionRows = Number(
      db.prepare("DELETE FROM agent_router_provider_session WHERE workspace_id = ?").run(id).changes,
    );

    const removedQueuedTaskRows = Number(
      db.prepare("DELETE FROM agent_task_queue WHERE workspace_id = ?").run(id).changes,
    );

    const removedAgentRouterSessionRows = Number(
      db.prepare("DELETE FROM agent_router_session WHERE workspace_id = ?").run(id).changes,
    );

    const removedBindingRows = Number(
      db.prepare("DELETE FROM employee_runtime_binding WHERE workspace_id = ?").run(id).changes,
    );

    const removedRuntimeGrantRows = Number(
      db.prepare("DELETE FROM workspace_runtime_grant WHERE workspace_id = ?").run(id).changes,
    );

    const removedDocumentAgentAccessRows = Number(
      db.prepare("DELETE FROM document_agent_access WHERE workspace_id = ?").run(id).changes,
    );

    const removedDocumentPermissionRequestRows = Number(
      db.prepare("DELETE FROM document_permission_request WHERE workspace_id = ?").run(id).changes,
    );

    const removedAgentAccessRequestRows = Number(
      db.prepare("DELETE FROM agent_access_request WHERE workspace_id = ?").run(id).changes,
    );

    const removedKnowledgeProposalRows = Number(
      db.prepare("DELETE FROM knowledge_proposal WHERE workspace_id = ?").run(id).changes,
    );

    const removedAgentForkSnapshotRows = Number(
      db.prepare("DELETE FROM agent_fork_snapshot WHERE workspace_id = ?").run(id).changes,
    );

    const removedAgentForkInvitationRows = Number(
      db.prepare("DELETE FROM agent_fork_invitation WHERE workspace_id = ?").run(id).changes,
    );

    const removedNotificationRows = Number(
      db.prepare("DELETE FROM workspace_notification WHERE workspace_id = ?").run(id).changes,
    );

    const removedRuntimeDisplayNameRows = Number(
      db.prepare("DELETE FROM workspace_runtime_display_name WHERE workspace_id = ?").run(id).changes,
    );

    const removedRuntimeRows = Number(
      db.prepare("DELETE FROM agent_runtime WHERE workspace_id = ?").run(id).changes,
    );

    const removedDaemonRows = Number(
      db.prepare("DELETE FROM daemon_connection WHERE workspace_id = ?").run(id).changes,
    );

    const removedDaemonTokenRows = Number(
      db.prepare("DELETE FROM daemon_api_token WHERE workspace_id = ?").run(id).changes,
    );

    const removedTaskRows = Number(
      db.prepare("DELETE FROM workspace_task WHERE workspace_id = ?").run(id).changes,
    );

    const removedChannelRows = Number(
      db.prepare("DELETE FROM workspace_channel WHERE workspace_id = ?").run(id).changes,
    );

    const removedEmployeeRows = Number(
      db.prepare("DELETE FROM workspace_employee WHERE workspace_id = ?").run(id).changes,
    );

    const removedAgentSkillRows = Number(
      db.prepare("DELETE FROM agent_skill WHERE workspace_id = ?").run(id).changes,
    );

    const removedAgentKnowledgePageRows = Number(
      db.prepare("DELETE FROM agent_knowledge_page WHERE workspace_id = ?").run(id).changes,
    );

    const removedKnowledgeAssignmentPolicyRows = Number(
      db.prepare("DELETE FROM knowledge_page_assignment_policy WHERE workspace_id = ?").run(id).changes,
    );

    const removedSkillImportEventRows = Number(
      db.prepare("DELETE FROM skill_import_event WHERE workspace_id = ?").run(id).changes,
    );

    const removedBudgetRows = Number(
      db.prepare("DELETE FROM budget WHERE workspace_id = ?").run(id).changes,
    );

    const removedSkillRows = Number(
      db.prepare("DELETE FROM skill WHERE workspace_id = ?").run(id).changes,
    );

    const removedMembershipRows = Number(
      db.prepare("DELETE FROM workspace_membership WHERE workspace_id = ?").run(id).changes,
    );

    const removedInvitationRows = Number(
      db.prepare("DELETE FROM workspace_invitation WHERE workspace_id = ?").run(id).changes,
    );

    const removedAgentGoogleWorkspaceDelegationRows = Number(
      db.prepare("DELETE FROM agent_google_workspace_delegation WHERE workspace_id = ?").run(id).changes,
    );

    const removedGoogleOAuthCredentialRows = Number(
      db.prepare("DELETE FROM google_oauth_credential WHERE workspace_id = ?").run(id).changes,
    );

    const removedWorkspaceSnapshotRows = Number(
      db.prepare("DELETE FROM workspace_snapshot WHERE id = ?").run(id).changes,
    );

    const removedWorkspaceRows = Number(
      db.prepare("DELETE FROM workspace WHERE id = ?").run(id).changes,
    );

    return {
      deletedWorkspace: removedWorkspaceRows > 0,
      removedWorkspaceRows,
      removedWorkspaceSnapshotRows,
      removedMembershipRows,
      removedInvitationRows,
      removedGoogleOAuthCredentialRows,
      removedAgentGoogleWorkspaceDelegationRows,
      removedChannelRows,
      removedEmployeeRows,
      removedTaskRows,
      removedDaemonRows,
      removedDaemonTokenRows,
      removedRuntimeRows,
      removedRuntimeDisplayNameRows,
      removedRuntimeGrantRows,
      removedDocumentAgentAccessRows,
      removedDocumentPermissionRequestRows,
      removedAgentAccessRequestRows,
      removedKnowledgeProposalRows,
      removedAgentForkInvitationRows,
      removedAgentForkSnapshotRows,
      removedNotificationRows,
      removedBindingRows,
      removedAgentRouterProviderSessionRows,
      removedAgentTaskAttemptRows,
      removedAgentRouterEventRows,
      removedAgentRouterContextSnapshotRows,
      removedAgentRouterSessionRows,
      removedQueuedTaskRows,
      removedTaskMessageRows,
      removedTokenUsageRows,
      removedSkillRows,
      removedAgentSkillRows,
      removedKnowledgeAssignmentPolicyRows,
      removedAgentKnowledgePageRows,
      removedSkillImportEventRows,
      removedBudgetRows,
    };
  });
}
