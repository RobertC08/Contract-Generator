import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_auth/panou/_layout/sabloane")({
  component: SabloaneLayout,
});

function SabloaneLayout() {
  const matchRoute = useMatchRoute();
  const isIndex = matchRoute({ to: "/panou/sabloane", fuzzy: false });
  const isNou = matchRoute({ to: "/panou/sabloane/nou", fuzzy: false });

  return (
    <div className="w-full">
      {!isIndex && !isNou && (
        <div className="mb-4 px-4 sm:px-6">
          <Link
            to="/panou/sabloane"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Template-uri
          </Link>
        </div>
      )}
      <Outlet />
    </div>
  );
}
