"use client";

import { type Dispatch, type SetStateAction, type TransitionStartFunction } from "react";
import type { WorkspaceRole } from "@agent-space/db";
import {
  approveChannelAccessRequestAction,
  rejectChannelAccessRequestAction,
  revokeChannelInvitationAction,
} from "@/features/channels/actions";
import {
  createWorkspaceInvitationAction,
  reissueWorkspaceInvitationAction,
  revokeWorkspaceInvitationAction,
} from "@/features/settings/actions";
import { SettingsSectionShell } from "@/features/settings/components/settings-chrome";
import type { SettingsSectionMeta } from "@/features/settings/settings-meta";
import type {
  SettingsTx,
  SettingsChannelAccessRequestItem,
  SettingsChannelInvitationItem,
  SettingsWorkspaceInvitationItem,
} from "@/features/settings/settings-types";
import {
  describeInvitationState,
  formatSessionTimestamp,
  translateInvitationStatus,
  translateSettingsActionError,
  translateWorkspaceRole,
} from "@/features/settings/settings-utils";
import { EmptyState } from "@/shared/ui/empty-state";

export function SettingsAccessSection({
  activeInvitations,
  assignableRoles,
  canManageMembers,
  channelAccessRequests,
  channelInvitations,
  createdInvitePath,
  invitationHistory,
  inviteEmail,
  inviteFeedback,
  inviteRole,
  isPending,
  meta,
  refreshSettingsData,
  setCreatedInvitePath,
  setInviteEmail,
  setInviteFeedback,
  setInviteRole,
  startTransition,
  tx,
}: {
  activeInvitations: SettingsWorkspaceInvitationItem[];
  assignableRoles: readonly WorkspaceRole[];
  canManageMembers: boolean;
  channelAccessRequests: SettingsChannelAccessRequestItem[];
  channelInvitations: SettingsChannelInvitationItem[];
  createdInvitePath: string | null;
  invitationHistory: SettingsWorkspaceInvitationItem[];
  inviteEmail: string;
  inviteFeedback: string | null;
  inviteRole: WorkspaceRole;
  isPending: boolean;
  meta: SettingsSectionMeta;
  refreshSettingsData: () => void;
  setCreatedInvitePath: Dispatch<SetStateAction<string | null>>;
  setInviteEmail: Dispatch<SetStateAction<string>>;
  setInviteFeedback: Dispatch<SetStateAction<string | null>>;
  setInviteRole: Dispatch<SetStateAction<WorkspaceRole>>;
  startTransition: TransitionStartFunction;
  tx: SettingsTx;
}) {
  return (
    <SettingsSectionShell meta={meta}>
      <section className="page-panel settings-access-panel">
        <div className="panel-header">
          <div>
            <h3>{tx("邀请链接与待接受成员", "Invitation Links & Pending Invitees")}</h3>
            <p className="settings-panel-note">
              {tx("把准入入口和邀请历史集中在一页，后续也方便加入邀请码与审批能力。", "Keep invite entry points and history together so future invite code or approval flows can slot in cleanly.")}
            </p>
          </div>
        </div>

        {canManageMembers ? (
          <InvitationCreateForm
            assignableRoles={assignableRoles}
            inviteEmail={inviteEmail}
            inviteRole={inviteRole}
            isPending={isPending}
            setCreatedInvitePath={setCreatedInvitePath}
            setInviteEmail={setInviteEmail}
            setInviteFeedback={setInviteFeedback}
            setInviteRole={setInviteRole}
            refreshSettingsData={refreshSettingsData}
            startTransition={startTransition}
            tx={tx}
          />
        ) : (
          <EmptyState title={tx("仅管理员和所有者可管理邀请。", "Only admins and owners can manage invitations.")} />
        )}

        {inviteFeedback ? <p aria-live="polite" className="settings-feedback" role="status">{inviteFeedback}</p> : null}
        {createdInvitePath ? (
          <div className="settings-token-secret">
            <strong>{tx("最新邀请链接", "Latest Invitation Link")}</strong>
            <code>{createdInvitePath}</code>
          </div>
        ) : null}

        <div className="settings-invitation-list">
          <ChannelAccessRequestGroup
            canManageMembers={canManageMembers}
            requests={channelAccessRequests}
            isPending={isPending}
            setInviteFeedback={setInviteFeedback}
            refreshSettingsData={refreshSettingsData}
            startTransition={startTransition}
            tx={tx}
          />
          <ChannelInvitationGroup
            canManageMembers={canManageMembers}
            invitations={channelInvitations}
            isPending={isPending}
            setInviteFeedback={setInviteFeedback}
            refreshSettingsData={refreshSettingsData}
            startTransition={startTransition}
            tx={tx}
          />
          <InvitationGroup
            canManageMembers={canManageMembers}
            emptyTitle={tx("暂无待接受邀请。", "No pending invitations.")}
            heading={tx("待接受邀请", "Pending invitations")}
            invitations={activeInvitations}
            isPending={isPending}
            setInviteFeedback={setInviteFeedback}
            setLatestInvitePath={setCreatedInvitePath}
            refreshSettingsData={refreshSettingsData}
            startTransition={startTransition}
            suffix={tx(`${activeInvitations.length} 条`, `${activeInvitations.length} pending`)}
            tx={tx}
          />
          <InvitationGroup
            canManageMembers={canManageMembers}
            emptyTitle={tx("暂无历史邀请。", "No invitation history yet.")}
            heading={tx("邀请历史", "Invitation history")}
            invitations={invitationHistory}
            isPending={isPending}
            setInviteFeedback={setInviteFeedback}
            setLatestInvitePath={setCreatedInvitePath}
            refreshSettingsData={refreshSettingsData}
            startTransition={startTransition}
            suffix={tx(`${invitationHistory.length} 条`, `${invitationHistory.length} history`)}
            tx={tx}
          />
        </div>
      </section>
    </SettingsSectionShell>
  );
}

