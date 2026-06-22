import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SidebarVisibilityProvider,
  SIDEBAR_VISIBILITY_STORAGE_KEY,
} from "@/features/dashboard/sidebar-visibility-provider";
import { WORKSPACE_ONBOARDING_REPLAY_EVENT } from "@/features/dashboard/onboarding-guide";
import { SettingsPageClient } from "@/features/settings/settings-page-client";
import { LanguageProvider } from "@/features/i18n/language-provider";

const {
  mockPermissionsUpdateWorkspaceMemberRoleAction,
} = vi.hoisted(() => ({
  mockPermissionsUpdateWorkspaceMemberRoleAction: vi.fn(),
}));

const {
  mockAddWorkspaceMemberAction,
  mockCreateWorkspaceInvitationAction,
  mockRemoveWorkspaceMemberAction,
  mockReissueWorkspaceInvitationAction,
  mockRotateWorkspaceJoinCodeAction,
  mockRevokeOtherSessionsAction,
  mockRevokeSessionAction,
  mockRevokeWorkspaceInvitationAction,
  mockTransferWorkspaceOwnershipAction,
  mockUpdateCurrentUserProfileAction,
  mockUpdateWorkspaceProfileAction,
  mockUpdateWorkspaceMemberRoleAction,
} = vi.hoisted(() => ({
  mockAddWorkspaceMemberAction: vi.fn(),
  mockCreateWorkspaceInvitationAction: vi.fn(),
  mockRemoveWorkspaceMemberAction: vi.fn(),
  mockReissueWorkspaceInvitationAction: vi.fn(),
  mockRotateWorkspaceJoinCodeAction: vi.fn(),
  mockRevokeOtherSessionsAction: vi.fn(),
  mockRevokeSessionAction: vi.fn(),
  mockRevokeWorkspaceInvitationAction: vi.fn(),
  mockTransferWorkspaceOwnershipAction: vi.fn(),
  mockUpdateCurrentUserProfileAction: vi.fn(),
  mockUpdateWorkspaceProfileAction: vi.fn(),
  mockUpdateWorkspaceMemberRoleAction: vi.fn(),
}));

vi.mock("@/features/settings/actions", () => ({
  addWorkspaceMemberAction: mockAddWorkspaceMemberAction,
  createWorkspaceInvitationAction: mockCreateWorkspaceInvitationAction,
  removeWorkspaceMemberAction: mockRemoveWorkspaceMemberAction,
  reissueWorkspaceInvitationAction: mockReissueWorkspaceInvitationAction,
  rotateWorkspaceJoinCodeAction: mockRotateWorkspaceJoinCodeAction,
  revokeOtherSessionsAction: mockRevokeOtherSessionsAction,
  revokeSessionAction: mockRevokeSessionAction,
  revokeWorkspaceInvitationAction: mockRevokeWorkspaceInvitationAction,
  transferWorkspaceOwnershipAction: mockTransferWorkspaceOwnershipAction,
  updateCurrentUserProfileAction: mockUpdateCurrentUserProfileAction,
  updateWorkspaceProfileAction: mockUpdateWorkspaceProfileAction,
  updateWorkspaceMemberRoleAction: mockUpdateWorkspaceMemberRoleAction,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/features/permissions/actions", () => ({
  permissionsAddChannelDocumentCollaboratorAction: vi.fn(),
  permissionsAddWorkspaceMemberToChannelAction: vi.fn(),
  permissionsApproveAgentAccessRequestAction: vi.fn(),
  permissionsApproveChannelAccessRequestAction: vi.fn(),
  permissionsBindAgentRuntimeAction: vi.fn(),
  permissionsCreateDaemonApiTokenAction: vi.fn(),
  permissionsCreateWorkspaceInvitationAction: vi.fn(),
  permissionsDisconnectGoogleWorkspaceAction: vi.fn(),
  permissionsGrantRuntimeUseAction: vi.fn(),
  permissionsRejectAgentAccessRequestAction: vi.fn(),
  permissionsRejectChannelAccessRequestAction: vi.fn(),
  permissionsReissueWorkspaceInvitationAction: vi.fn(),
  permissionsRemoveChannelDocumentCollaboratorAction: vi.fn(),
  permissionsRemoveWorkspaceMemberAction: vi.fn(),
  permissionsRemoveWorkspaceMemberFromChannelAction: vi.fn(),
  permissionsRevokeAgentGoogleWorkspaceDelegationAction: vi.fn(),
  permissionsRevokeChannelInvitationAction: vi.fn(),
  permissionsRevokeDaemonApiTokenAction: vi.fn(),
  permissionsRevokeRuntimeUseAction: vi.fn(),
  permissionsRevokeWorkspaceInvitationAction: vi.fn(),
  permissionsSetAgentChannelMemberAccessAction: vi.fn(),
  permissionsSetAgentKnowledgeAssignmentsAction: vi.fn(),
  permissionsSetAgentSkillAssignmentsAction: vi.fn(),
  permissionsSyncExternalGoogleSheetPermissionsAction: vi.fn(),
  permissionsUnbindAgentRuntimeAction: vi.fn(),
  permissionsUpdateChannelDocumentAccessRoleAction: vi.fn(),
  permissionsUpdateWorkspaceMemberRoleAction: mockPermissionsUpdateWorkspaceMemberRoleAction,
}));

