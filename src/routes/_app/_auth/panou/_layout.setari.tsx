import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_auth/panou/_layout/setari")({
  component: SetariLayout,
});

function SetariLayout() {
  const matchRoute = useMatchRoute();
  const isProfil = matchRoute({ to: "/panou/setari/profil", fuzzy: true });
  const isAbonament = matchRoute({ to: "/panou/setari/abonament", fuzzy: true });
  const isOrganizatie = matchRoute({ to: "/panou/setari/organizatie", fuzzy: true });

  return (
    <div className="flex w-full px-4 sm:px-6 py-6">
      <div className="mx-auto flex w-full max-w-4xl gap-8">
        <nav className="hidden w-48 flex-shrink-0 flex-col gap-1 lg:flex">
          <Link
            to="/panou/setari/profil"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isProfil ? "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100" : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
          >
            Profil
          </Link>
          <Link
            to="/panou/setari/abonament"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isAbonament ? "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100" : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
          >
            Abonament
          </Link>
          <Link
            to="/panou/setari/organizatie"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isOrganizatie ? "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100" : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
          >
            Organizație
          </Link>
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
