import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_auth/panou/_layout/setari/")({
  beforeLoad: () => { throw redirect({ to: "/panou/setari/profil" }); },
});
