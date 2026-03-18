# Flow integrare ToneTrack ↔ Contract Generator (API)

Document detaliat: de la contractul primit de la școală până la contract semnat vizibil în ToneTrack, elev/parinte și școală.

---

## 1. Roluri și sisteme

| Rol | Unde acționează | Rol în flow |
|-----|-----------------|-------------|
| **Superadmin (tu)** | Contract Generator (UI) | Templetizează DOCX, definește variabile, publică template |
| **Admin școală / Profesor** | ToneTrack | Pornește trimiterea contractului către elev/parinte |
| **Elev / Parinte** | ToneTrack + Contract Generator (link) | Apasă „Completează contract”, completează, semnează |
| **ToneTrack (backend)** | Supabase + API | Creează draft/contract, primește webhook, stochează stare, trimite email |
| **Contract Generator (backend)** | Convex + API REST | Template, generare DOCX, OTP, semnătură, webhook la final |

---

## 2. Faze pe durata vieții unui contract

```
[Faza A] Pregătire template     → doar Contract Generator + tu
[Faza B] Legare școală–template → ToneTrack (date) + eventual API list templates
[Faza C] Inițiere din ToneTrack → API Contract Generator
[Faza D] Completare + semnare   → UI Contract Generator (link)
[Faza E] Finalizare în app      → Webhook sau polling + Supabase + email
```

---

## 3. Faza A — Superadmin: de la contractul școlii la template

1. Școala îți trimite contractul (PDF/DOCX negociat).
2. Transformi documentul în **șablon DOCX** cu placeholders (`{numeElev}`, `{numeParinte}`, …) conform convenției tale sau a școlii.
3. În **Contract Generator** (UI):
   - încarci DOCX;
   - configurezi **variable definitions** (tip: text, dată, semnătură, număr contract, etc.);
   - salvezi template-ul.
4. Rezultat: un **`templateId`** (ID Convex) unic per șablon.

**Important:** Numele variabilelor din DOCX trebuie să poată fi mapate (manual sau prin convenție) la câmpuri din ToneTrack la Faza C (pre-fill opțional).

---

## 4. Faza B — Legătura școală ↔ template (în ToneTrack)

În ToneTrack (date proprii, nu neapărat în Contract Generator):

1. Pentru fiecare **școală** (`school_id`) stochezi:
   - `contract_template_id` = ID-ul din Contract Generator returnat la listare sau cunoscut după ce l-ai creat;
   - opțional: `template_label`, `activ`/`inactiv`.
2. **Superadmin ToneTrack** sau **tu** poți avea un ecran unde selectezi școala și lipești `templateId`.

**API util (Contract Generator):**

- `GET /api/v1/templates` — listă template-uri (cu cheie API).
- `GET /api/v1/templates/:id` — `variableDefinitions` ca să știi ce câmpuri trebuie completate din ToneTrack.

Fără această legătură, aplicația nu știe ce șablon să deschidă pentru elevul școlii X.

---

## 5. Faza C — Elev/parinte apasă „Completează contract” (ToneTrack)

### 5.1 Condiții în ToneTrack

- Elevul are cont și este asociat unei școli (enrollment / clasă).
- Școala are un `contract_template_id` configurat.
- (Opțional) profilul elevului/parintelui are deja date minime (nume, email pentru semnatar).

### 5.2 Ce face serverul ToneTrack (toate prin API)

**Variantă recomandată pentru „parintele completează tot ca în Contract Generator”:**

1. **Apel:** `POST /api/v1/contracts/shareable-draft`  
   **Headers:** `Authorization: Bearer <cheie API>` (generată în Contract Generator → Setări organizație)  
   **Body exemplu:**
   ```json
   {
     "templateId": "<id din Contract Generator>"
   }
   ```
2. **Răspuns:** `{ "contractId": "...", "fillLink": "https://<domeniu-contract-generator>/contract/fill/<token>" }`
3. ToneTrack **salvează** în Supabase un rând, de exemplu:
   - `school_id`, `student_id` (sau `profile_id` parinte),
   - `external_contract_id` = `contractId`,
   - `status` = `draft_pending_fill`,
   - `fill_link` (opțional, poate fi regenerat doar dacă păstrezi tokenul — azi API-ul returnează linkul o dată),
   - `template_id`,
   - `created_at`.

4. **UI:** redirect sau deschidere în tab nou către `fillLink`.

**Variantă alternativă (totul pre-completat din ToneTrack, fără pasul „fill” pe CG):**

- `POST /api/v1/contracts` cu `variables` + `signers` → primești direct `signingLinks`. Parintele merge direct la semnare. Mai puțin flexibil dacă șablonul cere multe câmpuri pe care nu le ai încă în app.

### 5.3 Metadata și legătura înapoi (recomandat de implementat în API)

Pentru ca la final să știi *cine* a semnat în ToneTrack, la crearea draftului/contractului trimiți (când API-ul va suporta):

