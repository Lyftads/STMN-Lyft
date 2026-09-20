# Onestà del racconto nel report PDF — collaudo

`lib/agent/narrativeQuality.js` → `NARRATIVE_QUALITY`, appeso al `systemPrompt` di
`aiNarrative()` in `app/api/report/route.js` (stessa riga nei due repo).
Origine: paper StoryScope, COLM 2026, arXiv 2604.03136 (skill `storyscope`).

## Cosa governa

`ACTION_QUALITY` governa la forma dei **consigli**. Questo blocco governa quali
**fatti** entrano nella sintesi del periodo. Sono quattro feature "core" dello
studio tradotte in verifiche di contenuto: la catena causale unica, il merito
attribuito alle proprie azioni, il costo taciuto, la chiusura consolatoria.

## Il collaudo (19–20 set 2026)

Prompt isolato, stesso modello (`gpt-4o`, temperature 0.5) e stessi dati finti,
senza passare dalle route e senza toccare il DB. Script nello scratchpad di
sessione (`prova.mjs`, `dati.json`, `dati2.json`). Costo totale ≈ 0,25 $.

Metodo: si contano quanti **fatti scomodi presenti nei dati** compaiono nel
testo generato, su 4 esecuzioni per versione. I fatti scomodi sono scelti prima
di generare.

### Caso 2 — periodo in crescita (+27%), fatti scomodi da dedurre, nessuna nota

| Versione del prompt | Fatti scomodi coperti (su 48) |
|---|---|
| attuale, senza blocco | 26 |
| blocco come **regole di stile narrativo** (1.990 car., sei regole discorsive) | **21** ⟵ peggiora |
| blocco come **verifica di contenuto** (472 car., quello adottato) | **32** ⟵ +23% |

Dettaglio dei fatti che il blocco adottato fa emergere e che prima non
emergevano quasi mai:

| Fatto | senza | con |
|---|---|---|
| un solo giorno vale il 44% della settimana | 0/4 | **4/4** |
| un solo prodotto vale il 33% del fatturato | 1/4 | **4/4** |
| la campagna Prospecting brucia ~480 € | 0/4 | 2/4 |
| i resi sono triplicati | 4/4 | 4/4 |

Con la versione a regole di stile, il fatto più importante del periodo — la
crescita veniva **solo** da clienti di ritorno — spariva in 4 esecuzioni su 4
(3/4 → 0/4). **Non riscrivere questo blocco come prosa: diluisce il prompt.**

### Caso 1 — periodo in calo, conferma di non-regressione

73% → 78% dei controlli. Migliora sui resi (1/3 → 3/4) e sui clienti nuovi in
calo (2/3 → 4/4). Nessuna regressione.

## I quattro errori di dominio (secondo giro, 20 set)

Trovati da tre revisori indipendenti sulle stesse uscite, poi misurati. Su 8
esecuzioni (4 periodo in calo + 4 in crescita), confrontando il prompt senza
blocco, con la prima versione del blocco (B1, 472 car.) e con quella attuale
(B2, 1.181 car.):

| Errore | senza blocco | B1 | **B2 (attuale)** |
|---|---|---|---|
| MER citato con la cifra | 0/7 | 0/8 | **7/8** ✅ |
| "il pixel ha fatto vendere meno" (errore) | 2/3 (caso col guasto) | 0/4 | **0/4** ✅ |
| costo per cliente nuovo con la cifra | 0/7 | 0/8 | **2/8** ⚠️ parziale |
| costo per ordine con la cifra | 0/7 | 0/8 | **0/8** ❌ |
| attribuzione sovrapposta segnalata | 0/7 | 0/8 | **0/8** ❌ |
| fatti scomodi (non-regressione, su 32) | 22 | 26 | **27** ✅ |

Il difetto del pixel era già stato chiuso da B1, prima ancora di scriverne la
regola: bastava chiedere di verificare i fatti.

### Variante più perentoria: scartata, misurata

Una terza versione (B3, ~1.700 car.: "falli tu, con la divisione", "non
scrivere mai che non è calcolabile") porta il MER a 8/8 ma riporta i fatti
scomodi a **22/32**, cioè al livello del prompt senza blocco. È la stessa
diluizione del primo giro. Da non ripetere.

### Cosa il prompt NON risolve, e perché

**Costo per ordine e attribuzione sovrapposta restano a 0/8 in ogni variante.**
Il modello non è affidabile nel fare divisioni a comando né nel sommare per
controllo tre voci sparse nel JSON. La soluzione non è insistere col prompt: è
**calcolare MER, CAC, CPO e la somma degli attribuiti nel codice** e passarli
già pronti dentro `context`, così il modello deve solo leggerli. Intervento più
invasivo (tocca il payload del report), non fatto: da decidere.

## Come rifare il collaudo

Rigenerare gli script nello scratchpad (sono ~40 righe: leggono `OPENAI_API_KEY`
da `.env.local`, ricopiano il `systemPrompt` di `aiNarrative` e chiamano l'API
direttamente). Regole: dati finti con fatti scomodi **non** annunciati da una
nota, almeno 4 esecuzioni per versione, elenco dei controlli scritto prima di
generare, conteggio automatico. Non serve avviare `next dev` e non si scrive nel
DB condiviso.
