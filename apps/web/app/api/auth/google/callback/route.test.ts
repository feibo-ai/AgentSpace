import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAcceptWorkspaceInvitationForUser,
  mockCreateSessionForGoogleLogin,
  mockExchangeGoogleCodeForProfile,
  mockJoinWorkspaceByCodeForUser,
  mockReadGoogleOAuthConfig,
  mockReportGoogleAuthCallbackIssue,
  mockVerifyGoogleOAuthCallbackState,
} = vi.hoisted(() => ({
  mockAcceptWorkspaceInvitationForUser: vi.fn(),
  mockCreateSessionForGoogleLogin: vi.fn(),
  mockExchangeGoogleCodeForProfile: vi.fn(),
  mockJoinWorkspaceByCodeForUser: vi.fn(),
  mockReadGoogleOAuthConfig: vi.fn(),
  mockReportGoogleAuthCallbackIssue: vi.fn(),
  mockVerifyGoogleOAuthCallbackState: vi.fn(),
}));

vi.mock("@/features/auth/google-oauth", () => ({
  exchangeGoogleCodeForProfile: mockExchangeGoogleCodeForProfile,
  readGoogleOAuthConfig: mockReadGoogleOAuthConfig,
  verifyGoogleOAuthCallbackState: mockVerifyGoogleOAuthCallbackState,
}));

vi.mock("@/features/auth/server-auth", () => ({
  createSessionForGoogleLogin: mockCreateSessionForGoogleLogin,
}));

vi.mock("@/features/auth/workspace-invitations", () => ({
  acceptWorkspaceInvitationForUser: mockAcceptWorkspaceInvitationForUser,
}));

vi.mock("@/features/auth/workspace-join-codes", () => ({
  joinWorkspaceByCodeForUser: mockJoinWorkspaceByCodeForUser,
}));

vi.mock("@/features/auth/auth-monitoring", () => ({
  reportGoogleAuthCallbackIssue: mockReportGoogleAuthCallbackIssue,
}));

import { GET } from "./route";

