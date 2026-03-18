import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app")({
  component: Outlet,
  beforeLoad: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.app.getCurrentUser, {}),
    );
  },
});