describe("SettingsPageClient", () => {
  function renderSettingsPage(
    props: Partial<ComponentProps<typeof SettingsPageClient>> = {},
  ) {
    return render(
      <LanguageProvider>
        <SidebarVisibilityProvider>
          <SettingsPageClient {...props} />
        </SidebarVisibilityProvider>
      </LanguageProvider>,
    );
  }

  beforeEach(() => {
    window.localStorage.clear();
    mockAddWorkspaceMemberAction.mockReset();
    mockCreateWorkspaceInvitationAction.mockReset();
    mockRemoveWorkspaceMemberAction.mockReset();
    mockReissueWorkspaceInvitationAction.mockReset();
    mockRotateWorkspaceJoinCodeAction.mockReset();
    mockRevokeOtherSessionsAction.mockReset();
    mockRevokeSessionAction.mockReset();
    mockRevokeWorkspaceInvitationAction.mockReset();
    mockTransferWorkspaceOwnershipAction.mockReset();
    mockUpdateCurrentUserProfileAction.mockReset();
    mockUpdateWorkspaceProfileAction.mockReset();
    mockUpdateWorkspaceMemberRoleAction.mockReset();
    mockPermissionsUpdateWorkspaceMemberRoleAction.mockReset();
  });

  it("switches the display language with a select field", async () => {
    const user = userEvent.setup();

    renderSettingsPage({ initialSection: "preferences" });

    const languageSelect = screen.getByRole("combobox", { name: "显示语言" });
    expect(languageSelect).toHaveValue("zh");

    await user.selectOptions(languageSelect, "en");

    expect(languageSelect).toHaveValue("en");
    expect(window.localStorage.getItem("agent-space-language")).toBe("en");
  });

  it("persists sidebar visibility toggles in local storage", async () => {
    const user = userEvent.setup();

    renderSettingsPage({ initialSection: "preferences" });

    expect(screen.getByRole("switch", { name: "应用市场" })).toBeChecked();

    const approvalsSwitch = screen.getByRole("switch", { name: "审批" });
    expect(approvalsSwitch).not.toBeChecked();

    await user.click(approvalsSwitch);

    expect(approvalsSwitch).toBeChecked();
    expect(JSON.parse(window.localStorage.getItem(SIDEBAR_VISIBILITY_STORAGE_KEY) ?? "{}")).toMatchObject({
      approvals: true,
    });
  });

  it("dispatches the onboarding replay event from preferences", async () => {
    const user = userEvent.setup();
    const replayListener = vi.fn();
    window.addEventListener(WORKSPACE_ONBOARDING_REPLAY_EVENT, replayListener);

    renderSettingsPage({ initialSection: "preferences" });

    expect(screen.getByText(/重新运行 Agent 搭建向导/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重看新手引导" }));

    expect(replayListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(WORKSPACE_ONBOARDING_REPLAY_EVENT, replayListener);
  });

  it("renders sessions and disables revoking the current device", async () => {
    renderSettingsPage({
      currentSessionId: "session-current",
      initialSection: "security",
      sessions: [
        {
          id: "session-current",
          createdAt: "2026-04-22T00:00:00.000Z",
          expiresAt: "2026-05-22T00:00:00.000Z",
          lastSeenAt: "2026-04-22T00:00:00.000Z",
          ipAddress: "127.0.0.1",
          userAgent: "Current Browser",
        },
        {
          id: "session-other",
          createdAt: "2026-04-20T00:00:00.000Z",
          expiresAt: "2026-05-20T00:00:00.000Z",
          lastSeenAt: "2026-04-21T00:00:00.000Z",
          ipAddress: "10.0.0.2",
          userAgent: "Other Browser",
        },
      ],
    });

    expect(screen.getByText("Current Browser")).toBeInTheDocument();
    expect(screen.getByText("Other Browser")).toBeInTheDocument();

    const revokeButtons = screen.getAllByRole("button", { name: "撤销" });
    expect(revokeButtons[0]).toBeDisabled();
    expect(revokeButtons[1]).not.toBeDisabled();
  });

  it("revokes other devices from the settings page", async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn();

    renderSettingsPage({
      currentSessionId: "session-current",
      initialSection: "security",
      onDataChanged,
      sessions: [
        {
          id: "session-current",
          createdAt: "2026-04-22T00:00:00.000Z",
          expiresAt: "2026-05-22T00:00:00.000Z",
          lastSeenAt: "2026-04-22T00:00:00.000Z",
        },
        {
          id: "session-other",
          createdAt: "2026-04-20T00:00:00.000Z",
          expiresAt: "2026-05-20T00:00:00.000Z",
          lastSeenAt: "2026-04-21T00:00:00.000Z",
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "退出其他设备" }));

    expect(mockRevokeOtherSessionsAction).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onDataChanged).toHaveBeenCalledTimes(1);
    });
  });

  it("refreshes security data after revoking an individual session", async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn();

    renderSettingsPage({
      currentSessionId: "session-current",
      initialSection: "security",
      onDataChanged,
      sessions: [
        {
          id: "session-current",
          createdAt: "2026-04-22T00:00:00.000Z",
          expiresAt: "2026-05-22T00:00:00.000Z",
          lastSeenAt: "2026-04-22T00:00:00.000Z",
        },
        {
          id: "session-other",
          createdAt: "2026-04-20T00:00:00.000Z",
          expiresAt: "2026-05-20T00:00:00.000Z",
          lastSeenAt: "2026-04-21T00:00:00.000Z",
        },
      ],
    });

    const revokeButtons = screen.getAllByRole("button", { name: "撤销" });
    await user.click(revokeButtons[1]!);

    expect(mockRevokeSessionAction).toHaveBeenCalledWith("session-other");
    await waitFor(() => {
      expect(onDataChanged).toHaveBeenCalledTimes(1);
    });
  });

  it("renders role-aware settings navigation for owners", () => {
    const { container } = renderSettingsPage({
      currentMembershipRole: "owner",
      currentWorkspaceName: "Mars Labs",
      initialSection: "account",
    });

    expect(screen.queryByRole("link", { name: /设置总览/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /账号资料/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /偏好设置/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /权限中心/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /成员与角色/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /邀请与访问/i }).length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".settings-nav__divider")).toHaveLength(1);
  });

  it("shows admin navigation without owner-only workspace basics", () => {
    renderSettingsPage({
      currentMembershipRole: "admin",
      currentWorkspaceName: "Mars Labs",
      initialSection: "account",
    });

    expect(screen.getAllByRole("link", { name: /账号资料/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /偏好设置/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /安全与会话/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /权限中心/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /成员与角色/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /邀请与访问/i }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("link", { name: /工作区基础/i })).toHaveLength(0);
  });

  it("updates the current user profile from the account section", async () => {
    const user = userEvent.setup();

    renderSettingsPage({
      currentMembershipRole: "owner",
      currentUserDisplayName: "Mina",
      currentUserId: "user-1",
      initialSection: "account",
      members: [
        {
          userId: "user-1",
          displayName: "Mina",
          primaryEmail: "mina@example.com",
          role: "owner",
        },
      ],
    });

    await user.clear(screen.getByRole("textbox", { name: "用户名" }));
    await user.type(screen.getByRole("textbox", { name: "用户名" }), "Mina Chen");
    await user.click(screen.getByRole("button", { name: "保存用户名" }));

    expect(mockUpdateCurrentUserProfileAction).toHaveBeenCalledWith({
      displayName: "Mina Chen",
    });
    expect(await screen.findByText("用户名已更新。")).toBeInTheDocument();
  });

  it("lets owners manage workspace, members, and access from focused sections", async () => {
    const user = userEvent.setup();
    const sharedProps: ComponentProps<typeof SettingsPageClient> = {
      currentMembershipRole: "owner",
      currentUserDisplayName: "Mina",
      currentUserId: "user-1",
      currentWorkspaceName: "Mars Labs",
      currentWorkspaceSlug: "mars-labs",
      invitations: [
        {
          id: "invite-1",
          email: "invitee@example.com",
          role: "member",
          status: "active",
          createdAt: "2026-04-22T00:00:00.000Z",
          expiresAt: "2026-04-29T00:00:00.000Z",
          acceptedAt: undefined,
        },
      ],
      members: [
        {
          userId: "user-1",
          displayName: "Mina",
          primaryEmail: "mina@example.com",
          role: "owner",
        },
        {
          userId: "user-2",
          displayName: "Alex",
          primaryEmail: "alex@example.com",
          role: "admin",
        },
      ],
    };

    const { rerender } = renderSettingsPage({
      ...sharedProps,
      initialSection: "workspace",
    });

    await user.clear(screen.getByLabelText("工作区名称"));
    await user.type(screen.getByLabelText("工作区名称"), "Mars Foundry");
    await user.click(screen.getByRole("button", { name: "保存工作区设置" }));

    expect(mockUpdateWorkspaceProfileAction).toHaveBeenCalledWith({
      name: "Mars Foundry",
    });

    rerender(
      <LanguageProvider>
        <SidebarVisibilityProvider>
          <SettingsPageClient {...sharedProps} initialSection="access" />
        </SidebarVisibilityProvider>
      </LanguageProvider>,
    );

    mockCreateWorkspaceInvitationAction.mockResolvedValue({
      id: "invite-2",
      email: "invitee@example.com",
      role: "member",
      expiresAt: "2026-04-29T00:00:00.000Z",
      invitePath: "/invite/wsi_test",
    });
    await user.type(screen.getByRole("textbox", { name: "邀请邮箱" }), "invitee@example.com");
    await user.click(screen.getByRole("button", { name: "创建邀请" }));

    expect(mockCreateWorkspaceInvitationAction).toHaveBeenCalledWith({
      email: "invitee@example.com",
      role: "member",
    });

    rerender(
      <LanguageProvider>
        <SidebarVisibilityProvider>
          <SettingsPageClient {...sharedProps} initialSection="members" />
        </SidebarVisibilityProvider>
      </LanguageProvider>,
    );

    await user.type(screen.getByRole("textbox", { name: "用户邮箱" }), "alex@example.com");
    await user.selectOptions(screen.getAllByRole("combobox", { name: "角色" })[0]!, "admin");
    await user.click(screen.getByRole("button", { name: "添加成员" }));

    expect(mockAddWorkspaceMemberAction).toHaveBeenCalledWith({
      email: "alex@example.com",
      role: "admin",
    });

    await user.click(screen.getByRole("button", { name: "转移所有权" }));
    expect(mockTransferWorkspaceOwnershipAction).toHaveBeenCalledWith("user-2");
  });

  it("lets admins manage members without owner-only ownership transfer", () => {
    renderSettingsPage({
      currentMembershipRole: "admin",
      currentUserDisplayName: "Mina",
      currentUserId: "user-1",
      initialSection: "members",
      members: [
        {
          userId: "user-1",
          displayName: "Mina",
          primaryEmail: "mina@example.com",
          role: "admin",
        },
        {
          userId: "user-2",
          displayName: "Alex",
          primaryEmail: "alex@example.com",
          role: "member",
        },
      ],
    });

    expect(screen.getByRole("button", { name: "添加成员" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "移除成员" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "转移所有权" })).toBeNull();
  });

  it("hides workspace management navigation for plain members", () => {
    renderSettingsPage({
      currentMembershipRole: "member",
      currentUserDisplayName: "Mina",
      currentUserId: "user-1",
      currentWorkspaceName: "Mars Labs",
      currentWorkspaceSlug: "mars-labs",
      initialSection: "account",
      members: [
        {
          userId: "user-1",
          displayName: "Mina",
          primaryEmail: "mina@example.com",
          role: "member",
        },
      ],
    });

    expect(screen.getAllByRole("link", { name: /账号资料/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /偏好设置/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("安全与会话").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /权限中心/i }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("link", { name: /工作区基础/i })).toHaveLength(0);
    expect(screen.queryAllByRole("link", { name: /成员与角色/i })).toHaveLength(0);
    expect(screen.queryAllByRole("link", { name: /邀请与访问/i })).toHaveLength(0);
  });

  it("renders the unified permissions center without exposing token fields", () => {
    const { container } = renderSettingsPage({
      currentMembershipRole: "owner",
      currentUserDisplayName: "Mina",
      currentUserId: "user-1",
      currentWorkspaceName: "Mars Labs",
      currentWorkspaceSlug: "mars-labs",
      initialSection: "permissions",
      permissions: {
        tree: [
          {
            id: "workspace:workspace-mars",
            resourceType: "workspace",
            label: "Mars Labs",
            status: "active",
            source: "workspace_role",
            bindings: [
              {
                subjectType: "human",
                subjectId: "user-1",
                subjectLabel: "Mina <mina@example.com>",
                permission: "owner",
                source: "workspace_role",
                status: "active",
                editable: false,
              },
            ],
            children: [
              {
                id: "runtime:runtime-1",
                parentId: "workspace:workspace-mars",
                resourceType: "runtime",
                label: "Codex runtime",
                status: "active",
                source: "runtime_grant",
                metadata: { runtimeId: "runtime-1" },
                bindings: [],
              },
            ],
          },
        ],
        actors: [
          {
            subjectType: "human",
            subjectId: "user-1",
            subjectLabel: "Mina <mina@example.com>",
            status: "active",
            permissions: [
              {
                nodeId: "workspace:workspace-mars",
                resourceType: "workspace",
                resourceLabel: "Mars Labs",
                permission: "owner",
                source: "workspace_role",
                status: "active",
                editable: false,
              },
            ],
            diagnostics: [],
          },
        ],
        diagnostics: [],
        catalog: {
          members: [
            {
              userId: "user-1",
              displayName: "Mina",
              primaryEmail: "mina@example.com",
              role: "owner",
            },
          ],
          agents: [],
          skills: [],
          knowledgePages: [],
        },
      },
    });

    expect(screen.getByText("权限地图")).toBeInTheDocument();
    expect(screen.getAllByText("Mars Labs").length).toBeGreaterThan(0);
    expect(screen.getByText("Codex runtime")).toBeInTheDocument();
    expect(container.textContent).not.toContain("tokenHash");
    expect(container.textContent).not.toContain("accessTokenEncrypted");
    expect(container.textContent).not.toContain("refreshTokenEncrypted");
  });
});