describe("google callback route", () => {
  beforeEach(() => {
    mockAcceptWorkspaceInvitationForUser.mockReset();
    mockCreateSessionForGoogleLogin.mockReset();
    mockExchangeGoogleCodeForProfile.mockReset();
    mockJoinWorkspaceByCodeForUser.mockReset();
    mockReadGoogleOAuthConfig.mockReset();
    mockReportGoogleAuthCallbackIssue.mockReset();
    mockVerifyGoogleOAuthCallbackState.mockReset();

    mockReadGoogleOAuthConfig.mockReturnValue({
      appUrl: "http://app.test",
    });
  });

  it("redirects provider-side OAuth errors to the dedicated auth error page", async () => {
    const response = await GET(new Request("http://localhost/api/auth/google/callback?error=access_denied"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://app.test/auth/error?code=access_denied");
    expect(mockReportGoogleAuthCallbackIssue).toHaveBeenCalledWith({
      code: "access_denied",
      phase: "provider_redirect",
    });
  });

  it("redirects successful invitation logins into the invited workspace", async () => {
    mockVerifyGoogleOAuthCallbackState.mockResolvedValue({
      nonce: "nonce-1",
      invitationToken: "invite-1",
    });
    mockExchangeGoogleCodeForProfile.mockResolvedValue({
      sub: "google-sub-1",
      email: "mina@example.com",
      emailVerified: true,
      displayName: "Mina",
      avatarUrl: "https://example.com/avatar.png",
    });
    mockCreateSessionForGoogleLogin.mockResolvedValue({
      id: "user-1",
      displayName: "Mina",
      email: "mina@example.com",
    });
    mockAcceptWorkspaceInvitationForUser.mockResolvedValue({
      workspaceSlug: "mars-labs",
    });

    const response = await GET(new Request("http://localhost/api/auth/google/callback?code=code-1&state=state-1"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://app.test/w/mars-labs/im");
    expect(mockVerifyGoogleOAuthCallbackState).toHaveBeenCalledWith("state-1");
    expect(mockCreateSessionForGoogleLogin).toHaveBeenCalledWith({
      providerSubject: "google-sub-1",
      email: "mina@example.com",
      emailVerified: true,
      displayName: "Mina",
      avatarUrl: "https://example.com/avatar.png",
      invitationToken: "invite-1",
      joinCode: undefined,
    });
    expect(mockAcceptWorkspaceInvitationForUser).toHaveBeenCalledWith({
      token: "invite-1",
      userId: "user-1",
      actorDisplayName: "Mina",
    });
  });

  it("redirects invitation callback failures back to the invitation page with authError", async () => {
    mockVerifyGoogleOAuthCallbackState.mockResolvedValue({
      nonce: "nonce-1",
      invitationToken: "invite-1",
    });
    mockExchangeGoogleCodeForProfile.mockRejectedValue(new Error("auth.google_exchange_failed"));

    const response = await GET(new Request("http://localhost/api/auth/google/callback?code=code-1&state=state-1"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://app.test/invite/invite-1?authError=auth.google_exchange_failed");
    expect(mockReportGoogleAuthCallbackIssue).toHaveBeenCalledWith({
      code: "auth.google_exchange_failed",
      phase: "callback",
      invitationToken: "invite-1",
      joinCode: undefined,
      details: expect.any(String),
    });
  });

  it("redirects non-invitation callback failures to the auth error page", async () => {
    mockVerifyGoogleOAuthCallbackState.mockResolvedValue({
      nonce: "nonce-2",
      invitationToken: undefined,
    });
    mockExchangeGoogleCodeForProfile.mockResolvedValue({
      sub: "google-sub-1",
      email: "mina@example.com",
      emailVerified: true,
      displayName: "Mina",
    });
    mockCreateSessionForGoogleLogin.mockRejectedValue(new Error("auth.google_nonce_invalid"));

    const response = await GET(new Request("http://localhost/api/auth/google/callback?code=code-1&state=state-1"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://app.test/auth/error?code=auth.google_nonce_invalid");
    expect(mockReportGoogleAuthCallbackIssue).toHaveBeenCalledWith({
      code: "auth.google_nonce_invalid",
      phase: "callback",
      invitationToken: undefined,
      joinCode: undefined,
      details: expect.any(String),
    });
  });

  it("redirects successful join-code logins into the joined workspace", async () => {
    mockVerifyGoogleOAuthCallbackState.mockResolvedValue({
      nonce: "nonce-1",
      invitationToken: undefined,
      joinCode: "A7K2M9Q4",
    });
    mockExchangeGoogleCodeForProfile.mockResolvedValue({
      sub: "google-sub-1",
      email: "mina@example.com",
      emailVerified: true,
      displayName: "Mina",
    });
    mockCreateSessionForGoogleLogin.mockResolvedValue({
      id: "user-1",
      displayName: "Mina",
      email: "mina@example.com",
    });
    mockJoinWorkspaceByCodeForUser.mockResolvedValue({
      redirectPath: "/w/mars-labs/im",
    });

    const response = await GET(new Request("http://localhost/api/auth/google/callback?code=code-1&state=state-1"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://app.test/w/mars-labs/im");
    expect(mockCreateSessionForGoogleLogin).toHaveBeenCalledWith({
      providerSubject: "google-sub-1",
      email: "mina@example.com",
      emailVerified: true,
      displayName: "Mina",
      avatarUrl: undefined,
      invitationToken: undefined,
      joinCode: "A7K2M9Q4",
    });
    expect(mockJoinWorkspaceByCodeForUser).toHaveBeenCalledWith({
      joinCode: "A7K2M9Q4",
      userId: "user-1",
      actorDisplayName: "Mina",
    });
  });

  it("redirects account-link conflicts into the Google link confirmation page", async () => {
    mockVerifyGoogleOAuthCallbackState.mockResolvedValue({
      nonce: "nonce-2",
      invitationToken: undefined,
    });
    mockExchangeGoogleCodeForProfile.mockResolvedValue({
      sub: "google-sub-1",
      email: "mina@example.com",
      emailVerified: true,
      displayName: "Mina",
    });
    mockCreateSessionForGoogleLogin.mockRejectedValue(new Error("auth.google_account_link_required"));

    const response = await GET(new Request("http://localhost/api/auth/google/callback?code=code-1&state=state-1"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://app.test/auth/link/google");
    expect(mockReportGoogleAuthCallbackIssue).not.toHaveBeenCalled();
  });

  it("redirects first-time Google users into the profile setup page", async () => {
    mockVerifyGoogleOAuthCallbackState.mockResolvedValue({
      nonce: "nonce-2",
      invitationToken: undefined,
    });
    mockExchangeGoogleCodeForProfile.mockResolvedValue({
      sub: "google-sub-1",
      email: "mina@example.com",
      emailVerified: true,
      displayName: "Mina",
    });
    mockCreateSessionForGoogleLogin.mockRejectedValue(new Error("auth.google_profile_setup_required"));

    const response = await GET(new Request("http://localhost/api/auth/google/callback?code=code-1&state=state-1"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://app.test/auth/setup/google");
    expect(mockReportGoogleAuthCallbackIssue).not.toHaveBeenCalled();
  });
});
