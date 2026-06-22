import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { readServerEnvValue } from "./server-env";

const GOOGLE_LINK_HANDOFF_COOKIE = "agent_space_google_link_handoff";
const GOOGLE_LINK_HANDOFF_MAX_AGE_SECONDS = 10 * 60;

interface PendingGoogleLinkPayload {
  providerSubject: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  invitationToken?: string;
  joinCode?: string;
  createdAt: number;
}

export interface PendingGoogleLinkHandoff {
  providerSubject: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  invitationToken?: string;
  joinCode?: string;
}

export async function writePendingGoogleLinkHandoff(
  input: PendingGoogleLinkHandoff,
): Promise<void> {
  const payload: PendingGoogleLinkPayload = {
    providerSubject: input.providerSubject.trim(),
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    avatarUrl: input.avatarUrl?.trim() || undefined,
    invitationToken: input.invitationToken?.trim() || undefined,
    joinCode: input.joinCode?.trim() || undefined,
    createdAt: Date.now(),
  };
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_LINK_HANDOFF_COOKIE, signPayload(payload, readLinkSecret()), {
    httpOnly: true,
    maxAge: GOOGLE_LINK_HANDOFF_MAX_AGE_SECONDS,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

export async function readPendingGoogleLinkHandoff(): Promise<PendingGoogleLinkHandoff | null> {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(GOOGLE_LINK_HANDOFF_COOKIE)?.value?.trim();
  if (!rawValue) {
    return null;
  }

  try {
    const payload = verifyPayload(rawValue, readLinkSecret());
    if (Date.now() - payload.createdAt > GOOGLE_LINK_HANDOFF_MAX_AGE_SECONDS * 1000) {
      await clearPendingGoogleLinkHandoff();
      return null;
    }

    return {
      providerSubject: payload.providerSubject,
      email: payload.email,
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl,
      invitationToken: payload.invitationToken,
      joinCode: payload.joinCode,
    };
  } catch {
    await clearPendingGoogleLinkHandoff();
    return null;
  }
}

export async function clearPendingGoogleLinkHandoff(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_LINK_HANDOFF_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

function readLinkSecret(): string {
  const value = readServerEnvValue("AGENT_SPACE_OAUTH_STATE_SECRET")?.trim();
  if (!value) {
    throw new Error("AGENT_SPACE_OAUTH_STATE_SECRET is required.");
  }
  return value;
}

function signPayload(payload: PendingGoogleLinkPayload, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyPayload(value: string, secret: string): PendingGoogleLinkPayload {
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid Google link handoff.");
  }

  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  if (signature !== expectedSignature) {
    throw new Error("Invalid Google link handoff.");
  }

  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as PendingGoogleLinkPayload;
}
