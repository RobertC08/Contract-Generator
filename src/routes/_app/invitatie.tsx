import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import { useConvexAuth } from "@convex-dev/react-query";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/invitatie")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: (s.token as string) || "",
  }),
  component: InvitatiePage,
});

function InvitatiePage() {
  const { token } = Route.useSearch();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const acceptInvite = useMutation(api.organizations.acceptInvite);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token) {
      navigate({ to: "/panou" });
      return;
    }
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate({
        to: "/autentificare",
        search: { redirect: `/invitatie?token=${encodeURIComponent(token)}` },
      });
      return;
    }
    if (attempted.current) return;
    attempted.current = true;
    acceptInvite({ token })
      .then(() => navigate({ to: "/panou" }))
      .catch(() => navigate({ to: "/panou" }));
  }, [token, isLoading, isAuthenticated, navigate, acceptInvite]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
