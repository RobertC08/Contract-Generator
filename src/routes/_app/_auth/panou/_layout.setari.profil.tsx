import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { z } from "zod";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_app/_auth/panou/_layout/setari/profil")({
  component: SetariProfilPage,
});

function SetariProfilPage() {
  const { data: user } = useQuery(api.app.getCurrentUser, {});
  const updateUsername = useMutation(api.app.updateUsername);
  const updateUserImage = useMutation(api.app.updateUserImage);
  const removeUserImage = useMutation(api.app.removeUserImage);
  const generateUploadUrl = useMutation(api.app.generateUploadUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    validatorAdapter: zodValidator(),
    defaultValues: { username: user?.username ?? "" },
    onSubmit: async ({ value }) => {
      await updateUsername({ username: value.username || "" });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, { method: "POST", body: file });
    const { storageId } = (await res.json()) as { storageId: string };
    if (storageId) await updateUserImage({ imageId: storageId as Parameters<typeof updateUserImage>[0]["imageId"] });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Avatar</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Imaginea ta de profil.</p>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-stone-200 dark:border-stone-800 p-6">
          <label className="group relative flex cursor-pointer overflow-hidden rounded-full transition active:scale-95">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} className="h-20 w-20 rounded-full object-cover" alt={user.username ?? user.email ?? ""} />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-stone-400 to-stone-600" />
            )}
            <div className="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
              <Upload className="h-6 w-6 text-white" />
            </div>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
          />
          {user.avatarUrl && (
            <Button type="button" variant="outline" size="sm" onClick={() => removeUserImage({})}>
              Resetează
            </Button>
          )}
        </div>
      </div>

      <form
        className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Nume utilizator</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Afișat în profil.</p>
        </div>
        <div className="border-t border-stone-200 dark:border-stone-800 p-6">
          <form.Field
            name="username"
            validators={{ onSubmit: z.string().min(2, "Minim 2 caractere").max(32, "Maxim 32 caractere") }}
            children={(field) => (
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="nume_utilizator"
                className="max-w-xs"
              />
            )}
          />
          {form.state.fieldMeta.username?.errors?.length ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{form.state.fieldMeta.username.errors.join(" ")}</p>
          ) : null}
        </div>
        <div className="flex justify-end border-t border-stone-200 dark:border-stone-800 p-4">
          <Button type="submit" disabled={form.state.isSubmitting}>
            Salvează
          </Button>
        </div>
      </form>
    </div>
  );
}
