import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import React, { Suspense } from "react";
import { Helmet } from "react-helmet-async";

const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : React.lazy(() =>
        import("@tanstack/router-devtools").then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      );

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: () => {
    const router = useRouter();
    const matchWithTitle = [...router.state.matches]
      .reverse()
      .find((d) => (d as { routeContext?: { title?: string } }).routeContext?.title);
    const title = (matchWithTitle as { routeContext?: { title?: string } })?.routeContext?.title || "Contract Generator";

    return (
      <>
        <Outlet />
        <Helmet>
          <title>{title}</title>
        </Helmet>
        <Suspense>
          <TanStackRouterDevtools />
        </Suspense>
      </>
    );
  },
});
