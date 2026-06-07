# Fase 2 — Attivare l'esecuzione automatica su Meta

La Coda Azioni è già pronta a eseguire **da sola** le azioni su Meta. Manca solo
lo "switch": il permesso di scrittura di Meta + un flag. Finché non li attivi,
tutto resta in **modalità manuale** (l'admin clicca "Segna come eseguita") — già
funzionante dalla Fase 1.

## Cosa fa l'executor (quando attivo)
File: `lib/actions/executors/meta.js`. Sull'azione *approvata* → "Segna come eseguita":
- **pause_campaign** → mette in PAUSED la campagna (`target_ref` = id campagna). ✅ auto
- **resume_campaign** → rimette ACTIVE. ✅ auto
- **scale_budget** → imposta `daily_budget` = `payload.to_spend` (in centesimi). ✅ auto
- **shift_budget**, **refresh_creative** → restano **manuali** (multi-target / creatività: non automatizzabili in sicurezza).

Se l'esecuzione fallisce (permessi, budget a livello sbagliato, ecc.) l'azione
passa a stato **Fallita** con il messaggio d'errore, senza rompere nulla.

## Step 1 — Permesso Meta `ads_management` (Meta App Review)
1. **developers.facebook.com** → la tua App → **App Review › Permissions and Features**.
2. Richiedi **`ads_management`** (e verifica di avere già `ads_read`, usato per l'analisi).
3. Prepara per la review:
   - **Business Verification** completata.
   - **Screencast** che mostra il flusso: l'utente approva un'azione in LyftAI → la campagna viene messa in pausa/scalata su Meta.
   - Descrizione d'uso: "Il cliente gestisce le proprie campagne pubblicitarie; LyftAI applica, su sua approvazione, modifiche di stato e budget."
   - **Privacy Policy** (già online: `/privacy`) e **Terms** (`/terms`).
4. Invia e attendi l'esito (di solito giorni).

> Nota: il token Meta usato è lo stesso dell'analisi (via Nango/`getMeta()`).
> Dopo l'approvazione, ri-autorizza la connessione Meta così il token include
> lo scope `ads_management`.

## Step 2 — Abilitare il flag su Vercel
Quando `ads_management` è approvato:
1. Vercel → progetto → **Settings › Environment Variables**.
2. Aggiungi: **`ACTIONS_META_EXECUTOR`** = **`true`** (Production).
3. **Redeploy**.

Da quel momento, "Segna come eseguita" su un'azione **meta** auto-eseguibile la
applica davvero via API. Con il flag assente o `false`, resta tutto manuale.

## Step 3 — Test sicuro
1. Crea una campagna di test su Meta (budget minimo).
2. In Budget Advisor accoda un'azione *scala/pausa* su quella campagna → approva → "Segna come eseguita".
3. Verifica su Meta Ads Manager che lo stato/budget sia cambiato.
4. Controlla in Coda Azioni: stato **Eseguita** (verde) e, in DB, la colonna `result` col payload di risposta Meta.

## Rollback
Metti `ACTIONS_META_EXECUTOR=false` (o rimuovi la variabile) e redeploy:
si torna istantaneamente alla modalità manuale, senza toccare il codice.