function InvitationCreateForm({
  assignableRoles,
  inviteEmail,
  inviteRole,
  isPending,
  setCreatedInvitePath,
  setInviteEmail,
  setInviteFeedback,
  setInviteRole,
  refreshSettingsData,
  startTransition,
  tx,
}: {
  assignableRoles: readonly WorkspaceRole[];
  inviteEmail: string;
  inviteRole: WorkspaceRole;
  isPending: boolean;
  setCreatedInvitePath: Dispatch<SetStateAction<string | null>>;
  setInviteEmail: Dispatch<SetStateAction<string>>;
  setInviteFeedback: Dispatch<SetStateAction<string | null>>;
  setInviteRole: Dispatch<SetStateAction<WorkspaceRole>>;
  refreshSettingsData: () => void;
  startTransition: TransitionStartFunction;
  tx: SettingsTx;
}) {
  return (
    <div className="settings-invitation-create">
      <label className="form-field">
        <span>{tx("邀请邮箱", "Invitation Email")}</span>
        <input
          onChange={(event) => setInviteEmail(event.currentTarget.value)}
          placeholder={tx("受邀邮箱", "Invitee email")}
          type="email"
          value={inviteEmail}
        />
      </label>

      <label className="form-field">
        <span>{tx("邀请角色", "Invitation Role")}</span>
        <select
          onChange={(event) => setInviteRole(event.currentTarget.value as WorkspaceRole)}
          value={inviteRole}
        >
          {assignableRoles.map((role) => (
            <option key={role} value={role}>
              {translateWorkspaceRole(role, tx)}
            </option>
          ))}
        </select>
      </label>

      <button
        className="primary-button"
        disabled={isPending || inviteEmail.trim().length === 0}
        onClick={() => {
          startTransition(async () => {
            try {
              const created = await createWorkspaceInvitationAction({
                email: inviteEmail,
                role: inviteRole,
              });
              setInviteEmail("");
              setInviteRole("member");
              setCreatedInvitePath(created.invitePath);
              setInviteFeedback(tx("邀请链接已生成，可发送给对方。", "Invitation link created and ready to share."));
              refreshSettingsData();
            } catch (error) {
              setInviteFeedback(translateSettingsActionError(error, tx));
            }
          });
        }}
        type="button"
      >
        {tx("创建邀请", "Create Invitation")}
      </button>
    </div>
  );
}

