# API integrare (ToneTrack & alte aplicații)

REST expus prin **Convex HTTP**. Frontend-ul Contract Generator (Vite/Vercel) **nu** servește aceste rute.

---

## Base URL

```
https://<DEPLOYMENT>.convex.site
```

În **Convex Dashboard** → deployment-ul folosit în producție → URL-ul site-ului HTTP (sufix `.convex.site`, regiunea poate apărea în URL, ex. `eu-west-1`).

Exemplu complet:

`POST https://flippant-mosquito-271.eu-west-1.convex.site/api/v1/contracts/shareable-draft`

---

## Autentificare

Toate rutele (în afară de webhook-ul pe care îl apelează Convex către ToneTrack):

```
Authorization: Bearer <cheie API>
```

**Cheia** se generează în Contract Generator: **Panou → Setări organizație → Chei API**. Poți avea mai multe chei (ex. staging / producție / altă aplicație).

**Drepturi:** cheia este legată de o **organizație**. Vezi doar template-uri și contracte permise pentru acea org (template-uri cu același `orgId`, plus template-uri „legacy” fără `orgId`). Contractele create prin API primesc `orgId`-ul org-ului cheii dacă template-ul nu avea org.

**Securitate:** cheia doar pe **server** ToneTrack (env), niciodată în browser.

---

## Endpoints

### `POST /api/v1/contracts/shareable-draft`

Creează draft partajabil: clientul deschide `fillLink`, completează câmpurile și semnează (OTP + semnătură).

**Body (JSON):**

| Câmp | Obligatoriu | Descriere |
|------|-------------|-----------|
| `templateId` | da | ID template din `GET /api/v1/templates` → `id` (tabela `contractTemplates`, **nu** ID contract). |
| `parentContractId` | nu | Doar act adițional; contract părinte trebuie **SIGNED**. |
| `metadata` | nu | Obiect plat (max 40 chei); valori string / number / boolean. Vezi mai jos (prefill + webhook). |
| `webhookUrl` | nu | URL **https**; la semnare, Convex face `POST` cu payload-ul de mai jos. |

**`metadata`: prefill și integrare**

- **Webhook (persistat separat):** doar cheile `studentId`, `schoolId`, `guardianId`, `contractFor`, `hasGuardian` — dacă apar în body, sunt salvate pe contract și **numai acestea** apar în `metadata` din webhook la semnare (fără câmpurile de prefill). `hasGuardian` ajunge ca string (`"true"` / `"false"`) după normalizarea API.
- **Prefill (`/contract/completeaza/...`):** orice altă cheie din `metadata` al cărei nume coincide cu o variabilă din șablon (placeholder-uri în DOCX **sau** `name` din `variableDefinitions` de la `GET /api/v1/template`) este copiată în valorile inițiale ale formularului. Numele trebuie să se potrivească exact cu cele din template.
- **Durată contract (derivat):** dacă în șablon există `{contractDurationDays}` sau `{Perioada contract (in zile)}`, valoarea este calculată automat din `contractStartDate` și `contractEndDate` (ISO `YYYY-MM-DD` sau `DD.MM.YYYY` din formular): **diferența în zile între sfârșit și început** (nu e inclusiv; aceeași zi = 0; un an de calendar 365 zile dă 365, nu 366). Nu trimite aceste chei în metadata pentru prefill; completează doar cele două date.
- **Câmpul `{Data}`:** dacă există în șablon și nu vine precompletat (sau e gol), se pune automat **data calendaristică curentă** (fus `Europe/Bucharest`, format `YYYY-MM-DD` în formular). Utilizatorul o poate modifica înainte de trimitere.
- **Placeholder cu fallback (`|`):** poți folosi un singur tag, ex. `{studentFullName | guardianFullName}` sau `{studentAddress | guardianAddress}`. În formularul de completare, fiecare segment devine **câmp separat** (ex. Nume elev, Nume apărător), iar la generarea DOCX se aplică regula de mai jos. La randare, dacă în `integrationMetadata` ai `hasGuardian: "true"`, pentru **ambele** tag-uri se folosește mai întâi apărătorul (`guardianFullName` / `guardianAddress`), apoi elevul dacă lipsește; dacă `hasGuardian` e fals sau lipsește, se folosește mai întâi elevul, apoi apărătorul. Ordinea `|` din DOCX nu contează pentru aceste perechi. Alte tag-uri cu `|` (alte nume de variabile) expun tot câte un câmp per segment; dacă nu sunt perechea student/guardian de mai sus, coalesce-ul rămâne „prima valoare nevidă” stânga→dreapta. `hasGuardian` vine din metadata salvată la draft.

