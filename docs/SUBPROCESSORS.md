# Sub-processor di LyftAI — template per Privacy Policy

> **Nota:** questo è un template tecnico (elenco accurato dei servizi terzi a cui
> LyftAI trasmette dati). Fallo validare da un legale prima di pubblicarlo e
> verifica le **regioni** effettive in base alla configurazione dei tuoi account
> (Supabase/Vercel possono essere UE o USA). Ultimo aggiornamento: **2026-06-22**.

## 1. Cosa sono i sub-processor
Per erogare il servizio, LyftAI si avvale di fornitori terzi ("sub-processor")
che trattano dati per nostro conto. Di seguito l'elenco, con finalità, categorie
di dati e ubicazione. Trattiamo i dati dei clienti in forma **aggregata** dove
possibile; le email vengono rimosse dai contenuti inviati ai modelli AI.

## 2. Elenco sub-processor

| Sub-processor | Finalità | Dati trattati | Ubicazione |
|---|---|---|---|
| **Supabase** | Database, autenticazione, storage file | Account, dati di business aggregati, token integrazioni, file caricati | UE/USA (secondo progetto) |
| **Vercel** | Hosting applicazione e funzioni server | Dati di traffico/richieste, log | USA (edge globale) |
| **Railway** | Hosting worker chiamate audio/video | Metadati sessioni call team | UE/USA |
| **OpenAI** | Modelli AI (agenti, analisi, copy) | Prompt con dati di business **aggregati** (no PII individuale) | USA |
| **Google (Gemini AI)** | Modelli AI generativi | Prompt con dati aggregati | USA |
| **fal.ai** | Generazione immagini/video (Creative Studio) | Prompt testuali e immagini caricate | USA |
| **ElevenLabs** | Sintesi vocale (voce agenti) | Testo da convertire in audio | USA |
| **Nango** | Broker OAuth per le integrazioni | Token di connessione alle piattaforme collegate | UE/USA |
| **Stripe** | Pagamenti e abbonamenti | Dati di fatturazione e pagamento | USA/UE |
| **Resend** | Invio email (report, notifiche) | Indirizzi email destinatari e contenuto email | USA |
| **Browserless** | Rendering headless (PDF, screenshot, scraping) | URL forniti dall'utente, contenuto pagine | UE/USA |
| **Microlink / ScreenshotOne** | Screenshot pagine (AI Website Scanner) | URL forniti dall'utente | USA |
| **LiveKit** | Chiamate audio/video di gruppo | Stream audio/video, metadati call | UE/USA |

## 3. Piattaforme collegate dal cliente (data source)
Queste **non** sono sub-processor nostri: è il cliente che le autorizza per
leggere i propri dati. LyftAI vi accede con i permessi concessi dal cliente.

- Shopify · Meta (Facebook/Instagram Ads) · Google (Ads, Analytics 4, Search Console)
- Klaviyo · Mailchimp · Omnisend
- (eventuali) Pinterest · TikTok · Snapchat

## 4. Misure privacy verso l'AI
- I prompt verso i modelli AI usano **dati aggregati**, non elenchi di clienti
  con PII; uno scrubber rimuove automaticamente le email dai dati inviati.
- **Da configurare (consigliato):** sottoscrivere il **DPA con OpenAI** e
  attivare **Zero Data Retention / no-training** sull'API per i clienti UE.
- I clienti possono richiedere l'elenco aggiornato dei sub-processor e la
  cancellazione dei propri dati scrivendo a [inserire email privacy].

## 5. Aggiornamenti
Aggiorneremo questo elenco quando aggiungiamo o sostituiamo un sub-processor,
dando preavviso ai clienti secondo quanto previsto dal DPA.
