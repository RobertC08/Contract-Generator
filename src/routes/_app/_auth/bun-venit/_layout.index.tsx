import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { z } from "zod";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvexAuth } from "@convex-dev/react-query";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const Route = createFileRoute("/_app/_auth/bun-venit/_layout/")({
  component: BunVenitPage,
});

function BunVenitPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { data: user } = useQuery(convexQuery(api.app.getCurrentUser, {}));
  const navigate = useNavigate();
  const completeOnboarding = useMutation(api.app.completeOnboarding);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/autentificare" });
      return;
    }
    if (user?.username) {
      navigate({ to: "/panou" });
      return;
    }
  }, [user, isLoading, isAuthenticated, navigate]);

  const form = useForm({
    validatorAdapter: zodValidator(),
    defaultValues: { username: "", orgName: "" },
    onSubmit: async ({ value }) => {
      const orgSlug = slugify(value.orgName) || "organizatie";
      await completeOnboarding({
        username: value.username,
        orgName: value.orgName,
        orgSlug,
      });
      navigate({ to: "/panou" });
    },
  });

  if (user?.username) return null;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Bun venit!</h1>
      <p className="text-center text-muted-foreground">
        Completează detaliile pentru a crea organizația ta.
      </p>
      <form
        className="flex w-full flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Field
          name="username"
          validators={{
            onSubmit: z.string().min(2, "Numele trebuie să aibă cel puțin 2 caractere."),
          }}
          children={(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="username">Nume utilizator</label>
              <Input
                id="username"
                placeholder="nume_utilizator"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta?.errors.length > 0 && (
                <span className="text-sm text-destructive">
                  {field.state.meta.errors.join(" ")}
                </span>
              )}
            </div>
          )}
        />
        <form.Field
          name="orgName"
          validators={{
            onSubmit: z.string().min(2, "Numele organizației trebuie să aibă cel puțin 2 caractere."),
          }}
          children={(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="orgName">Nume organizație</label>
              <Input
                id="orgName"
                placeholder="Școala de muzică X"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta?.errors.length > 0 && (
                <span className="text-sm text-destructive">
                  {field.state.meta.errors.join(" ")}
                </span>
              )}
            </div>
          )}
        />
        <Button type="submit" disabled={form.state.isSubmitting}>
          {form.state.isSubmitting ? <Loader2 className="animate-spin" /> : "Continuă"}
        </Button>
      </form>
    </div>
  );
}
