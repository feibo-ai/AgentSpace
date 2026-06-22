"use client";

import { type Dispatch, type SetStateAction, type TransitionStartFunction } from "react";
import { updateCurrentUserProfileAction } from "@/features/settings/actions";
import { SettingsSectionShell } from "@/features/settings/components/settings-chrome";
import type { SettingsSectionMeta } from "@/features/settings/settings-meta";
import type { SettingsTx } from "@/features/settings/settings-types";
import { translateSettingsActionError } from "@/features/settings/settings-utils";

export function SettingsAccountSection({
  currentAccountEmail,
  displayName,
  isPending,
  meta,
  profileFeedback,
  refreshSettingsData,
  savedDisplayName,
  setDisplayName,
  setProfileFeedback,
  setSavedDisplayName,
  startTransition,
  tx,
}: {
  currentAccountEmail: string;
  displayName: string;
  isPending: boolean;
  meta: SettingsSectionMeta;
  profileFeedback: string | null;
  refreshSettingsData: () => void;
  savedDisplayName: string;
  setDisplayName: Dispatch<SetStateAction<string>>;
  setProfileFeedback: Dispatch<SetStateAction<string | null>>;
  setSavedDisplayName: Dispatch<SetStateAction<string>>;
  startTransition: TransitionStartFunction;
  tx: SettingsTx;
}) {
  return (
    <SettingsSectionShell meta={meta}>
      <section className="page-panel">
        <div className="panel-header">
          <div>
            <h3>{tx("账号资料", "Profile")}</h3>
            <p className="settings-panel-note">
              {tx("修改当前账号在工作区中显示的用户名。", "Change the display name shown for your account in the workspace.")}
            </p>
          </div>
        </div>

        <div className="settings-workspace-profile">
          <label className="form-field">
            <span>{tx("用户名", "Username")}</span>
            <input
              disabled={isPending}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
              value={displayName}
            />
          </label>

          <label className="form-field">
            <span>{tx("登录邮箱", "Sign-in Email")}</span>
            <input disabled value={currentAccountEmail} />
          </label>

          <button
            className="primary-button"
            disabled={isPending || displayName.trim().length === 0 || displayName.trim() === savedDisplayName}
            onClick={() => {
              startTransition(async () => {
                try {
                  await updateCurrentUserProfileAction({ displayName });
                  setSavedDisplayName(displayName.trim());
                  setProfileFeedback(tx("用户名已更新。", "Username updated."));
                  refreshSettingsData();
                } catch (error) {
                  setProfileFeedback(translateSettingsActionError(error, tx));
                }
              });
            }}
            type="button"
          >
            {tx("保存用户名", "Save Username")}
          </button>
        </div>

        {profileFeedback ? <p aria-live="polite" className="settings-feedback" role="status">{profileFeedback}</p> : null}
      </section>
    </SettingsSectionShell>
  );
}