function ChannelAccessRequestGroup({
  canManageMembers,
  isPending,
  requests,
  setInviteFeedback,
  refreshSettingsData,
  startTransition,
  tx,
}: {
  canManageMembers: boolean;
  isPending: boolean;
  requests: SettingsChannelAccessRequestItem[];
  setInviteFeedback: Dispatch<SetStateAction<string | null>>;
  refreshSettingsData: () => void;
  startTransition: TransitionStartFunction;
  tx: SettingsTx;
}) {
  return (
    <div className="settings-invitation-group">
      <div className="settings-invitation-group__header">
        <strong>{tx("群访问申请", "Channel access requests")}</strong>
        <span>{tx(`${requests.length} 条`, `${requests.length} pending`)}</span>
      </div>
      {requests.length > 0 ? (
        requests.map((request) => (
          <article className="settings-invitation-card" key={request.id}>
            <div className="settings-invitation-card__header">
              <div>
                <strong>{request.requesterName}</strong>
                <p>{tx(`申请加入 ${request.channelName}`, `Requests access to ${request.channelName}`)}</p>
              </div>
              <div className="settings-invitation-card__actions">
                <span className="status-chip status-chip--active">{tx("待审批", "Pending")}</span>
                {canManageMembers ? (
                  <>
                    <button
                      className="action-button"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await approveChannelAccessRequestAction(request.id);
                            setInviteFeedback(tx("群访问申请已批准。", "Channel access request approved."));
                            refreshSettingsData();
                          } catch (error) {
                            setInviteFeedback(translateSettingsActionError(error, tx));
                          }
                        });
                      }}
                      type="button"
                    >
                      {tx("批准", "Approve")}
                    </button>
                    <button
                      className="action-button action-button--danger"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await rejectChannelAccessRequestAction(request.id);
                            setInviteFeedback(tx("群访问申请已拒绝。", "Channel access request rejected."));
                            refreshSettingsData();
                          } catch (error) {
                            setInviteFeedback(translateSettingsActionError(error, tx));
                          }
                        });
                      }}
                      type="button"
                    >
                      {tx("拒绝", "Reject")}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="settings-invitation-card__meta">
              <span>{request.requesterEmail || request.requesterUserId}</span>
              <span>{tx(`申请时间 ${formatSessionTimestamp(request.requestedAt)}`, `Requested ${formatSessionTimestamp(request.requestedAt)}`)}</span>
            </div>
          </article>
        ))
      ) : (
        <EmptyState title={tx("暂无待审批的群访问申请。", "No pending channel access requests.")} />
      )}
    </div>
  );
}

function ChannelInvitationGroup({
  canManageMembers,
  invitations,
  isPending,
  setInviteFeedback,
  refreshSettingsData,
  startTransition,
  tx,
}: {
  canManageMembers: boolean;
  invitations: SettingsChannelInvitationItem[];
  isPending: boolean;
  setInviteFeedback: Dispatch<SetStateAction<string | null>>;
  refreshSettingsData: () => void;
  startTransition: TransitionStartFunction;
  tx: SettingsTx;
}) {
  return (
    <div className="settings-invitation-group">
      <div className="settings-invitation-group__header">
        <strong>{tx("群邀请", "Channel invitations")}</strong>
        <span>{tx(`${invitations.length} 条`, `${invitations.length} pending`)}</span>
      </div>
      {invitations.length > 0 ? (
        invitations.map((invitation) => (
          <article className="settings-invitation-card" key={invitation.id}>
            <div className="settings-invitation-card__header">
              <div>
                <strong>{invitation.inviteeEmail || invitation.inviteeUserId || tx("未绑定邀请对象", "Unbound invitee")}</strong>
                <p>{tx(`邀请加入 ${invitation.channelName}`, `Invited to ${invitation.channelName}`)}</p>
              </div>
              <div className="settings-invitation-card__actions">
                <span className="status-chip status-chip--active">{tx("待接受", "Pending")}</span>
                {canManageMembers ? (
                  <button
                    className="action-button action-button--danger"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await revokeChannelInvitationAction(invitation.id);
                          setInviteFeedback(tx("群邀请已撤销。", "Channel invitation revoked."));
                          refreshSettingsData();
                        } catch (error) {
                          setInviteFeedback(translateSettingsActionError(error, tx));
                        }
                      });
                    }}
                    type="button"
                  >
                    {tx("撤销", "Revoke")}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="settings-invitation-card__meta">
              <span>{tx(`邀请人 ${invitation.invitedByName}`, `Invited by ${invitation.invitedByName}`)}</span>
              <span>{tx(`创建时间 ${formatSessionTimestamp(invitation.createdAt)}`, `Created ${formatSessionTimestamp(invitation.createdAt)}`)}</span>
              {invitation.expiresAt ? (
                <span>{tx(`过期时间 ${formatSessionTimestamp(invitation.expiresAt)}`, `Expires ${formatSessionTimestamp(invitation.expiresAt)}`)}</span>
              ) : null}
            </div>
          </article>
        ))
      ) : (
        <EmptyState title={tx("暂无待接受的群邀请。", "No pending channel invitations.")} />
      )}
    </div>
  );
}

