# Integrarea feature-ului de generare contracte în alt proiect

Acest document explică cum să integrezi în alt proiect (ex. Next.js) feature-ul de generare de contracte PDF din template-uri HTML cu variabile, previzualizare live și descărcare PDF.

---

## 1. Ce face feature-ul

- **Template-uri HTML** stocate în DB, cu variabile Handlebars (`{{numeVariabila}}`).
- **Generare PDF** la cerere: se completează variabilele, se randează HTML, se generează PDF (Puppeteer), se salvează și se returnează.
- **API:** GET template (pentru preview), POST generare contract (returnează PDF).
- **UI opțional:** formular cu variabile + previzualizare live în iframe + buton descărcare PDF.

---

## 2. Arhitectura (ce fișiere copiezi)

```
lib/
  contracts/
    template-engine.ts   # Handlebars: renderTemplate(html, variables) → HTML
    pdf-generator.ts     # Puppeteer: generatePdf(html) → Buffer
    contract-service.ts  # Orchestrează: template → render → PDF → storage → DB
    errors.ts            # TemplateNotFoundError, TemplateRenderError, PdfGenerationError, StorageError
    template-versioning.ts  # Opțional: createTemplateVersion() pentru noi versiuni
  storage/
    storage-provider.ts # Interface + LocalStorageProvider (salvează în public/contracts/)
  db.ts                 # Prisma client singleton (Next.js)

app/api/contracts/
  route.ts              # GET ?templateId=... (conținut template), POST body: { templateId, variables } → PDF

prisma/
  schema.prisma         # ContractTemplate, Contract (vezi mai jos)
  seed.ts               # Exemplu seed pentru un template
  contract-*.html       # Template-uri HTML (sau le încarci din DB prin seed)
```

---

## 3. Dependențe

În proiectul țintă adaugă:

```bash
npm install @prisma/client handlebars puppeteer zod
npm install -D prisma
# Pentru Prisma 7 + PostgreSQL cu adapter:
npm install @prisma/adapter-pg pg dotenv
```

- **handlebars** – substituție variabile în HTML.
- **puppeteer** – generare PDF din HTML (rulează doar în Node, nu Edge).
- **zod** – validare body la POST.
- **Prisma** – stocare template-uri și contracte; dacă folosești Prisma 7, și `@prisma/adapter-pg`, `pg`, `dotenv` pentru DB și seed.

---

## 4. Schema Prisma

Modele minime:

```prisma
model ContractTemplate {
  id        String   @id @default(cuid())
  name      String
  content   String   // HTML cu {{variabile}}
  version   Int
  createdAt DateTime @default(now())
  contracts Contract[]
}

model Contract {
  id         String   @id @default(cuid())
  templateId String
  template   ContractTemplate @relation(fields: [templateId], references: [id])
  variables  Json
  pdfUrl     String?
  createdAt  DateTime @default(now())
}
```

Dacă e Prisma 7, URL-ul DB se configurează în `prisma.config.ts`; datasource în `schema.prisma` poate avea doar `provider = "postgresql"`.

---

## 5. Pași de integrare

### 5.1 Copiază lib-ul

- Copiază `lib/contracts/` (template-engine, pdf-generator, contract-service, errors, eventual template-versioning).
- Copiază `lib/storage/storage-provider.ts` și implementează `StorageProvider` (ex. local în `public/contracts/`).
- Copiază `lib/db.ts` dacă folosești același pattern de Prisma client; altfel adaptează `contract-service` să primească `prisma` și `storageProvider` din exterior.

Asigură-te că în contract-service:
- se folosește `renderTemplate(template.content, variables)` din template-engine;
- se folosește `generatePdf(html)` din pdf-generator;
- se salvează PDF-ul prin `storageProvider.save(key, buffer)` și se creează înregistrarea `Contract` cu `pdfUrl` returnat.

### 5.2 Ruta API

