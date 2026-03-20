# ToneTrack ↔ Contract Generator — ce face fiecare parte

Contract Generator (CG) oferă **șabloane DOCX**, **completare + semnare** și **API HTTP pe Convex**. ToneTrack trebuie să orchestreze: cine primește contractul, salvare stare în Supabase, webhook, email.

---

## 1. Ce este deja gata în Contract Generator

| Capabilitate | Unde |
|--------------|------|
| Template-uri DOCX + variabile | UI Panou |
| Chei API per organizație | Panou → Setări organizație → Chei API |
| ID template vizibil în UI | Panou → Template-uri → „ID API” |
| Shareable draft + metadata + webhookUrl | API (vezi `API_SHAREABLE_DRAFT.md`) |
| Webhook `contract.signed` + HMAC opțional | După semnare |
| Hosting frontend | Vercel + `VITE_CONVEX_URL`; Convex `SITE_URL` = URL public CG |

---

## 2. Ce trebuie implementat în ToneTrack (checklist)

1. **Config**  
   - URL API Convex (`https://….convex.site`).  
   - Cheie API (env server-only).  
   - Același secret ca `INTEGRATION_WEBHOOK_SECRET` din Convex (pentru verificare webhook).

2. **Legătură școală ↔ template**  
   - În Supabase (sau config): `school_id` → `contract_template_id` (ID din CG).  
   - Opțional: sync din `GET /api/v1/templates` pentru admin.

3. **Flux parinte / elev — „Completează contractul”**  
   - Server: `POST …/api/v1/contracts/shareable-draft` cu  
     `templateId`, `metadata` (ID-uri: `studentId`, `schoolId`, `guardianId` + chei de **prefill** aliniate cu numele variabilelor din șablonul DOCX), `webhookUrl` (URL-ul tău HTTPS).  
   - Salvează `contractId` + metadata trimisă + status `pending_fill` în Supabase.  
   - Redirect sau tab nou către `fillLink`.

4. **Webhook**  
   - Endpoint POST (ex. `/api/webhooks/contract-signed`): verifică HMAC, citește `contractId` + `metadata` (**doar** `studentId`, `schoolId`, `guardianId`, `contractFor`, `hasGuardian` dacă au fost trimise la creare), marchează contract semnat în DB, opțional descarcă DOCX cu `GET …/contract/document-url?id=…`.

5. **Polling (fallback)**  
   - Dacă webhook eșuează: periodic `GET …/contract?id=<contractId>` până la `status === "SIGNED"`.

6. **UI**  
   - Elev/parinte: buton + istoric status.  
   - Școală: listă contracte per elev / per școală.  
   - Descărcare DOCX (direct din URL API sau fișier salvat în Storage după webhook).

7. **Email**  
   - După semnare (webhook sau polling): Resend din ToneTrack către elev/parinte / școală.

---

## 3. Flux pe scurt

```
[Faza A] Tu / școala → template în CG → notezi templateId (sau îl pui în TT per școală)

[Faza B] Parinte în TT → „Completează contract”
         → TT server: POST shareable-draft (metadata + webhookUrl)
         → salvează contractId în Supabase
         → browser: fillLink (site CG hostat)

[Faza C] Parinte completează + OTP + semnătură pe CG

[Faza D] CG → POST webhook către TT (contract.signed + metadata)
         → TT actualizează DB, email, eventual descarcă DOCX
```

Alternativ fără pas „completare pe CG”: `POST /api/v1/contracts` cu toate `variables` + `signers` din TT (doar dacă ai deja toate datele în app).

---

## 4. Metadata (`studentId`, `schoolId`)

- **Trimise de ToneTrack** la `shareable-draft`, stocate pe contract în Convex.  
- **Returnate** în webhook ca `metadata` — ca să știi imediat cărui elev/școli îi apartine evenimentul, fără să mapezi doar după `contractId`.  
- **Recomandat:** salvează oricum `contractId` în TT la creare; metadata grăbește logica și rapoartele.

---

## 5. Securitate

| Aspect | Practica |
|--------|----------|
| Cheie API | Doar server ToneTrack (env). |
| Webhook | HTTPS + verificare `X-Contract-Generator-Signature` cu secret partajat. |
| fillLink | Token opac, expirare gestionată de CG. |

---

## 6. Documentație API detaliată

Endpoint-uri, body-uri, coduri de eroare: **`docs/API_SHAREABLE_DRAFT.md`**.

---

## 7. Test webhook fără ToneTrack

`webhookUrl` trebuie să fie **HTTPS**. Variante rapide:

- **[webhook.site](https://webhook.site)** (sau similar): copiezi URL-ul unic, îl pui la `webhookUrl` în `POST …/shareable-draft`, apoi completezi și semnezi contractul pe `fillLink`; vezi request-ul, JSON-ul și opțional `X-Contract-Generator-Signature`.
- **Server local + ngrok / Cloudflare Tunnel**: endpoint care primește POST și loghează **raw body** (string UTF-8) dacă vrei să verifici HMAC cu același secret ca `INTEGRATION_WEBHOOK_SECRET` în Convex — vezi exemplu Node în `API_SHAREABLE_DRAFT.md`.

Nu ai nevoie de altă aplicație: doar URL public HTTPS + același flux API ca pentru ToneTrack.
