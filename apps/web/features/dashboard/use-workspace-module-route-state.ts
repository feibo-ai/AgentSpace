"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildWorkspaceModuleHref,
  parseWorkspaceModuleHref,
  parseWorkspaceModulePath,
  type WorkspaceModuleHrefInput,
  type WorkspaceModuleId,
  type WorkspaceModuleRouteState,
} from "@/features/dashboard/workspace-module-route";

export function useWorkspaceModuleRouteState(currentWorkspaceSlug: string): {
  routeState: WorkspaceModuleRouteState;
  routeStateSource: "url" | "next" | "client";
  setOptimisticRouteFromHref: (href: string) => WorkspaceModuleRouteState | null;
  navigateHrefLocally: (href: string, options?: { replace?: boolean }) => WorkspaceModuleRouteState | null;
  navigateModule: (
    input: WorkspaceModuleId | WorkspaceModuleHrefInput,
    options?: { replace?: boolean; scroll?: boolean },
  ) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const currentRouteState = useMemo(
    () => parseWorkspaceModulePath(pathname, searchParams),
    [pathname, searchKey, searchParams],
  );
  const [optimisticRouteState, setOptimisticRouteState] = useState<{
    routeState: WorkspaceModuleRouteState;
    source: "next" | "client";
  } | null>(null);

  useEffect(() => {
    setOptimisticRouteState((current) => current?.source === "client" ? current : null);
  }, [pathname, searchKey]);

  useEffect(() => {
    function handlePopState(): void {
      const nextHref = `${window.location.pathname}${window.location.search}`;
      const nextRouteState = parseWorkspaceModuleHref(nextHref);
      setOptimisticRouteState({ routeState: nextRouteState, source: "client" });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const setOptimisticRouteFromHref = useCallback((href: string) => {
    const nextRouteState = parseWorkspaceModuleHref(href);
    if (nextRouteState.workspaceSlug && nextRouteState.workspaceSlug !== currentWorkspaceSlug) {
      return null;
    }

    setOptimisticRouteState({ routeState: nextRouteState, source: "next" });
    return nextRouteState;
  }, [currentWorkspaceSlug]);

  const navigateHrefLocally = useCallback((href: string, options?: { replace?: boolean }) => {
    const nextRouteState = parseWorkspaceModuleHref(href);
    if (nextRouteState.workspaceSlug && nextRouteState.workspaceSlug !== currentWorkspaceSlug) {
      return null;
    }

    const nextUrl = new URL(href, window.location.href);
    const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    const historyState = { agentSpaceWorkspaceModule: true };
    if (options?.replace) {
      window.history.replaceState(historyState, "", nextPath);
    } else {
      window.history.pushState(historyState, "", nextPath);
    }
    setOptimisticRouteState({ routeState: nextRouteState, source: "client" });
    return nextRouteState;
  }, [currentWorkspaceSlug]);

  const navigateModule = useCallback((
    input: WorkspaceModuleId | WorkspaceModuleHrefInput,
    options?: { replace?: boolean; scroll?: boolean },
  ) => {
    const href = buildWorkspaceModuleHref(currentWorkspaceSlug, input);
    setOptimisticRouteFromHref(href);
    if (options?.replace) {
      router.replace(href, { scroll: options.scroll ?? false });
      return;
    }
    router.push(href, { scroll: options?.scroll ?? false });
  }, [currentWorkspaceSlug, router, setOptimisticRouteFromHref]);

  return {
    routeState: optimisticRouteState?.routeState ?? currentRouteState,
    routeStateSource: optimisticRouteState?.source ?? "url",
    setOptimisticRouteFromHref,
    navigateHrefLocally,
    navigateModule,
  };
}
