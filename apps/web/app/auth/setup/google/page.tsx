import { redirect } from "next/navigation";
import { GoogleProfileSetupScreen } from "@/features/auth/google-profile-setup-screen";
import { readPendingGoogleRegistrationHandoff } from "@/features/auth/google-registration-handoff";
import { readWorkspaceInvitationDetailsSync } from "@/features/auth/workspace-invitations";

export const dynamic = "force-dynamic";

export default async function GoogleProfileSetupPage() {
  const handoff = await readPendingGoogleRegistrationHandoff();
  if (!handoff) {
    redirect("/auth/error?code=auth.google_profile_setup_expired");
  }

  const invitation = handoff.invitationToken
    ? readWorkspaceInvitationDetailsSync(handoff.invitationToken, { includeInactive: true })
    : null;

  return (
    <GoogleProfileSetupScreen
      email={handoff.email}
      initialDisplayName={handoff.displayName}
      invitation={invitation
        ? {
            workspaceName: invitation.workspaceName,
            role: invitation.role,
          }
        : undefined}
    />
  );
}
