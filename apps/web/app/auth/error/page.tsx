import { AuthErrorScreen } from "@/features/auth/auth-error-screen";

export const dynamic = "force-dynamic";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const code =
    typeof resolvedSearchParams.code === "string"
      ? resolvedSearchParams.code
      : typeof resolvedSearchParams.error === "string"
        ? resolvedSearchParams.error
        : undefined;

  return <AuthErrorScreen code={code} />;
}
