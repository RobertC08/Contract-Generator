# Convex migration – remaining frontend steps

Dashboard and templates list already use Convex (`useQuery(api.dashboard.get)`, `api.templates.list`, `api.templates.remove`, `contracts.actions.createShareableDraft`).

## Env

- **Next.js (Vercel / local):** `NEXT_PUBLIC_CONVEX_URL` from Convex dashboard (Project Settings > URL).
- **Convex (obligatoriu pentru OTP):** `RESEND_API_KEY` și `RESEND_FROM` trebuie setate **în proiectul Convex**, nu doar în `.env` Next.js. Ex.: `npx convex env set RESEND_API_KEY re_...` și `npx convex env set RESEND_FROM "Nume <noreply@domeniu-verificat.ro>"`. Fără cheie, `sendOtp` returnează eroare explicită.
- Opțional local: `npx convex env set OTP_DEV_RETURN_CODE true` — returnează codul OTP în răspuns fără Resend (doar dev).
- **Convex:** `NEXT_PUBLIC_APP_URL` pentru linkuri fill/sign.

## Pattern for each page

1. Replace `fetch("/api/...")` with:
   - **Read-only:** `useQuery(api.<module>.<query>)` (e.g. `api.contracts.get`, `api.sign.getSignerByToken`).
   - **Writes:** `useMutation(api.<module>.<mutation>)` (e.g. `api.contracts.updateDraftVariables`, `api.contracts.deleteContract`).
   - **Side effects (doc gen, email, ANAF):** `useAction(api.<module>.actions.<action>)` (e.g. `api.contracts.actions.createContract`, `api.sign.actions.sendOtp`). Use the same cast as in `app/templates/page.tsx` if `api.contracts.actions` is not in generated types.

2. **Document URLs:** Use the Convex action `contracts.actions.getDocumentUrl({ contractId })` and open the returned URL, or use the URL from `generateDocument` / sign flow.

3. **Template upload:** Use `useMutation(api.templates.generateUploadUrl)`, POST the file to the returned URL, get `storageId` from the response, then `useMutation(api.templates.create, { name, fileStorageId, ... })`.

4. **ANAF:** Replace `fetch("/api/anaf", { body: JSON.stringify({ cui, data }) })` with `useAction(api.anaf.actions.fetchCompanyByCui, { cui, data })`.

## Pages to migrate

| Page | Convex usage |
|------|----------------|
| `app/templates/new/page.tsx` | `generateUploadUrl`, POST file, `templates.create`, `templates.actions.extractVariablesFromFile(storageId)` for new template; or extract from file before upload. |
| `app/templates/[id]/edit/page.tsx` | `useQuery(api.templates.get)`, `templates.update`, `templates.actions.getTemplateContentHtml` for mammoth HTML. |
| `app/templates/[id]/contracts/page.tsx` | `useQuery(api.templates.getContracts, { templateId })`. |
| `app/contract/page.tsx` | `useQuery(api.contracts.getTemplateFormData)` or templates.actions.getTemplateContentHtml, `contracts.actions.createContract` or `createShareableDraft`, `anaf.actions.fetchCompanyByCui`. |
| `app/contract/[id]/page.tsx` | `useQuery(api.contracts.getView, { contractId })`, document URL via `getDocumentUrl` action. |
| `app/contract/edit/[id]/page.tsx` | `useQuery(api.contracts.getForEdit)`, `contracts.actions.updateDraftAndGenerateDocument`. |
| `app/contract/fill/[token]/page.tsx` | `useQuery(api.contracts.getFillData, { token })`, actions for preview and document URL. |
| `app/sign/[token]/page.tsx` | `useQuery(api.sign.getSignerByToken)`, `sign.actions.sendOtp`, `sign.actions.verifyOtp`, `sign.actions.submitSignature`, document URL via `getDocumentUrl(contractId)`. |
| `app/audit/page.tsx` | `useQuery(api.contracts.getAudit, { contractId })` when contractId is set. |

## Data migration (run once)

1. Export from PostgreSQL: `npx tsx scripts/export-for-convex.ts`. This writes `scripts/convex-export/` (JSON + template binaries).
2. Upload each template file to Convex storage (e.g. use `templates.generateUploadUrl` and POST the file), then create template docs with the returned `storageId`.
3. Insert contracts, signers, signingOtps, signatureAuditLogs, contractNumberSequences (map old string ids to new Convex ids if needed). Existing `documentUrl` paths (e.g. `/contracts/xyz.docx`) can be re-uploaded to Convex storage and set as `documentStorageId`.

## Phase-out (done)

1. ~~Remove `app/api` routes~~ – Removed.
2. ~~Remove Prisma~~ – Removed: `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `postinstall`, `lib/db.ts`, `lib/contracts/contract-service.ts`, `lib/contracts/sign-service.ts`, `lib/contracts/template-versioning.ts`, `prisma/`, `prisma.config.ts`, `scripts/export-for-convex.ts`.
