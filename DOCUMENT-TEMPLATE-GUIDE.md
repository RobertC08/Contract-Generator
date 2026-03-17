# Ghid: modificarea documentului DOCX pentru generatorul de contracte

Acest document descrie modalitățile în care trebuie modificat un document Word (DOCX) ca să fie interpretat corect de generator.

---

## 1. Placeholder-uri în document

Generatorul folosește **Docxtemplater**. În corpul documentului (text, headere, footere) pui **exact** sintaxa de mai jos.

### 1.1 Text / număr / dată (simplu)

```
{numeVariabila}
```

- Înlocuiește cu valoarea variabilei `numeVariabila`.
- Exemple: `{clientName}`, `{Cui/CNP}`, `{dataContract}`.

### 1.2 Imagine (ex.: semnătură)

```
{%numeVariabila}
```

- Valoarea trebuie să fie un **data URL** de imagine: `data:image/png;base64,...` (sau jpeg/jpg/gif).
- Dacă în template ai definit variabila ca tip **signature**, poți scrie în DOCX doar `{numeVariabila}`; generatorul o transformă automat în `{%numeVariabila}` la randare.
- Dimensiune afișată pentru semnături: 2cm × 1cm.

### 1.3 Dropdown cu text condiționat

Sintaxa combină **dropdown** (`{#...#}`) și **sibling** (`{@...}`):

```
{#numeDropdown# etichetă1}{@text care rămâne dacă se alege etichetă1} {#numeDropdown# etichetă2}{@text care rămâne dacă se alege etichetă2}
```

**Cum funcționează:**

- `{#numeDropdown# etichetă}` — definește o opțiune din dropdown. Numele (între `{#` și `#`) e identic pentru toate opțiunile aceluiași dropdown; eticheta (după al doilea `#`) e ce vede utilizatorul în formular.
- `{@text}` — pus imediat după `{#...#}`. Textul din interiorul `{@...}` este **literal**: el apare în contract dacă opțiunea din fața lui e selectată. Dacă opțiunea nu e selectată, `{@text}` dispare complet din document.
- La randare, **toate** `{#...#}` dispar din document (nu se afișează); rămâne doar `{@text}` corespunzător opțiunii alese.
- Câmpurile `{@...}` **nu apar** în formularul de completare — ele nu sunt editabile de utilizator.

**Exemplu concret**

În DOCX:

```
Clientul îşi {#Consimțământ imagine# de acord}{@exprimă acordul} {#Consimțământ imagine# nu sunt de acord}{@nu îşi exprimă acordul} ca Prestatorul să poată utiliza imagini.
```

În formular apare un dropdown **Consimțământ imagine** cu opțiunile: „de acord" / „nu sunt de acord".

Dacă utilizatorul alege **de acord**, documentul generat devine:

```
Clientul îşi exprimă acordul ca Prestatorul să poată utiliza imagini.
```

Dacă alege **nu sunt de acord**:

```
Clientul nu îşi exprimă acordul ca Prestatorul să poată utiliza imagini.
```

În variableDefinitions trebuie definit doar dropdown-ul: `{ "name": "Consimțământ imagine", "type": "text" }`.

### 1.4 Text cu dropdown din opțiuni predefinite (fără sibling)

Alternativă mai simplă: un singur placeholder `{numeVariabila}` + opțiuni în definiție.

```
Clientul îşi {Consimțământ imagine} ca Prestatorul...
```

Definești `options` în variableDefinitions:

```json
{ "name": "Consimțământ imagine", "type": "text", "options": ["exprimă acordul", "nu îşi exprimă acordul"] }
```

În formular apare un dropdown; valoarea selectată se pune direct în document.

---

## 2. Reguli pentru numele variabilelor

- Caractere permise: litere (a-z, A-Z), cifre, `_`, `/`, spațiu, `.`, `-`.
- Nu se acceptă: `<`, `>`, `"`, caractere care ar strica XML-ul.

Exemple valide: `clientName`, `Cui/CNP`, `Art. 1`, `prestatorSignature`.

---

## 3. Definiții variabile (la încărcarea template-ului)

La upload/ediție template în aplicație se trimite un JSON **variableDefinitions**: un array de obiecte, câte una per variabilă folosită în DOCX.

### 3.1 Câmpuri per variabilă

| Câmp | Obligatoriu | Descriere |
|------|-------------|-----------|
| `name` | Da | Exact numele folosit în DOCX (ex: `{name}`). |
| `type` | Da | Unul din: `text`, `number`, `date`, `month`, `cui`, `signature`, `contractNumber`. |
| `label` | Nu | Etichetă afișată deasupra câmpului în formular. |
| `description` | Nu | Text explicativ afișat sub label; explică utilizatorului ce înseamnă câmpul. |
| `options` | Nu | Array de stringuri (minim 2). Dacă e setat, în formular apare un **dropdown** cu aceste opțiuni în loc de text liber. Valoarea selectată este cea care se pune în document. |
| `linkedVariables` | Doar pentru `type: "cui"` | Obiect: `{ "denumire": "...", "sediu": "...", "regCom": "..." }`. |

### 3.2 Tipuri

- **text** – text liber (sau dropdown dacă `options` e setat).
- **number** – numeric.
- **date** – dată.
- **month** – lună.
- **cui** – CUI; obligatoriu variabile legate `denumire`, `sediu`, `regCom`.
- **signature** – semnătură (imagine); în DOCX poți folosi `{nume}` sau direct `{%nume}`.
- **contractNumber** – număr de contract; se asignează automat la semnare și se incrementează per template (nu se completează în formular).

### 3.3 Exemplu variableDefinitions

```json
[
  { "name": "clientName", "type": "text", "label": "Nume client" },
  { "name": "Consimțământ imagine", "type": "text", "label": "Acord imagine elev" },
  { "name": "Cui/CNP", "type": "cui", "label": "CUI/CNP", "linkedVariables": { "denumire": "denumireFirma", "sediu": "sediuFirma", "regCom": "regComFirma" } },
  { "name": "dataContract", "type": "date", "label": "Data contract" },
  { "name": "prestatorSignature", "type": "signature", "label": "Semnătura prestator" },
  { "name": "nrContract", "type": "contractNumber", "label": "Număr contract" }
]
```

---

## 4. Rezumat: ce modifici în DOCX

1. **Text dinamic** → `{numeVariabila}`.
2. **Semnături** → `{numeSemnatura}` (cu tip `signature` în definiții) sau direct `{%numeSemnatura}`.
3. **Dropdown cu text condiționat** → `{#numeDropdown# eticheta}{@text literal}` per opțiune. Doar textul `{@...}` al opțiunii selectate rămâne; restul dispare.
4. **Dropdown simplu** → `{numeVariabila}` + `options` în definiție (fără sibling).
5. **Nume variabile** → doar litere, cifre, `_`, `/`, spațiu, `.`, `-`.
6. **Definiții** → la template, completezi `variableDefinitions` cu `name`, `type` și eventual `label`, `description`, `options`, `linkedVariables`.
