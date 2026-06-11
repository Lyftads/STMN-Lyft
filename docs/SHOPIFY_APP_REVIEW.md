# Shopify App Review — pacchetto submission (go-live)

App: **LyftAI** · Client ID `a385cfa5245273f810530fe2e88c46bf` · Partner org Lyft Ads.
Modello: il merchant si registra su **lyftai.io** e collega Shopify dall'interno (OAuth via Nango). App **read-only**.

---

## 0. BLOCCANTI TECNICI (fare PRIMA di sottomettere)

### ⛔ 0.1 — Env `SHOPIFY_APP_API_SECRET` su Vercel (CRITICO)
I webhook GDPR (`/api/shopify/webhooks/compliance`) verificano l'HMAC con `process.env.SHOPIFY_APP_API_SECRET`. Se non è settata → rispondono **401** → la review **fallisce** (Shopify testa i 3 webhook).
- **Azione**: su Vercel impostare `SHOPIFY_APP_API_SECRET` = **Client Secret** dell'app Shopify (lo stesso usato in Nango). Redeploy.
- Verifica veloce dopo il deploy: i webhook devono dare 200 con HMAC valido, 401 con HMAC errato.

### ✅ 0.2 — Webhook GDPR (già implementati, OK)
Endpoint unico per `customers/data_request`, `customers/redact`, `shop/redact`: HMAC sha256/base64, 200 se valido. Config app già punta a `https://stmn-lyft.vercel.app/api/shopify/webhooks/compliance` (per le 3 URL). **NB: l'app_url è `stmn-lyft.vercel.app`** — va bene, ma idealmente allinearlo a `lyftai.io` per coerenza di brand (opzionale).
- Post-launch (non blocca): implementare la cancellazione reale su `shop/redact` (rimuovere `nango_connections.shopify` + creds del tenant dello shop).

### ✅ 0.3 — OAuth/redirect/scope (già OK)
- Redirect URL = `https://api.nango.dev/oauth/callback` ✅
- Scope protetto **all orders** = **Concesso** (auto granted) ✅

### ⚠️ 0.4 — Trimming degli scope (riduce il rischio di rifiuto)
L'app dichiara molti scope. Shopify **boccia chi chiede più del necessario**. Tenere SOLO quelli usati dal codice:
- **`read_orders`, `read_all_orders`** → vendite/ordini, netto resi, AOV, NC/RC, storico per coorti.
- **`read_customers`** → nuovi vs di ritorno, LTV, retention.
- **`read_products`** → performance prodotto (usato in product-costs/product-images/tool prodotti).
- **`read_reports`** → query ShopifyQL (`/api/metrics`).
- **Rimuovere** (se presenti e non usati): read_discounts, read_fulfillments, read_inventory, read_locations, read_marketing_events, read_returns. (I resi arrivano da `totalRefundedSet` degli ordini → read_returns non serve.)
- Aggiornare gli scope sia nell'app config (Versioni) sia su **Nango** in modo che combacino.

### ⚠️ 0.5 — Privacy policy + support (richiesti dalla listing)
- **Privacy policy URL** pubblica (es. `https://lyftai.io/privacy`) — se non esiste, crearla. Deve coprire: dati letti da Shopify, finalità (analytics), conservazione, subprocessori, diritti GDPR, contatto.
- **Support email**: `info@lyftads.agency` (già impostata in Shopify).

---

## 1. RISCHIO PRINCIPALE DA DECIDERE — Billing (Stripe vs Shopify Billing)
LyftAI fa pagare i merchant via **Stripe** su lyftai.io. La policy App Store generalmente richiede di usare la **Shopify Billing API** per addebiti ai merchant.
- **Interpretazione "connector gratis"** (consigliata per partire): pubblicare l'app Shopify come **gratuita** (è solo il connettore dati); l'abbonamento avviene su lyftai.io come SaaS indipendente. Molti tool analytics fanno così. **Rischio**: Shopify può chiedere di usare il Billing API.
- **Se viene contestato** → implementare Shopify Billing API per gli store che arrivano dall'App Store.
- **Decisione da prendere ora**: partiamo come **app gratuita / connector** e, se la review lo richiede, valutiamo il Billing API. (Più veloce per andare live.)

---

## 2. DUE STRADE PER ANDARE LIVE

### Strada A — Custom distribution (PONTE, live in 1 giorno, no review)
Per collegare **subito** i primi store clienti reali senza attendere la review:
- Partners → app → **Distribuzione → Custom distribution** → genera **link di installazione per-store** (per ogni cliente).
- Il merchant apre il link → installa → l'app è autorizzata su quel store.
- ✅ Nessuna review, live immediato. ❌ Manuale per ogni store, niente listing/discovery, limiti sul numero.
- Usala per i **primi 2-3 clienti** mentre la review pubblica è in coda.

