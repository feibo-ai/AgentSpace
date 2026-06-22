import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateGoogleAuthorizationUrl } = vi.hoisted(() => ({
  mockCreateGoogleAuthorizationUrl: vi.fn(),
}));

vi.mock("@/features/auth/google-oauth", () => ({
  createGoogleAuthorizationUrl: mockCreateGoogleAuthorizationUrl,
}));

import { GET } from "./route";

describe("google start route", () => {
  beforeEach(() => {
    mockCreateGoogleAuthorizationUrl.mockReset();
    mockCreateGoogleAuthorizationUrl.mockResolvedValue("https://accounts.google.com/o/oauth2/v2/auth?state=test");
  });

  it("redirects to the generated Google authorization URL", async () => {
    const response = await GET(new Request("http://localhost/api/auth/google/start"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=test");
    expect(mockCreateGoogleAuthorizationUrl).toHaveBeenCalledWith({ invitationToken: undefined, joinCode: undefined });
  });

  it("forwards an invitation token into the authorization URL builder", async () => {
    await GET(new Request("http://localhost/api/auth/google/start?invitationToken=invite-1"));

    expect(mockCreateGoogleAuthorizationUrl).toHaveBeenCalledWith({ invitationToken: "invite-1", joinCode: undefined });
  });

  it("forwards a workspace join code into the authorization URL builder", async () => {
    await GET(new Request("http://localhost/api/auth/google/start?joinCode=A7K2M9Q4"));

    expect(mockCreateGoogleAuthorizationUrl).toHaveBeenCalledWith({ invitationToken: undefined, joinCode: "A7K2M9Q4" });
  });
});