- Creează `app/api/contracts/route.ts` (sau echivalent în proiectul tău).
- **GET** `?templateId=...`: citește din DB template-ul cu acel id, returnează `{ content: string }`. Folosit de frontend pentru preview.
- **POST** body: `{ templateId: string, variables: Record<string, unknown> }`:
  - validează cu Zod;
  - apelează `createContract({ prisma, storageProvider, templateId, variables })`;
  - returnează PDF-ul ca răspuns binar cu headere: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="contract.pdf"`.

Setare obligatorie pentru Puppeteer (Next.js):

```ts
export const runtime = "nodejs";
```

Tratează erorile din contract-service (TemplateNotFoundError → 404, TemplateRenderError → 400, PdfGenerationError/StorageError → 500) și returnează JSON cu `message` și eventual `code`.

### 5.3 Template-uri HTML

- Template-urile sunt HTML cu variabile Handlebars, ex.: `{{contractNr}}`, `{{clientName}}`.
- Pentru PDF frumos: folosește în `<style>` reguli `@page { size: A4; margin: 25mm; }` și `body { padding: 0; }` (marginile vin din @page). În pdf-generator poți seta și `margin: { top: "25mm", ... }` la `page.pdf()`.
- Stocare: fie în fișiere `.html` în `prisma/` (sau alt folder) și încărcare în DB prin seed, fie introduse direct în DB. Contract-service citește doar din DB prin `templateId`.

### 5.4 UI (formular + preview + PDF)

- **Formular:** un form cu câmpuri pentru fiecare variabilă a template-ului (ex. contractNr, clientName, prestatorNume, etc.). La submit: `POST /api/contracts` cu `{ templateId, variables }`, răspunsul e PDF; îl poți descărca cu un blob + link cu `download`.
- **Preview live:**
  - La mount, `GET /api/contracts?templateId=...` pentru a lua `content` (HTML-ul template-ului).
  - La fiecare schimbare în formular, înlocuiești în HTML toate `{{key}}` cu valorile din form (escape HTML pentru siguranță).
  - Afișezi rezultatul într-un `<iframe srcDoc={htmlPreview} />`. Poți injecta în `<head>` un `<style>body { padding: 25mm; }</style>` doar pentru preview, ca textul să aibă același spațiu ca în PDF.
- **Fără padding în jurul “paginii” albe:** containerul iframe-ului să nu aibă padding; padding-ul să fie doar în interiorul body-ului din preview (ex. 25mm).

Pattern-ul din acest proiect: un singur template id (ex. `contract-prestari-servicii`), un form cu toate variabilele, un `useMemo` care construiește HTML-ul de preview din template + form state, și un buton „Generează PDF” care face POST și descarcă fișierul.

---

## 6. Variabile de mediu

- **DATABASE_URL** (obligatoriu) – pentru Prisma și pentru seed.
- Dacă folosești Prisma 7 cu adapter pg, și **DIRECT_URL** / **shadowDatabaseUrl** dacă ai nevoie pentru migrații.

---

## 7. Generare PDF (Puppeteer)

- `pdf-generator.ts` trebuie rulat doar în **Node** (`runtime = "nodejs"` pe ruta care îl apelează).
- Opțional, pentru medii cu puțină memorie, poți lansa Chromium cu args: `--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`, etc.
- Dacă apar erori de memorie, mărește heap Node: `NODE_OPTIONS=--max-old-space-size=4096` (sau 8192).

---

## 8. Checklist rapid pentru Cursor / alt developer

1. Copiază `lib/contracts/`, `lib/storage/`, `lib/db.ts` și adaptează path-urile (alias `@/` etc.).
2. Adaugă modelele Prisma (ContractTemplate, Contract), rulează migrații.
3. Implementează seed care încarcă cel puțin un template HTML în `ContractTemplate`.
4. Creează ruta API GET + POST pentru `/api/contracts`, cu `runtime = "nodejs"` și tratare erori.
5. În frontend: form cu variabilele template-ului, fetch GET pentru HTML, preview prin substituție `{{var}}` + iframe `srcDoc`, POST pentru descărcare PDF.
6. Setează DATABASE_URL (și DIRECT_URL dacă e cazul) și testează generarea unui contract.

---

## 9. Extensii posibile

- **Storage:** înlocuirea `LocalStorageProvider` cu un provider care scrie în S3/Cloudflare R2 și returnează URL public.
- **Template versioning:** folosirea `createTemplateVersion()` din `template-versioning.ts` la crearea/actualizarea template-urilor (fără overwrite).
- **Multi-template:** listare template-uri din DB și formular dinamic în funcție de variabilele cunoscute (ex. din numele coloanelor sau din un câmp `variablesSchema` stocat pe template).

Dacă vrei, următorul pas poate fi un exemplu concret de body POST și răspuns PDF pentru un proiect nou (Next.js sau alt framework).