function InvitationGroup({
  canManageMembers,
  emptyTitle,
  heading,
  invitations,
  isPending,
  setInviteFeedback,
  setLatestInvitePath,
  refreshSettingsData,
  startTransition,
  suffix,
  tx,
}: {
  canManageMembers: boolean;
  emptyTitle: string;
  heading: string;
  invitations: SettingsWorkspaceInvitationItem[];
  isPending: boolean;
  setInviteFeedback: Dispatch<SetStateAction<string | null>>;
  setLatestInvitePath: Dispatch<SetStateAction<string | null>>;
  refreshSettingsData: () => void;
  startTransition: TransitionStartFunction;
  suffix: string;
  tx: SettingsTx;
}) {
  return (
    <div className="settings-invitation-group">
      <div className="settings-invitation-group__header">
        <strong>{heading}</strong>
        <span>{suffix}</span>
      </div>
      {invitations.length > 0 ? (
        invitations.map((invitation) => (
          <InvitationCard
            canManageMembers={canManageMembers}
            invitation={invitation}
            isPending={isPending}
            key={invitation.id}
            setInviteFeedback={setInviteFeedback}
            setLatestInvitePath={setLatestInvitePath}
            refreshSettingsData={refreshSettingsData}
            startTransition={startTransition}
            tx={tx}
          />
        ))
      ) : (
        <EmptyState title={emptyTitle} />
      )}
    </div>
  );
}

function InvitationCard({
  canManageMembers,
  invitation,
  isPending,
  setInviteFeedback,
  setLatestInvitePath,
  refreshSettingsData,
  startTransition,
  tx,
}: {
  canManageMembers: boolean;
  invitation: SettingsWorkspaceInvitationItem;
  isPending: boolean;
  setInviteFeedback: Dispatch<SetStateAction<string | null>>;
  setLatestInvitePath: Dispatch<SetStateAction<string | null>>;
  refreshSettingsData: () => void;
  startTransition: TransitionStartFunction;
  tx: SettingsTx;
}) {
  const canReissue = canManageMembers && invitation.status !== "accepted";
  const canRevoke = canManageMembers && invitation.status === "active";

  return (
    <article className="settings-invitation-card">
      <div className="settings-invitation-card__header">
        <div>
          <strong>{invitation.email}</strong>
          <p>{translateWorkspaceRole(invitation.role, tx)}</p>
        </div>
        <div className="settings-invitation-card__actions">
          <span className={`status-chip${invitation.status === "active" ? " status-chip--active" : ""}`}>
            {translateInvitationStatus(invitation.status, tx)}
          </span>
          {canReissue ? (
            <button
              className="action-button"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const created = await reissueWorkspaceInvitationAction(invitation.id);
                    setLatestInvitePath(created.invitePath);
                    setInviteFeedback(tx("邀请已重新生成。", "Invitation reissued."));
                    refreshSettingsData();
                  } catch (error) {
                    setInviteFeedback(translateSettingsActionError(error, tx));
                  }
                });
              }}
              type="button"
            >
              {tx("重新发送", "Reissue")}
            </button>
          ) : null}
          {canRevoke ? (
            <button
              className="action-button action-button--danger"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await revokeWorkspaceInvitationAction(invitation.id);
                    setInviteFeedback(tx("邀请已撤销。", "Invitation revoked."));
                    refreshSettingsData();
                  } catch (error) {
                    setInviteFeedback(translateSettingsActionError(error, tx));
                  }
                });
              }}
              type="button"
            >
              {tx("撤销邀请", "Revoke Invitation")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="settings-invitation-card__meta">
        <span>{tx(`创建时间 ${formatSessionTimestamp(invitation.createdAt)}`, `Created ${formatSessionTimestamp(invitation.createdAt)}`)}</span>
        <span>{tx(`过期时间 ${formatSessionTimestamp(invitation.expiresAt)}`, `Expires ${formatSessionTimestamp(invitation.expiresAt)}`)}</span>
        {invitation.acceptedAt ? (
          <span>{tx(`接受时间 ${formatSessionTimestamp(invitation.acceptedAt)}`, `Accepted ${formatSessionTimestamp(invitation.acceptedAt)}`)}</span>
        ) : null}
        <span>{describeInvitationState(invitation, tx)}</span>
      </div>
    </article>
  );
}
