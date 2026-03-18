import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/autentificare/_layout")({
  component: Outlet,
});
