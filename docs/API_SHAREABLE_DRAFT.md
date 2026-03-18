# API: Shareable draft (ToneTrack / integrări)

**Base URL:** API-ul rulează pe **Convex HTTP**, nu pe Vite (5173). În Convex Dashboard → deployment → vezi URL-ul de tip `https://<nume>.convex.site`. Exemplu:

`POST https://rapid-impala-123.convex.site/api/v1/contracts/shareable-draft`

Template după ID: `GET https://...convex.site/api/v1/template?id=<templateId>`  
Contract: `GET https://...convex.site/api/v1/contract?id=<contractId>`

---

## `POST /api/v1/contracts/shareable-draft`

**Auth:** `Authorization: Bearer <cheie API>` — cheia se generează în aplicație: **Panou → Setări organizație → Chei API**. Fiecare cheie e legată de o organizație; vezi doar template-uri și contracte ale acelei organizații (template-urile trebuie să aibă `orgId` setat la creare).

**Body:**

| Field | Required | Description |
|-------|----------|-------------|
| `templateId` | yes | ID din **`contractTemplates`** (din `GET /api/v1/templates` → `id`). **Nu** folosi ID de contract. |
| `parentContractId` | no | Doar pentru act adițional (contract părinte semnat) |
| `metadata` | no | Obiect plat: chei string, valori string / number / boolean (max 40 chei). Ex: `studentId`, `schoolId`, `enrollmentId` |
| `webhookUrl` | no | URL **https** unde se trimite evenimentul după semnare |

**Response `201`:**

```json
{
  "contractId": "jd7...",
  "fillLink": "https://<SITE_URL>/contract/completeaza/<token>"
}
```

Redirecționează utilizatorul la `fillLink`. După completare + semnare, dacă ai trimis `webhookUrl`, serverul face `POST` către acel URL.

---

## Webhook `contract.signed`

**Trigger:** imediat după semnare reușită (același flux ca în UI).

**Request:** `POST` la `webhookUrl`  
**Headers:**
- `Content-Type: application/json`
- `X-Contract-Generator-Signature`: hex HMAC-SHA256 al body-ului cu secretul `INTEGRATION_WEBHOOK_SECRET` (setat în Convex). Dacă secretul lipsește, headerul nu se trimite.

**Body:**

```json
{
  "event": "contract.signed",
  "contractId": "...",
  "templateId": "...",
  "signedAt": 1730000000000,
  "metadata": { "studentId": "...", "schoolId": "..." }
}
```

**Verificare în ToneTrack (exemplu Node):**

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

Eșecul webhook-ului **nu** anulează semnarea; se loghează doar în Convex.

---

## Variabile de mediu

| Unde | Variabilă |
|------|-----------|
| Next.js | `NEXT_PUBLIC_CONVEX_URL`, `SITE_URL` (base pentru `fillLink`) |
| Convex | `INTEGRATION_WEBHOOK_SECRET` (opțional, recomandat) |

---

## Polling alternativ

`GET /api/v1/contracts/:id` cu același API key → câmp `status` devine `SIGNED` după semnare.

Descărcare: `GET /api/v1/contracts/:id/document-url`.
