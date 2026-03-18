import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/ui/button-util";
import { useConvexAuth } from "@convex-dev/react-query";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-card">
      <div className="mx-auto flex w-full max-w-screen-lg flex-col gap-4 px-6 py-12">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold text-primary">
            Contract Generator
          </Link>
          <Link
            to={isAuthenticated ? "/panou" : "/autentificare"}
            className={buttonVariants({ size: "sm" })}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-16 animate-spin" />}
            {!isLoading && isAuthenticated && "Panou"}
            {!isLoading && !isAuthenticated && "Începe"}
          </Link>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-24">
          <h1 className="text-center text-4xl font-bold leading-tight text-primary md:text-6xl">
            Generare contracte electronice
          </h1>
          <p className="max-w-screen-md text-center text-lg text-muted-foreground">
            Creează șabloane, completează variabile și trimite contracte pentru
            semnare electronică. Ideal pentru școli de muzică.
          </p>
          <Link to="/autentificare" className={buttonVariants({ size: "sm" })}>
            Începe acum
          </Link>
        </div>
      </div>
    </div>
  );
}
