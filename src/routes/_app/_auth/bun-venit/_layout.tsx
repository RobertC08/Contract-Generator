import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_auth/bun-venit/_layout")({
  component: Outlet,
});
