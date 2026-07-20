# Google OAuth — Verifica del consent screen (pacchetto submission)

> Obiettivo: eliminare l'avviso **"app non verificata"** al collegamento Google.
> Oggi molti utenti si bloccano lì (se non cliccano "Avanzate → procedi" l'accesso fallisce).
> Scope da verificare: 3 **sensibili** (`adwords`, `analytics.readonly`, `webmasters.readonly`) + `userinfo.email` (non sensibile).
> NON servono restricted scopes → **niente security assessment a pagamento**: solo la review Trust & Safety (tipicamente da pochi giorni a ~2 settimane).

---

## 1 · Prerequisiti (Cloud Console + dominio) — checklist

Cloud Console → **APIs & Services → OAuth consent screen** (progetto = quello del `GOOGLE_CLIENT_ID` in uso):

- [ ] **Publishing status: In production** (non "Testing")
- [ ] **App name:** `LyftAI` (deve combaciare col brand mostrato nel video e sul sito)
- [ ] **App logo** caricato (il logo LyftAI — nota: appena carichi un logo, la verifica diventa obbligatoria: va bene, è quello che vogliamo)
- [ ] **User support email:** info@lyftads.agency
- [ ] **Developer contact email:** info@lyftads.agency (monitorata: le risposte del team review arrivano lì)
- [ ] **App domain:** homepage `https://lyftai.io` · privacy `https://lyftai.io/privacy` · terms `https://lyftai.io/terms`
- [ ] **Authorized domain:** `lyftai.io`
- [ ] **Dominio verificato in Search Console** con lo STESSO account Google che fa la submission (proprietà `lyftai.io` — se già verificato per GSC ok, altrimenti: Search Console → Aggiungi proprietà → verifica DNS)
- [ ] Privacy policy con **Limited Use disclosure** → ✅ GIÀ FATTO (sezione 4 di /privacy: "Google data and Google API Services compliance")
- [ ] La homepage descrive cosa fa l'app e linka la privacy → ✅ (landing lyftai.io)
- [ ] Scope richiesti = solo quelli usati → ✅ (rimosso `bigquery.readonly` inutilizzato)

Poi: **OAuth consent screen → "Prepare for verification" / "Submit for verification"** → compila i campi come sotto e allega il video.

---

## 2 · Giustificazioni per scope (da incollare nel form, EN)

**`https://www.googleapis.com/auth/adwords`**
> LyftAI (lyftai.io) is a read-only analytics SaaS for e-commerce merchants. The user connects their own Google Ads account; we use this scope exclusively to READ campaign performance (cost, impressions, clicks, conversions, conversion value) via GoogleAdsService.SearchStream and to list the user's accessible customer accounts so they can pick which account to analyze. The data is displayed only to the authorizing user inside their dashboard (Google KPI / Google Detail tabs), next to their Shopify and Meta data. We never create or modify campaigns, budgets or settings. A narrower scope is not available: adwords is the only scope that grants Google Ads API reporting access.

**`https://www.googleapis.com/auth/analytics.readonly`**
> Used to read the user's GA4 property (they select which one) for reporting shown only to them: sessions, conversion funnel and revenue for the CRO tab, realtime active users for the live dashboard globe, and region-level data for geo-lift test design. Read-only by definition; we chose the .readonly variant precisely to request minimal access.

**`https://www.googleapis.com/auth/webmasters.readonly`**
> Used to read the user's Search Console data (they select which verified site): queries, clicks, impressions and positions, displayed in their SEO Audit tab to complement the on-page analysis. Read-only variant chosen for minimal access.

**`userinfo.email`** (non sensibile, di solito non chiede giustificazione)
> Used to associate the Google connection with the user's workspace account.

---

## 3 · Video demo (YouTube non in elenco) — copione

Regole d'oro (stesse che hanno fatto passare Meta):
- **UI in inglese** (`?lang=en` / account impostato EN), **barra URL sempre visibile**
- Un video unico che dimostra **tutti e 3 gli scope in uso**
- Durata 2-3 minuti, niente tagli sul momento del consenso

| # | Scena | Cosa si vede |
|---|---|---|
| 1 | Homepage lyftai.io (5s) | brand + URL |
| 2 | Login → Onboarding → step "Google Ads" | pulsante **Connect Google** |
| 3 | **Consent screen Google** (il momento chiave) | nome app "LyftAI", elenco permessi (Ads / Analytics / Search Console), **URL accounts.google.com** visibile → clic Allow |
| 4 | Ritorno in app → picker | selezione account Ads, proprietà GA4, sito GSC |
| 5 | **Google KPI / Google Detail** | spesa, conversioni, ROAS reali → dimostra `adwords` |
| 6 | **Dashboard live (globo) + CRO** | visitatori realtime e funnel GA4 → dimostra `analytics.readonly` |
| 7 | **SEO Audit** (sezione Search Console) | query/click/posizioni → dimostra `webmasters.readonly` |
| 8 | Chiusura (5s) | "Read-only reporting. Data is shown only to the account owner." (voce o sottotitolo) |

Suggerimento: registra col **dev store / account demo** già connesso a dati reali di test, come per il video Meta.

---

## 4 · Note per il form di submission

- Alla domanda "how will the scopes be used": incolla le giustificazioni della sezione 2 (una per scope).
- Link video: YouTube **unlisted** (non privato).
- Le email del team review arrivano dal dominio google.com sulla developer contact email → **rispondere sempre entro pochi giorni** (le pratiche decadono per silenzio).
- Se chiedono modifiche minori (es. wording privacy), si sistemano e si risponde nella stessa pratica senza ripartire da zero.
- Dopo l'approvazione l'avviso sparisce per tutti i NUOVI collegamenti; i token già concessi restano validi.

---

*Prerequisiti codice: ✅ scope minimizzati (bigquery.readonly rimosso perché non usato) · ✅ privacy con Limited Use · ✅ pagine privacy/terms live su lyftai.io.*
