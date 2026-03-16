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

### 1.3 Dropdown (opțiuni)

```
{#numeDropdown# Eticheta opțiunii 1}
{#numeDropdown# Eticheta opțiunii 2}
...
```

- `numeDropdown` e același pentru toate opțiunile; eticheta (după al doilea `#`) e textul afișat pentru fiecare variantă.
- La randare, se afișează doar eticheta opțiunii alese (valoarea variabilei `numeDropdown` trebuie să se potrivească exact cu una dintre eticheți).

### 1.4 Sibling (legat de dropdown)

```
{@numeVariabila}
```

- Se folosește **imediat după** un bloc de dropdown (`{#numeDropdown# ...}`).
- `{@numeVariabila}` afișează valoarea variabilei doar când opțiunea selectată pentru dropdown-ul anterior este cea curentă; altfel se afișează puncte (`..........`).
- Un singur `{@...}` poate fi asociat la ultimul dropdown din document (ordinea contează).

**Exemplu concret**

În DOCX ai un dropdown „Tip serviciu” cu 3 opțiuni; fiecare opțiune are un preț/detalii diferit. Structura:

```
Serviciul ales: {#tipServiciu# Consultanță} — Preț: {@pret}
                {#tipServiciu# Implementare} — Preț: {@pret}
                {#tipServiciu# Mentenanță}    — Preț: {@pret}
```

Variabile trimise la generare:
- `tipServiciu`: `"Implementare"`
- `pret`: `"500 RON"`

Rezultat randat:
- Se afișează doar eticheta aleasă: „Implementare”.
- La prima linie `{@pret}` devine `..........` (nu e opțiunea selectată).
- La a doua linie `{@pret}` devine `500 RON`.
- La a treia linie `{@pret}` devine `..........`.

În variableDefinitions trebuie definite: `tipServiciu` (text) și `pret` (text sau number).

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
| `type` | Da | Unul din: `text`, `number`, `date`, `month`, `cui`, `signature`. |
| `label` | Nu | Etichetă afișată deasupra câmpului în formular. |
| `description` | Nu | Text explicativ afișat sub label; explică utilizatorului ce înseamnă câmpul. |
| `options` | Nu | Array de stringuri (minim 2). Dacă e setat, în formular apare un **dropdown** cu aceste opțiuni în loc de text liber. Valoarea selectată este cea care se pune în document. |
| `linkedVariables` | Doar pentru `type: "cui"` | Obiect: `{ "denumire": "numeVarDenumire", "sediu": "numeVarSediu", "regCom": "numeVarRegCom" }`. |

### 3.2 Tipuri

- **text** – text liber.
- **number** – numeric.
- **date** – dată.
- **month** – lună.
- **cui** – CUI; obligatoriu să existe variabilele legate `denumire`, `sediu`, `regCom` (numele din DOCX pentru fiecare).
- **signature** – semnătură (imagine); în DOCX poți folosi `{nume}` sau direct `{%nume}`.

### 3.3 Exemplu variableDefinitions

```json
[
  { "name": "clientName", "type": "text", "label": "Nume client" },
  { "name": "Consimțământ imagine", "type": "text", "label": "Acord imagine elev", "options": ["exprimă acordul", "nu îşi exprimă acordul"] },
  { "name": "Cui/CNP", "type": "cui", "label": "CUI/CNP", "linkedVariables": { "denumire": "denumireFirma", "sediu": "sediuFirma", "regCom": "regComFirma" } },
  { "name": "dataContract", "type": "date", "label": "Data contract" },
  { "name": "prestatorSignature", "type": "signature", "label": "Semnătura prestator" }
]
```

Toate variabilele din DOCX (`{clientName}`, `{Cui/CNP}`, `{denumireFirma}`, etc.) trebuie să aibă o definiție cu `name` corespunzător. Numele din `variableDefinitions` trebuie să fie **unice**.

---

## 4. Rezumat: ce modifici în DOCX

1. **Text dinamic** → `{numeVariabila}`.
2. **Semnături** → `{numeSemnatura}` (și în variableDefinitions tip `signature`) sau direct `{%numeSemnatura}`.
3. **Dropdown** → `{#numeDropdown# Eticheta1}`, `{#numeDropdown# Eticheta2}`, apoi opțional `{@numeVariabila}` pentru valoare condiționată.
4. **Nume variabile** → doar litere, cifre, `_`, `/`, spațiu, `.`, `-`.
5. **Definiții** → la template, completezi `variableDefinitions` cu `name`, `type` și eventual `label` / `linkedVariables` (pentru CUI), astfel încât fiecare placeholder din document să aibă o definiție validă.

Dacă un placeholder din DOCX nu are definiție sau tipul nu e potrivit (ex. CUI fără `linkedVariables`), randarea poate eșua sau câmpurile nu vor apărea corect în formularul de completare.
