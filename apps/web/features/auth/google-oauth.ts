import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { readServerEnvValue } from "./server-env";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const OAUTH_STATE_COOKIE = "agent_space_google_oauth_state";
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

interface GoogleOAuthStatePayload {
  csrf: string;
  nonce: string;
  invitationToken?: string;
  joinCode?: string;
  createdAt: number;
}

export interface GoogleOAuthConfig {
  appUrl: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  stateSecret: string;
}

export interface GoogleUserProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl?: string;
}

export function readGoogleOAuthConfig(): GoogleOAuthConfig {
  const appUrl = readRequiredAuthEnv("AGENT_SPACE_APP_URL");
  const clientId = readRequiredAuthEnv("AGENT_SPACE_GOOGLE_CLIENT_ID");
  const clientSecret = readRequiredAuthEnv("AGENT_SPACE_GOOGLE_CLIENT_SECRET");
  const callbackUrl = readServerEnvValue("AGENT_SPACE_GOOGLE_CALLBACK_URL")?.trim() || `${appUrl}/api/auth/google/callback`;
  const stateSecret = readRequiredAuthEnv("AGENT_SPACE_OAUTH_STATE_SECRET");

  return {
    appUrl,
    clientId,
    clientSecret,
    callbackUrl,
    stateSecret,
  };
}

export async function createGoogleAuthorizationUrl(input?: {
  invitationToken?: string;
  joinCode?: string;
}): Promise<string> {
  const config = readGoogleOAuthConfig();
  const statePayload: GoogleOAuthStatePayload = {
    csrf: randomBytes(16).toString("hex"),
    nonce: randomBytes(16).toString("hex"),
    invitationToken: input?.invitationToken?.trim() || undefined,
    joinCode: input?.joinCode?.trim() || undefined,
    createdAt: Date.now(),
  };
  const state = signOAuthState(statePayload, config.stateSecret);

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce: statePayload.nonce,
    access_type: "offline",
    prompt: "consent",
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function verifyGoogleOAuthCallbackState(state: string): Promise<{
  invitationToken?: string;
  joinCode?: string;
  nonce: string;
}> {
  const config = readGoogleOAuthConfig();
  const cookieStore = await cookies();
  const cookieState = cookieStore.get(OAUTH_STATE_COOKIE)?.value?.trim();
  cookieStore.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  if (!cookieState || cookieState !== state.trim()) {
    throw new Error("auth.google_state_invalid");
  }

  const payload = readAndVerifyOAuthState(cookieState, config.stateSecret);
  if (Date.now() - payload.createdAt > OAUTH_STATE_MAX_AGE_SECONDS * 1000) {
    throw new Error("auth.google_state_invalid");
  }

  return {
    invitationToken: payload.invitationToken,
    joinCode: payload.joinCode,
    nonce: payload.nonce,
  };
}

export async function exchangeGoogleCodeForProfile(input: {
  code: string;
  expectedNonce: string;
}): Promise<GoogleUserProfile> {
  const config = readGoogleOAuthConfig();
  const tokenParams = new URLSearchParams({
    code: input.code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.callbackUrl,
    grant_type: "authorization_code",
  });

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenParams.toString(),
    cache: "no-store",
  });
  if (!tokenResponse.ok) {
    throw new Error("auth.google_exchange_failed");
  }

  const tokenPayload = await tokenResponse.json() as {
    access_token?: string;
    id_token?: string;
  };
  if (!tokenPayload.access_token || !tokenPayload.id_token) {
    throw new Error("auth.google_exchange_failed");
  }

  verifyGoogleIdTokenClaims(tokenPayload.id_token, config.clientId, input.expectedNonce);
  const userResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
    cache: "no-store",
  });
  if (!userResponse.ok) {
    throw new Error("auth.google_userinfo_failed");
  }

  const userPayload = await userResponse.json() as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!userPayload.sub || !userPayload.email) {
    throw new Error("auth.google_profile_missing_email");
  }
  if (userPayload.email_verified !== true) {
    throw new Error("auth.google_email_not_verified");
  }

  return {
    sub: userPayload.sub,
    email: userPayload.email,
    emailVerified: true,
    displayName: userPayload.name?.trim() || userPayload.email,
    avatarUrl: userPayload.picture?.trim() || undefined,
  };
}

function verifyGoogleIdTokenClaims(idToken: string, clientId: string, expectedNonce: string): void {
  const payload = parseJwtPayload(idToken) as {
    aud?: string;
    iss?: string;
    nonce?: string;
    exp?: number;
  };

  if (payload.aud !== clientId) {
    throw new Error("auth.google_nonce_invalid");
  }
  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    throw new Error("auth.google_nonce_invalid");
  }
  if (payload.nonce !== expectedNonce) {
    throw new Error("auth.google_nonce_invalid");
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
    throw new Error("auth.google_nonce_invalid");
  }
}

function parseJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("auth.google_nonce_invalid");
  }

  const payload = parts[1] ?? "";
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
}

function readRequiredAuthEnv(name: string): string {
  const value = readServerEnvValue(name)?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function signOAuthState(payload: GoogleOAuthStatePayload, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function readAndVerifyOAuthState(state: string, secret: string): GoogleOAuthStatePayload {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("auth.google_state_invalid");
  }

  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  if (signature !== expectedSignature) {
    throw new Error("auth.google_state_invalid");
  }

  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as GoogleOAuthStatePayload;
}