**Răspuns `201`:**

```json
{
  "contractId": "jd7...",
  "fillLink": "https://<PUBLIC_APP_URL sau SITE_URL>/contract/completeaza/<token>"
}
```

În **Convex**: setează **`PUBLIC_APP_URL`** = URL-ul frontend-ului hostat (ex. `https://contract-generator-mu.vercel.app`). Dacă lipsește, se folosește **`SITE_URL`** (ideal ambele la același URL în producție).

---

### `GET /api/v1/templates`

Listă template-uri disponibile pentru org-ul cheii.

**Răspuns:** array de `{ id, name, version, createdAt, contractsCount }`.

---

### `GET /api/v1/template?id=<templateId>`

Detalii un template: `variableDefinitions`, `hasPreviewDocx`, etc.

Query **`id`** obligatoriu.

---

### `POST /api/v1/contracts`

Creează contract cu variabile deja completate + semnatari; returnează link-uri de semnare.

**Body:**

```json
{
  "templateId": "...",
  "parentContractId": "...",
  "variables": { "cheieDocx": "valoare" },
  "signers": [
    { "fullName": "...", "email": "...", "phone": "...", "role": "guardian", "signingOrder": 0 }
  ]
}
```

`role`: `teacher` | `student` | `guardian` | `school_music`.

---

### `GET /api/v1/contract?id=<contractId>`

Status, semnatari, variabile (fără câmpuri sensibile de integrare).

---

### `GET /api/v1/contract/document-url?id=<contractId>`

URL temporar pentru descărcare DOCX.

---

### `GET /api/v1/contract/signing-links?id=<contractId>`

Link-uri `/semneaza/<token>` per semnatar.

---

### `GET /api/v1/contract/audit?id=<contractId>`

Jurnal audit pentru contract.

---

## Webhook după semnare

Dacă ai trimis `webhookUrl` la **shareable-draft** (sau pe viitor la alte fluxuri care persistă același câmp):

**POST** către URL-ul tău imediat după semnare reușită.

**Headers:**

- `Content-Type: application/json`
- `X-Contract-Generator-Signature`: hex **HMAC-SHA256** al body-ului UTF-8 cu secretul din Convex `INTEGRATION_WEBHOOK_SECRET`. Dacă secretul nu e setat, headerul lipsește.

**Body:**

```json
{
  "event": "contract.signed",
  "contractId": "...",
  "templateId": "...",
  "signedAt": 1730000000000,
  "metadata": {
    "studentId": "...",
    "schoolId": "...",
    "guardianId": "...",
    "contractFor": "adult",
    "hasGuardian": "false"
  }
}
```

`metadata` din webhook conține **doar** cheile trimise la creare dintre `studentId`, `schoolId`, `guardianId`, `contractFor`, `hasGuardian` (celelalte chei din request nu sunt incluse).

Eșecul webhook-ului **nu** anulează semnarea.

**Verificare (Node):**

```ts
import { createHmac, timingSafeEqual } from "crypto";

function verifySignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}
```

---

## Variabile de mediu relevante

| Unde | Variabilă | Rol |
|------|-----------|-----|
| Convex | `PUBLIC_APP_URL` | Baza pentru `fillLink` și link-uri de semnare (prioritar). |
| Convex | `SITE_URL` | Fallback dacă `PUBLIC_APP_URL` lipsește; folosit și de Stripe. |
| Convex | `INTEGRATION_WEBHOOK_SECRET` | Opțional; HMAC pe webhook. |
| Convex | `RESEND_*`, etc. | Email OTP semnare. |
| Vercel (frontend CG) | `VITE_CONVEX_URL` | URL Convex pentru `ConvexReactClient` (build-time). |

---

## Erori uzuale

| Situație | Cauză probabilă |
|----------|----------------|
| 401 Invalid API key | Cheie greșită / revocată / lipsește `Bearer`. |
| 404 Template not found | `templateId` nu aparține org-ului cheii. |
| 400 templateId vs contract | Ai trimis ID de **contract** în loc de **template**. |
| Listă goală la templates | Template-uri fără `orgId` apar dacă sunt legacy; altfel creează template cu org activă. |

---

## UI Contract Generator

Pe **Template-uri**, fiecare rând afișează **ID API (templateId)** + copiere — același ID ca în API.