- `metadata`: `{ "studentId": "...", "schoolId": "...", "enrollmentId": "..." }`
- eventual `webhookUrl` per cerere sau fix în env Contract Generator.

Fără metadata, webhook-ul poate trimite doar `contractId` și trebuie să corelezi doar după ce ai salvat `contractId` la pasul C.2 (deja suficient dacă salvezi corect).

---

## 6. Faza D — Completare și semnare (Contract Generator, același flow ca „Generează contract”)

1. Utilizatorul deschide **`fillLink`**.
2. Parcurge pașii existenți: citire → completare variabile → verificare date → **semnare**.
3. **OTP** pe email (Resend, configurat în Convex).
4. **Semnătură** pe canvas; la final contractul devine **SIGNED** în Convex; se regenerează DOCX cu semnătură și număr contract dacă e cazul.

**Nu este nevoie ca ToneTrack să reimplementeze acest UI** dacă acceptați redirect la Contract Generator.

---

## 7. Faza E — Contract „identificat” în ToneTrack (elev, parinte, școală)

### 7.1 Sincronizare status

**Opțiunea 1 — Webhook (preferată)**

1. La trecerea în **SIGNED**, Contract Generator face `POST` către URL-ul ToneTrack (ex. `https://app.tonetrack.../api/webhooks/contract-signed`).
2. **Body exemplu:**
   ```json
   {
     "event": "contract.signed",
     "contractId": "...",
     "templateId": "...",
     "signedAt": 1234567890,
     "metadata": { "studentId": "...", "schoolId": "..." }
   }
   ```
3. Header secret (ex. `X-Webhook-Signature: HMAC-SHA256`) verificat în ToneTrack.
4. ToneTrack actualizează rândul din Supabase: `status = signed`, `signed_at`.

**Opțiunea 2 — Polling**

- Job sau la login: `GET /api/v1/contracts/:id` până când `status === "SIGNED"`.
- Mai simplu la început; întârzieri până la următoarea verificare.

### 7.2 Documentul (DOCX) în aplicație

1. Server ToneTrack: `GET /api/v1/contracts/:id/document-url` → URL temporar descărcare.
2. Opțional: descarci fișierul și îl pui în **Storage Supabase** pentru link stabil și istoric.
3. În UI **elev/parinte**: buton „Descarcă contract semnat”.
4. În UI **școală**: aceeași înregistrare filtrată după `school_id` + listă contracte per elev.

### 7.3 Email

- După webhook (sau după ce polling vede SIGNED), **ToneTrack** trimite email (Resend) către:
  - emailul contului elev/parinte,
  - opțional copie la admin școală sau adresă configurată per școală.
- Conținut: „Contractul a fost semnat” + link către ToneTrack (pagina contractului) sau link direct la download dacă e sigur.

---

## 8. Diagramă secvență (rezumat)

```
[Superadmin CG]     upload template → templateId
       │
       ▼
[ToneTrack DB]      school ↔ templateId
       │
       ▼
[Parinte TT]        click „Completează contract”
       │
       ▼
[ToneTrack API]     POST shareable-draft(templateId)
       │             salvează contractId + student + school
       ▼
[Browser]           redirect → fillLink (Contract Generator)
       │
       ▼
[Contract Generator] completare + OTP + semnătură → SIGNED
       │
       ├─► [Webhook] POST ToneTrack → update DB + email
       └─► (sau ToneTrack polling GET contract)
```

---

## 9. Securitate (API)

| Aspect | Măsură |
|--------|--------|
| Apeluri Contract Generator | Cheie API generată în app, doar pe server ToneTrack |
| Webhook către ToneTrack | Secret HMAC sau token static; verificare semnătură |
| fillLink / sign links | Token-uri opace, expirare (deja în CG) |
| document-url | Doar server cu API key; nu expune cheia în browser |

---

## 10. Ce lipsește astăzi (checklist implementare)

- [ ] **Metadata + webhook** pe Contract Generator (dacă vrei corelare automată fără doar `contractId`).
- [ ] **Tabele Supabase** ToneTrack: contract instances + FK la școală/elev.
- [ ] **Endpoint webhook** în ToneTrack + verificare semnătură.
- [ ] **UI** parinte: buton + salvare `contractId` după `shareable-draft`.
- [ ] **UI** școală: listă contracte semnate/pending per elev.
- [ ] **Email** post-semnare din ToneTrack.

---

## 11. Variante de flow (comparatie scurtă)

| Scenariu | API start | Unde completează | Potrivit pentru |
|----------|-----------|------------------|-----------------|
| Shareable draft | `shareable-draft` | Contract Generator | Parintele completează multe câmpuri; același UX ca manual |
| Contract direct | `POST /contracts` | ToneTrack (variabile deja cunoscute) | Puține câmpuri, toate în profil |

Acest document descrie în principal varianta **shareable draft + webhook**, aliniată cu cerința „buton la parinte, apoi același flow ca în Contract Generator”.

---

*Ultima actualizare: flow conceptual; endpointurile concrete pot include `metadata`/`webhook` când sunt implementate în API.*
