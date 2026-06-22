export function translateAuthError(
  message: string,
  tx: (zh: string, en: string) => string,
): string {
  if (message === "auth.email_exists") {
    return tx("该邮箱已经注册。", "This email is already registered.");
  }
  if (message === "auth.account_not_found") {
    return tx("账号不存在。", "Account not found.");
  }
  if (message === "auth.invalid_password") {
    return tx("密码错误。", "Incorrect password.");
  }
  if (message === "auth.google_state_invalid") {
    return tx("Google 登录状态校验失败，请重试。", "Google sign-in state validation failed. Please try again.");
  }
  if (message === "auth.google_exchange_failed" || message === "auth.google_userinfo_failed") {
    return tx("Google 登录失败，请稍后重试。", "Google sign-in failed. Please try again.");
  }
  if (message === "auth.google_email_not_verified") {
    return tx("Google 邮箱尚未验证。", "Your Google email is not verified.");
  }
  if (message === "auth.google_profile_missing_email") {
    return tx("Google 账户未返回可用邮箱。", "Google did not return a usable email address.");
  }
  if (message === "auth.google_nonce_invalid") {
    return tx("Google 登录校验失败，请重试。", "Google sign-in verification failed. Please try again.");
  }
  if (message === "auth.google_account_link_required") {
    return tx("请先确认并绑定现有账号，再继续使用 Google 登录。", "Please confirm and link your existing account before continuing with Google sign-in.");
  }
  if (message === "auth.google_profile_setup_required") {
    return tx("请先确认用户名和工作区名字，再继续使用 Google 登录。", "Please confirm your username and workspace name before continuing with Google sign-in.");
  }
  if (message === "auth.google_link_expired") {
    return tx("Google 绑定流程已过期，请重新发起登录。", "The Google account-link flow expired. Please start Google sign-in again.");
  }
  if (message === "auth.google_profile_setup_expired") {
    return tx("Google 首次登录补全流程已过期，请重新发起登录。", "The first-time Google setup flow expired. Please start Google sign-in again.");
  }
  if (message === "auth.google_link_requires_password") {
    return tx("该账号需要先通过密码确认后才能绑定 Google。", "This account must be confirmed with its password before Google can be linked.");
  }
  if (message === "auth.google_account_conflict") {
    return tx("这个 Google 账号已经绑定到其他用户。", "This Google account is already linked to another user.");
  }
  if (message === "access_denied") {
    return tx("你取消了 Google 登录。", "You cancelled Google sign-in.");
  }
  if (message === "workspace.invitation.invalid" || message === "workspace.invitation.inactive") {
    return tx("邀请链接无效。", "Invitation link is invalid.");
  }
  if (message === "workspace.invitation.expired") {
    return tx("邀请已过期。", "Invitation has expired.");
  }
  if (message === "workspace.invitation.email_mismatch") {
    return tx("当前账号邮箱与邀请邮箱不一致。", "This account email does not match the invitation email.");
  }
  if (message === "workspace.join_code.invalid") {
    return tx("邀请码无效或已重置。", "This invite code is invalid or has been reset.");
  }
  if (message === "workspace.join_code.missing") {
    return tx("请填写工作区邀请码。", "Please enter a workspace invite code.");
  }
  if (message === "Missing form value \"displayName\".") {
    return tx("请填写你的名字。", "Please enter your name.");
  }
  if (message === "Missing form value \"workspaceName\".") {
    return tx("请填写工作区名字。", "Please enter a workspace name.");
  }
  if (message === "Missing form value \"email\".") {
    return tx("请填写邮箱。", "Please enter your email.");
  }
  if (message === "Missing form value \"password\".") {
    return tx("请填写密码。", "Please enter your password.");
  }
  if (message.startsWith("Missing form value")) {
    return tx("表单信息不完整，请检查后重试。", "The form is incomplete. Please review it and try again.");
  }
  return message;
}
