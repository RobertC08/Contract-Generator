import Link from "next/link";
import { ContractForm } from "./components/contract-form";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <main className="w-full max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Contract de prestări servicii
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm">
              Completați câmpurile; previzualizarea se actualizează în timp real. Apăsați „Generează PDF” pentru descărcare.
            </p>
          </div>
          <Link
            href="/templates"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Template-uri
          </Link>
        </div>
        <ContractForm />
      </main>
    </div>
  );
}
