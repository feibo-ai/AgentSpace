"use client";

import { useLanguage } from "@/features/i18n/language-provider";
import { translateAuthError } from "./auth-error-messages";
import { AuthStatusScreen } from "./auth-status-screen";

export function AuthErrorScreen({ code }: { code?: string }) {
  const { tx } = useLanguage();
  const resolvedCode = code?.trim() || "auth.google_exchange_failed";

  return (
    <AuthStatusScreen
      body={translateAuthError(resolvedCode, tx)}
      eyebrow={tx("身份验证", "Authentication")}
      heroBody={tx(
        "OAuth、邀请和账号绑定共用同一条身份链路。出现错误时，先把问题解释清楚，再回到登录入口。",
        "OAuth, invitations, and account linking share one identity flow. When something fails, the UI should explain the problem clearly before sending people back.",
      )}
      heroTitle={tx("登录流程被中断了。", "The sign-in flow was interrupted.")}
      highlights={[
        tx("Google 登录", "Google sign-in"),
        tx("邀请链路", "Invitation flow"),
        tx("账号绑定", "Account linking"),
      ]}
      primaryAction={{
        href: "/",
        label: tx("返回登录页", "Back to sign in"),
      }}
      title={tx("登录失败", "Sign-in failed")}
    />
  );
}
