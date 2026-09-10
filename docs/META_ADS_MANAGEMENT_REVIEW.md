# Meta App Review — `ads_management` (Advanced Access)

App: **LyftAI Marketing API** · App ID `1670438130981723` · già **Live**, Business Verification fatta,
con una review approvata alle spalle (20 lug 2026: `ads_read`, `read_insights`, `business_management`).

Questa richiesta aggiunge **`ads_management`**, il permesso di SCRITTURA: creare inserzioni,
modificare budget, mettere in pausa, duplicare adset.

---

## 0. PRIMA DI TUTTO — il passaggio che fa fallire il video

Gli scope NON stanno nel codice: stanno nella **configurazione Nango dell'integrazione `facebook`**
(`connect-session/route.js` passa solo `allowedIntegrations`).

**Aggiungere `ads_management` agli scope dell'integrazione Nango PRIMA di registrare lo screencast.**
Se non lo fai, la schermata di consenso Facebook non mostrerà il permesso, il video non lo dimostrerà,
e la review viene bocciata esattamente come le prime due volte.

Verifica: dopo la modifica, un nuovo collegamento deve mostrare nella disclosure
"Manage advertisements for your ad account" (o equivalente) fra le voci concesse.

---

## 1. Testo di giustificazione (in inglese, per il form "Tell us why you're requesting ads_management")

> Our users are e-commerce businesses that connect their own Meta ad account to LyftAI through
> Facebook Login. The app analyses the performance of their existing ad creatives — CTR, CPM, CPC,
> ROAS, purchases and conversion value at ad level — and identifies which creative angles are working.
>
> `ads_management` is required so that the user can act on those findings without leaving the product.
> Three operations are needed: (1) pause an ad or ad set that is underperforming against the user's own
> targets, (2) adjust the daily budget of an ad set the user chooses to scale, and (3) publish a new
> creative variant into an existing ad set.
>
> Every action is proposed by the software and **explicitly approved by the user** in an in-app queue
> before it is applied. Nothing is written to the ad account automatically. The user can see the reason
> for each proposal, edit it, or discard it.
>
> This is not a server-to-server integration: access is granted by the account owner through a visible
> Facebook Login flow, and the app acts only on the ad account that user selected.

**Nota importante:** insistere su *human-in-the-loop*. Un caso d'uso in cui il software propone e
l'utente approva viene approvato molto più volentieri di uno completamente automatico.

---

## 2. Copione dello screencast (è QUI che ti hanno bocciato due volte)

Requisiti non negoziabili, dal rifiuto del 18 giu e del 2 lug:
- flusso **completo** di Meta Login, non un pezzo
- l'utente che **concede** i permessi, con la disclosure visibile a schermo
- l'esperienza **end-to-end** del caso d'uso, fino all'effetto reale
- **UI in inglese** + sottotitoli che mappano ogni passo al permesso
- dichiarare che NON è server-to-server

### Scene

| # | Cosa si vede | Sottotitolo (EN) |
|---|---|---|
| 1 | App in inglese, tab Integrations, click "Connect Meta" | "The user connects their own Meta ad account." |
| 2 | Facebook Login, schermata di consenso con la riga dei permessi | "The user grants access, including ads_management." |
| 3 | Selezione dell'ad account | "The user selects which ad account the app may access." |
| 4 | Board creatività con KPI reali per inserzione | "The app reads ad-level performance: CTR, CPM, ROAS, purchases." |
| 5 | Una creatività sotto soglia, con la motivazione | "The app identifies an underperforming ad and explains why." |
| 6 | La proposta in coda: "Pause this ad" | "The action is proposed, not applied. ads_management is needed here." |
| 7 | L'utente clicca **Approve** | "The user reviews and approves. Nothing happens without approval." |
| 8 | L'inserzione passa a Paused su Meta, verificabile | "Only then the app writes to the ad account." |
| 9 | Stessa cosa per un aumento di budget | "Same flow for a budget change the user chose to apply." |

Durata utile: 2–3 minuti. Meglio corto e completo che lungo e parziale.

### Gotcha operativi (dai giri precedenti)

- La schermata di consenso segue la **lingua dell'account Facebook** → mettere l'account in **English (US)**
  prima di registrare, e aprire l'app con `?lang=en`.
- Se il consenso non ricompare è perché è già stato concesso (reconnect silenzioso). Si forza revocando
  l'app da **facebook.com/settings?tab=business_tools** → Business Integrations
  (NON da "Apps and websites", che è un'altra lista).
- ffmpeg locale (homebrew) è **senza libass/drawtext**: i sottotitoli si generano come PNG
  (ImageMagick `caption:`) e si compongono con `overlay + enable='between(t,s,e)'`.
  Gli script del giro precedente sono riusabili.

---

## 3. Dove si invia

App Dashboard → **App Review → Permissions and Features** → cercare `ads_management` → *Request*.
Se esiste già una richiesta chiusa: **Requests → "Request again"** (crea una bozza, NON invia subito).
Compilare il form per-permesso col testo della sezione 1, caricare lo screencast, poi **Submit**.

---

## 4. Cosa succede nel codice quando arriva

Nulla da riscrivere. `lib/actions/executors/meta.js` sa già fare `pause_campaign`, `resume_campaign`
e `scale_budget`; è dietro il flag **`ACTIONS_META_EXECUTOR=true`**. Restano da aggiungere solo
`create_ad` (pubblicare una creatività in un adset esistente) e `duplicate_adset`.