### Strada B — Public distribution + App Review (produzione scalabile)
- **Registrazione App Store** (19 $ una-tantum) → Distribuzione **Public** → completare la **scheda app** → **submit**.
- Una volta approvata: il **one-click via Nango funziona su qualsiasi store**, con discovery sull'App Store.
- Tempi review: tipicamente **giorni/settimane**. Richiede anche l'approvazione **Protected Customer Data** (sez. 4).

**Raccomandazione**: avviare **A** (ponte per i primi clienti) e **in parallelo** preparare/sottomettere **B**.

---

## 3. CONTENUTI LISTING (bozza copia-incolla)

**Nome**: LyftAI — AI Analytics & Growth Brain
**Tagline (max ~62 char)**: Tutti i tuoi dati store + AI in un unico cervello operativo.
**Descrizione breve**:
> LyftAI unifica i dati del tuo store in un'unica dashboard guidata dall'AI: vendite al netto dei resi, nuovi vs clienti di ritorno, LTV e coorti, attribuzione e una squadra di agenti AI che risponde alle tue domande e scrive i report. Sola lettura, zero rischi per il tuo store.

**Descrizione lunga (punti)**:
- 📊 KPI vendite precisi: fatturato **netto resi**, AOV, ordini, nuovi/ritorno (NC/RC).
- 🔁 LTV, coorti e retention dei clienti.
- 🎯 Attribuzione e performance (con Meta/GA4/Klaviyo collegabili a parte).
- 🤖 Squadra di **agenti AI** (CEO/CFO/Ads/CRO/Data…) che analizzano e rispondono.
- 📄 Report automatici e export PDF.
- 🔒 **Sola lettura**: LyftAI non modifica nulla nel tuo store.

**Categorie**: Analytics / Reporting · Store management.
**Search terms**: analytics, reporting, KPI, LTV, cohort, AI, ads, attribution.
**Screenshots da preparare** (1280×800, 3-5): Dashboard, KPI Brain, LTV & Coorti, Squadra AI, Report.

---

## 4. PROTECTED CUSTOMER DATA — risposte al questionario
LyftAI accede a `read_customers`/`read_all_orders` (dati cliente protetti). Compilare nel pannello "Protected customer data":
- **Quali dati**: ordini e dati cliente aggregati per analytics (conteggi nuovi/ritorno, valore, coorti). **Niente uso marketing diretto.**
- **Conservazione**: i dati sono letti **live** dalle API Shopify; nessuna PII cliente persistita stabilmente lato LyftAI (eventuale warehouse opzionale conserva solo aggregati/ID, vedi docs/DATA_WAREHOUSE.md, non attivo).
- **Cifratura**: at-rest su Supabase (Postgres cifrato), in-transit TLS. Token OAuth gestiti da **Nango** (cifrati).
- **Accessi**: solo il tenant proprietario vede i propri dati (isolamento multi-tenant, gate `isOwner` in `lib/tenant/credentials.js`).
- **Subprocessori**: Supabase (DB/hosting), Vercel (hosting), Nango (gestione OAuth), provider LLM per le risposte AGGREGATE (non si inviano PII di singoli clienti al modello). Dichiararli.
- **Retention/cancellazione**: webhook `customers/redact` e `shop/redact` gestiti; nessuna PII cliente da cancellare (read-live).
- **Minimizzazione**: richiesti solo gli scope necessari (vedi 0.4).

---

## 5. ISTRUZIONI PER IL REVIEWER (campo "Testing instructions")
> LyftAI is a SaaS that merchants sign up for at https://lyftai.io. After creating an account, the merchant connects Shopify from the in-app onboarding (one-click OAuth, "Collega Shopify"). The app is **read-only** (sales/customer analytics).
>
> Demo access: email `<demo@lyftai.io>` / password `<...>` (oppure forniamo magic link). Steps:
> 1. Log in at https://lyftai.io.
> 2. Go to Onboarding → "Collega Shopify con un clic" → authorize the test store.
> 3. Open Dashboard → sales KPIs (revenue net of refunds, new vs returning customers) load from the store.
>
> Compliance webhooks: POST to /api/shopify/webhooks/compliance, HMAC-verified, return 200.

*(Preparare un account demo dedicato con dati e fornire le credenziali nel form.)*

---

## 6. CHECKLIST FINALE PRIMA DEL SUBMIT
- [ ] `SHOPIFY_APP_API_SECRET` impostata su Vercel (= client secret) + redeploy → webhook 200/401 OK.
- [ ] Scope trimmati al minimo (0.4), allineati app config ↔ Nango.
- [ ] Privacy policy pubblica online (`/privacy`) + support email.
- [ ] Account demo dedicato + credenziali per il reviewer.
- [ ] Screenshots listing (3-5) + icona app.
- [ ] Decisione billing (partiamo "free connector").
- [ ] (Ponte) Custom distribution link per i primi clienti reali.
- [ ] Submit Public + completare Protected Customer Data.
