"use client";

import { type Dispatch, type SetStateAction, type TransitionStartFunction, useState } from "react";
import { rotateWorkspaceJoinCodeAction, updateWorkspaceProfileAction } from "@/features/settings/actions";
import { SettingsSectionShell } from "@/features/settings/components/settings-chrome";
import type { SettingsSectionMeta } from "@/features/settings/settings-meta";
import type { SettingsTx } from "@/features/settings/settings-types";
import { translateSettingsActionError } from "@/features/settings/settings-utils";
import { EmptyState } from "@/shared/ui/empty-state";

export function SettingsWorkspaceSection({
  canManageWorkspaceProfile,
  currentWorkspaceName,
  currentWorkspaceSlug,
  currentWorkspaceJoinCode,
  currentWorkspaceJoinCodeUpdatedAt,
  isPending,
  meta,
  refreshSettingsData,
  setWorkspaceFeedback,
  setWorkspaceName,
  startTransition,
  tx,
  workspaceFeedback,
  workspaceName,
}: {
  canManageWorkspaceProfile: boolean;
  currentWorkspaceName: string;
  currentWorkspaceSlug: string;
  currentWorkspaceJoinCode?: string;
  currentWorkspaceJoinCodeUpdatedAt?: string;
  isPending: boolean;
  meta: SettingsSectionMeta;
  refreshSettingsData: () => void;
  setWorkspaceFeedback: Dispatch<SetStateAction<string | null>>;
  setWorkspaceName: Dispatch<SetStateAction<string>>;
  startTransition: TransitionStartFunction;
  tx: SettingsTx;
  workspaceFeedback: string | null;
  workspaceName: string;
}) {
  const [workspaceJoinCode, setWorkspaceJoinCode] = useState(currentWorkspaceJoinCode);
  const [workspaceJoinCodeUpdatedAt, setWorkspaceJoinCodeUpdatedAt] = useState(currentWorkspaceJoinCodeUpdatedAt);

  return (
    <SettingsSectionShell meta={meta}>
      <section className="page-panel">
        <div className="panel-header">
          <div>
            <h3>{tx("基础设置", "Base Settings")}</h3>
            <p className="settings-panel-note">
              {tx("这里放工作区名称、标识和后续 owner-only 的核心配置。", "Keep workspace name, slug, and future owner-only controls in one place.")}
            </p>
          </div>
        </div>

        <div className="settings-workspace-profile">
          <label className="form-field">
            <span>{tx("工作区名称", "Workspace Name")}</span>
            <input
              disabled={!canManageWorkspaceProfile || isPending}
              onChange={(event) => setWorkspaceName(event.currentTarget.value)}
              value={workspaceName}
            />
          </label>

          <label className="form-field">
            <span>{tx("工作区标识", "Workspace Slug")}</span>
            <input disabled value={currentWorkspaceSlug} />
          </label>

          {canManageWorkspaceProfile ? (
            <button
              className="primary-button"
              disabled={isPending || workspaceName.trim().length === 0 || workspaceName.trim() === currentWorkspaceName}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await updateWorkspaceProfileAction({ name: workspaceName });
                    setWorkspaceFeedback(tx("工作区设置已更新。", "Workspace settings updated."));
                    refreshSettingsData();
                  } catch (error) {
                    setWorkspaceFeedback(translateSettingsActionError(error, tx));
                  }
                });
              }}
              type="button"
            >
              {tx("保存工作区设置", "Save Workspace Settings")}
            </button>
          ) : (
            <EmptyState title={tx("只有所有者可以修改工作区设置。", "Only owners can edit workspace settings.")} />
          )}
        </div>

        {workspaceFeedback ? <p aria-live="polite" className="settings-feedback" role="status">{workspaceFeedback}</p> : null}
      </section>

      <section className="page-panel">
        <div className="panel-header">
          <div>
            <h3>{tx("工作区邀请码", "Workspace Join Code")}</h3>
            <p className="settings-panel-note">
              {tx("Owner 可以复制或重置邀请码。通过邀请码加入的用户默认是 member。", "Owners can copy or reset the code. Users who join by code become members.")}
            </p>
          </div>
        </div>

        {canManageWorkspaceProfile ? (
          <div className="settings-join-code-card">
            <div>
              <span>{tx("当前邀请码", "Current code")}</span>
              <strong>{workspaceJoinCode || "--------"}</strong>
              <small>
                {workspaceJoinCodeUpdatedAt
                  ? tx(`最近更新：${workspaceJoinCodeUpdatedAt}`, `Updated: ${workspaceJoinCodeUpdatedAt}`)
                  : tx("尚未记录更新时间", "No update timestamp recorded")}
              </small>
            </div>
            <div className="settings-join-code-card__actions">
              <button
                className="action-button"
                disabled={!workspaceJoinCode}
                onClick={() => {
                  if (workspaceJoinCode && typeof navigator !== "undefined" && navigator.clipboard) {
                    void navigator.clipboard.writeText(workspaceJoinCode);
                    setWorkspaceFeedback(tx("邀请码已复制。", "Join code copied."));
                  }
                }}
                type="button"
              >
                {tx("复制邀请码", "Copy code")}
              </button>
              <button
                className="action-button action-button--danger"
                disabled={isPending}
                onClick={() => {
                  if (!window.confirm(tx("重置后旧邀请码会立即失效，确定继续？", "The old code stops working immediately. Continue?"))) {
                    return;
                  }
                  startTransition(async () => {
                    try {
                      const result = await rotateWorkspaceJoinCodeAction();
                      setWorkspaceJoinCode(result.data.joinCode);
                      setWorkspaceJoinCodeUpdatedAt(result.data.updatedAt);
                      setWorkspaceFeedback(tx("邀请码已重置。", "Join code reset."));
                      refreshSettingsData();
                    } catch (error) {
                      setWorkspaceFeedback(translateSettingsActionError(error, tx));
                    }
                  });
                }}
                type="button"
              >
                {tx("重置邀请码", "Reset code")}
              </button>
            </div>
          </div>
        ) : (
          <EmptyState title={tx("只有所有者可以查看和重置邀请码。", "Only owners can view and reset the join code.")} />
        )}
      </section>
    </SettingsSectionShell>
  );
}
