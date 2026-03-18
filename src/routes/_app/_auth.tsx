import { useConvexAuth } from "@convex-dev/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_app/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/autentificare" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading && !isAuthenticated) {
    return null;
  }

  return <Outlet />;
}
