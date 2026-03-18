import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Header } from "@/ui/header";

export const Route = createFileRoute("/_app/_auth/panou/_layout")({
  component: PanouLayout,
});

function PanouLayout() {
  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950">
      <Header />
      <Outlet />
    </div>
  );
}
