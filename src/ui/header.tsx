import { useState } from "react";
import { Link } from "@tanstack/react-router";

const navLinks = [
  { to: "/panou", label: "Acasă" },
  { to: "/panou/sabloane", label: "Template-uri" },
  { to: "/panou/audit", label: "Audit" },
  { to: "/panou/setari/profil", label: "Setări" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link
          to="/panou"
          className="text-lg font-semibold text-stone-900 dark:text-stone-100 tracking-tight shrink-0"
        >
          Consolă admin
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="md:hidden p-2 -mr-2 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
          aria-expanded={open}
          aria-label={open ? "Închide meniul" : "Deschide meniul"}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <nav
          className={`absolute md:relative top-full left-0 right-0 md:top-auto md:left-auto bg-white dark:bg-stone-900 md:bg-transparent dark:md:bg-transparent border-b md:border-b-0 border-stone-200 dark:border-stone-800 md:border-0 shadow-lg md:shadow-none ${open ? "block" : "hidden md:flex"} md:flex items-stretch md:items-center gap-0 md:gap-4`}
        >
          <div className="max-w-5xl mx-auto w-full px-4 py-3 md:py-0 md:px-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className="py-2.5 px-3 md:py-0 md:px-0 rounded-lg md:rounded-none text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 md:hover:bg-transparent transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
