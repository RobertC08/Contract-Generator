# Integrarea feature-ului de generare contracte în alt proiect

Acest document explică cum să integrezi feature-ul de generare de contracte DOCX din template-uri Word (.docx) cu variabile (docxtemplater), stocare template în DB, JSON pentru câmpuri.

---

## 1. Ce face feature-ul

- **Template-uri DOCX** stocate în DB (sau S3), cu placeholdere `{numeVariabila}` (docxtemplater).
- **Generare DOCX** la cerere: variabilele (JSON) se aplică pe template, se generează DOCX, se salvează (ex. S3/local) și se returnează URL.
- **API:** GET template (metadate/variabile), POST generare contract → JSON cu contractId, documentUrl, signingLinks.
- **Fără conversii** (HTML→PDF etc.), fără Puppeteer.

---

## 2. Arhitectura (ce fișiere copiezi)

```
lib/
  contracts/
    docx-generator.ts   # docxtemplater: renderDocx(templateBuffer, data) → Buffer
    contract-service.ts # template → renderDocx → storage → DB
    errors.ts           # TemplateNotFoundError, StorageError, ContractSignedError
  storage/
    storage-provider.ts # Interface + LocalStorageProvider (sau S3)
  db.ts

app/api/contracts/
  route.ts              # GET ?templateId=..., POST { templateId, variables, signers } → JSON

prisma/
  schema.prisma         # ContractTemplate (fileContent Bytes), Contract (documentUrl, variables Json)
```

---

## 3. Dependențe

```bash
npm install docxtemplater pizzip @prisma/client zod
npm install -D prisma
# Pentru Prisma 7 + PostgreSQL:
npm install @prisma/adapter-pg pg dotenv
```

- **docxtemplater** + **pizzip** – generare DOCX din template + JSON.
- **zod** – validare body POST.
- **Prisma** – stocare template-uri (fileContent = DOCX buffer) și contracte.

---

## 4. Schema Prisma

```prisma
model ContractTemplate {
  id                   String   @id @default(cuid())
  name                 String
  fileContent          Bytes    // DOCX binary
  version              Int
  variableDefinitions  Json?
  createdAt            DateTime @default(now())
  contracts            Contract[]
}

model Contract {
  id               String   @id @default(cuid())
  templateId       String
  template         ContractTemplate @relation(...)
  variables        Json
  documentUrl      String?
  status           ContractStatus @default(DRAFT)
  documentHash     String?
  templateVersion  Int?
  createdAt        DateTime @default(now())
  signers          Signer[]
}
```

---

## 5. Pași de integrare

### 5.1 Copiază lib-ul

- Copiază `lib/contracts/docx-generator.ts`, `contract-service.ts`, `errors.ts`.
- Copiază `lib/storage/storage-provider.ts` și implementează `StorageProvider` (local sau S3).
- În contract-service: `renderDocx(templateBuffer, variables)` din docx-generator; salvează buffer-ul DOCX cu `storageProvider.save(key, buffer)`; creează Contract cu `documentUrl` returnat.

### 5.2 Ruta API

- **GET** `?templateId=...`: returnează `{ variableDefinitions }` pentru formular.
- **POST** body: `{ templateId, variables, signers? }`:
  - apelează `createContract({ prisma, storageProvider, templateId, variables, signers })`;
  - răspuns JSON: `{ success: true, contractId, documentUrl?, signingLinks }`.

Setare:

```ts
export const runtime = "nodejs";
```

### 5.3 Template-uri DOCX

- Template-urile sunt fișiere .docx cu placeholdere docxtemplater: `{contractNr}`, `{clientName}`, etc.
- Stocare: în DB în `ContractTemplate.fileContent` (Bytes), sau în S3 cu referință în DB.
- Variabilele se trimit ca JSON; docxtemplater le înlocuiește în DOCX.

### 5.4 UI

- Formular cu câmpuri pentru variabile; la submit POST /api/contracts; la succes afișezi link descărcare DOCX (`documentUrl`) sau redirect la pagina contractului.

---

## 6. Variabile de mediu

- **DATABASE_URL** – pentru Prisma.
- Pentru storage: în funcție de provider (ex. S3: AWS_*, sau local nu necesită extra).

---

## 7. Checklist rapid

1. Copiază `lib/contracts/` (docx-generator, contract-service, errors), `lib/storage/`, `lib/db.ts`.
2. Adaugă modelele Prisma, rulează migrații.
3. Seed care încarcă cel puțin un template DOCX în `ContractTemplate.fileContent`.
4. Creează ruta API GET + POST pentru `/api/contracts`, `runtime = "nodejs"`.
5. Frontend: form cu variabile, POST, afișare documentUrl pentru descărcare DOCX.

---

## 8. Extensii posibile

- **Storage:** S3 / R2 pentru documentUrl public.
- **Template versioning:** version în ContractTemplate, templateVersion în Contract.
- **Multi-template:** listare template-uri, formular dinamic din variableDefinitions.
