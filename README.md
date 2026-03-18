# Contract Generator - SaaS

Generator de contracte cu șabloane DOCX, semnare electronică și audit.

## Stack

- **Frontend**: Vite + React + TanStack Router + shadcn/ui
- **Backend**: Convex (auth, DB, storage, HTTP)
- **Autentificare**: Convex Auth (Email OTP, Google, GitHub)
- **Plăți**: Stripe (abonamente)
- **Email**: Resend

## Setup

1. Instalare dependențe: `npm install`
2. Variabile de mediu:
   - `.env.local`: `VITE_CONVEX_URL` (URL Convex deployment)
   - Convex dashboard: `AUTH_RESEND_KEY`, `AUTH_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`, OAuth credentials
3. `npm run dev` - frontend (Vite) + backend (Convex)

## Scripturi

- `npm run dev` - development (frontend + Convex)
- `npm run build` - build production
- `npm run preview` - preview build
- `npm run typecheck` - verificare tipuri
- `npm run lint` - ESLint
- `npm test` - teste

## Rute principale

- `/` - landing
- `/autentificare` - login (Email OTP, Google, GitHub)
- `/bun-venit` - onboarding (username + organizație)
- `/panou` - dashboard
- `/panou/sabloane` - șabloane
- `/panou/contracte` - contracte
- `/panou/audit` - audit
- `/panou/setari` - setări (profil, abonament, organizație)
- `/semneaza/:token` - semnare (public)
- `/contract/completeaza/:token` - completare draft (public)
- `/invitatie?token=` - acceptare invitație organizație
